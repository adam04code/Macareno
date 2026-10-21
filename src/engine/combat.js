'use strict';

const { defaultRng } = require('./rng');
const dice = require('./dice');
const checks = require('./checks');
const { iterativeAttacks, xpForCr } = require('./tables');
const { resolveAttack, applyDamage, featStep } = require('./attacks');
const { resolveSpell, applyAffliction, tickAfflictions, spiritualStrike } = require('./spellEffects');
const { makeEffect, newId } = require('./effects');
const maneuvers = require('./maneuvers');
const spellcasting = require('./spellcasting');
const classAbilities = require('./classAbilities');
const { SPELLS, rangeFeet } = require('../data/spells');
const { CLASSES } = require('../data/classes');
const { ITEMS } = require('../data/equipment');
const { SIZES } = require('../data/core');

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/** PF1 grid distance (diagonals alternate 5/10 ft.). */
function gridDistance(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const diag = Math.min(dx, dy);
  return (Math.max(dx, dy) + Math.floor(diag / 2)) * 5;
}

/**
 * An encounter: initiative order, rounds, the action economy, positions on a
 * 5-ft. grid, attacks of opportunity and the resolution of every combat action.
 * Sides are arbitrary strings ('players', 'monsters', or party ids for PvP).
 */
class Encounter {
  constructor(opts = {}) {
    this.id = opts.id || newId();
    this.roomId = opts.roomId || null;
    this.rng = opts.rng || defaultRng;
    this.combatants = new Map();
    this.order = [];
    this.round = 0;
    this.turnIndex = 0;
    this.state = 'pending';
    this.log = [];
    this.listeners = [];
    this.createdAt = Date.now();
    this.turnStartedAt = null;
    this.defeated = [];
    this.winner = null;
    this.xpAwards = {};
  }

  // ------------------------------------------------------------ setup
  add(creature, side, opts = {}) {
    if (this.combatants.has(creature.id)) return this.combatants.get(creature.id);
    const c = {
      id: creature.id, creature, side, controller: opts.controller || (creature.kind === 'character' ? 'player' : 'ai'),
      position: opts.position || this.defaultPosition(side), init: null, aooUsed: 0, budget: null, actedOnce: false,
      summonRounds: creature.summonRounds || null, ownerId: creature.ownerId || null, joinedRound: this.round, auraApplied: new Set(),
    };
    this.combatants.set(creature.id, c);
    if (this.state === 'active') {
      const r = checks.initiativeRoll(creature, this.rng);
      c.init = r;
      this.insertInOrder(c.id);
      this.emit('join', { actor: c.id, text: `${creature.name} joins the fight (initiative ${r.total}).` });
    }
    return c;
  }

  defaultPosition(side) {
    const sameSide = [...this.combatants.values()].filter((c) => c.side === side).length;
    const sides = [...new Set([...this.combatants.values()].map((c) => c.side))];
    const idx = sides.includes(side) ? sides.indexOf(side) : sides.length;
    return { x: sameSide * 1, y: idx * 6 };
  }

  insertInOrder(id) {
    this.order.push(id);
    this.sortOrder(true);
  }

  sortOrder(keepCurrent) {
    const current = this.order[this.turnIndex];
    this.order.sort((a, b) => {
      const A = this.combatants.get(a).init;
      const B = this.combatants.get(b).init;
      return B.total - A.total || B.tiebreak - A.tiebreak;
    });
    if (keepCurrent && current) this.turnIndex = this.order.indexOf(current);
  }

  start() {
    if (this.state === 'active') return;
    for (const c of this.combatants.values()) {
      c.init = checks.initiativeRoll(c.creature, this.rng);
      // Everyone is flat-footed until their first turn (uncanny dodge negates the AC penalty).
      c.creature.addEffect(makeEffect({ key: 'combat:flat-footed', name: 'Flat-Footed', kind: 'condition', conditions: c.creature.hasFlag('uncannyDodge') || c.creature.hasFlag('neverSurprised') ? [] : ['flat-footed'], flags: ['flatFooted'] }));
    }
    this.order = [...this.combatants.keys()];
    this.sortOrder(false);
    this.state = 'active';
    this.round = 1;
    this.turnIndex = 0;
    this.emit('start', {
      text: `Combat begins! Initiative: ${this.order.map((id) => `${this.combatants.get(id).creature.name} ${this.combatants.get(id).init.total}`).join(', ')}.`,
      order: this.order.map((id) => ({ id, name: this.combatants.get(id).creature.name, initiative: this.combatants.get(id).init.total, side: this.combatants.get(id).side })),
    });
    this.beginTurn();
  }

  // ------------------------------------------------------------ queries
  get(id) {
    const c = this.combatants.get(id);
    if (!c) throw err(`${id} is not in this encounter`, 404);
    return c;
  }
  creatures() { return [...this.combatants.values()].map((c) => c.creature); }
  sideOf(id) { return this.combatants.has(id) ? this.combatants.get(id).side : null; }
  current() { return this.combatants.get(this.order[this.turnIndex]) || null; }
  alliesOf(creature) { const s = this.sideOf(creature.id); return [...this.combatants.values()].filter((c) => c.side === s && c.creature.isAlive()).map((c) => c.creature); }
  enemiesOf(creature) { const s = this.sideOf(creature.id); return [...this.combatants.values()].filter((c) => c.side !== s && c.creature.isAlive() && !c.fled).map((c) => c.creature); }
  distance(a, b) { return gridDistance(this.get(a.id || a).position, this.get(b.id || b).position); }
  within(creature, feet, filter) {
    const pos = this.get(creature.id).position;
    return [...this.combatants.values()].filter((c) => c.creature.isAlive() && gridDistance(pos, c.position) <= feet && (!filter || filter(c.creature))).map((c) => c.creature);
  }

  threatens(attacker, target) {
    const a = this.get(attacker.id);
    if (!attacker.isAlive() || !attacker.canAct() || attacker.hasFlag('noAoO')) return false;
    if (attacker.hasFlag('flatFooted') && !(attacker.hasFeat && attacker.hasFeat('combat-reflexes'))) return false;
    const reach = this.meleeReach(attacker);
    return gridDistance(a.position, this.get(target.id).position) <= reach;
  }

  meleeReach(creature) {
    if (creature.kind === 'monster') return creature.reach();
    const main = creature.attackProfiles().find((p) => p.melee);
    return main ? main.reach : SIZES[creature.size()].reach;
  }

  isFlanked(target, attacker) {
    return this.flankingPartners(target, attacker).length > 0;
  }

  /** Allies that flank `target` together with `attacker` (opposite sides, both threatening). */
  flankingPartners(target, attacker) {
    if (target.hasFlag('improvedUncannyDodge') || target.isImmune(['flanking'])) return [];
    const tp = this.get(target.id).position;
    const ap = this.get(attacker.id).position;
    if (gridDistance(tp, ap) > this.meleeReach(attacker)) return [];
    const out = [];
    for (const ally of this.alliesOf(attacker)) {
      if (ally.id === attacker.id || !this.threatens(ally, target)) continue;
      const bp = this.get(ally.id).position;
      const dot = (ap.x - tp.x) * (bp.x - tp.x) + (ap.y - tp.y) * (bp.y - tp.y);
      if (dot < 0) out.push(ally);
    }
    return out;
  }

  /** Allies' class-feature auras (aura of courage, banner...) refresh on the creature whose turn begins. */
  applyAuras(c) {
    const cr = c.creature;
    cr.removeEffectsWhere((e) => (e.key || '').startsWith('aura:'));
    const { FEATURES } = require('../data/features');
    for (const ally of this.alliesOf(cr)) {
      if (ally.id === cr.id || ally.kind !== 'character' || !ally.isAlive() || ally.hasFlag('unconscious')) continue;
      for (const f of ally.features()) {
        const def = FEATURES[f.key];
        if (!def || !def.aura) continue;
        if (this.distance(ally, cr) > def.aura.radius) continue;
        cr.addEffect(makeEffect({ key: `aura:${f.key}:${ally.id}`, name: `${def.name} (${ally.name})`, kind: 'ability', remaining: 1, modifiers: def.aura.modifiers(ally) }));
      }
    }
  }

  /**
   * Teamwork feats apply when an ally also has the feat (or the attacker has
   * solo tactics, or the ally was granted it by a cavalier's tactician).
   */
  sharesTeamwork(attacker, ally, feat) {
    const has = (c) => (c.hasFeat && c.hasFeat(feat)) || c.effects.some((e) => (e.grantedFeats || []).includes(feat));
    return has(attacker) && (has(ally) || attacker.hasFlag('soloTactics'));
  }

  targetInMelee(target, attacker) {
    return this.alliesOf(attacker).some((a) => a.id !== attacker.id && gridDistance(this.get(a.id).position, this.get(target.id).position) <= 5);
  }

  // ------------------------------------------------------------ events
  emit(type, data = {}) {
    const entry = { id: this.log.length + 1, round: this.round, type, at: Date.now(), ...data };
    this.log.push(entry);
    if (this.log.length > 500) this.log.shift();
    for (const fn of this.listeners) {
      try {
        fn(entry, this);
      } catch (e) {
        // listeners must not break combat
      }
    }
    return entry;
  }

  onEvent(fn) {
    this.listeners.push(fn);
  }

