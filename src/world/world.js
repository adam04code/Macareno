'use strict';

const { EventEmitter } = require('events');
const { Character } = require('../engine/character');
const { Monster } = require('../engine/monster');
const { Encounter } = require('../engine/combat');
const { companionFor, saveCompanion } = require('../engine/companion');
const { defaultRng } = require('../engine/rng');
const dice = require('../engine/dice');
const checks = require('../engine/checks');
const T = require('../engine/tables');
const inventory = require('../engine/inventory');
const spellcasting = require('../engine/spellcasting');
const classAbilities = require('../engine/classAbilities');
const { resolveSpell, tickAfflictions } = require('../engine/spellEffects');
const { newId } = require('../engine/effects');
const { revive } = require('./store');
const { ITEMS, itemPrice } = require('../data/equipment');
const { SPELLS, spellLevelFor } = require('../data/spells');
const { CLASSES } = require('../data/classes');
const { SKILLS, ABILITIES } = require('../data/core');
const WORLD = require('../data/world');

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up', northeast: 'southwest', southwest: 'northeast', northwest: 'southeast', southeast: 'northwest' };
const TREASURE_MULT = { none: 0, incidental: 0.5, standard: 1, double: 2, triple: 3 };

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/**
 * The live game world. Owns rooms, spawned monsters, online characters,
 * parties and encounters, and drives the clock. Everything a client does
 * goes through a World method (via REST, WebSocket or the text command
 * interpreter), and everything a client sees arrives as an event.
 */