  // ------------------------------------------------------------ turns
  beginTurn() {
    const c = this.current();
    if (!c || this.state !== 'active') return;
    const cr = c.creature;
    c.budget = { standard: 1, move: 1, swift: 1, fiveFoot: true, moved: 0, single: cr.hasFlag('singleAction'), moveOnly: cr.hasFlag('moveOnly'), usedAny: false };
    c.aooUsed = 0;
    this.turnStartedAt = Date.now();
    // Losing flat-footed on first action.
    cr.removeEffectsWhere((e) => e.key === 'combat:flat-footed');
    cr.removeEffectsWhere((e) => e.key === 'combat:total-defense' || e.key === 'combat:charging');
    if (cr.toggles) cr.toggles.fightingDefensively = false;
    cr.touch();
    this.applyAuras(c);
    const events = [];
    // Natural healing for monsters.
    if (cr.naturalHealing) for (const h of cr.naturalHealing()) if (h.healed) events.push(`${cr.name} heals ${h.healed} (${h.type}).`);
    // Effect timers, ongoing damage, recurring saves.
    for (const e of [...cr.effects]) {
      if (e.saveEachRound) {
        const s = checks.savingThrow(cr, e.saveEachRound.type, { dc: e.saveEachRound.dc, rng: this.rng });
        if (s.success) {
          cr.removeEffect(e.id);
          events.push(`${cr.name} shakes off ${e.name} (${s.total} vs DC ${s.dc}).`);
        }
      }
      if (e.ongoing && e.ongoing.save) {
        const s = checks.savingThrow(cr, e.ongoing.save.type, { dc: e.ongoing.save.dc, rng: this.rng });
        if (s.success && e.ongoing.save.effect === 'negates') e.skipOngoing = true;
      }
      if (e.ongoingAttack && e.ongoingAttack.targetId && this.combatants.has(e.ongoingAttack.targetId)) {
        const t = this.get(e.ongoingAttack.targetId).creature;
        if (t.isAlive()) {
          const r = spiritualStrike(cr, t, e.ongoingAttack, this.rng);
          events.push(`${e.name} strikes ${t.name}: ${r.damage ? `${r.damage} damage` : 'miss'}.`);
        }
      }
    }
    const tick = cr.tickEffects(1, this.rng);
    for (const ev of tick.events) events.push(`${cr.name} takes ${ev.damage} ${ev.damageType || ev.type} damage (${ev.effect || ev.type}).`);
    for (const ex of tick.expired) if (ex.kind !== 'condition' || ex.name !== 'Flat-Footed') events.push(`${ex.name} ends on ${cr.name}.`);
    for (const ev of tickAfflictions(cr, this.rng, 'round')) events.push(ev.type === 'affliction' ? `${cr.name} suffers from ${ev.name} (${Object.entries(ev.damage).map(([a, n]) => `${n} ${a}`).join(', ')}).` : `${cr.name} is cured of ${ev.name}.`);
    // Dying creatures bleed out or stabilize.
    if (cr.hpState() === 'dying') {
      if (cr.hasFeat && cr.hasFeat('diehard')) {
        cr.stable = true;
        events.push(`${cr.name} stabilizes (Diehard).`);
      } else if (!(cr.def && cr.def.regeneration)) {
        const s = checks.stabilizeCheck(cr, this.rng);
        if (s.success) {
          cr.stable = true;
          cr.touch();
          events.push(`${cr.name} stabilizes.`);
        } else {
          cr.takeDamage(1, { type: 'bleed' });
          events.push(`${cr.name} is dying (${cr.hp.current} hp).`);
        }
      }
    }
    // Summons expire.
    if (c.summonRounds !== null && c.summonRounds !== undefined) {
      c.summonRounds -= 1;
      if (c.summonRounds <= 0) {
        cr.status = 'dead';
        cr.touch();
        c.fled = true;
        events.push(`${cr.name} returns to its home plane.`);
      }
    }
    this.emit('turn', { actor: c.id, name: cr.name, text: `Round ${this.round}: ${cr.name}'s turn.${events.length ? ` ${events.join(' ')}` : ''}`, events });
    if (this.checkEnd()) return;
    if (!cr.isAlive() || !cr.canAct() || c.fled) {
      if (cr.isAlive() && !c.fled) this.emit('skip', { actor: c.id, text: `${cr.name} cannot act.` });
      return this.endTurn();
    }
    if (cr.hasFlag('confused')) return this.confusedTurn(c);
    if (cr.hasFlag('flee') && this.enemiesOf(cr).length) return this.fleeTurn(c);
    if (c.controller === 'ai') this.runAi(c);
  }

  endTurn(actorId) {
    if (this.state !== 'active') return;
    const c = this.current();
    if (actorId && c && c.id !== actorId) throw err('It is not your turn', 409);
    if (c) {
      for (const e of [...c.creature.effects]) if (e.skipOngoing) delete e.skipOngoing;
    }
    let guard = 0;
    do {
      this.turnIndex += 1;
      if (this.turnIndex >= this.order.length) {
        this.turnIndex = 0;
        this.round += 1;
        this.emit('round', { text: `Round ${this.round} begins.` });
      }
      guard++;
    } while (guard < this.order.length * 2 && this.current() && (this.current().fled || this.current().creature.status === 'dead'));
    if (this.checkEnd()) return;
    this.beginTurn();
  }

  /** Validate turn ownership and spend action budget. */
  spend(c, kind) {
    const b = c.budget;
    if (!b) throw err('Not your turn', 409);
    const deny = () => {
      throw err(`No ${kind} action available this turn`, 409);
    };
    if (b.moveOnly && kind !== 'move' && kind !== 'free' && kind !== 'fiveFoot') throw err('Nauseated: only a single move action is allowed', 409);
    switch (kind) {
      case 'free':
        return;
      case 'swift':
        if (!b.swift) deny();
        b.swift = 0;
        return;
      case 'immediate':
        if (!b.swift) deny();
        b.swift = 0;
        return;
      case 'standard':
        if (!b.standard || (b.single && b.usedAny)) deny();
        b.standard = 0;
        b.usedAny = true;
        if (b.single) b.move = 0;
        return;
      case 'move':
        if (b.move) {
          if (b.single && b.usedAny) deny();
          b.move = 0;
          b.usedAny = true;
          if (b.single) b.standard = 0;
          return;
        }
        // A standard action can be traded for a move action.
        if (b.standard && !b.single) {
          b.standard = 0;
          b.usedAny = true;
          return;
        }
        deny();
        return;
      case 'full':
        if (b.single || b.moveOnly || !b.standard || !b.move || b.moved > 0) {
          if (b.moved > 0 && b.standard && b.move) throw err('Cannot take a full-round action after moving (except a 5-foot step)', 409);
          deny();
        }
        b.standard = 0;
        b.move = 0;
        b.usedAny = true;
        return;
      case 'fiveFoot':
        if (!b.fiveFoot || b.moved > 0) deny();
        b.fiveFoot = false;
        return;
      default:
        throw err(`Unknown action type ${kind}`);
    }
  }

  /** Main entry point for player commands. */
  act(actorId, action) {
    if (this.state !== 'active') throw err('Combat is not active', 409);
    const c = this.get(actorId);
    const cur = this.current();
    const immediate = ['toggle', 'immediate-ability'].includes(action.type);
    if (!immediate && (!cur || cur.id !== actorId)) throw err('It is not your turn', 409);
    if (!c.creature.isAlive()) throw err('You are dead', 409);
    const handler = ACTIONS[action.type];
    if (!handler) throw err(`Unknown combat action: ${action.type}`);
    if (!immediate && !c.creature.canAct() && action.type !== 'end-turn') throw err('You cannot act', 409);
    const result = handler.call(this, c, action);
    this.checkEnd();
    return result;
  }

  // ------------------------------------------------------------ movement
  /**
   * Move toward a point or creature, pathing around enemies (Dijkstra on the
   * 5-ft. grid, diagonals cost 7.5 ft. on average). Allies may be passed
   * through but not ended on. Stops once within `stopAt` feet of the goal.
   */
  moveTowards(c, target, maxFeet, opts = {}) {
    const from = { ...c.position };
    const dest = target.x !== undefined ? target : this.get(target.id).position;
    const stopAt = opts.stopAt ?? 0;
    const key = (p) => `${p.x},${p.y}`;
    const blocked = new Set();
    const occupiedAny = new Set();
    for (const o of this.combatants.values()) {
      if (o.id === c.id || !o.creature.isAlive() || o.fled) continue;
      occupiedAny.add(key(o.position));
      if (o.side !== c.side) blocked.add(key(o.position));
    }
    const span = Math.ceil(maxFeet / 5) + 2;
    const dist = new Map([[key(from), 0]]);
    const prev = new Map();
    const queue = [{ p: from, d: 0 }];
    let best = { p: from, d: 0, goal: gridDistance(from, dest) };
    while (queue.length) {
      queue.sort((a, b) => a.d - b.d);
      const { p, d } = queue.shift();
      if (d > (dist.get(key(p)) ?? Infinity)) continue;
      const gd = gridDistance(p, dest);
      const canEnd = !occupiedAny.has(key(p)) || (p.x === from.x && p.y === from.y);
      if (canEnd && (gd < best.goal || (gd === best.goal && d < best.d))) best = { p, d, goal: gd };
      if (canEnd && gd <= stopAt) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const n = { x: p.x + dx, y: p.y + dy };
        if (Math.abs(n.x - from.x) > span || Math.abs(n.y - from.y) > span) continue;
        if (blocked.has(key(n))) continue;
        const nd = d + (dx && dy ? 7.5 : 5);
        if (nd > maxFeet) continue;
        if (nd < (dist.get(key(n)) ?? Infinity)) {
          dist.set(key(n), nd);
          prev.set(key(n), p);
          queue.push({ p: n, d: nd });
        }
      }
    }
    return { from, to: best.p, moved: Math.round(best.d / 5) * 5, path: this.pathTo(prev, from, best.p) };
  }

  pathTo(prev, from, to) {
    const out = [to];
    let cur = to;
    let guard = 0;
    while ((cur.x !== from.x || cur.y !== from.y) && guard++ < 200) {
      cur = prev.get(`${cur.x},${cur.y}`);
      if (!cur) break;
      out.unshift(cur);
    }
    return out;
  }

  occupied(pos, exceptId) {
    for (const o of this.combatants.values()) if (o.id !== exceptId && o.creature.isAlive() && !o.fled && o.position.x === pos.x && o.position.y === pos.y) return true;
    return false;
  }

  /** Attacks of opportunity triggered by `mover` leaving squares threatened by enemies. */
  provokeMovement(c, from, to, opts = {}) {
    const out = [];
    for (const enemy of this.enemiesOf(c.creature)) {
      const ec = this.get(enemy.id);
      const reach = this.meleeReach(enemy);
      const before = gridDistance(ec.position, from) <= reach;
      if (!before) continue;
      if (opts.firstSquareSafe && gridDistance(ec.position, from) <= reach && gridDistance(ec.position, to) <= reach) continue;
      if (gridDistance(from, to) === 0) continue;
      out.push(...this.attackOfOpportunity(ec, c, { aooMovement: true }));
      if (!c.creature.isAlive()) break;
    }
    return out;
  }

  /** Attacks of opportunity against `c` for a provoking action (casting, ranged attack, standing up...). */
  provokeAction(c, reason) {
    const out = [];
    for (const enemy of this.enemiesOf(c.creature)) {
      if (!this.threatens(enemy, c.creature)) continue;
      out.push(...this.attackOfOpportunity(this.get(enemy.id), c, { reason }));
      if (!c.creature.isAlive()) break;
    }
    return out;
  }

  attackOfOpportunity(ec, targetC, ctx = {}) {
    const enemy = ec.creature;
    const max = 1 + (enemy.hasFeat && enemy.hasFeat('combat-reflexes') ? Math.max(0, enemy.abilityMod('dex')) : 0);
    if (ec.aooUsed >= max || !this.threatens(enemy, targetC.creature)) return [];
    const profile = enemy.attackProfiles().find((p) => p.melee && (p.source !== 'unarmed' || !p.provokes || enemy.kind === 'monster'));
    if (!profile) return [];
    ec.aooUsed += 1;
    const res = resolveAttack(enemy, targetC.creature, profile, { rng: this.rng, aooMovement: ctx.aooMovement, ...this.offenseContext(enemy, targetC.creature, profile) });
    this.processHit(enemy, targetC.creature, profile, res);
    this.emit('aoo', { actor: enemy.id, target: targetC.id, result: res, text: `${enemy.name} makes an attack of opportunity on ${targetC.creature.name}${ctx.reason ? ` (${ctx.reason})` : ''}: ${describeAttack(res)}` });
    return [res];
  }

  // ------------------------------------------------------------ offense helpers
  /** Situational context for an attack from attacker on defender. */
  offenseContext(attacker, defender, profile, opts = {}) {
    const ctx = { rng: this.rng };
    const ac = this.combatants.get(attacker.id);
    const dc = this.combatants.get(defender.id);
    if (ac && dc) {
      ctx.distance = gridDistance(ac.position, dc.position);
      if (profile.melee) {
        const partners = this.flankingPartners(defender, attacker);
        ctx.flanking = partners.length > 0;
        if (partners.some((p) => this.sharesTeamwork(attacker, p, 'outflank'))) ctx.flankBonus = 4;
        if (partners.some((p) => this.sharesTeamwork(attacker, p, 'precise-strike'))) ctx.teamworkPrecision = 1;
      }
      if (profile.ranged) ctx.targetInMelee = this.targetInMelee(defender, attacker);
    }
    if (attacker.toggles && attacker.toggles.powerAttack && attacker.hasFeat && attacker.hasFeat('power-attack')) ctx.powerAttack = true;
    if (attacker.toggles && attacker.toggles.deadlyAim && attacker.hasFeat && attacker.hasFeat('deadly-aim')) ctx.deadlyAim = true;
    // Feint / impromptu sneak attack deny Dex.
    if (attacker.effects.some((e) => e.data && e.data.targetId === defender.id && (e.key || '').startsWith('feint:'))) ctx.feinted = true;
    if (attacker.hasFlag('impromptuSneak')) ctx.feinted = true;
    // Sneak attack.
    const sneak = attacker.kind === 'character' ? attacker.prog('sneakAttack') : attacker.def.sneakAttack || 0;
    if (sneak) {
      const { deniedDexTo } = require('./attacks');
      const eligible = (ctx.flanking || ctx.feinted || deniedDexTo(attacker, defender, ctx)) && (!profile.ranged || (ctx.distance || 0) <= 30);
      if (eligible) ctx.sneakAttackDice = sneak;
    }
    // Duelist precise strike.
    if (attacker.hasFlag('preciseStrike') && profile.melee && attacker.wieldsDuelistWeapon && attacker.wieldsDuelistWeapon()) ctx.preciseStrike = attacker.classLevel('duelist');
    // Smite evil.
    const smite = attacker.effects.find((e) => e.key === 'ability:smite' && e.data.targetId === defender.id);
    if (smite) {
      ctx.smite = true;
      ctx.smiteDamage = smite.data.firstHitDouble && smite.data.hits === 0 ? smite.data.damage * 2 : smite.data.damage;
    }
    if (attacker.hasFlag('weaponMastery')) ctx.weaponMastery = true;
    if (attacker.hasFlag('arcaneStrikeActive')) ctx.arcaneStrike = true;
    return { ...ctx, ...opts };
  }

  /** Post-hit riders: monster specials, stunning fist, death attack, smite bookkeeping, crit feats. */
  processHit(attacker, defender, profile, res) {
    if (!res.hit) {
      attacker.removeEffectsWhere((e) => e.dischargeOnAttack);
      return;
    }
    const notes = [];
    const src = { id: attacker.id, name: attacker.name };
    // Wards end when the warded creature is hit.
    defender.removeEffectsWhere((e) => e.breaksWhenHit);
    // Retribution hex: the attacker takes half the melee damage it deals.
    if (profile.melee && attacker.hasFlag('retribution') && res.damage > 0) {
      const back = applyDamage(attacker, [{ amount: Math.floor(res.damage / 2), type: 'untyped' }]);
      notes.push(`${attacker.name} suffers ${back.total} retribution damage.`);
    }
    for (const e of [...attacker.effects]) {
      if (e.key === 'ability:smite' && e.data.targetId === defender.id) e.data.hits += 1;
      if (e.onHit && (profile.source === 'unarmed' || profile.monk || e.onHitAny)) {
        const oh = e.onHit;
        const s = checks.savingThrow(defender, oh.save, { dc: oh.dc, rng: this.rng });
        if (!s.success) {
          if (oh.slay) {
            defender.die();
            notes.push(`${defender.name} is slain by quivering palm!`);
          } else if (defender.addCondition(oh.condition, oh.rounds, src)) notes.push(`${defender.name} is ${oh.condition}.`);
        } else notes.push(`${defender.name} resists (${s.total} vs DC ${oh.dc}).`);
      }
      if (e.dischargeOnHit || e.dischargeOnAttack) attacker.removeEffect(e.id);
      if (e.breaksOnAttack) attacker.removeEffect(e.id);
    }
    // Death attack (assassin).
    const study = attacker.effects.find((e) => e.key === 'ability:study' && e.data.targetId === defender.id && e.data.rounds >= 3);
    if (study && res.sneakAttack > 0 && defender.isAlive()) {
      const dc = 10 + attacker.classLevel('assassin') + attacker.abilityMod('int');
      const s = checks.savingThrow(defender, 'fort', { dc, rng: this.rng, tags: ['death'] });
      attacker.removeEffect(study.id);
      if (!s.success && !defender.isImmune(['death'])) {
        defender.die();
        notes.push(`Death attack! ${defender.name} dies.`);
      } else notes.push(`${defender.name} survives the death attack.`);
    }
    // Rogue talents.
    if (res.sneakAttack && attacker.hasFlag('bleedingAttack')) defender.addEffect(makeEffect({ key: 'talent:bleeding-attack', name: 'Bleeding attack', bleed: attacker.prog('sneakAttack') }));
    if (res.sneakAttack && attacker.hasFlag('cripplingStrike')) {
      defender.abilityDamage.str = (defender.abilityDamage.str || 0) + 2;
      defender.touch();
    }
    // Critical feats.
    if (res.critical && attacker.hasFeat) {
      const bab = attacker.bab();
      const critSaveDc = 10 + bab;
      if (attacker.hasFeat('bleeding-critical')) defender.addEffect(makeEffect({ key: 'feat:bleeding-critical', name: 'Bleeding Critical', ongoing: { dice: '2d6', type: 'bleed' } }));
      if (attacker.hasFeat('sickening-critical')) defender.addCondition('sickened', 10, src);
      if (attacker.hasFeat('tiring-critical')) defender.addCondition('fatigued', null, src);
      if (attacker.hasFeat('exhausting-critical')) defender.addCondition('exhausted', null, src);
      if (attacker.hasFeat('staggering-critical')) {
        const s = checks.savingThrow(defender, 'fort', { dc: critSaveDc, rng: this.rng });
        defender.addCondition('staggered', s.success ? 1 : dice.total('1d4+1', this.rng), src);
      }
      if (attacker.hasFeat('stunning-critical')) {
        const s = checks.savingThrow(defender, 'fort', { dc: critSaveDc, rng: this.rng });
        defender.addCondition(s.success ? 'staggered' : 'stunned', dice.total('1d4', this.rng), src);
      }
      if (attacker.hasFeat('blinding-critical')) {
        const s = checks.savingThrow(defender, 'fort', { dc: critSaveDc, rng: this.rng });
        defender.addCondition(s.success ? 'dazzled' : 'blinded', s.success ? dice.total('1d4', this.rng) : null, src);
      }
      if (attacker.hasFeat('deafening-critical')) defender.addCondition('deafened', null, src);
    }
    // Fire shield / reflective effects on the defender.
    if (profile.melee) {
      const fs = defender.effects.find((e) => e.reflect);
      if (fs) {
        const r = applyDamage(attacker, [{ amount: dice.total(fs.reflect.dice, this.rng), type: fs.reflect.type }]);
        notes.push(`${attacker.name} is burned by ${fs.name} for ${r.total}.`);
      }
    }
    // Monster on-hit riders.
    for (const oh of profile.onHit || []) notes.push(...this.applyOnHit(attacker, defender, oh, res));
    if (notes.length) res.notes = [...(res.notes || []), ...notes];
  }

  applyOnHit(attacker, defender, oh, res) {
    const notes = [];
    if (!defender.isAlive()) return notes;
    const src = { id: attacker.id, name: attacker.name };
    switch (oh.kind) {
      case 'trip': {
        const r = maneuvers.perform(attacker, defender, 'trip', { rng: this.rng });
        notes.push(r.success ? `${defender.name} is tripped!` : `${defender.name} avoids being tripped.`);
        break;
      }
      case 'grab': {
        const r = maneuvers.perform(attacker, defender, 'grapple', { rng: this.rng });
        notes.push(r.success ? `${attacker.name} grabs ${defender.name}!` : `${defender.name} slips the grab.`);
        break;
      }
      case 'poison':
      case 'disease': {
        const r = applyAffliction(defender, oh, this.rng);
        notes.push(r.immune ? `${defender.name} is immune to ${oh.name}.` : r.resisted ? `${defender.name} resists ${oh.name}.` : `${defender.name} is afflicted by ${oh.name}${Object.keys(r.damage || {}).length ? ` (${Object.entries(r.damage).map(([a, n]) => `${n} ${a}`).join(', ')})` : ''}.`);
        break;
      }
      case 'paralysis': {
        if (oh.immune.includes(defender.race) || (defender.subtypes && oh.immune.some((x) => defender.subtypes().includes(x)))) {
          notes.push(`${defender.name} is immune to the paralysis.`);
          break;
        }
        const s = checks.savingThrow(defender, 'fort', { dc: oh.dc, rng: this.rng, tags: ['paralysis'] });
        if (!s.success && defender.addCondition('paralyzed', dice.total(oh.duration, this.rng), src)) notes.push(`${defender.name} is paralyzed!`);
        break;
      }
      case 'energyDrain': {
        if (defender.isImmune(['energy-drain'])) break;
        defender.negativeLevels.temporary = (defender.negativeLevels.temporary || 0) + oh.levels;
        defender.touch();
        notes.push(`${defender.name} gains ${oh.levels} negative level(s).`);
        if (defender.totalNegativeLevels() >= defender.hitDice()) defender.die();
        break;
      }
      case 'abilityDamage': {
        const n = dice.total(oh.dice, this.rng);
        defender.abilityDamage[oh.ability] = (defender.abilityDamage[oh.ability] || 0) + n;
        defender.touch();
        notes.push(`${defender.name} takes ${n} ${oh.ability.toUpperCase()} damage.`);
        if (oh.ability === 'str' && defender.ability('str') === 0) defender.die();
        break;
      }
      case 'abilityDrain': {
        const s = oh.dc ? checks.savingThrow(defender, 'fort', { dc: oh.dc, rng: this.rng }) : { success: false };
        if (!s.success) {
          const n = dice.total(oh.dice, this.rng);
          defender.abilityDrain[oh.ability] = (defender.abilityDrain[oh.ability] || 0) + n;
          defender.touch();
          notes.push(`${defender.name} suffers ${n} ${oh.ability.toUpperCase()} drain.`);
          if (oh.ability === 'con' && defender.ability('con') === 0) defender.die();
        }
        break;
      }
      case 'energy': {
        const r = applyDamage(defender, [{ amount: dice.total(oh.dice, this.rng), type: oh.type }]);
        if (r.total) notes.push(`+${r.total} ${oh.type}.`);
        res.damage = (res.damage || 0) + r.total;
        break;
      }
      case 'burn': {
        const s = checks.savingThrow(defender, 'ref', { dc: oh.dc, rng: this.rng });
        if (!s.success && !defender.isImmune(['fire'])) {
          defender.addEffect(makeEffect({ key: 'condition:burning', name: 'On fire', remaining: dice.total('1d4', this.rng), ongoing: { dice: oh.dice, type: 'fire' } }));
          notes.push(`${defender.name} catches fire!`);
        }
        break;
      }
      case 'bleed':
        defender.addEffect(makeEffect({ key: `bleed:${attacker.id}`, name: 'Bleeding', bleed: oh.amount }));
        notes.push(`${defender.name} is bleeding.`);
        break;
      case 'condition': {
        let ok = true;
        if (oh.save) ok = !checks.savingThrow(defender, oh.save.type, { dc: oh.save.dc, rng: this.rng }).success;
        if (ok && defender.addCondition(oh.condition, oh.duration ?? null, src)) notes.push(`${defender.name} is ${oh.condition}.`);
        break;
      }
      case 'rust':
        notes.push(`${defender.name}'s metal gear corrodes.`);
        if (defender.inventory) {
          const armor = defender.armorItem();
          if (armor && ['chain-shirt', 'scale-mail', 'chainmail', 'breastplate', 'splint-mail', 'banded-mail', 'half-plate', 'full-plate'].includes(armor.itemId) && !armor.enhancement) {
            defender.inventory = defender.inventory.filter((i) => i.uid !== armor.uid);
            defender.touch();
            notes.push(`${ITEMS[armor.itemId].name} crumbles to rust!`);
          }
        }
        break;
      default:
        break;
    }
    return notes;
  }

  /** Build the list of attacks in a full attack. */
  fullAttackSequence(attacker, opts = {}) {
    const profiles = attacker.attackProfiles();
    const seq = [];
    const hasted = attacker.hasFlag('hasted') || attacker.hasFlag('extraAttack');
    if (attacker.kind === 'monster') {
      const melee = opts.ranged ? profiles.filter((p) => p.ranged) : profiles.filter((p) => p.melee);
      melee.forEach((p) => seq.push({ profile: p, ctx: {} }));
      if (hasted && melee[0]) seq.unshift({ profile: melee[0], ctx: {} });
      return seq;
    }
    const pick = (id) => profiles.find((p) => p.id === id);
    let main = opts.weapon ? pick(opts.weapon) : opts.ranged ? profiles.find((p) => p.ranged) : profiles.find((p) => p.hand === 'mainHand' && p.source === 'weapon') || pick('unarmed');
    if (!main) main = pick('unarmed');
    const bab = attacker.bab();
    const flurry = attacker.hasFlag('flurry') && attacker.hasFlag('monkAcActive') !== false && (main.source === 'unarmed' || main.monk) && !opts.noFlurry && attacker.armorType() === 'none';
    if (flurry) {
      const monk = attacker.classLevel('monk');
      const fb = monk + attacker.classes.filter((c) => c.id !== 'monk').reduce((s, c) => s + require('./tables').BAB[CLASSES[c.id].bab](c.level), 0);
      const its = iterativeAttacks(fb);
      its.forEach((b) => seq.push({ profile: main, ctx: { babOverride: b, flurryPenalty: -2 } }));
      seq.push({ profile: main, ctx: { babOverride: fb, flurryPenalty: -2 } });
      if (monk >= 8) seq.push({ profile: main, ctx: { babOverride: fb - 5, flurryPenalty: -2 } });
      if (monk >= 15) seq.push({ profile: main, ctx: { babOverride: fb - 10, flurryPenalty: -2 } });
      if (attacker.hasFlag('kiExtraAttack')) seq.push({ profile: main, ctx: { babOverride: fb, flurryPenalty: -2 } });
      if (hasted) seq.push({ profile: main, ctx: { babOverride: fb, flurryPenalty: -2 } });
      return seq;
    }
    const off = !opts.ranged && profiles.find((p) => p.hand === 'offHand');
    let mainPen = 0;
    let offPen = 0;
    if (off) {
      const light = off.light;
      const twf = attacker.hasFeat('two-weapon-fighting');
      mainPen = twf ? (light ? -2 : -4) : light ? -4 : -6;
      offPen = twf ? (light ? -2 : -4) : light ? -8 : -10;
    }
    const its = iterativeAttacks(bab);
    const rapid = main.ranged && attacker.toggles.rapidShot && attacker.hasFeat('rapid-shot');
    its.forEach((b, i) => seq.push({ profile: main, ctx: { babOverride: b, twfPenalty: mainPen, rapidShot: rapid, manyshot: i === 0 && main.ranged && attacker.hasFeat('manyshot') } }));
    if (hasted) seq.push({ profile: main, ctx: { babOverride: bab, twfPenalty: mainPen, rapidShot: rapid } });
    if (rapid) seq.push({ profile: main, ctx: { babOverride: bab, rapidShot: true } });
    if (main.speed) seq.push({ profile: main, ctx: { babOverride: bab, twfPenalty: mainPen } });
    if (off) {
      seq.push({ profile: off, ctx: { babOverride: bab, twfPenalty: offPen } });
      if (attacker.hasFeat('improved-two-weapon-fighting')) seq.push({ profile: off, ctx: { babOverride: bab - 5, twfPenalty: offPen } });
      if (attacker.hasFeat('greater-two-weapon-fighting')) seq.push({ profile: off, ctx: { babOverride: bab - 10, twfPenalty: offPen } });
    }
    // Natural attacks alongside weapons are secondary.
    if (!main.ranged) for (const n of profiles.filter((p) => p.natural)) seq.push({ profile: { ...n, primary: main.source === 'unarmed' && !off ? n.primary : false }, ctx: { babOverride: bab, withManufactured: main.source === 'weapon' } });
    return seq;
  }

  /** Execute a sequence of attacks against a target (switching targets if it drops). */
  runAttacks(c, target, seq, extraCtx = {}) {
    const results = [];
    const attacker = c.creature;
    let tgt = target;
    const rends = {};
    for (const step of seq) {
      if (!attacker.isAlive() || !attacker.canAct()) break;
      if (!tgt.isAlive() || tgt.hpState() === 'dying' && extraCtx.switchTargets !== false) {
        const reach = this.meleeReach(attacker);
        const next = this.enemiesOf(attacker).find((e) => e.isAlive() && e.hpState() !== 'dying' && (step.profile.ranged || gridDistance(c.position, this.get(e.id).position) <= reach));
        if (!next) break;
        tgt = next;
      }
      const ctx = { ...this.offenseContext(attacker, tgt, step.profile), ...step.ctx, ...extraCtx };
      const res = resolveAttack(attacker, tgt, step.profile, ctx);
      if (step.ctx.manyshot && res.hit) {
        const extra = resolveAttack(attacker, tgt, step.profile, { ...ctx, autoHit: true });
        res.damage = (res.damage || 0) + (extra.damage || 0);
        res.manyshot = true;
      }
      this.processHit(attacker, tgt, step.profile, res);
      if (res.hit && step.profile.name && /claw/i.test(step.profile.name)) rends[tgt.id] = (rends[tgt.id] || 0) + 1;
      results.push(res);
      this.emit('attack', { actor: attacker.id, target: tgt.id, result: res, text: `${attacker.name} attacks ${tgt.name} with ${step.profile.name}: ${describeAttack(res)}` });
    }
    // Rend: two claw hits on the same target.
    const rend = attacker.kind === 'monster' && attacker.specials().find((s) => s.kind === 'rend');
    if (rend) {
      for (const [id, n] of Object.entries(rends)) {
        if (n >= 2) {
          const t = this.get(id).creature;
          const r = applyDamage(t, [{ amount: dice.total(rend.dice, this.rng), physical: true, damageTypes: ['slashing'] }]);
          this.emit('special', { actor: attacker.id, target: id, text: `${attacker.name} rends ${t.name} for ${r.total} damage!` });
        }
      }
    }
    return results;
  }

  // ------------------------------------------------------------ casting
  castSpell(c, action, opts = {}) {
    const caster = c.creature;
    const spell = SPELLS[action.spell];
    if (!spell) throw err(`Unknown spell ${action.spell}`);
    if (caster.hasFlag('noCast') && !opts.spellLike) throw err('You cannot cast spells right now', 409);
    if (caster.hasFlag('raging') && !opts.spellLike) throw err('Cannot cast spells while raging', 409);
    const isSla = !!opts.spellLike;
    let plan = null;
    let cl;
    let dc;
    let classId = action.classId;
    if (isSla) {
      cl = opts.cl;
      dc = opts.dc;
    } else {
      if (!classId) classId = caster.casterClasses().find((id) => {
        try {
          spellcasting.planCast(caster, id, spell.id, action);
          return true;
        } catch (e) {
          return false;
        }
      });
      if (!classId) throw err(`You cannot cast ${spell.name} right now`);
      plan = spellcasting.planCast(caster, classId, spell.id, action);
      cl = caster.casterLevel(classId);
      // Metamagic does not change save DCs, except Heighten Spell.
      const dcLevel = (action.metamagic || []).includes('heighten-spell') ? plan.level : plan.baseLevel;
      dc = spellcasting.spellDC(caster, spell, dcLevel, CLASSES[classId].spellcasting.ability);
    }
    // Action cost.
    const metamagic = action.metamagic || [];
    let actionType = opts.actionType || castActionType(spell, metamagic);
    if (plan && plan.spontaneousMetamagic && actionType === 'standard') actionType = 'full';
    if (!opts.noActionCost) this.spend(c, actionType);
    const log = { actor: caster.id, spell: spell.id };
    const sc = !isSla && classId ? CLASSES[classId].spellcasting : null;
    // Silence / verbal components (alchemist extracts need none; deaf oracles cast silently).
    if (caster.hasFlag('silenced') && spell.components.includes('V') && !metamagic.includes('silent-spell') && !(sc && sc.noComponents) && !caster.hasFlag('silentCasting')) throw err('You are silenced');
    // Provoke unless casting defensively.
    const threatened = this.enemiesOf(caster).some((e) => this.threatens(e, caster));
    if (threatened && !opts.noProvoke && !isSla) {
      if (action.defensive) {
        const conc = checks.concentrationCheck(caster, { classId, dc: 15 + 2 * plan.level, rng: this.rng, tags: ['defensive'] });
        log.concentration = conc;
        if (!conc.success) {
          spellcasting.consume(caster, plan);
          this.emit('cast', { ...log, text: `${caster.name} fails to cast ${spell.name} defensively (concentration ${conc.total} vs ${conc.dc}).` });
          return { failed: true, concentration: conc };
        }
      } else {
        const aoos = this.provokeAction(c, `casting ${spell.name}`);
        const dealt = aoos.reduce((s, r) => s + (r.damage || 0), 0);
        if (dealt > 0 && caster.isAlive()) {
          const conc = checks.concentrationCheck(caster, { classId, dc: 10 + dealt + (plan ? plan.level : 0), rng: this.rng });
          log.concentration = conc;
          if (!conc.success) {
            if (plan) spellcasting.consume(caster, plan);
            this.emit('cast', { ...log, text: `${caster.name} loses ${spell.name} (concentration ${conc.total} vs ${conc.dc}).` });
            return { failed: true, concentration: conc };
          }
        }
        if (!caster.isAlive()) return { failed: true };
      }
    }
    // Grappled casters must concentrate.
    if (caster.hasFlag('grappled') && !isSla) {
      const conc = checks.concentrationCheck(caster, { classId, dc: 10 + 5 + plan.level, rng: this.rng, tags: ['grappled'] });
      if (!conc.success) {
        spellcasting.consume(caster, plan);
        this.emit('cast', { ...log, text: `${caster.name} cannot concentrate while grappled; ${spell.name} is lost.` });
        return { failed: true, concentration: conc };
      }
    }
    // Arcane spell failure.
    if (!isSla && CLASSES[classId].spellcasting.tradition === 'arcane' && spell.components.includes('S') && !metamagic.includes('still-spell')) {
      const asf = caster.arcaneSpellFailure();
      if (asf > 0) {
        const r = this.rng.die(100);
        if (r <= asf) {
          spellcasting.consume(caster, plan);
          this.emit('cast', { ...log, text: `${caster.name}'s ${spell.name} fizzles (arcane spell failure ${r} <= ${asf}%).` });
          return { failed: true, arcaneSpellFailure: { roll: r, chance: asf } };
        }
      }
    }
    if (plan) spellcasting.consume(caster, plan);
    // Targets. Extracts affect only the drinker (unless the alchemist has Infusion).
    const targets = sc && sc.selfOnly && !caster.hasFlag('infusion') ? [caster] : this.resolveSpellTargets(caster, spell, action, cl);
    const allies = this.alliesOf(caster);
    const enemies = this.enemiesOf(caster);
    const bl = caster.bloodline && caster.bloodline();
    const result = resolveSpell({
      caster, spell, cl, dc, targets, rng: this.rng, metamagic, options: action.options || {}, encounter: this, allies, enemies,
      bloodlineEnergyBonus: bl && bl.arcana && bl.arcana.energyDamagePerDie ? { energy: caster.dragonEnergy(), perDie: bl.arcana.energyDamagePerDie } : null,
      surpriseSneak: caster.hasFlag('surpriseSpells') ? caster.prog('sneakAttack') : 0,
    });
    for (const s of result.summons || []) {
      const sc = this.add(s, c.side, { controller: 'ai' });
      sc.summonRounds = s.summonRounds;
      sc.position = this.moveTowards(c, c.position, 0).to;
      const free = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]].map(([dx, dy]) => ({ x: c.position.x + dx, y: c.position.y + dy })).find((p) => !this.occupied(p, s.id));
      if (free) sc.position = free;
    }
    // Breaking invisibility on hostile action.
    if (targets.some((t) => this.sideOf(t.id) !== c.side)) caster.removeEffectsWhere((e) => e.breaksOnAttack);
    this.emit('cast', { ...log, result, text: `${caster.name} casts ${spell.name}${metamagic.length ? ` (${metamagic.join(', ')})` : ''}. ${describeSpell(result, this)}` });
    return result;
  }

  resolveSpellTargets(caster, spell, action, cl) {
    const range = rangeFeet(spell.range, cl) * ((action.metamagic || []).includes('enlarge-spell') ? 2 : 1);
    const eff = spell.effect || {};
    if (spell.range === 'personal') return [caster];
    if (eff.targets === 'allies') return this.alliesOf(caster).filter((a) => this.distance(caster, a) <= Math.max(range, 50));
    if (eff.targets === 'enemies') return this.enemiesOf(caster).filter((a) => this.distance(caster, a) <= Math.max(range, 50));
    let ids = action.targets || (action.target ? [action.target] : []);
    if (eff.area && !ids.length) {
      // Area spells centred on a target or point: everyone within the area size (Widen doubles it).
      const size = eff.area.size * ((action.metamagic || []).includes('widen-spell') ? 2 : 1);
      const center = action.point || (action.center ? this.get(action.center).position : null);
      if (!center) throw err('Area spells need a point ({x,y}) or a center creature');
      if (gridDistance(this.get(caster.id).position, center) > range && eff.area.shape === 'burst') throw err('Point is out of range');
      return [...this.combatants.values()].filter((o) => o.creature.isAlive() && gridDistance(center, o.position) <= (eff.area.shape === 'burst' ? size : size) && (eff.area.shape !== 'cone' || o.id !== caster.id)).map((o) => o.creature);
    }
    if (!ids.length) {
      const harmful = ['damage', 'condition', 'debuff', 'slay', 'powerWord', 'energyDrain', 'inflict', 'poison', 'colorSpray'].includes(eff.kind);
      if (harmful) {
        const near = this.enemiesOf(caster).sort((a, b) => this.distance(caster, a) - this.distance(caster, b))[0];
        if (!near) throw err('No target');
        ids = [near.id];
      } else ids = [caster.id];
    }
    const out = [];
    for (const id of ids) {
      const t = this.get(id).creature;
      if (range !== Infinity && this.distance(caster, t) > Math.max(range, 5)) throw err(`${t.name} is out of range (${this.distance(caster, t)} ft. > ${range} ft.)`);
      out.push(t);
    }
    return out;
  }

  // ------------------------------------------------------------ end
  checkEnd() {
    if (this.state !== 'active') return true;
    const sides = new Map();
    for (const c of this.combatants.values()) {
      if (c.fled) continue;
      const fighting = c.creature.isAlive() && !['dying', 'stable', 'unconscious'].includes(c.creature.hpState()) && !c.creature.hasFlag('petrified');
      if (!sides.has(c.side)) sides.set(c.side, 0);
      if (fighting && !c.creature.summoned) sides.set(c.side, sides.get(c.side) + 1);
      else if (fighting && c.creature.summoned) sides.set(c.side, sides.get(c.side) + 0.001);
    }
    const alive = [...sides.entries()].filter(([, n]) => n >= 1);
    if (alive.length <= 1) {
      this.finish(alive.length ? alive[0][0] : null);
      return true;
    }
    return false;
  }

  finish(winner) {
    this.state = 'ended';
    this.winner = winner;
    // Award XP: defeated non-summoned enemies, divided among surviving characters on the winning side.
    const defeated = [...this.combatants.values()].filter((c) => c.side !== winner && !c.creature.summoned && !c.creature.isCompanion && (!c.creature.isAlive() || ['dying', 'stable', 'unconscious'].includes(c.creature.hpState()) || c.creature.hasFlag('petrified')));
    this.defeated = defeated.map((c) => c.id);
    const xp = defeated.reduce((s, c) => s + (c.creature.kind === 'monster' ? xpForCr(c.creature.cr()) : xpForCr(Math.max(1, c.creature.hitDice() - 1))), 0);
    const recipients = [...this.combatants.values()].filter((c) => c.side === winner && c.creature.kind === 'character' && c.creature.isAlive());
    const share = recipients.length ? Math.floor(xp / recipients.length) : 0;
    for (const r of recipients) {
      r.creature.xp += share;
      this.xpAwards[r.id] = share;
      r.creature.stats.kills = (r.creature.stats.kills || 0) + defeated.length;
    }
    // Clear combat-only effects.
    for (const c of this.combatants.values()) {
      c.creature.removeEffectsWhere((e) => e.endsWithCombat || (e.key || '').startsWith('combat:') || e.key === 'condition:grappled' || e.key === 'condition:grappling' || (e.key || '').startsWith('feint:'));
      if (c.creature.toggles) c.creature.toggles.fightingDefensively = false;
    }
    this.emit('end', { winner, xp, share, defeated: this.defeated, text: winner ? `Combat ends. Victory for ${winner}.${share ? ` Each survivor earns ${share} XP.` : ''}` : 'Combat ends with no victor.' });
  }

  // ------------------------------------------------------------ AI
  runAi(c) {
    try {
      monsterAi(this, c);
    } catch (e) {
      this.emit('ai-error', { actor: c.id, text: `${c.creature.name} hesitates (${e.message}).` });
    }
    if (this.state === 'active' && this.current() && this.current().id === c.id) this.endTurn();
  }

  confusedTurn(c) {
    const r = this.rng.die(100);
    const cr = c.creature;
    let text;
    if (r <= 25) {
      text = `${cr.name} is confused but acts normally.`;
      this.emit('confused', { actor: c.id, text });
      if (c.controller === 'ai') return this.runAi(c);
      return;
    }
    if (r <= 50) text = `${cr.name} babbles incoherently.`;
    else if (r <= 75) {
      const dmg = dice.total('1d8', this.rng) + cr.abilityMod('str');
      cr.takeDamage(Math.max(1, dmg));
      text = `${cr.name} hurts itself for ${Math.max(1, dmg)} damage.`;
    } else {
      const nearest = [...this.combatants.values()].filter((o) => o.id !== c.id && o.creature.isAlive()).sort((a, b) => gridDistance(c.position, a.position) - gridDistance(c.position, b.position))[0];
      if (nearest && gridDistance(c.position, nearest.position) <= this.meleeReach(cr)) {
        const p = cr.attackProfiles().find((x) => x.melee);
        const res = resolveAttack(cr, nearest.creature, p, this.offenseContext(cr, nearest.creature, p));
        text = `${cr.name} lashes out at ${nearest.creature.name}: ${describeAttack(res)}`;
      } else text = `${cr.name} stumbles about.`;
    }
    this.emit('confused', { actor: c.id, text });
    this.endTurn();
  }

  fleeTurn(c) {
    const cr = c.creature;
    const enemies = this.enemiesOf(cr);
    const nearest = enemies.sort((a, b) => this.distance(cr, a) - this.distance(cr, b))[0];
    const away = { x: c.position.x + Math.sign(c.position.x - this.get(nearest.id).position.x) * 10 || 10, y: c.position.y + Math.sign(c.position.y - this.get(nearest.id).position.y) * 10 };
    const mv = this.moveTowards(c, away, cr.speed() * 2);
    this.provokeMovement(c, mv.from, mv.to, { firstSquareSafe: true });
    c.position = mv.to;
    this.emit('flee', { actor: c.id, text: `${cr.name} flees in terror (${mv.moved} ft.).` });
    if (enemies.every((e) => this.distance(cr, e) > 60)) {
      c.fled = true;
      this.emit('fled', { actor: c.id, text: `${cr.name} escapes the battle.` });
    }
    this.endTurn();
  }

  // ------------------------------------------------------------ output
  snapshot(viewerId) {
    return {
      id: this.id, roomId: this.roomId, state: this.state, round: this.round, winner: this.winner,
      current: this.current() ? this.current().id : null,
      turnStartedAt: this.turnStartedAt,
      combatants: this.order.map((id) => {
        const c = this.combatants.get(id);
        const cr = c.creature;
        const own = viewerId && (viewerId === id || this.sideOf(viewerId) === c.side);
        return {
          id, name: cr.name, kind: cr.kind, side: c.side, initiative: c.init ? c.init.total : null, position: c.position, controller: c.controller, fled: !!c.fled,
          hp: own ? { current: cr.hp.current, max: cr.maxHp(), temp: cr.hp.temp } : { state: cr.hpState(), percent: Math.max(0, Math.round((100 * cr.hp.current) / cr.maxHp())) },
          conditions: [...new Set(cr.effects.flatMap((e) => e.conditions || []))], effects: own ? cr.effects.map((e) => ({ name: e.name, remaining: e.remaining })) : undefined,
          budget: c.budget && this.current() && this.current().id === id ? c.budget : undefined,
        };
      }),
      log: this.log.slice(-30),
      xpAwards: this.xpAwards,
    };
  }
}