class World extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.store = opts.store;
    this.rng = opts.rng || defaultRng;
    this.config = {
      turnTimeoutMs: 60000, roundMs: 6000, restSeconds: 10, gameMinutesPerSecond: 1, lootFactor: 1, autosaveMs: 5000,
      monstersUseDyingRules: false, hpMethod: 'average', ...opts.config,
    };
    Monster.useDyingRules = this.config.monstersUseDyingRules;
    this.rooms = new Map();
    this.zones = WORLD.ZONES;
    this.online = new Map(); // characterId -> session
    this.characters = new Map(); // characterId -> Character (loaded)
    this.encounters = new Map();
    this.parties = new Map();
    this.partyOf = new Map();
    this.invites = new Map();
    this.dirty = new Set();
    this.clock = { minutes: 8 * 60, day: 1 };
    this.seq = 0;
    this.loadRooms(opts.rooms || WORLD.ROOMS);
    this.loadState();
    for (const room of this.rooms.values()) this.populate(room, true);
  }

  // ------------------------------------------------------------ rooms
  loadRooms(defs) {
    for (const [id, def] of Object.entries(defs)) {
      this.rooms.set(id, {
        id, ...def, flags: def.flags || [], exits: def.exits || {}, spawns: def.spawns || [], npcs: def.npcs || [], features: def.features || [],
        monsters: new Map(), items: [], spawnState: (def.spawns || []).map(() => ({ ids: [], nextAt: 0 })), usedFeatures: new Set(), encounterId: null,
      });
    }
    for (const r of this.rooms.values()) for (const [dir, to] of Object.entries(r.exits)) if (!this.rooms.has(to)) throw new Error(`Room ${r.id} exit ${dir} -> unknown room ${to}`);
  }

  room(id) {
    const r = this.rooms.get(id);
    if (!r) throw err(`Unknown room ${id}`, 404);
    return r;
  }

  loadState() {
    if (!this.store) return;
    const st = this.store.get('world', 'state');
    if (!st) return;
    this.clock = st.clock || this.clock;
    for (const [roomId, rs] of Object.entries(st.rooms || {})) {
      const r = this.rooms.get(roomId);
      if (!r) continue;
      r.items = rs.items || [];
      r.usedFeatures = new Set(rs.usedFeatures || []);
    }
  }

  saveState() {
    if (!this.store) return;
    const rooms = {};
    for (const r of this.rooms.values()) if (r.items.length || r.usedFeatures.size) rooms[r.id] = { items: r.items, usedFeatures: [...r.usedFeatures] };
    this.store.put('world', 'state', { clock: this.clock, rooms });
  }

  /** Spawn monsters for every spawn entry that is due. */
  populate(room, initial = false) {
    const now = Date.now();
    room.spawns.forEach((sp, i) => {
      const st = room.spawnState[i];
      st.ids = st.ids.filter((id) => room.monsters.has(id) && room.monsters.get(id).isAlive());
      if (st.ids.length || (!initial && now < st.nextAt)) return;
      if (room.encounterId) return;
      if (st.nextAt === 0 || now >= st.nextAt || initial) {
        if (sp.chance && this.rng.die(100) > sp.chance) {
          st.nextAt = now + (sp.respawn || 300) * 1000;
          return;
        }
        const n = typeof sp.count === 'number' ? sp.count : dice.total(sp.count, this.rng);
        for (let k = 0; k < n; k++) {
          const m = new Monster({ templateId: sp.monster }, { rollHp: true, rng: this.rng });
          m.aggressive = !!sp.aggressive;
          m.spawnIndex = i;
          room.monsters.set(m.id, m);
          st.ids.push(m.id);
        }
        if (!initial) this.broadcastRoom(room.id, { type: 'spawn', text: `${n > 1 ? `${n} ${room.monsters.get(st.ids[0]).name}s appear` : `A ${room.monsters.get(st.ids[0]).name} appears`}.` });
      }
    });
  }

  // ------------------------------------------------------------ characters & sessions
  loadCharacter(id) {
    if (this.characters.has(id)) return this.characters.get(id);
    const doc = this.store && this.store.get('characters', id);
    if (!doc) throw err('Character not found', 404);
    const c = new Character(revive(doc));
    this.characters.set(id, c);
    return c;
  }

  saveCharacter(char) {
    if (this.store) this.store.put('characters', char.id, char.toJSON());
    this.dirty.delete(char.id);
  }

  markDirty(char) {
    this.dirty.add(char.id);
  }

  flush() {
    for (const id of [...this.dirty]) {
      const c = this.characters.get(id);
      if (c) this.saveCharacter(c);
    }
    this.saveState();
  }

  addCharacter(char) {
    this.characters.set(char.id, char);
    char.location = char.location || { roomId: WORLD.START_ROOM };
    this.saveCharacter(char);
  }

  deleteCharacter(id) {
    if (this.online.has(id)) this.leave(id);
    this.characters.delete(id);
    if (this.store) this.store.delete('characters', id);
  }

  session(charId) {
    const s = this.online.get(charId);
    if (!s) throw err('Character is not in the world (enter first)', 409);
    return s;
  }

  enter(charId, accountId) {
    const char = this.loadCharacter(charId);
    if (accountId && char.accountId !== accountId) throw err('Not your character', 403);
    let s = this.online.get(charId);
    if (!s) {
      s = { charId, accountId: char.accountId, queue: [], lastSeq: 0, subscribers: new Set(), enteredAt: Date.now(), resting: null };
      this.online.set(charId, s);
      if (!char.location || !this.rooms.has(char.location.roomId)) char.location = { roomId: WORLD.START_ROOM, visited: [WORLD.START_ROOM] };
      this.broadcastRoom(char.location.roomId, { type: 'arrive', text: `${char.name} appears.` }, charId);
    }
    this.send(charId, { type: 'look', text: this.describeRoom(char), data: this.roomView(char) });
    return { character: char.id, room: char.location.roomId };
  }

  leave(charId) {
    const s = this.online.get(charId);
    if (!s) return;
    const char = this.characters.get(charId);
    const enc = this.encounterOf(charId);
    if (enc && enc.state === 'active') {
      // Disconnected characters are run by the AI until the fight ends.
      enc.get(charId).controller = 'ai';
    }
    this.leaveParty(charId, true);
    this.online.delete(charId);
    if (char) {
      this.broadcastRoom(char.location.roomId, { type: 'depart', text: `${char.name} vanishes.` }, charId);
      this.saveCharacter(char);
    }
  }

  /** Deliver an event to a character's queue and live subscribers. */
  send(charId, event) {
    const s = this.online.get(charId);
    if (!s) return;
    const e = { seq: ++this.seq, at: Date.now(), ...event };
    s.queue.push(e);
    if (s.queue.length > 300) s.queue.shift();
    for (const fn of s.subscribers) {
      try {
        fn(e);
      } catch (x) {
        // subscriber errors are ignored
      }
    }
    this.emit('event', charId, e);
  }

  subscribe(charId, fn) {
    const s = this.session(charId);
    s.subscribers.add(fn);
    return () => s.subscribers.delete(fn);
  }

  events(charId, since = 0) {
    const s = this.session(charId);
    return s.queue.filter((e) => e.seq > since);
  }

  charactersIn(roomId) {
    return [...this.online.keys()].map((id) => this.characters.get(id)).filter((c) => c && c.location.roomId === roomId);
  }

  broadcastRoom(roomId, event, exceptId) {
    for (const c of this.charactersIn(roomId)) if (c.id !== exceptId) this.send(c.id, event);
  }

  findCharacterByName(name) {
    const n = String(name).toLowerCase();
    for (const id of this.online.keys()) {
      const c = this.characters.get(id);
      if (c && c.name.toLowerCase() === n) return c;
    }
    return null;
  }

  // ------------------------------------------------------------ views
  roomView(char) {
    const room = this.room(char.location.roomId);
    return {
      id: room.id, name: room.name, zone: room.zone, zoneName: (this.zones[room.zone] || {}).name, description: room.description,
      exits: Object.keys(room.exits), flags: room.flags, terrain: room.terrain, light: room.light,
      characters: this.charactersIn(room.id).filter((c) => c.id !== char.id).map((c) => ({ id: c.id, name: c.name, level: c.hitDice(), race: c.race, state: c.hpState() })),
      monsters: [...room.monsters.values()].filter((m) => m.isAlive()).map((m) => ({ id: m.id, name: m.name, templateId: m.templateId, state: m.hpState(), aggressive: !!m.aggressive })),
      npcs: room.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role })),
      items: room.items.map((i) => ({ uid: i.uid, name: inventory.displayName(i), qty: i.qty })),
      features: room.features.filter((f) => !(f.once && room.usedFeatures.has(f.id))).map((f) => ({ id: f.id, name: f.name, verb: f.verb, skill: f.skill })),
      encounter: room.encounterId,
      time: this.timeOfDay(),
    };
  }

  describeRoom(char) {
    const v = this.roomView(char);
    const lines = [`== ${v.name} (${v.zoneName}) ==`, v.description];
    if (v.npcs.length) lines.push(`People here: ${v.npcs.map((n) => `${n.name} (${n.role})`).join(', ')}.`);
    if (v.characters.length) lines.push(`Adventurers: ${v.characters.map((c) => `${c.name} (level ${c.level})`).join(', ')}.`);
    if (v.monsters.length) lines.push(`Creatures: ${v.monsters.map((m) => m.name).join(', ')}.`);
    if (v.items.length) lines.push(`On the ground: ${v.items.map((i) => i.name).join(', ')}.`);
    if (v.features.length) lines.push(`You notice: ${v.features.map((f) => `${f.name} (${f.verb})`).join(', ')}.`);
    lines.push(`Exits: ${v.exits.join(', ') || 'none'}.`);
    return lines.join('\n');
  }

  timeOfDay() {
    const h = Math.floor(this.clock.minutes / 60) % 24;
    const m = this.clock.minutes % 60;
    return { day: this.clock.day, hour: h, minute: m, period: h >= 6 && h < 18 ? 'day' : 'night', text: `Day ${this.clock.day}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
  }

  // ------------------------------------------------------------ movement
  requireFree(char) {
    if (char.status === 'dead') throw err('You are dead. Use "respawn" or wait for a resurrection.', 409);
    if (this.encounterOf(char.id) && this.encounterOf(char.id).state === 'active') throw err('You are in combat!', 409);
    const s = this.online.get(char.id);
    if (s && s.resting) throw err('You are resting.', 409);
    if (!char.canAct()) throw err('You cannot act right now.', 409);
  }

  move(charId, dir) {
    const char = this.loadCharacter(charId);
    this.requireFree(char);
    if (char.hasFlag('noMove') || char.hpState() === 'disabled' && false) throw err('You cannot move.');
    const room = this.room(char.location.roomId);
    const d = expandDir(dir);
    const to = room.exits[d];
    if (!to) throw err(`You cannot go ${dir} from here.`);
    if (char.load() === 'heavy' && char.speed() < 5) throw err('You are carrying too much to move.');
    this.broadcastRoom(room.id, { type: 'depart', text: `${char.name} leaves ${d}.` }, charId);
    char.location = { roomId: to, visited: [...new Set([...(char.location.visited || []), to])].slice(-200) };
    this.markDirty(char);
    const next = this.room(to);
    this.broadcastRoom(to, { type: 'arrive', text: `${char.name} arrives from the ${OPPOSITE[d] || 'somewhere'}.` }, charId);
    this.send(charId, { type: 'look', text: this.describeRoom(char), data: this.roomView(char) });
    // Party followers.
    const party = this.partyOf.get(charId) && this.parties.get(this.partyOf.get(charId));
    if (party && party.leader === charId) {
      for (const mid of party.members) {
        if (mid === charId) continue;
        const m = this.characters.get(mid);
        if (m && m.location.roomId === room.id && this.online.get(mid) && this.online.get(mid).follow) {
          try {
            this.move(mid, d);
          } catch (e) {
            this.send(mid, { type: 'error', text: `You could not follow: ${e.message}` });
          }
        }
      }
    }
    this.checkAggro(char, next);
    return this.roomView(char);
  }

  /** Aggressive monsters attack characters who enter, unless they sneak past. */
  checkAggro(char, room) {
    if (room.flags.includes('safe')) return;
    const hostile = [...room.monsters.values()].filter((m) => m.isAlive() && m.aggressive);
    if (!hostile.length) return;
    if (room.encounterId && this.encounters.get(room.encounterId) && this.encounters.get(room.encounterId).state === 'active') {
      this.joinEncounter(char, this.encounters.get(room.encounterId), 'players');
      return;
    }
    const s = this.online.get(char.id);
    if (s && s.sneaking) {
      const stealth = checks.skillCheck(char, 'stealth', { rng: this.rng });
      const best = hostile.reduce((b, m) => Math.max(b, m.skill('perception').total), -99);
      const spot = this.rng.die(20) + best;
      if (stealth.total >= spot) {
        this.send(char.id, { type: 'stealth', text: `You slip in unnoticed (Stealth ${stealth.total} vs Perception ${spot}).`, data: { unnoticed: true } });
        s.unnoticedIn = room.id;
        return;
      }
      this.send(char.id, { type: 'stealth', text: `You are spotted! (Stealth ${stealth.total} vs Perception ${spot})` });
    }
    this.startEncounter(room, char, hostile, { ambushedBy: 'monsters' });
  }

  // ------------------------------------------------------------ encounters
  encounterOf(charId) {
    for (const e of this.encounters.values()) if (e.combatants.has(charId) && e.state === 'active') return e;
    return null;
  }

  startEncounter(room, initiator, monsters, opts = {}) {
    if (room.flags.includes('safe') && !opts.pvp) throw err('Violence is forbidden here.');
    const enc = new Encounter({ roomId: room.id, rng: this.rng });
    this.encounters.set(enc.id, enc);
    room.encounterId = enc.id;
    enc.onEvent((e) => this.onEncounterEvent(enc, e));
    const party = this.partyMembersInRoom(initiator, room.id);
    party.forEach((c, i) => enc.add(c, opts.pvp ? `pvp:${initiator.id}` : 'players', { position: { x: i * 2, y: 0 }, controller: this.online.has(c.id) ? 'player' : 'ai' }));
    party.forEach((c, i) => this.addCompanion(enc, c, opts.pvp ? `pvp:${initiator.id}` : 'players', { x: i * 2 + 1, y: 0 }));
    monsters.forEach((m, i) => enc.add(m, opts.pvp ? `pvp:${m.id}` : 'monsters', { position: { x: i * 2, y: (m.def ? 4 : 4) + (i % 2) }, controller: m.kind === 'character' && this.online.has(m.id) ? 'player' : 'ai' }));
    // Surprise: an unnoticed party gets the first strike; monsters start flat-footed.
    const s = this.online.get(initiator.id);
    const surprise = s && s.unnoticedIn === room.id && !opts.ambushedBy;
    enc.start();
    if (surprise) {
      for (const m of monsters) m.addEffect({ id: newId(), key: 'combat:flat-footed', name: 'Surprised', kind: 'condition', remaining: null, modifiers: [], flags: ['flatFooted'], conditions: ['flat-footed'], tags: [] });
      this.send(initiator.id, { type: 'combat', text: 'You catch your foes by surprise! They are flat-footed.' });
      s.unnoticedIn = null;
    }
    return enc;
  }

  /** Animal companions (and cavalier mounts) fight beside their owner, controlled by the AI. */
  addCompanion(enc, char, side, position) {
    if (char.kind !== 'character' || !char.companion || char.companion.status === 'dead') return null;
    const comp = companionFor(char);
    if (!comp || !comp.isAlive()) return null;
    enc.add(comp, side, { position, controller: 'ai' });
    enc.companions = enc.companions || new Map();
    enc.companions.set(comp.id, char.id);
    return comp;
  }

  joinEncounter(char, enc, side) {
    if (enc.combatants.has(char.id)) return;
    enc.add(char, side, { position: { x: enc.combatants.size, y: 0 }, controller: 'player' });
    this.addCompanion(enc, char, side, { x: enc.combatants.size, y: 0 });
    this.send(char.id, { type: 'combat', text: 'You join the battle!', data: enc.snapshot(char.id) });
  }

  partyMembersInRoom(char, roomId) {
    const pid = this.partyOf.get(char.id);
    if (!pid) return [char];
    return [...this.parties.get(pid).members].map((id) => this.characters.get(id)).filter((c) => c && c.location.roomId === roomId && this.online.has(c.id) && c.status !== 'dead' && !this.encounterOf(c.id));
  }

  onEncounterEvent(enc, e) {
    for (const c of enc.combatants.values()) if (c.creature.kind === 'character') {
      this.send(c.id, { type: `combat:${e.type}`, text: e.text, data: { encounter: enc.id, round: enc.round, actor: e.actor, target: e.target } });
      this.markDirty(c.creature);
    }
    // Spectators in the room see the fight too.
    for (const ch of this.charactersIn(enc.roomId)) if (!enc.combatants.has(ch.id)) this.send(ch.id, { type: 'combat:spectate', text: e.text });
    if (e.type === 'turn') {
      const cur = enc.current();
      if (cur && cur.creature.kind === 'character' && cur.controller === 'player') {
        const s = this.online.get(cur.id);
        this.send(cur.id, { type: 'combat:your-turn', text: `It is your turn (round ${enc.round}). Actions: attack, full, cast, move, step, charge, ability, maneuver, defend, use, end.`, data: enc.snapshot(cur.id) });
        if (s && s.pending) {
          const action = s.pending;
          s.pending = null;
          setImmediate(() => {
            try {
              this.combatAction(cur.id, action);
            } catch (x) {
              this.send(cur.id, { type: 'error', text: x.message });
            }
          });
        }
      }
    }
    if (e.type === 'end') setImmediate(() => this.finishEncounter(enc));
  }

  combatAction(charId, action) {
    const enc = this.encounterOf(charId);
    if (!enc) throw err('You are not in combat.', 409);
    const logStart = enc.log.length ? enc.log[enc.log.length - 1].id : 0;
    const res = enc.act(charId, action);
    const cur = enc.current();
    // Auto end the turn once nothing useful is left in the budget.
    if (enc.state === 'active' && cur && cur.id === charId && cur.budget && !cur.budget.standard && !cur.budget.move && action.type !== 'toggle' && !action.keepTurn) enc.endTurn();
    const narration = enc.log.filter((e) => e.id > logStart && e.actor === charId && e.text).map((e) => e.text);
    return { result: res, text: narration.join('\n'), encounter: enc.snapshot(charId) };
  }

  finishEncounter(enc) {
    if (enc.finished) return;
    enc.finished = true;
    const room = this.rooms.get(enc.roomId);
    if (room && room.encounterId === enc.id) room.encounterId = null;
    const loot = [];
    for (const c of enc.combatants.values()) {
      const cr = c.creature;
      if (cr.isCompanion) {
        const owner = this.characters.get(enc.companions && enc.companions.get(cr.id));
        if (owner) {
          saveCompanion(owner, cr);
          this.markDirty(owner);
        }
        continue;
      }
      if (cr.kind === 'monster') {
        if (!cr.isAlive() || ['dying', 'stable', 'unconscious'].includes(cr.hpState()) || cr.hasFlag('petrified')) {
          if (!cr.summoned && room && room.monsters.has(cr.id)) {
            loot.push(...this.generateLoot(cr));
            room.monsters.delete(cr.id);
            const sp = room.spawns[cr.spawnIndex];
            if (sp) room.spawnState[cr.spawnIndex].nextAt = Date.now() + (sp.respawn || 300) * 1000;
          }
        } else if (c.fled && room) room.monsters.delete(cr.id);
        else if (cr.summoned) {
          // Summons vanish at the end of combat.
        } else cr.restoreResources();
      } else {
        this.markDirty(cr);
        if (cr.isAlive()) cr.stats.lastCombat = Date.now();
        if (cr.status === 'dead') {
          cr.stats.deaths = (cr.stats.deaths || 0) + 1;
          this.send(cr.id, { type: 'death', text: 'You have died. Type "respawn" to return to the temple (raise dead penalties apply), or wait for an ally to raise you.' });
        }
        if (c.fled && room) {
          const exits = Object.values(room.exits);
          if (exits.length) {
            cr.location = { ...cr.location, roomId: exits[0] };
            this.send(cr.id, { type: 'look', text: this.describeRoom(cr), data: this.roomView(cr) });
          }
        }
        if (enc.xpAwards[cr.id]) {
          this.send(cr.id, { type: 'xp', text: `You gain ${enc.xpAwards[cr.id]} XP (total ${cr.xp}).${cr.canLevelUp() ? ' You can level up!' : ''}` });
        }
      }
    }
    if (room && loot.length) {
      const coins = loot.filter((l) => l.coins).reduce((s, l) => s + l.coins, 0);
      const winners = [...enc.combatants.values()].filter((c) => c.creature.kind === 'character' && c.side === enc.winner && c.creature.isAlive());
      if (coins && winners.length) {
        const share = Math.floor(coins / winners.length);
        for (const w of winners) {
          inventory.earn(w.creature, share);
          this.send(w.id, { type: 'loot', text: `You receive ${T.formatMoney(share)} as your share of the spoils.` });
        }
      }
      for (const l of loot.filter((x) => x.item)) room.items.push(l.item);
      const items = loot.filter((x) => x.item).map((x) => inventory.displayName(x.item));
      if (items.length) this.broadcastRoom(room.id, { type: 'loot', text: `The defeated foes leave behind: ${items.join(', ')}.` });
    }
    setTimeout(() => this.encounters.delete(enc.id), 60000).unref?.();
  }

  /** Treasure by CR (Table 12-5), scaled by the creature's treasure type. */
  generateLoot(monster) {
    const mult = TREASURE_MULT[monster.def.treasure || 'standard'] ?? 1;
    const value = T.treasureForCr(monster.def.cr) * mult * this.config.lootFactor;
    if (value <= 0) return [];
    const out = [];
    const coinShare = 0.4 + this.rng.next() * 0.4;
    out.push({ coins: T.toCopper(value * coinShare) });
    let budget = value * (1 - coinShare);
    const candidates = Object.values(ITEMS).filter((i) => ['potion', 'scroll', 'wand', 'wondrous', 'weapon', 'armor', 'shield', 'splash'].includes(i.kind) && i.cost > 0);
    for (let tries = 0; tries < 4 && budget > 10; tries++) {
      const affordable = candidates.filter((i) => i.cost <= budget);
      if (!affordable.length) break;
      const def = this.rng.pick(affordable);
      const opts = {};
      if (['weapon', 'armor', 'shield'].includes(def.kind)) {
        const enh = budget > 2300 + def.cost && this.rng.die(3) === 1 ? 1 : 0;
        if (enh) opts.enhancement = 1;
        else if (budget > 300 + def.cost && this.rng.die(2) === 1) opts.masterwork = true;
      }
      const inst = inventory.createItem(def.id, opts);
      budget -= itemPrice(def, inst);
      out.push({ item: inst });
    }
    return out;
  }

  // ------------------------------------------------------------ actions (out of combat)
  attack(charId, targetName) {
    const char = this.loadCharacter(charId);
    if (char.status === 'dead') throw err('You are dead.');
    const room = this.room(char.location.roomId);
    const existing = this.encounterOf(charId);
    if (existing) throw err('You are already in combat.');
    if (room.encounterId && this.encounters.get(room.encounterId) && this.encounters.get(room.encounterId).state === 'active') {
      this.joinEncounter(char, this.encounters.get(room.encounterId), 'players');
      return this.encounters.get(room.encounterId).snapshot(charId);
    }
    const monsters = [...room.monsters.values()].filter((m) => m.isAlive());
    const target = targetName ? this.matchTarget(room, targetName, char) : monsters[0];
    if (!target) throw err('There is nothing here to attack.');
    if (target.kind === 'character') {
      if (!room.flags.includes('pvp')) throw err('You can only fight other adventurers in a PvP area (the Proving Pit).');
      if (target.status === 'dead') throw err(`${target.name} is already dead.`);
      const enc = this.startEncounter(room, char, [target], { pvp: true });
      return enc.snapshot(charId);
    }
    if (room.flags.includes('safe')) throw err('Violence is forbidden here.');
    // Everything hostile in the room joins the fight.
    const enc = this.startEncounter(room, char, monsters);
    return enc.snapshot(charId);
  }

  matchTarget(room, name, viewer) {
    const n = String(name).toLowerCase();
    const monsters = [...room.monsters.values()].filter((m) => m.isAlive());
    const byId = monsters.find((m) => m.id === name) || this.charactersIn(room.id).find((c) => c.id === name);
    if (byId) return byId;
    const m = monsters.find((x) => x.name.toLowerCase() === n) || monsters.find((x) => x.name.toLowerCase().includes(n) || x.templateId === n);
    if (m) return m;
    return this.charactersIn(room.id).find((c) => c.id !== (viewer && viewer.id) && c.name.toLowerCase().startsWith(n)) || null;
  }

  /** Text-level target resolution inside an encounter ("goblin", "goblin 2", an id). */
  matchCombatant(enc, name, viewer) {
    if (!name) return null;
    if (enc.combatants.has(name)) return enc.get(name).creature;
    const m = /^(.*?)(?:\s+(\d+))?$/.exec(String(name).toLowerCase().trim());
    const base = m[1];
    const idx = m[2] ? Number(m[2]) - 1 : 0;
    const list = enc.creatures().filter((c) => c.isAlive() && (c.name.toLowerCase().includes(base) || (c.templateId && c.templateId.includes(base))) && (!viewer || c.id !== viewer.id || base === 'me' || base === 'self'));
    if (base === 'me' || base === 'self') return viewer;
    return list[idx] || null;
  }

  say(charId, text) {
    const char = this.loadCharacter(charId);
    const msg = String(text || '').slice(0, 500);
    this.broadcastRoom(char.location.roomId, { type: 'say', text: `${char.name} says, "${msg}"`, data: { from: char.id } }, charId);
    this.send(charId, { type: 'say', text: `You say, "${msg}"` });
  }

  emote(charId, text) {
    const char = this.loadCharacter(charId);
    const msg = `${char.name} ${String(text || '').slice(0, 300)}`;
    this.broadcastRoom(char.location.roomId, { type: 'emote', text: msg }, null);
  }

  tell(charId, targetName, text) {
    const char = this.loadCharacter(charId);
    const t = this.findCharacterByName(targetName);
    if (!t) throw err(`${targetName} is not online.`, 404);
    const msg = String(text || '').slice(0, 500);
    this.send(t.id, { type: 'tell', text: `${char.name} tells you, "${msg}"`, data: { from: char.id } });
    this.send(charId, { type: 'tell', text: `You tell ${t.name}, "${msg}"` });
  }

  shout(charId, text) {
    const char = this.loadCharacter(charId);
    const zone = this.room(char.location.roomId).zone;
    const msg = String(text || '').slice(0, 300);
    for (const id of this.online.keys()) {
      const c = this.characters.get(id);
      if (c && this.room(c.location.roomId).zone === zone) this.send(id, { type: 'shout', text: `${char.name} shouts, "${msg}"` });
    }
  }

  who() {
    return [...this.online.keys()].map((id) => {
      const c = this.characters.get(id);
      return { id, name: c.name, level: c.hitDice(), race: c.race, classes: c.classes.map((x) => `${CLASSES[x.id].name} ${x.level}`).join('/'), zone: this.room(c.location.roomId).zone };
    });
  }

  // ------------------------------------------------------------ parties
  invite(charId, targetName) {
    const char = this.loadCharacter(charId);
    const t = this.findCharacterByName(targetName);
    if (!t) throw err(`${targetName} is not online.`, 404);
    if (t.id === charId) throw err('You cannot invite yourself.');
    let pid = this.partyOf.get(charId);
    if (!pid) {
      pid = newId();
      this.parties.set(pid, { id: pid, leader: charId, members: new Set([charId]) });
      this.partyOf.set(charId, pid);
    }
    const party = this.parties.get(pid);
    if (party.members.size >= 6) throw err('Parties are limited to six adventurers.');
    this.invites.set(t.id, pid);
    this.send(t.id, { type: 'party', text: `${char.name} invites you to join their party. Type "party accept".` });
    return { party: pid };
  }

  acceptInvite(charId) {
    const pid = this.invites.get(charId);
    if (!pid || !this.parties.has(pid)) throw err('You have no pending invitation.');
    this.leaveParty(charId, true);
    const party = this.parties.get(pid);
    party.members.add(charId);
    this.partyOf.set(charId, pid);
    this.invites.delete(charId);
    const char = this.loadCharacter(charId);
    for (const m of party.members) this.send(m, { type: 'party', text: `${char.name} joins the party.` });
    return this.partyView(charId);
  }

  leaveParty(charId, silent) {
    const pid = this.partyOf.get(charId);
    if (!pid) return;
    const party = this.parties.get(pid);
    party.members.delete(charId);
    this.partyOf.delete(charId);
    const char = this.characters.get(charId);
    if (!silent || party.members.size) for (const m of party.members) this.send(m, { type: 'party', text: `${char ? char.name : 'Someone'} leaves the party.` });
    if (party.members.size <= 1) {
      for (const m of party.members) this.partyOf.delete(m);
      this.parties.delete(pid);
    } else if (party.leader === charId) party.leader = [...party.members][0];
  }

  partyView(charId) {
    const pid = this.partyOf.get(charId);
    if (!pid) return null;
    const p = this.parties.get(pid);
    return { id: pid, leader: p.leader, members: [...p.members].map((id) => { const c = this.characters.get(id); return { id, name: c.name, hp: c.hp.current, maxHp: c.maxHp(), room: c.location.roomId }; }) };
  }

  partyChat(charId, text) {
    const pid = this.partyOf.get(charId);
    if (!pid) throw err('You are not in a party.');
    const char = this.loadCharacter(charId);
    for (const m of this.parties.get(pid).members) this.send(m, { type: 'party-chat', text: `[party] ${char.name}: ${String(text).slice(0, 500)}` });
  }

  // ------------------------------------------------------------ items
  pickUp(charId, name) {
    const char = this.loadCharacter(charId);
    this.requireFree(char);
    const room = this.room(char.location.roomId);
    const n = String(name || '').toLowerCase();
    const idx = room.items.findIndex((i) => i.uid === name || inventory.displayName(i).toLowerCase().includes(n) || i.itemId === n || n === 'all');
    if (idx === -1) throw err('You do not see that here.');
    const taken = n === 'all' ? room.items.splice(0) : room.items.splice(idx, 1);
    for (const it of taken) inventory.addItem(char, { ...it, equipped: null });
    this.markDirty(char);
    this.broadcastRoom(room.id, { type: 'item', text: `${char.name} picks up ${taken.map(inventory.displayName).join(', ')}.` }, charId);
    return { taken: taken.map(inventory.displayName) };
  }

  drop(charId, uidOrName, qty) {
    const char = this.loadCharacter(charId);
    const inst = this.findInventoryItem(char, uidOrName);
    if (inst.equipped) throw err('Unequip it first.');
    const removed = inventory.removeItem(char, inst.uid, qty);
    this.room(char.location.roomId).items.push(removed);
    this.markDirty(char);
    this.broadcastRoom(char.location.roomId, { type: 'item', text: `${char.name} drops ${inventory.displayName(removed)}.` });
    return { dropped: inventory.displayName(removed) };
  }

  give(charId, uidOrName, targetName, qty) {
    const char = this.loadCharacter(charId);
    const t = this.findCharacterByName(targetName);
    if (!t || t.location.roomId !== char.location.roomId) throw err(`${targetName} is not here.`);
    const inst = this.findInventoryItem(char, uidOrName);
    if (inst.equipped) throw err('Unequip it first.');
    const removed = inventory.removeItem(char, inst.uid, qty);
    inventory.addItem(t, removed);
    this.markDirty(char);
    this.markDirty(t);
    this.send(t.id, { type: 'item', text: `${char.name} gives you ${inventory.displayName(removed)}.` });
    return { given: inventory.displayName(removed) };
  }

  giveMoney(charId, amountGp, targetName) {
    const char = this.loadCharacter(charId);
    const t = this.findCharacterByName(targetName);
    if (!t || t.location.roomId !== char.location.roomId) throw err(`${targetName} is not here.`);
    const cp = T.toCopper(Number(amountGp));
    if (!(cp > 0)) throw err('Invalid amount');
    inventory.pay(char, cp);
    inventory.earn(t, cp);
    this.markDirty(char);
    this.markDirty(t);
    this.send(t.id, { type: 'item', text: `${char.name} gives you ${T.formatMoney(cp)}.` });
    return { given: cp };
  }

  findInventoryItem(char, uidOrName) {
    const n = String(uidOrName || '').toLowerCase();
    const inst = char.inventory.find((i) => i.uid === uidOrName) || char.inventory.find((i) => i.itemId === n) || char.inventory.find((i) => inventory.displayName(i).toLowerCase().includes(n));
    if (!inst) throw err(`You have no "${uidOrName}".`);
    return inst;
  }

  // ------------------------------------------------------------ shops & services
  shopOf(room) {
    return room.npcs.find((n) => n.role === 'shopkeeper');
  }

  shopList(charId) {
    const char = this.loadCharacter(charId);
    const room = this.room(char.location.roomId);
    const shop = this.shopOf(room);
    if (!shop) throw err('There is no shop here.');
    return {
      shop: shop.name,
      items: shop.stock.map((s) => {
        const spec = typeof s === 'string' ? { itemId: s } : s;
        const inst = inventory.createItem(spec.itemId, spec);
        const def = ITEMS[spec.itemId];
        return { itemId: spec.itemId, name: inventory.displayName(inst), priceGp: itemPrice(def, inst), kind: def.kind, enhancement: spec.enhancement, special: spec.special, masterwork: spec.masterwork };
      }),
    };
  }

  buy(charId, name, qty = 1) {
    const char = this.loadCharacter(charId);
    this.requireFree(char);
    const list = this.shopList(charId).items;
    const n = String(name).toLowerCase();
    const entry = list.find((i) => i.name.toLowerCase() === n) || list.find((i) => i.itemId === n) || list.find((i) => i.name.toLowerCase().includes(n));
    if (!entry) throw err(`The shop does not sell "${name}".`);
    const res = inventory.buy(char, entry.itemId, { enhancement: entry.enhancement, special: entry.special, masterwork: entry.masterwork, ...(qty > 1 ? { qty } : {}) });
    this.markDirty(char);
    return { bought: inventory.displayName(res.item), cost: res.cost, costText: T.formatMoney(res.cost), money: T.formatMoney(char.money) };
  }

  sell(charId, name, qty) {
    const char = this.loadCharacter(charId);
    this.requireFree(char);
    const room = this.room(char.location.roomId);
    if (!this.shopOf(room)) throw err('There is no shop here.');
    const inst = this.findInventoryItem(char, name);
    const res = inventory.sell(char, inst.uid, qty);
    this.markDirty(char);
    return { ...res, valueText: T.formatMoney(res.value), money: T.formatMoney(char.money) };
  }

  templeService(charId, spellId, targetName) {
    const char = this.loadCharacter(charId);
    const room = this.room(char.location.roomId);
    const priest = room.npcs.find((n) => n.role === 'priest');
    if (!priest) throw err('There is no priest here.');
    const svc = priest.services[spellId];
    if (!svc) throw err(`Services: ${Object.keys(priest.services).join(', ')}`);
    const target = targetName ? this.findCharacterByName(targetName) || this.characters.get(targetName) : char;
    if (!target || target.location.roomId !== room.id) throw err('The recipient must be here.');
    inventory.pay(char, T.toCopper(svc.costGp));
    const spell = SPELLS[spellId];
    const res = resolveSpell({ caster: priestCaster(svc.cl), spell, cl: svc.cl, dc: 0, targets: [target], rng: this.rng });
    if (spellId === 'restoration' && target.negativeLevels.permanent > 0 && !(res.results[0] && (res.results[0].removed || []).some((x) => x.includes('negative')))) {
      target.negativeLevels.permanent -= 1;
      target.touch();
    }
    this.markDirty(char);
    this.markDirty(target);
    return { service: spell.name, cost: T.formatMoney(T.toCopper(svc.costGp)), result: res };
  }

  respawn(charId) {
    const char = this.loadCharacter(charId);
    if (char.status !== 'dead') throw err('You are not dead.');
    const enc = this.encounterOf(charId);
    if (enc) throw err('Wait for the battle to end.');
    const res = resolveSpell({ caster: priestCaster(9), spell: SPELLS['raise-dead'], cl: 9, dc: 0, targets: [char], rng: this.rng });
    char.location = { ...char.location, roomId: WORLD.TEMPLE_ROOM };
    this.markDirty(char);
    this.send(charId, { type: 'respawn', text: `The priests of the Dawnflame return your soul to your body. ${char.hitDice() <= 1 ? 'You suffer 2 points of Constitution drain.' : 'You gain 2 permanent negative levels (restoration can remove them).'}` });
    this.send(charId, { type: 'look', text: this.describeRoom(char), data: this.roomView(char) });
    return res;
  }

  // ------------------------------------------------------------ rest
  rest(charId, opts = {}) {
    const char = this.loadCharacter(charId);
    this.requireFree(char);
    const room = this.room(char.location.roomId);
    const hostile = [...room.monsters.values()].some((m) => m.isAlive() && m.aggressive);
    if (hostile) throw err('You cannot rest with enemies nearby.');
    let bed = false;
    if (opts.bed || room.flags.includes('inn')) {
      const inn = room.npcs.find((n) => n.role === 'innkeeper');
      if (inn) {
        inventory.pay(char, T.toCopper(inn.roomCostGp || 2));
        bed = true;
      }
    }
    const s = this.session(charId);
    s.resting = { until: Date.now() + this.config.restSeconds * 1000, bed };
    this.send(charId, { type: 'rest', text: `You settle down to rest for 8 hours${bed ? ' in a warm bed' : ''}... (${this.config.restSeconds}s)` });
    if (this.config.restSeconds <= 0) this.completeRest(charId);
    return { resting: true, seconds: this.config.restSeconds };
  }

  /** 8 hours of rest (Core Rulebook "Natural Healing" and spell preparation). */
  completeRest(charId) {
    const s = this.online.get(charId);
    const char = this.characters.get(charId);
    if (!s || !char || !s.resting) return;
    const bed = s.resting.bed;
    s.resting = null;
    const lvl = char.hitDice();
    const healed = char.heal(lvl * (bed ? 2 : 1));
    char.hp.nonlethal = 0;
    for (const a of ABILITIES) if (char.abilityDamage[a]) char.abilityDamage[a] = Math.max(0, char.abilityDamage[a] - (bed ? 2 : 1));
    char.removeConditions(['fatigued']);
    const ex = char.effects.find((e) => (e.conditions || []).includes('exhausted'));
    if (ex) {
      ex.conditions = ['fatigued'];
      ex.name = 'Fatigued';
    }
    // Eight hours pass for timed effects (4800 rounds).
    char.tickEffects(4800, this.rng);
    for (let i = 0; i < 1; i++) tickAfflictions(char, this.rng, 'day');
    spellcasting.restoreSlots(char);
    char.restoreResources();
    // Companions heal like their owner; a slain companion is replaced after a day of rest and prayer.
    if (char.companion) {
      const comp = companionFor(char);
      if (char.companion.status === 'dead') char.companion = { ...char.companion, id: undefined, hp: null, status: 'alive', effects: [] };
      else if (comp) {
        comp.heal(comp.hitDice() * (bed ? 2 : 1));
        saveCompanion(char, comp);
      }
    }
    char.touch();
    this.markDirty(char);
    this.send(charId, { type: 'rest', text: `You wake refreshed: +${healed} hp, spells and daily abilities restored.` });
  }

  // ------------------------------------------------------------ skills & features
  useFeature(charId, featureName, opts = {}) {
    const char = this.loadCharacter(charId);
    this.requireFree(char);
    const room = this.room(char.location.roomId);
    const n = String(featureName || '').toLowerCase();
    const f = room.features.find((x) => x.id === n || x.name.toLowerCase() === n || x.name.toLowerCase().includes(n));
    if (!f) throw err('You see nothing like that here.');
    if (f.once && room.usedFeatures.has(f.id)) throw err('That has already been dealt with.');
    const isAbility = ABILITIES.includes(f.skill);
    const res = isAbility ? checks.abilityCheck(char, f.skill, { dc: f.dc, rng: this.rng, take10: opts.take10, take20: opts.take20 }) : checks.skillCheck(char, f.skill, { dc: f.dc, rng: this.rng, take10: opts.take10, take20: opts.take20 });
    let text = `${f.verb[0].toUpperCase()}${f.verb.slice(1)} the ${f.name}: ${isAbility ? f.skill.toUpperCase() : SKILLS[f.skill].name} ${res.total} vs DC ${f.dc} — `;
    if (res.success) {
      text += f.success;
      if (f.reward) {
        if (f.reward.gold) inventory.earn(char, T.toCopper(f.reward.gold));
        if (f.reward.item) inventory.addItem(char, inventory.createItem(f.reward.item));
      }
      if (f.once) room.usedFeatures.add(f.id);
    } else {
      text += f.failure;
      if (f.failureDamage) {
        const d = dice.total(f.failureDamage, this.rng);
        char.takeDamage(d);
        text += ` (${d} damage)`;
      }
    }
    this.markDirty(char);
    this.send(charId, { type: 'check', text, data: res });
    return { check: res, text };
  }

  /** Free-form check: skill/ability/save at a DC (for GMs, clients and scripted content). */
  check(charId, kind, id, opts = {}) {
    const char = this.loadCharacter(charId);
    const inCombat = !!this.encounterOf(charId);
    const o = { rng: this.rng, dc: opts.dc, take10: opts.take10, take20: opts.take20, inCombat, tags: opts.tags, circumstance: opts.circumstance };
    let res;
    if (kind === 'skill') res = checks.skillCheck(char, id, o);
    else if (kind === 'ability') res = checks.abilityCheck(char, id, o);
    else if (kind === 'save') res = checks.savingThrow(char, id, o);
    else if (kind === 'caster') res = checks.casterLevelCheck(char, { ...o, classId: id });
    else if (kind === 'concentration') res = checks.concentrationCheck(char, { ...o, classId: id });
    else if (kind === 'initiative') res = checks.initiativeRoll(char, this.rng);
    else throw err('kind must be skill, ability, save, caster, concentration or initiative');
    return res;
  }

  identify(charId, targetName) {
    const char = this.loadCharacter(charId);
    const room = this.room(char.location.roomId);
    const enc = this.encounterOf(charId);
    const t = enc ? this.matchCombatant(enc, targetName, char) : this.matchTarget(room, targetName, char);
    if (!t || t.kind !== 'monster') throw err('Identify which creature?');
    return checks.identifyCreature(char, t, { rng: this.rng });
  }

  // ------------------------------------------------------------ magic out of combat
  cast(charId, action) {
    const char = this.loadCharacter(charId);
    const enc = this.encounterOf(charId);
    if (enc) return this.combatAction(charId, { type: 'cast', ...action });
    this.requireFree(char);
    const spell = SPELLS[action.spell];
    if (!spell) throw err(`Unknown spell ${action.spell}`);
    const room = this.room(char.location.roomId);
    const harmful = ['damage', 'condition', 'debuff', 'slay', 'powerWord', 'energyDrain', 'inflict', 'colorSpray', 'cloudkill', 'hdKill', 'poison', 'grappleArea'].includes(spell.effect.kind);
    if (harmful) {
      // Opening a fight with a spell: start the encounter and queue the cast.
      const target = action.target ? this.matchTarget(room, action.target, char) : null;
      if (target && target.kind === 'monster') {
        this.session(charId).pending = { type: 'cast', ...action, target: target.id };
        const snap = this.attack(charId, target.id);
        return { queued: true, encounter: snap };
      }
      if (!(spell.effect.kind === 'inflict' && action.target)) throw err('Target a creature to attack with this spell.');
    }
    const classId = action.classId || char.casterClasses().find((id) => {
      try {
        spellcasting.planCast(char, id, spell.id, action);
        return true;
      } catch (e) {
        return false;
      }
    });
    if (!classId) throw err(`You cannot cast ${spell.name} right now.`);
    const plan = spellcasting.planCast(char, classId, spell.id, action);
    spellcasting.consume(char, plan);
    const cl = char.casterLevel(classId);
    const dc = spellcasting.spellDC(char, spell, plan.baseLevel, CLASSES[classId].spellcasting.ability);
    const partyHere = this.partyMembersInRoom(char, room.id);
    let targets;
    if (spell.range === 'personal') targets = [char];
    else if (action.target) {
      const t = this.findCharacterByName(action.target) || this.matchTarget(room, action.target, char);
      if (!t) throw err('No such target here.');
      targets = [t];
    } else targets = [char];
    const res = resolveSpell({ caster: char, spell, cl, dc, targets, rng: this.rng, metamagic: action.metamagic || [], options: action.options || {}, allies: partyHere, enemies: [] });
    if (res.teleport) this.teleport(char, res.teleport, action, partyHere);
    for (const t of targets) if (t.kind === 'character') this.markDirty(t);
    this.markDirty(char);
    const text = `${char.name} casts ${spell.name}.`;
    this.broadcastRoom(room.id, { type: 'cast', text, data: res });
    return res;
  }

  teleport(char, tp, action, party) {
    const dest = action.options && action.options.destination;
    if (!dest) throw err('Teleport needs options.destination (a room id you have visited)');
    if (!this.rooms.has(dest)) throw err('Unknown destination');
    if (!tp.planar && !(char.location.visited || []).includes(dest)) throw err('You must have visited the destination');
    if (tp.shortRange && this.room(dest).zone !== this.room(char.location.roomId).zone) throw err('Too far for a short-range teleport');
    for (const c of party) {
      c.location = { ...c.location, roomId: dest };
      this.markDirty(c);
      this.send(c.id, { type: 'look', text: this.describeRoom(c), data: this.roomView(c) });
    }
  }

  useAbility(charId, abilityId, opts = {}) {
    const enc = this.encounterOf(charId);
    if (enc) return this.combatAction(charId, { type: 'ability', ability: abilityId, ...opts });
    const char = this.loadCharacter(charId);
    this.requireFree(char);
    const room = this.room(char.location.roomId);
    const target = opts.target ? this.findCharacterByName(opts.target) || this.matchTarget(room, opts.target, char) : null;
    const party = this.partyMembersInRoom(char, room.id);
    const res = classAbilities.useAbility(char, abilityId, { target: target || char, targets: party, allies: party, enemies: [], rng: this.rng, options: { ...opts.options, nearby: party } });
    for (const p of party) this.markDirty(p);
    return res;
  }

  useItem(charId, uidOrName, targetName) {
    const enc = this.encounterOf(charId);
    const char = this.loadCharacter(charId);
    const inst = this.findInventoryItem(char, uidOrName);
    if (enc) return this.combatAction(charId, { type: 'use-item', item: inst.uid, target: targetName ? (this.matchCombatant(enc, targetName, char) || {}).id : undefined });
    this.requireFree(char);
    const def = ITEMS[inst.itemId];
    if (!['potion', 'wand', 'scroll'].includes(def.kind)) throw err(`${def.name} cannot be used that way.`);
    const room = this.room(char.location.roomId);
    const target = targetName ? this.findCharacterByName(targetName) || char : char;
    if (target.location && target.location.roomId !== room.id) throw err('Target must be here.');
    const spell = SPELLS[def.spell];
    const res = resolveSpell({ caster: char, spell, cl: def.cl, dc: 10 + Math.min(...Object.values(spell.levels)), targets: [target], rng: this.rng });
    if (def.kind === 'wand') {
      inst.charges = (inst.charges ?? def.charges) - 1;
      if (inst.charges <= 0) inventory.removeItem(char, inst.uid);
    } else inventory.removeItem(char, inst.uid, 1);
    this.markDirty(char);
    this.markDirty(target);
    return res;
  }

  // ------------------------------------------------------------ clock
  start() {
    if (this.timer) return;
    let last = Date.now();
    let roundAcc = 0;
    let saveAcc = 0;
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      this.tick(dt);
      roundAcc += dt;
      saveAcc += dt;
      if (roundAcc >= this.config.roundMs) {
        roundAcc = 0;
        this.worldRound();
      }
      if (saveAcc >= this.config.autosaveMs) {
        saveAcc = 0;
        this.flush();
      }
    }, 1000);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.flush();
  }

  tick(dt) {
    // Game clock.
    const before = this.clock.minutes;
    this.clock.minutes += Math.round((dt / 1000) * this.config.gameMinutesPerSecond);
    if (Math.floor(this.clock.minutes / 1440) > Math.floor(before / 1440)) this.newDay();
    if (this.clock.minutes >= 1440) {
      this.clock.day += Math.floor(this.clock.minutes / 1440);
      this.clock.minutes %= 1440;
    }
    // Rest completion and player turn timeouts.
    for (const [id, s] of this.online) if (s.resting && Date.now() >= s.resting.until) this.completeRest(id);
    for (const enc of this.encounters.values()) {
      if (enc.state !== 'active') continue;
      const cur = enc.current();
      if (cur && cur.controller === 'player' && enc.turnStartedAt && Date.now() - enc.turnStartedAt > this.config.turnTimeoutMs) {
        const ch = cur.creature;
        this.send(cur.id, { type: 'combat', text: 'You hesitate too long; your turn passes.' });
        if (ch.toggles && ch.toggles.autoBattle) enc.runAi(cur);
        else enc.endTurn();
      }
    }
    for (const room of this.rooms.values()) this.populate(room);
  }

  /** Out-of-combat round (6 seconds): durations, ongoing damage, dying. */
  worldRound() {
    for (const id of this.online.keys()) {
      const c = this.characters.get(id);
      if (!c || this.encounterOf(id)) continue;
      const before = c.effects.length;
      const t = c.tickEffects(1, this.rng);
      tickAfflictions(c, this.rng, 'round');
      for (const ev of t.events) this.send(id, { type: 'damage', text: `You take ${ev.damage} ${ev.damageType || ''} damage (${ev.effect || ev.type}).` });
      for (const ex of t.expired) this.send(id, { type: 'effect', text: `${ex.name} wears off.` });
      if (c.hpState() === 'dying') {
        const s = checks.stabilizeCheck(c, this.rng);
        if (s.success) {
          c.stable = true;
          this.send(id, { type: 'dying', text: 'You stabilize.' });
        } else {
          c.takeDamage(1);
          this.send(id, { type: 'dying', text: c.status === 'dead' ? 'You have bled out and died.' : `You are dying (${c.hp.current} hp).` });
        }
        c.touch();
      }
      if (t.expired.length || t.events.length || before !== c.effects.length) this.markDirty(c);
    }
  }

  newDay() {
    for (const id of this.online.keys()) {
      const c = this.characters.get(id);
      if (c) for (const ev of tickAfflictions(c, this.rng, 'day')) this.send(id, { type: 'affliction', text: ev.type === 'affliction' ? `${ev.name} worsens.` : `You recover from ${ev.name}.` });
    }
  }
}

function priestCaster(cl) {
  // A minimal caster stand-in for NPC spellcasting services.
  const { Creature } = require('../engine/creature');
  const p = new Creature({ name: 'Temple priest', alignment: 'NG' });
  p.casterLevel = () => cl;
  p.hasFlag = () => false;
  return p;
}

function expandDir(d) {
  const map = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down', ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest' };
  return map[d] || d;
}

module.exports = { World, expandDir };