function castActionType(spell, metamagic = []) {
  if (metamagic.includes('quicken-spell')) return 'swift';
  const ct = spell.castingTime || 'standard';
  if (ct === 'swift' || ct === 'immediate') return 'swift';
  if (ct === 'standard') return 'standard';
  return 'full';
}

function describeAttack(r) {
  if (r.note && !r.hit) return `${r.note}.`;
  const roll = r.roll !== undefined ? `rolled ${r.roll}+${r.bonus}=${r.total} vs AC ${r.ac}` : '';
  if (!r.hit) return `miss (${roll}).`;
  let s = `${r.critical ? 'CRITICAL HIT' : 'hit'} (${roll}) for ${r.damage || 0} damage`;
  if (r.sneakAttack) s += ` (incl. ${r.sneakAttack} sneak attack)`;
  if (r.targetState && r.targetState !== 'healthy') s += ` — target is ${r.targetState}`;
  s += '.';
  if (r.notes && r.notes.length) s += ` ${r.notes.join(' ')}`;
  return s;
}

function describeSpell(result, enc) {
  const parts = [];
  for (const r of result.results || []) {
    const name = r.name || (enc.combatants.has(r.target) ? enc.get(r.target).creature.name : r.target);
    const bits = [];
    if (r.attack && !r.attack.hit) bits.push('missed');
    if (r.save) bits.push(`save ${r.save.success ? 'succeeded' : 'failed'} (${r.save.total} vs ${r.save.dc})`);
    if (r.damage !== undefined) bits.push(`${r.damage} damage`);
    if (r.healed !== undefined) bits.push(`healed ${r.healed}`);
    if (r.tempHp) bits.push(`${r.tempHp} temp hp`);
    if (r.condition) bits.push(r.condition);
    if (r.conditions) bits.push(r.conditions.join(', '));
    if (r.effect) bits.push(r.effect);
    if (r.slain) bits.push('SLAIN');
    if (r.revived) bits.push('revived');
    if (r.note && !bits.includes(r.note)) bits.push(r.note);
    if (r.dispelled && r.dispelled.length) bits.push(`dispelled ${r.dispelled.join(', ')}`);
    if (r.removed && r.removed.length) bits.push(`removed ${r.removed.join(', ')}`);
    parts.push(`${name}: ${bits.join(', ') || 'affected'}`);
  }
  if (result.notes) parts.push(...result.notes);
  return parts.join('; ');
}

// ---------------------------------------------------------------- actions
const ACTIONS = {
  'end-turn'(c) {
    this.endTurn(c.id);
    return { ended: true };
  },

  toggle(c, a) {
    const t = c.creature.toggles;
    for (const k of ['powerAttack', 'deadlyAim', 'combatExpertise', 'rapidShot', 'fightingDefensively']) if (a[k] !== undefined) t[k] = !!a[k];
    c.creature.touch();
    return { toggles: t };
  },

  attack(c, a) {
    const attacker = c.creature;
    const target = this.get(a.target).creature;
    this.spend(c, 'standard');
    const profiles = attacker.attackProfiles();
    const profile = (a.weapon && profiles.find((p) => p.id === a.weapon)) || (a.ranged ? profiles.find((p) => p.ranged) : profiles.find((p) => p.melee && (p.source !== 'unarmed' || profiles.every((x) => x.source === 'unarmed' || !x.melee))));
    if (!profile) throw err('No usable attack');
    this.checkRange(c, target, profile);
    if (profile.ranged || profile.provokes) this.provokeAction(c, profile.ranged ? 'ranged attack' : 'unarmed attack');
    if (!attacker.isAlive()) return { died: true };
    if (a.fightDefensively) {
      attacker.toggles.fightingDefensively = true;
      attacker.touch();
    }
    const extra = {};
    if (a.vitalStrike && attacker.hasFeat && attacker.hasFeat('vital-strike')) extra.vitalStrike = attacker.hasFeat('greater-vital-strike') ? 4 : attacker.hasFeat('improved-vital-strike') ? 3 : 2;
    const results = this.runAttacks(c, target, [{ profile, ctx: {} }], { ...extra, switchTargets: false });
    if (a.cleave && attacker.hasFeat && attacker.hasFeat('cleave') && results[0] && results[0].hit) {
      attacker.addEffect(makeEffect({ key: 'combat:cleave', name: 'Cleave', remaining: 1, modifiers: [{ target: 'ac', value: -2, type: 'untyped', source: 'Cleave' }] }));
      for (const other of this.enemiesOf(attacker).filter((e) => e.id !== target.id && this.distance(attacker, e) <= this.meleeReach(attacker) && this.distance(target, e) <= 5)) {
        const r = this.runAttacks(c, other, [{ profile, ctx: {} }], { switchTargets: false });
        results.push(...r);
        if (!r[0].hit || !attacker.hasFeat('great-cleave')) break;
      }
    }
    attacker.removeEffectsWhere((e) => e.breaksOnAttack);
    return { results };
  },

  'full-attack'(c, a) {
    const attacker = c.creature;
    const target = this.get(a.target).creature;
    this.spend(c, 'full');
    const seq = this.fullAttackSequence(attacker, { weapon: a.weapon, ranged: a.ranged, noFlurry: a.noFlurry });
    if (!seq.length) throw err('No usable attacks');
    this.checkRange(c, target, seq[0].profile);
    if (seq[0].profile.ranged) this.provokeAction(c, 'ranged attack');
    if (!attacker.isAlive()) return { died: true };
    if (a.fightDefensively) {
      attacker.toggles.fightingDefensively = true;
      attacker.touch();
    }
    const results = this.runAttacks(c, target, seq);
    attacker.removeEffectsWhere((e) => e.breaksOnAttack);
    return { results };
  },

  charge(c, a) {
    const attacker = c.creature;
    const target = this.get(a.target).creature;
    if (attacker.hasFlag('noCharge')) throw err('Cannot charge while fatigued');
    this.spend(c, 'full');
    const reach = this.meleeReach(attacker);
    const dist = this.distance(attacker, target);
    if (dist < 10) throw err('Must move at least 10 ft. to charge');
    if (dist - reach > attacker.speed() * 2) throw err('Target is too far to charge');
    const mv = this.moveTowards(c, target, attacker.speed() * 2, { stopAt: reach });
    this.provokeMovement(c, mv.from, mv.to);
    if (!attacker.isAlive()) return { died: true };
    c.position = mv.to;
    attacker.addEffect(makeEffect({ key: 'combat:charging', name: 'Charging', kind: 'condition', conditions: ['charging'], remaining: null }));
    if (gridDistance(c.position, this.get(target.id).position) > reach) {
      this.emit('charge', { actor: c.id, text: `${attacker.name} charges but cannot reach ${target.name}.` });
      return { reached: false };
    }
    const pounce = attacker.kind === 'monster' && attacker.specials().some((s) => s.kind === 'pounce');
    const seq = pounce ? this.fullAttackSequence(attacker) : [{ profile: attacker.attackProfiles().find((p) => p.melee), ctx: {} }];
    const powerful = attacker.kind === 'monster' && attacker.specials().find((s) => s.kind === 'powerfulCharge');
    if (powerful) seq.splice(0, seq.length, { profile: { ...attacker.attackProfiles().find((p) => p.melee), name: powerful.name, printedBonus: powerful.bonus, damageDice: powerful.damage }, ctx: {} });
    this.emit('charge', { actor: c.id, text: `${attacker.name} charges ${target.name}${pounce ? ' and pounces' : ''}!` });
    const results = this.runAttacks(c, target, seq, { charging: true });
    if (pounce) {
      const rake = attacker.specials().find((s) => s.kind === 'rake');
      if (rake) {
        const p = { ...attacker.attackProfiles()[0], name: 'rake', printedBonus: rake.bonus, damageDice: rake.damage, onHit: [] };
        results.push(...this.runAttacks(c, target, Array.from({ length: rake.count }, () => ({ profile: p, ctx: {} })), { charging: true }));
      }
    }
    return { results };
  },

  move(c, a) {
    const cr = c.creature;
    this.spend(c, 'move');
    const target = a.to || (a.toward ? this.get(a.toward).position : null);
    if (!target) throw err('Specify "to" {x,y} or "toward" creature id');
    let speed = cr.speed();
    if (cr.hasFlag('prone')) speed = 5;
    const mv = this.moveTowards(c, target, speed, { stopAt: a.toward ? this.meleeReach(cr) : 0 });
    this.provokeMovement(c, mv.from, mv.to);
    if (cr.isAlive()) c.position = mv.to;
    c.budget.moved += mv.moved;
    this.emit('move', { actor: c.id, text: `${cr.name} moves ${mv.moved} ft. to (${c.position.x}, ${c.position.y}).`, position: c.position });
    return mv;
  },

  step(c, a) {
    const cr = c.creature;
    if (cr.hasFlag('halfSpeed') && cr.speed() < 10) throw err('Cannot take a 5-foot step');
    this.spend(c, 'fiveFoot');
    const to = a.to;
    if (!to || gridDistance(c.position, to) !== 5) throw err('A 5-foot step must move exactly one square');
    if (this.occupied(to, c.id)) throw err('Square is occupied');
    c.position = { ...to };
    this.emit('move', { actor: c.id, text: `${cr.name} takes a 5-foot step.`, position: c.position });
    return { position: c.position };
  },

  withdraw(c, a) {
    const cr = c.creature;
    this.spend(c, 'full');
    const mv = this.moveTowards(c, a.to, cr.speed() * 2);
    this.provokeMovement(c, mv.from, mv.to, { firstSquareSafe: true });
    if (cr.isAlive()) c.position = mv.to;
    this.emit('move', { actor: c.id, text: `${cr.name} withdraws ${mv.moved} ft.` });
    return mv;
  },

  flee(c) {
    const cr = c.creature;
    this.spend(c, 'full');
    this.provokeAction(c, 'fleeing');
    if (cr.isAlive()) {
      c.fled = true;
      this.emit('fled', { actor: c.id, text: `${cr.name} flees the battle!` });
    }
    return { fled: cr.isAlive() };
  },

  cast(c, a) {
    if (a.spellstrike && c.creature.hasFlag('spellstrike')) return ACTIONS.spellstrike.call(this, c, a);
    return this.castSpell(c, a);
  },

  /** Magus: cast a touch spell and deliver it through a melee weapon attack. */
  spellstrike(c, a) {
    const caster = c.creature;
    const spell = SPELLS[a.spell];
    const eff = spell && spell.effect;
    if (!eff || !['meleeTouch', 'rangedTouch'].includes(eff.attack)) throw err('Spellstrike requires a touch spell');
    if (eff.attack === 'rangedTouch' && !(caster.choices['magus-arcana'] || []).includes('close-range')) throw err('Ranged touch spells need the close range arcana');
    const target = this.get(a.target).creature;
    const profile = caster.attackProfiles().find((p) => p.melee && p.source === 'weapon') || caster.attackProfiles().find((p) => p.melee);
    this.checkRange(c, target, profile);
    const plan = spellcasting.planCast(caster, 'magus', spell.id, a);
    this.spend(c, 'standard');
    spellcasting.consume(caster, plan);
    const res = resolveAttack(caster, target, { ...profile, critRange: Math.min(profile.critRange, 19) }, this.offenseContext(caster, target, profile));
    this.processHit(caster, target, profile, res);
    let spellResult = null;
    if (res.hit) {
      const cl = caster.casterLevel('magus');
      const dc = spellcasting.spellDC(caster, spell, plan.level, 'int');
      spellResult = resolveSpell({ caster, spell: { ...spell, effect: { ...eff, attack: null, autoHit: true } }, cl, dc, targets: [target], rng: this.rng, metamagic: a.metamagic || [], encounter: this });
    }
    this.emit('spellstrike', { actor: c.id, target: target.id, text: `${caster.name} spellstrikes ${target.name} with ${spell.name}: ${describeAttack(res)}${spellResult ? ` ${describeSpell(spellResult, this)}` : ''}` });
    return { attack: res, spell: spellResult };
  },

  /** Magus spell combat: full attack at -2 plus casting a spell (standard action or less). */
  'spell-combat'(c, a) {
    const caster = c.creature;
    if (!caster.hasFlag('spellCombat')) throw err('You do not have spell combat');
    const target = this.get(a.target).creature;
    this.spend(c, 'full');
    const castFirst = a.castFirst !== false;
    const out = {};
    const doCast = () => {
      out.spell = this.castSpell(c, { ...a, target: a.spellTarget || a.target, targets: a.spellTargets }, { noActionCost: true, defensiveBonus: true });
    };
    if (castFirst) doCast();
    const seq = this.fullAttackSequence(caster, { weapon: a.weapon, noFlurry: true }).filter((s) => !s.profile.offHand);
    out.attacks = this.runAttacks(c, target, seq, { spellCombat: true });
    if (!castFirst) doCast();
    return out;
  },

  'spell-like'(c, a) {
    const cr = c.creature;
    if (cr.kind !== 'monster') throw err('Use "ability" for character spell-like abilities');
    const sla = cr.spellLikeAbilities().find((s) => s.spell === a.spell);
    if (!sla) throw err(`${cr.name} has no spell-like ability ${a.spell}`);
    if (sla.remaining <= 0) throw err('No uses remaining');
    cr.slaUses[a.spell] = (cr.slaUses[a.spell] || 0) + 1;
    const spell = SPELLS[a.spell];
    const lvl = Math.min(...Object.values(spell.levels));
    return this.castSpell(c, a, { spellLike: true, cl: sla.cl || cr.hitDice(), dc: sla.dc || 10 + lvl + cr.abilityMod('cha') });
  },

  ability(c, a) {
    const cr = c.creature;
    const ab = classAbilities.getAbility(a.ability);
    if (!ab) throw err(`Unknown ability ${a.ability}`);
    const target = a.target ? this.get(a.target).creature : null;
    const actionType = a.ability === 'lay-on-hands' && (!target || target.id === cr.id) ? 'swift' : ab.action === 'immediate' ? 'swift' : ab.action;
    this.spend(c, actionType);
    let targets = (a.targets || []).map((id) => this.get(id).creature);
    if (ab.target === 'area' && !targets.length) {
      const radius = a.radius || 30;
      const center = target ? this.get(target.id).position : c.position;
      targets = [...this.combatants.values()].filter((o) => o.side !== c.side && o.creature.isAlive() && gridDistance(center, o.position) <= radius).map((o) => o.creature);
    }
    const res = classAbilities.useAbility(cr, a.ability, { target, targets, encounter: this, rng: this.rng, options: a.options || {}, allies: this.alliesOf(cr), enemies: this.enemiesOf(cr) });
    this.emit('ability', { actor: c.id, result: res, text: `${cr.name} uses ${res.name}.${describeAbility(res, this)}` });
    return res;
  },

  'immediate-ability'(c, a) {
    return ACTIONS.ability.call(this, c, a);
  },

  maneuver(c, a) {
    const cr = c.creature;
    const target = this.get(a.target).creature;
    this.spend(c, 'standard');
    if (gridDistance(c.position, this.get(target.id).position) > this.meleeReach(cr)) throw err('Target is out of reach');
    if (maneuvers.provokes(cr, a.maneuver)) this.provokeAction(c, a.maneuver);
    if (!cr.isAlive()) return { died: true };
    const res = maneuvers.perform(cr, target, a.maneuver, { rng: this.rng, condition: a.condition });
    if (res.pushedFeet) {
      const tc = this.get(target.id);
      const dx = Math.sign(tc.position.x - c.position.x);
      const dy = Math.sign(tc.position.y - c.position.y);
      tc.position = { x: tc.position.x + dx * (res.pushedFeet / 5), y: tc.position.y + dy * (res.pushedFeet / 5) };
    }
    this.emit('maneuver', { actor: c.id, target: target.id, result: res, text: `${cr.name} attempts to ${a.maneuver} ${target.name}: ${res.success ? 'success' : 'failure'} (${res.total ?? '-'} vs CMD ${res.cmd ?? '-'})${res.effect ? ` — ${res.effect}` : ''}${res.note ? ` — ${res.note}` : ''}.` });
    return res;
  },

  'maintain-grapple'(c, a) {
    const cr = c.creature;
    const g = cr.effects.find((e) => e.key === 'condition:grappling');
    if (!g) throw err('You are not grappling anyone');
    const target = this.get(g.data.target).creature;
    this.spend(c, cr.hasFeat && cr.hasFeat('greater-grapple') ? 'move' : 'standard');
    const res = maneuvers.maintainGrapple(cr, target, a.mode || 'damage', { rng: this.rng });
    if (res.success && (a.mode || 'damage') === 'damage') {
      const p = cr.attackProfiles().find((x) => x.melee);
      const constrict = cr.kind === 'monster' && cr.specials().find((s) => s.kind === 'constrict');
      const r = resolveAttack(cr, target, p, { ...this.offenseContext(cr, target, p), autoHit: true });
      if (constrict) applyDamage(target, [{ amount: dice.total(constrict.dice, this.rng), physical: true, damageTypes: ['bludgeoning'] }]);
      res.damage = r.damage;
    }
    this.emit('maneuver', { actor: c.id, target: target.id, result: res, text: `${cr.name} maintains the grapple on ${target.name}: ${res.success ? res.effect : 'fails'}${res.damage ? ` (${res.damage} damage)` : ''}.` });
    return res;
  },

  escape(c) {
    const cr = c.creature;
    const g = cr.effects.find((e) => (e.key === 'condition:grappled' || e.key === 'condition:pinned') && e.data && e.data.by);
    if (!g) throw err('You are not grappled');
    this.spend(c, 'standard');
    const grappler = this.get(g.data.by).creature;
    const res = maneuvers.escapeGrapple(cr, grappler, { rng: this.rng });
    this.emit('maneuver', { actor: c.id, text: `${cr.name} tries to escape ${grappler.name}'s grapple: ${res.success ? 'free!' : 'still held'} (${res.total} vs CMD ${res.cmd}).` });
    return res;
  },

  feint(c, a) {
    const cr = c.creature;
    const target = this.get(a.target).creature;
    this.spend(c, cr.hasFeat && cr.hasFeat('improved-feint') ? 'move' : 'standard');
    const res = maneuvers.feint(cr, target, { rng: this.rng });
    this.emit('feint', { actor: c.id, target: target.id, text: `${cr.name} feints at ${target.name}: ${res.success ? 'success' : 'failure'} (Bluff ${res.total} vs ${res.dc}).` });
    return res;
  },

  demoralize(c, a) {
    const cr = c.creature;
    const target = this.get(a.target).creature;
    this.spend(c, 'standard');
    const res = maneuvers.demoralize(cr, target, { rng: this.rng });
    this.emit('demoralize', { actor: c.id, target: target.id, text: `${cr.name} tries to demoralize ${target.name}: ${res.success ? res.effect : 'failure'} (Intimidate ${res.total} vs ${res.dc}).` });
    return res;
  },

  'total-defense'(c) {
    const cr = c.creature;
    this.spend(c, 'standard');
    const acro = cr.skillRanks && cr.skillRanks('acrobatics') >= 3;
    cr.addEffect(makeEffect({ key: 'combat:total-defense', name: 'Total Defense', kind: 'condition', conditions: ['total-defense'], flags: ['fightingDefensively'], modifiers: [{ target: 'ac', value: acro ? 6 : 4, type: 'dodge', source: 'Total defense' }] }));
    this.emit('defend', { actor: c.id, text: `${cr.name} takes a total defense stance.` });
    return { ac: cr.ac().total };
  },

  'stand-up'(c) {
    const cr = c.creature;
    if (!cr.hasCondition('prone')) throw err('You are not prone');
    this.spend(c, 'move');
    this.provokeAction(c, 'standing up');
    if (cr.isAlive()) cr.removeConditions(['prone']);
    this.emit('stand', { actor: c.id, text: `${cr.name} stands up.` });
    return {};
  },

  'coup-de-grace'(c, a) {
    const cr = c.creature;
    const target = this.get(a.target).creature;
    if (!target.hasFlag('helpless')) throw err('Coup de grace requires a helpless target');
    this.spend(c, 'full');
    this.provokeAction(c, 'coup de grace');
    const profile = cr.attackProfiles().find((p) => p.melee);
    const res = resolveAttack(cr, target, profile, { rng: this.rng, autoHit: true, autoConfirm: true, ...this.offenseContext(cr, target, profile) });
    res.critical = true;
    if (target.isAlive() && !target.isImmune(['critical'])) {
      const s = checks.savingThrow(target, 'fort', { dc: 10 + (res.damage || 0), rng: this.rng });
      if (!s.success) target.die();
      res.save = s;
    }
    this.emit('coup-de-grace', { actor: c.id, target: target.id, text: `${cr.name} delivers a coup de grace to ${target.name}: ${res.damage} damage${target.isAlive() ? '' : ' — slain'}.` });
    return res;
  },

  'aid-another'(c, a) {
    const cr = c.creature;
    const enemy = this.get(a.target).creature;
    const ally = this.get(a.ally).creature;
    this.spend(c, 'standard');
    const p = cr.attackProfiles().find((x) => x.melee);
    // Aid another: an attack roll against AC 10.
    const { attackBonus } = require('./attacks');
    const roll = this.rng.die(20);
    const success = roll !== 1 && roll + attackBonus(cr, enemy, p, {}).total >= 10;
    if (success) ally.addEffect(makeEffect({ key: `aid:${cr.id}`, name: 'Aided', remaining: 1, modifiers: [a.mode === 'ac' ? { target: 'ac', value: 2, type: 'circumstance', source: `Aid from ${cr.name}`, onlyIf: [`attacker:${enemy.id}`] } : { target: 'attack', value: 2, type: 'circumstance', source: `Aid from ${cr.name}`, onlyIf: [`id:${enemy.id}`] }] }));
    this.emit('aid', { actor: c.id, text: `${cr.name} aids ${ally.name}: ${success ? 'success' : 'failure'}.` });
    return { success };
  },

  'use-item'(c, a) {
    const cr = c.creature;
    if (!cr.inventory) throw err('No inventory');
    const inst = cr.inventory.find((i) => i.uid === a.item);
    if (!inst) throw err('Item not found');
    const def = ITEMS[inst.itemId];
    const target = a.target ? this.get(a.target).creature : cr;
    if (def.kind === 'potion') {
      this.spend(c, 'standard');
      this.provokeAction(c, 'drinking a potion');
      const res = resolveSpell({ caster: cr, spell: SPELLS[def.spell], cl: def.cl, dc: 0, targets: [cr], rng: this.rng });
      consumeItem(cr, inst);
      this.emit('item', { actor: c.id, text: `${cr.name} drinks ${def.name}. ${describeSpell(res, this)}` });
      return res;
    }
    if (def.kind === 'wand' || def.kind === 'scroll') {
      this.spend(c, 'standard');
      const spell = SPELLS[def.spell];
      const { spellLevelFor } = require('../data/spells');
      const canUse = cr.casterClasses && cr.casterClasses().some((id) => spellLevelFor(spell, CLASSES[id].spellcasting.list) !== null);
      if (!canUse) {
        const umd = checks.skillCheck(cr, 'use-magic-device', { dc: def.kind === 'wand' ? 20 : 20 + def.cl, rng: this.rng });
        if (!umd.success) {
          this.emit('item', { actor: c.id, text: `${cr.name} fails to activate ${def.name} (UMD ${umd.total} vs ${umd.dc}).` });
          return { failed: true, check: umd };
        }
      }
      this.provokeAction(c, `using ${def.name}`);
      const targets = this.resolveSpellTargets(cr, spell, a, def.cl);
      const lvl = Math.min(...Object.values(spell.levels));
      const res = resolveSpell({ caster: cr, spell, cl: def.cl, dc: 10 + lvl + Math.floor(lvl / 2), targets, rng: this.rng, encounter: this, allies: this.alliesOf(cr), enemies: this.enemiesOf(cr) });
      if (def.kind === 'wand') {
        inst.charges = (inst.charges ?? def.charges) - 1;
        if (inst.charges <= 0) consumeItem(cr, inst);
      } else consumeItem(cr, inst);
      cr.touch();
      this.emit('item', { actor: c.id, text: `${cr.name} uses ${def.name}. ${describeSpell(res, this)}` });
      return res;
    }
    if (def.kind === 'splash') {
      this.spend(c, 'standard');
      this.provokeAction(c, 'ranged attack');
      const { touchAttack } = require('./spellEffects');
      const atk = touchAttack(cr, target, 'rangedTouch', this.rng, cr.hasFeat && cr.hasFeat('throw-anything') ? 1 : 0);
      let text = `${cr.name} throws ${def.name} at ${target.name}: `;
      if (atk.hit) {
        if (def.damage) {
          const r = applyDamage(target, [{ amount: dice.total(def.damage, this.rng), type: def.damageType, positiveHurtsLiving: false }]);
          text += `${r.total} ${def.damageType} damage.`;
        }
        if (def.condition) {
          const s = checks.savingThrow(target, def.condition.save.type, { dc: def.condition.save.dc, rng: this.rng });
          if (!s.success) target.addCondition(def.condition.id, dice.total(def.condition.rounds, this.rng), { name: def.name });
          text += s.success ? ' (resisted)' : ` ${def.condition.id}!`;
        }
        if (def.burning) target.addEffect(makeEffect({ key: 'condition:burning', name: 'On fire', remaining: 1, ongoing: { dice: def.burning, type: 'fire' } }));
      } else text += 'miss.';
      consumeItem(cr, inst);
      this.emit('item', { actor: c.id, text });
      return { attack: atk };
    }
    throw err(`${def.name} cannot be used in combat`);
  },

  equip(c, a) {
    const cr = c.creature;
    this.spend(c, cr.hasFeat && cr.hasFeat('quick-draw') ? 'free' : 'move');
    require('./inventory').equip(cr, a.item, a.slot);
    this.emit('equip', { actor: c.id, text: `${cr.name} readies a weapon.` });
    return {};
  },

  delay(c) {
    // Move to the end of the initiative order for this round.
    const idx = this.order.indexOf(c.id);
    this.order.splice(idx, 1);
    this.order.push(c.id);
    c.init = { ...c.init, total: this.combatants.get(this.order[this.order.length - 2]).init.total - 1 };
    this.turnIndex -= 1;
    this.emit('delay', { actor: c.id, text: `${c.creature.name} delays.` });
    this.endTurn();
    return {};
  },

  'heal-check'(c, a) {
    const cr = c.creature;
    const target = this.get(a.target).creature;
    this.spend(c, 'standard');
    const r = checks.skillCheck(cr, 'heal', { dc: 15, rng: this.rng });
    if (r.success && target.hpState() === 'dying') {
      target.stable = true;
      target.touch();
    }
    this.emit('heal', { actor: c.id, text: `${cr.name} tends to ${target.name}: ${r.success ? 'stabilized' : 'failed'} (Heal ${r.total} vs 15).` });
    return r;
  },
};

function describeAbility(res, enc) {
  const bits = [];
  if (res.results) for (const r of res.results) bits.push(`${enc.combatants.has(r.target) ? enc.get(r.target).creature.name : r.target}: ${r.healed !== undefined ? `healed ${r.healed}` : r.damage !== undefined ? `${r.damage} damage` : r.effect || r.note || 'affected'}`);
  if (res.healed !== undefined && !res.results) bits.push(`heals ${res.healed}`);
  if (res.damage !== undefined && !res.results) bits.push(`${res.damage} damage`);
  if (res.condition) bits.push(res.condition);
  if (res.note) bits.push(res.note);
  return bits.length ? ` ${bits.join('; ')}.` : '';
}

Encounter.prototype.checkRange = function checkRange(c, target, profile) {
  const d = gridDistance(c.position, this.get(target.id).position);
  if (profile.melee && d > profile.reach && d > this.meleeReach(c.creature)) throw err(`${target.name} is out of reach (${d} ft.)`);
  if (profile.ranged) {
    const max = (profile.rangeIncrement || 10) * (profile.thrown ? 5 : 10);
    if (d > max) throw err(`${target.name} is beyond maximum range (${max} ft.)`);
  }
};

function consumeItem(cr, inst) {
  inst.qty = (inst.qty || 1) - 1;
  if (inst.qty <= 0) cr.inventory = cr.inventory.filter((i) => i.uid !== inst.uid);
  cr.touch();
}

// ---------------------------------------------------------------- monster AI
function monsterAi(enc, c) {
  const me = c.creature;
  const enemies = enc.enemiesOf(me).filter((e) => !['dying', 'stable', 'dead'].includes(e.hpState()));
  if (!enemies.length) return;
  enemies.sort((a, b) => enc.distance(me, a) - enc.distance(me, b) || a.hp.current - b.hp.current);
  const nearest = enemies[0];
  const dist = enc.distance(me, nearest);
  const reach = enc.meleeReach(me);
  const rng = enc.rng;

  // Grappling: keep squeezing.
  if (me.effects.some((e) => e.key === 'condition:grappling')) {
    try {
      return ACTIONS['maintain-grapple'].call(enc, c, { mode: 'damage' });
    } catch (e) {
      // fall through
    }
  }
  if (me.hasFlag('grappled') && me.effects.some((e) => e.key === 'condition:grappled')) {
    if (rng.die(2) === 1) return ACTIONS.escape.call(enc, c, {});
  }
  if (me.hasCondition('prone')) ACTIONS['stand-up'].call(enc, c, {});
  if (!me.isAlive()) return;

  if (me.kind === 'monster') {
    // Auras (stench, frightful presence, songs).
    for (const s of me.specials().filter((x) => x.kind === 'aura')) {
      for (const e of enc.within(me, s.radius, (x) => enc.sideOf(x.id) !== c.side)) {
        if (s.once && c.auraApplied.has(`${s.name}:${e.id}`)) continue;
        c.auraApplied.add(`${s.name}:${e.id}`);
        if (e.isImmune(s.tags || [])) continue;
        const sv = checks.savingThrow(e, s.save.type, { dc: s.save.dc, rng, tags: s.tags || [] });
        if (!sv.success && e.addCondition(s.condition, dice.total(String(s.duration), rng), { id: me.id, name: s.name })) enc.emit('special', { actor: me.id, target: e.id, text: `${e.name} is ${s.condition} by ${me.name}'s ${s.name}!` });
      }
    }
    // Gaze attacks.
    const gaze = me.specials().find((x) => x.kind === 'gaze');
    if (gaze) {
      const victim = enemies.find((e) => enc.distance(me, e) <= gaze.range && !e.hasFlag('blind'));
      if (victim && rng.die(2) === 1) {
        const sv = checks.savingThrow(victim, gaze.save.type, { dc: gaze.save.dc, rng });
        if (!sv.success) {
          victim.addCondition(gaze.condition, null, { id: me.id, name: gaze.name });
          enc.emit('special', { actor: me.id, target: victim.id, text: `${victim.name} meets ${me.name}'s ${gaze.name} and is ${gaze.condition}!` });
        } else enc.emit('special', { actor: me.id, target: victim.id, text: `${victim.name} resists ${me.name}'s ${gaze.name}.` });
      }
    }
    // Breath weapon.
    const breath = me.specials().find((x) => x.kind === 'breath');
    if (breath && !(me.cooldowns.breath > enc.round)) {
      const inArea = enemies.filter((e) => enc.distance(me, e) <= breath.size);
      if (inArea.length >= 2 || (inArea.length && rng.die(3) === 1)) {
        enc.spend(c, 'standard');
        const amt = dice.total(breath.dice, rng);
        const parts = [];
        for (const t of inArea) {
          const sv = checks.savingThrow(t, breath.save.type, { dc: breath.save.dc, rng, tags: [breath.energy] });
          let d = sv.success ? Math.floor(amt / 2) : amt;
          if (sv.success && t.hasFlag('evasion')) d = 0;
          if (!sv.success && t.hasFlag('improvedEvasion')) d = Math.floor(amt / 2);
          const r = applyDamage(t, [{ amount: d, type: breath.energy }]);
          parts.push(`${t.name} ${r.total}${sv.success ? ' (saved)' : ''}`);
        }
        me.cooldowns.breath = breath.recharge === 'day' ? Infinity : enc.round + 1 + dice.total(breath.recharge, rng);
        enc.emit('special', { actor: me.id, text: `${me.name} unleashes its ${breath.name} (${breath.size}-ft. ${breath.shape}, ${amt} ${breath.energy})! ${parts.join(', ')}.` });
        return;
      }
    }
    // Spell-like abilities.
    const slas = me.spellLikeAbilities().filter((s) => s.remaining > 0 && SPELLS[s.spell] && ['damage', 'condition', 'debuff', 'inflict'].includes(SPELLS[s.spell].effect.kind));
    if (slas.length && rng.die(3) === 1) {
      const s = rng.pick(slas);
      try {
        return ACTIONS['spell-like'].call(enc, c, { spell: s.spell, target: nearest.id, center: nearest.id });
      } catch (e) {
        // fall back to attacking
      }
    }
    const buff = me.spellLikeAbilities().find((s) => s.remaining > 0 && SPELLS[s.spell] && ['buff'].includes(SPELLS[s.spell].effect.kind) && !me.effects.some((e) => e.key === `spell:${s.spell}`));
    if (buff && enc.round === 1 && dist > reach) {
      try {
        return ACTIONS['spell-like'].call(enc, c, { spell: buff.spell });
      } catch (e) {
        // ignore
      }
    }
  } else {
    // AI-controlled characters (afk players, NPC companions): heal if low, else fight.
    if (me.hp.current < me.maxHp() / 3) {
      const potion = (me.inventory || []).find((i) => (ITEMS[i.itemId] || {}).kind === 'potion' && /cure/.test(i.itemId));
      if (potion) return ACTIONS['use-item'].call(enc, c, { item: potion.uid });
    }
  }

  // Intelligent monsters flee when badly hurt.
  if (me.kind === 'monster' && !me.summoned && me.ability('int') >= 6 && me.hp.current < me.maxHp() * 0.15 && rng.die(4) === 1) return ACTIONS.flee.call(enc, c, {});

  const profiles = me.attackProfiles();
  const hasRanged = profiles.some((p) => p.ranged);
  const hasMelee = profiles.some((p) => p.melee);
  if (dist <= reach && hasMelee) return ACTIONS['full-attack'].call(enc, c, { target: nearest.id });
  if (hasRanged && (!hasMelee || dist > me.speed() * 2)) {
    const rp = profiles.find((p) => p.ranged);
    if (dist <= (rp.rangeIncrement || 30) * 5) return ACTIONS['full-attack'].call(enc, c, { target: nearest.id, ranged: true });
  }
  if (!hasMelee) return;
  if (dist >= 10 && dist - reach <= me.speed() * 2 && !me.hasFlag('noCharge') && !me.hasFlag('singleAction')) {
    try {
      return ACTIONS.charge.call(enc, c, { target: nearest.id });
    } catch (e) {
      // blocked path: move instead
    }
  }
  ACTIONS.move.call(enc, c, { toward: nearest.id });
  if (!me.isAlive()) return;
  if (enc.distance(me, nearest) <= reach && c.budget.standard) ACTIONS.attack.call(enc, c, { target: nearest.id });
}

module.exports = { Encounter, gridDistance, ACTIONS, describeAttack, describeSpell, castActionType };
