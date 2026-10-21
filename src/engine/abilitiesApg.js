'use strict';

const dice = require('./dice');
const checks = require('./checks');
const { mod } = require('./modifiers');
const { makeEffect } = require('./effects');
const { applyDamage } = require('./attacks');
const { touchAttack, resolveSpell } = require('./spellEffects');

/**
 * Activated abilities of the Advanced Player's Guide classes. Same format as
 * src/engine/classAbilities.js (which merges this table into ABILITIES).
 */

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
const half = (n) => Math.floor(n / 2);
const spend = (u, r, n = 1) => { if (!u.spendResource(r, n)) throw err(`Not enough ${r} remaining`); };
const ol = (u) => u.prog('mysteryLevel');
const wl = (u) => u.prog('hexLevel');
const chaMod = (u) => Math.max(0, u.abilityMod('cha'));
const intMod = (u) => Math.max(0, u.abilityMod('int'));
const revDC = (u) => 10 + half(ol(u)) + u.abilityMod('cha');
const hexDC = (u) => 10 + half(wl(u)) + u.abilityMod('int');
const onePlusPerFive = (u) => 1 + Math.floor(ol(u) / 5);

/** Damage creatures in an area with a save for half; returns per-target results. */
function areaDamage(ctx, { diceExpr, energy, save, dc, tags = [] }) {
  const amt = dice.total(diceExpr, ctx.rng);
  const results = (ctx.targets || (ctx.target ? [ctx.target] : [])).map((t) => {
    const s = save ? checks.savingThrow(t, save, { dc, rng: ctx.rng, tags: [energy, ...tags] }) : null;
    let d = s && s.success ? half(amt) : amt;
    if (s && s.success && save === 'ref' && t.hasFlag('evasion')) d = 0;
    if (s && !s.success && save === 'ref' && t.hasFlag('improvedEvasion')) d = half(amt);
    const res = applyDamage(t, [{ amount: d, type: energy, physical: ['bludgeoning', 'piercing', 'slashing'].includes(energy), damageTypes: [energy], magic: true }]);
    return { target: t.id, save: s, damage: res.total, state: res.state };
  });
  return { rolled: amt, dc, results };
}

/** Melee touch dealing 1d6 + 1 per two levels of an energy (touch of flame, wintry touch...). */
function energyTouch(name, energy) {
  return {
    name, action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => 3 + chaMod(u),
    use({ user, target, rng }) {
      const atk = touchAttack(user, target, 'meleeTouch', rng);
      if (!atk.hit) return { target: target.id, attack: atk, note: 'missed' };
      const res = applyDamage(target, [{ amount: dice.total(`1d6+${half(ol(user))}`, rng) * (atk.crit ? 2 : 1), type: energy }]);
      return { target: target.id, attack: atk, damage: res.total, state: res.state };
    },
  };
}

/** Armor revelations (coat of many stars, armor of bones, ice armor, air barrier): +4 armor, +2 at 7th and every four levels. */
function armorRevelation(name, dr) {
  return {
    name, action: 'standard', target: 'self',
    use({ user }) {
      const l = ol(user);
      const hoursLeft = l - (user.resourcesUsed[`hours:${name}`] || 0);
      if (hoursLeft < 1) throw err(`No hours of ${name} remaining today`);
      user.resourcesUsed[`hours:${name}`] = (user.resourcesUsed[`hours:${name}`] || 0) + 1;
      const bonus = 4 + (l >= 7 ? 2 + 2 * Math.floor((l - 7) / 4) : 0);
      user.removeEffectsWhere((e) => e.key === `rev:${name}`);
      user.addEffect(makeEffect({ key: `rev:${name}`, name, kind: 'ability', remaining: 600, modifiers: [mod('ac', bonus, 'armor', name)], dr: l >= 13 && dr ? [{ amount: 5, bypass: dr }] : [] }));
      return { bonus, rounds: 600 };
    },
  };
}

/** Breath/blast revelations usable 1/day + 1 per five levels. */
function blastRevelation(name, { diceFn, energy, save = 'ref', perDay = onePlusPerFive, after }) {
  return {
    name, action: 'standard', target: 'area', resource: (u, id) => `power:${id}`, perDay,
    use(ctx) {
      const r = areaDamage(ctx, { diceExpr: diceFn(ctx.user), energy, save, dc: revDC(ctx.user) });
      if (after) after(ctx, r);
      return r;
    },
  };
}

function elementalForm(name, element) {
  return {
    name, action: 'standard', target: 'self', resource: (u, id) => `power:${id}`, perDay: () => 1,
    use({ user }) {
      const { resolveForm } = require('../data/wildShape');
      const { SIZE_ORDER } = require('../data/core');
      // Small at 7th, Medium at 9th, Large at 11th, Huge at 13th: the elemental body tier for that oracle level.
      const l = ol(user);
      const asDruid = l >= 13 ? 12 : l >= 11 ? 10 : l >= 9 ? 8 : 6;
      const r = resolveForm(`${element}-elemental`, asDruid);
      const steps = SIZE_ORDER.indexOf(r.size) - SIZE_ORDER.indexOf(user.baseSize());
      const mods = Object.entries(r.adj).filter(([k]) => k !== 'natural').map(([a, v]) => mod(a, v, 'size', name));
      if (r.adj.natural) mods.push(mod('ac', r.adj.natural, 'natural', name));
      user.addEffect(makeEffect({ key: 'ability:wild-shape', name, kind: 'ability', remaining: 600 * l, sizeChange: steps, modifiers: mods, flags: ['polymorphed', 'wildShape', 'noCast', ...(r.form.flags || []), ...(r.form.fly ? [`fly:${r.form.fly}`] : [])], naturalAttacks: r.form.attacks.map((a) => ({ ...a, fixedSize: true, magic: true })), resist: r.form.resist }));
      return { form: r.form.id, size: r.size };
    },
  };
}

/** Hex helper: once per day per creature unless `repeatable`. */
function hexImmune(target, hex, witch) {
  return target.effects.some((e) => e.key === `hexImmune:${hex}:${witch.id}`);
}
function markHex(target, hex, witch) {
  target.addEffect(makeEffect({ key: `hexImmune:${hex}:${witch.id}`, name: `Immune to ${witch.name}'s ${hex} (24 hours)`, kind: 'ability', remaining: 14400 }));
}
function hex(name, { side = 'enemy', save, oncePerDay = true, apply }) {
  return {
    name, action: 'standard', target: side,
    use(ctx) {
      const { user, target, rng } = ctx;
      const t = target || user;
      const id = name.toLowerCase().replace(/\s+/g, '-');
      if (oncePerDay && hexImmune(t, id, user)) throw err(`${t.name} cannot be targeted by your ${name} again for 24 hours`);
      const s = save ? checks.savingThrow(t, save, { dc: hexDC(user), rng, tags: ['hex', 'supernatural'] }) : null;
      if (oncePerDay) markHex(t, id, user);
      const r = apply(ctx, t, s);
      return { target: t.id, save: s, dc: save ? hexDC(user) : undefined, ...r };
    },
  };
}

function mutagenMods(user, opts) {
  const pair = { str: 'int', dex: 'wis', con: 'cha', int: 'str', wis: 'dex', cha: 'con' };
  const cognatogen = ['int', 'wis', 'cha'].includes(opts.ability);
  if (cognatogen && !user.hasFlag('cognatogen')) throw err('Mental mutagens require the cognatogen discovery');
  const has = (d) => user.hasOption('discovery', d) || user.hasOption('grand-discovery', d);
  const mods = [];
  const tier = has('true-mutagen') ? 'true' : has('grand-mutagen') && !cognatogen ? 'grand' : has('greater-mutagen') && !cognatogen ? 'greater' : 'normal';
  const primary = opts.ability || 'str';
  if (!pair[primary]) throw err('options.ability must be str, dex or con (int, wis or cha with cognatogen)');
  if (tier === 'true') {
    for (const a of ['str', 'dex', 'con']) mods.push(mod(a, 8, 'alchemical', 'True mutagen'));
    for (const a of ['int', 'wis', 'cha']) mods.push(mod(a, -2, 'untyped', 'True mutagen'));
    mods.push(mod('ac', 8, 'natural', 'True mutagen'));
    return mods;
  }
  if (tier === 'grand') {
    const order = [primary, opts.second || ['str', 'dex', 'con'].find((a) => a !== primary), ['str', 'dex', 'con'].find((a) => a !== primary && a !== (opts.second || ''))].filter(Boolean);
    const amounts = [8, 6, 4];
    [...new Set([...order, 'str', 'dex', 'con'])].slice(0, 3).forEach((a, i) => mods.push(mod(a, amounts[i], 'alchemical', 'Grand mutagen')));
    for (const a of ['int', 'wis', 'cha']) mods.push(mod(a, -2, 'untyped', 'Grand mutagen'));
    mods.push(mod('ac', 6, 'natural', 'Grand mutagen'));
    return mods;
  }
  if (tier === 'greater') {
    const second = opts.second && opts.second !== primary ? opts.second : ['str', 'dex', 'con'].find((a) => a !== primary);
    mods.push(mod(primary, 6, 'alchemical', 'Greater mutagen'), mod(second, 4, 'alchemical', 'Greater mutagen'), mod(pair[primary], -2, 'untyped', 'Greater mutagen'), mod(pair[second], -2, 'untyped', 'Greater mutagen'), mod('ac', 4, 'natural', 'Greater mutagen'));
    return mods;
  }
  mods.push(mod(primary, 4, 'alchemical', cognatogen ? 'Cognatogen' : 'Mutagen'), mod(pair[primary], -2, 'untyped', cognatogen ? 'Cognatogen' : 'Mutagen'), mod('ac', 2, 'natural', cognatogen ? 'Cognatogen' : 'Mutagen'));
  return mods;
}

function throwBomb(ctx, extra = {}) {
  const { user, target, rng, options, encounter } = ctx;
  const { DISCOVERIES } = require('../data/classOptionsApg');
  const level = user.classLevel('alchemist');
  const kind = options.bomb ? DISCOVERIES[options.bomb] : null;
  if (options.bomb && (!kind || !kind.bomb || !user.hasOption('discovery', options.bomb))) throw err(`You do not know the ${options.bomb} bomb discovery`);
  const b = (kind && kind.bomb) || {};
  // Explosive bomb is the one discovery that stacks with an energy bomb.
  const explosive = user.hasOption('discovery', 'explosive-bomb') && (options.explosive || options.bomb === 'explosive-bomb');
  const energy = b.energy || 'fire';
  const die = b.die || 6;
  const n = Math.max(1, user.prog('bombDice') - (b.reduceDice || 0));
  const int = Math.max(0, user.abilityMod('int'));
  const dc = 10 + half(level) + user.abilityMod('int');
  const atk = touchAttack(user, target, 'rangedTouch', rng, extra.attackPenalty || 0);
  const r = { target: target.id, attack: atk, bomb: options.bomb || 'fire', dc };
  const splashOf = (x) => (encounter ? encounter.within(x, explosive ? 10 : 5).filter((c) => c.id !== x.id && c.id !== user.id && !(user.hasFlag('preciseBombs') && encounter.sideOf(c.id) === encounter.sideOf(user.id))) : []);
  const splashDamage = n + int;
  const splash = (who) => who.map((t) => {
    const s = checks.savingThrow(t, 'ref', { dc, rng, tags: [energy] });
    const res = applyDamage(t, [{ amount: s.success ? half(splashDamage) : splashDamage, type: energy }]);
    if (b.sticky && !s.success) t.addEffect(makeEffect({ key: 'bomb:sticky', name: 'Sticky bomb', remaining: 1, ongoing: { dice: String(splashDamage), type: energy } }));
    if (b.splashCondition && b.condition) {
      const cs = checks.savingThrow(t, b.save || 'fort', { dc, rng });
      if (!cs.success) t.addCondition(b.condition, typeof b.conditionRounds === 'string' ? dice.total(b.conditionRounds, rng) : b.conditionRounds, { id: user.id, name: 'Bomb' });
    }
    return { target: t.id, save: s, damage: res.total };
  });
  if (!atk.hit) {
    r.note = 'missed (splash only)';
    r.splash = splash([target, ...splashOf(target)]);
    return r;
  }
  if (b.dispel) {
    r.dispel = resolveSpell({ caster: user, spell: require('../data/spells').SPELLS['dispel-magic'], cl: level, dc: 0, targets: [target], rng }).results;
    return r;
  }
  if (b.cloudkill) {
    r.cloudkill = resolveSpell({ caster: user, spell: require('../data/spells').SPELLS.cloudkill, cl: level, dc, targets: [target, ...splashOf(target)], rng }).results;
    return r;
  }
  // Bonus dice are not multiplied on a critical hit; the Int bonus is.
  const rolled = dice.total(`${n}d${die}`, rng);
  const amount = rolled + int * (atk.crit ? 2 : 1);
  const res = applyDamage(target, [{ amount, type: energy, magic: true }]);
  Object.assign(r, { damage: res.total, state: res.state });
  if (target.isAlive()) {
    if (b.lingering) target.addEffect(makeEffect({ key: 'bomb:acid', name: 'Acid bomb', remaining: 1, ongoing: { dice: b.lingering, type: 'acid' } }));
    if (explosive || b.burning) target.addEffect(makeEffect({ key: 'bomb:burning', name: 'On fire', remaining: 3, ongoing: { dice: '1d6', type: 'fire' } }));
    if (b.condition && !b.splashCondition) {
      const s = b.save ? checks.savingThrow(target, b.save, { dc, rng }) : null;
      if (!s || !s.success) {
        const rounds = typeof b.conditionRounds === 'function' ? b.conditionRounds(user) : typeof b.conditionRounds === 'string' ? dice.total(b.conditionRounds, rng) : b.conditionRounds;
        target.addCondition(b.condition, rounds, { id: user.id, name: 'Bomb' });
        r.condition = b.condition;
      }
    }
    if (b.abilityDamage) for (const [a, d] of Object.entries(b.abilityDamage)) target.abilityDamage[a] = (target.abilityDamage[a] || 0) + dice.total(d, rng);
    if (b.smoke) r.smoke = true;
  }
  r.splash = splash(splashOf(target));
  return r;
}

const ABILITIES = {
  // ------------------------------------------------------------ Alchemist
  bomb: {
    name: 'Bomb', action: 'standard', target: 'enemy',
    use(ctx) {
      spend(ctx.user, 'bombs');
      return throwBomb(ctx);
    },
  },
  'bomb-barrage': {
    name: 'Fast Bombs', action: 'full', target: 'enemy',
    use(ctx) {
      const { iterativeAttacks } = require('./tables');
      const its = iterativeAttacks(ctx.user.bab());
      const out = [];
      for (let i = 0; i < its.length; i++) {
        if (!ctx.user.spendResource('bombs', 1)) break;
        if (!ctx.target.isAlive()) break;
        out.push(throwBomb(ctx, { attackPenalty: its[i] - its[0] }));
      }
      return { bombs: out };
    },
  },
  mutagen: {
    name: 'Mutagen', action: 'standard', target: 'self',
    use({ user, options }) {
      const mods = mutagenMods(user, options);
      spend(user, 'mutagen');
      const l = user.classLevel('alchemist');
      const rounds = user.hasFlag('persistentMutagen') ? 600 * l : 100 * l;
      user.removeEffectsWhere((e) => e.key === 'ability:mutagen');
      user.addEffect(makeEffect({ key: 'ability:mutagen', name: ['int', 'wis', 'cha'].includes(options.ability) ? 'Cognatogen' : 'Mutagen', kind: 'ability', remaining: rounds, modifiers: mods, flags: ['mutagen'] }));
      return { ability: options.ability || 'str', rounds };
    },
  },
  'spontaneous-healing': {
    name: 'Spontaneous Healing', action: 'free', target: 'self',
    use({ user }) {
      const max = 5 * Math.max(1, intMod(user));
      const used = user.resourcesUsed.spontaneousHealing || 0;
      const amt = Math.min(5, max - used);
      if (amt <= 0) throw err('No spontaneous healing remaining today');
      user.resourcesUsed.spontaneousHealing = used + amt;
      return { healed: user.heal(amt) };
    },
  },

  // ------------------------------------------------------------ Cavalier
  challenge: {
    name: 'Challenge', action: 'swift', target: 'enemy',
    use({ user, target }) {
      spend(user, 'challenge');
      const { CAVALIER_ORDERS } = require('../data/classOptionsApg');
      const l = user.classLevel('cavalier');
      const ord = CAVALIER_ORDERS[user.choices.order];
      const ch = (ord && ord.challenge) || {};
      const tag = `id:${target.id}`;
      const mods = [mod('damage.melee', l, 'untyped', 'Challenge', [tag]), mod('ac', -2, 'untyped', 'Challenge (others)', ['notChallenged'])];
      if (ch.damage) mods.push(mod('damage.melee', ch.damage(user), 'morale', 'Order of the Cockatrice', [tag]));
      if (ch.dodgeAc) mods.push(mod('ac', ch.dodgeAc(user), 'dodge', 'Order of the Lion', [`attacker:${target.id}`]));
      if (ch.attackIfOthers) mods.push(mod('attack', ch.attackIfOthers(user), 'morale', 'Order of the Shield', [tag]));
      if (ch.saves) mods.push(mod('save', ch.saves(user), 'morale', 'Order of the Star'));
      if (ch.attackMounted) mods.push(mod('attack', ch.attackMounted(user), 'morale', 'Order of the Sword', ['mounted']));
      user.removeEffectsWhere((e) => e.key === 'ability:challenge');
      user.addEffect(makeEffect({ key: 'ability:challenge', name: `Challenge (${target.name})`, kind: 'ability', remaining: null, endsWithCombat: true, modifiers: mods, data: { targetId: target.id } }));
      return { target: target.id, damageBonus: l };
    },
  },
  tactician: {
    name: 'Tactician', action: 'standard', target: 'allies',
    use({ user, allies, options }) {
      const { FEATS } = require('../data/feats');
      const known = user.allFeats().filter((f) => FEATS[f.id] && FEATS[f.id].types.includes('teamwork')).map((f) => f.id);
      const pick = (options.feats || [options.feat || known[0]]).filter((id) => known.includes(id)).slice(0, user.hasFeature('master-tactician') ? 2 : 1);
      if (!pick.length) throw err('You know no teamwork feats to share');
      spend(user, 'tactician');
      const rounds = 3 + half(user.classLevel('cavalier'));
      for (const a of allies || []) if (a.id !== user.id) a.addEffect(makeEffect({ key: 'ability:tactician', name: `Tactician (${pick.join(', ')})`, kind: 'ability', remaining: rounds, grantedFeats: pick }));
      return { feats: pick, rounds };
    },
  },

  // ------------------------------------------------------------ Inquisitor
  judgment: {
    name: 'Judgment', action: 'swift', target: 'self',
    use({ user, options }) {
      const { JUDGMENTS } = require('../data/classOptionsApg');
      const l = user.classLevel('inquisitor');
      const count = user.prog('judgmentCount');
      const picks = (options.judgments || [options.judgment || 'justice']).slice(0, count);
      for (const p of picks) if (!JUDGMENTS[p]) throw err(`Unknown judgment ${p} (${Object.keys(JUDGMENTS).join(', ')})`);
      spend(user, 'judgment');
      const type = user.axes().evil ? 'profane' : 'sacred';
      user.removeEffectsWhere((e) => e.key === 'ability:judgment');
      const fx = { modifiers: [], flags: [], dr: [], resist: {} };
      picks.forEach((p, i) => {
        const effLevel = user.hasFeature('slayer-judgment') && i === 0 ? l + 5 : l;
        const b = JUDGMENTS[p].build(effLevel, type, options.energy);
        fx.modifiers.push(...(b.modifiers || []));
        fx.flags.push(...(b.flags || []));
        fx.dr.push(...(b.dr || []));
        Object.assign(fx.resist, b.resist || {});
      });
      user.addEffect(makeEffect({ key: 'ability:judgment', name: `Judgment (${picks.join(', ')})`, kind: 'ability', remaining: null, endsWithCombat: true, ...fx }));
      return { judgments: picks };
    },
  },
  bane: {
    name: 'Bane', action: 'swift', target: 'enemy',
    use({ user, target, options }) {
      const max = user.classLevel('inquisitor');
      const rounds = Math.min(options.rounds || max, max - (user.resourcesUsed.bane || 0));
      if (rounds < 1) throw err('No bane rounds remaining today');
      user.resourcesUsed.bane = (user.resourcesUsed.bane || 0) + rounds;
      const t = target.creatureType();
      const sub = (target.subtypes() || [])[0];
      const tag = ['humanoid', 'outsider'].includes(t) && sub ? `vs:${t}:${sub}` : `vs:${t}`;
      const diceExpr = user.hasFeature('greater-bane') ? '4d6' : '2d6';
      user.removeEffectsWhere((e) => e.key === 'ability:bane');
      user.addEffect(makeEffect({ key: 'ability:bane', name: `Bane (${tag.slice(3)})`, kind: 'ability', remaining: rounds, modifiers: [mod('attack', 2, 'untyped', 'Bane', [tag])], bonusDamage: [{ dice: diceExpr, onlyIf: [tag], weaponOnly: true }] }));
      return { against: tag.slice(3), rounds, dice: diceExpr };
    },
  },
  'true-judgment': {
    name: 'True Judgment', action: 'swift', target: 'enemy',
    use({ user, target, rng }) {
      if (!user.effects.some((e) => e.key === 'ability:judgment')) throw err('True judgment requires an active judgment');
      if (user.effects.some((e) => e.key === 'ability:true-judgment-cooldown')) throw err('True judgment is recharging');
      const dc = 10 + half(user.classLevel('inquisitor')) + user.abilityMod('wis');
      user.addEffect(makeEffect({ key: 'ability:true-judgment', name: 'True Judgment (primed)', remaining: 1, dischargeOnHit: true, onHitAny: true, onHit: { save: 'fort', dc, slay: true } }));
      user.addEffect(makeEffect({ key: 'ability:true-judgment-cooldown', name: 'True judgment recharging', remaining: dice.total('1d4', rng) + 1 }));
      return { target: target.id, dc };
    },
  },

  // ------------------------------------------------------------ Oracle revelations
  battlecry: {
    name: 'Battlecry', action: 'standard', target: 'allies', resource: (u, id) => `power:${id}`, perDay: onePlusPerFive,
    use({ user, allies }) {
      const b = ol(user) >= 10 ? 2 : 1;
      const rounds = Math.max(1, chaMod(user));
      for (const a of allies || [user]) a.addEffect(makeEffect({ key: 'rev:battlecry', name: 'Battlecry', kind: 'ability', remaining: rounds, modifiers: [mod('attack', b, 'morale', 'Battlecry'), mod('skill', b, 'morale', 'Battlecry'), mod('save', b, 'morale', 'Battlecry')] }));
      return { bonus: b, rounds };
    },
  },
  'iron-skin': {
    name: 'Iron Skin', action: 'standard', target: 'self', resource: (u, id) => `power:${id}`, perDay: (u) => (ol(u) >= 15 ? 2 : 1),
    use(ctx) { return resolveSpell({ caster: ctx.user, spell: require('../data/spells').SPELLS.stoneskin, cl: ol(ctx.user), dc: 0, targets: [ctx.user], rng: ctx.rng }); },
  },
  'armor-of-bones': armorRevelation('Armor of Bones', 'bludgeoning'),
  'coat-of-many-stars': armorRevelation('Coat of Many Stars', 'slashing'),
  'ice-armor': armorRevelation('Ice Armor', 'piercing'),
  'air-barrier': armorRevelation('Air Barrier', null),
  'deaths-touch': energyTouch("Death's Touch", 'negative'),
  'touch-of-flame': energyTouch('Touch of Flame', 'fire'),
  'touch-of-acid': energyTouch('Touch of Acid', 'acid'),
  'wintry-touch': energyTouch('Wintry Touch', 'cold'),
  'touch-of-electricity': energyTouch('Touch of Electricity', 'electricity'),
  'soul-siphon': {
    name: 'Soul Siphon', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => 1 + (ol(u) >= 11 ? 1 + Math.floor((ol(u) - 11) / 4) : 0),
    use({ user, target, rng }) {
      const atk = touchAttack(user, target, 'rangedTouch', rng);
      if (!atk.hit) return { target: target.id, attack: atk, note: 'missed' };
      target.negativeLevels.temporary = (target.negativeLevels.temporary || 0) + 1;
      target.touch();
      return { target: target.id, attack: atk, negativeLevels: 1, healed: user.heal(ol(user)) };
    },
  },
  'fire-breath': blastRevelation('Fire Breath', { diceFn: (u) => `${ol(u)}d4`, energy: 'fire' }),
  'lightning-breath': blastRevelation('Lightning Breath', { diceFn: (u) => `${ol(u)}d4`, energy: 'electricity' }),
  'heat-aura': blastRevelation('Heat Aura', { diceFn: (u) => `${Math.max(1, half(ol(u)))}d4`, energy: 'fire', after: ({ user }) => user.addEffect(makeEffect({ key: 'rev:heat-aura', name: 'Heat aura', remaining: 1, flags: ['concealment:20'] })) }),
  'spray-of-shooting-stars': blastRevelation('Spray of Shooting Stars', { diceFn: (u) => `${ol(u)}d4`, energy: 'fire' }),
  'interstellar-void': blastRevelation('Interstellar Void', {
    diceFn: (u) => `${ol(u)}d6`, energy: 'cold', save: 'fort', perDay: (u) => (ol(u) >= 10 ? 2 : 1),
    after: ({ user, targets, target }, r) => {
      for (const res of r.results) {
        if (res.save && !res.save.success && ol(user) >= 10) {
          const t = (targets || [target]).find((x) => x.id === res.target);
          if (t) t.addCondition(ol(user) >= 15 ? 'exhausted' : 'fatigued', null, { id: user.id, name: 'Interstellar void' });
          if (t && ol(user) >= 15) t.addCondition('stunned', 1, { id: user.id, name: 'Interstellar void' });
        }
      }
    },
  }),
  'mighty-pebble': blastRevelation('Mighty Pebble', { diceFn: (u) => `${Math.max(1, half(ol(u)))}d6`, energy: 'bludgeoning' }),
  'shard-explosion': blastRevelation('Shard Explosion', { diceFn: (u) => `${Math.max(1, half(ol(u)))}d6`, energy: 'piercing' }),
  firestorm: blastRevelation('Firestorm', { diceFn: (u) => `${ol(u)}d6`, energy: 'fire', perDay: () => 1 }),
  blizzard: blastRevelation('Blizzard', { diceFn: (u) => `${ol(u)}d4`, energy: 'cold', perDay: () => 1 }),
  thunderburst: blastRevelation('Thunderburst', {
    diceFn: (u) => `${ol(u)}d6`, energy: 'bludgeoning', save: 'fort', perDay: (u) => 1 + (ol(u) >= 11 ? 1 + Math.floor((ol(u) - 11) / 4) : 0),
    after: ({ user, targets }, r) => { for (const res of r.results) if (res.save && !res.save.success) { const t = (targets || []).find((x) => x.id === res.target); if (t) t.addCondition('deafened', 600, { id: user.id, name: 'Thunderburst' }); } },
  }),
  'form-of-flame': elementalForm('Form of Flame', 'fire'),
  'water-form': elementalForm('Water Form', 'water'),
  'wings-of-fire': { name: 'Wings of Fire', action: 'swift', target: 'self', use({ user }) { user.addEffect(makeEffect({ key: 'rev:wings', name: 'Wings of Fire', remaining: 10 * ol(user), flags: ['fly:60'] })); return { rounds: 10 * ol(user) }; } },
  'wings-of-air': { name: 'Wings of Air', action: 'swift', target: 'self', use({ user }) { user.addEffect(makeEffect({ key: 'rev:wings', name: 'Wings of Air', remaining: 10 * ol(user), flags: [ol(user) >= 10 ? 'fly:90' : 'fly:60'] })); return { rounds: 10 * ol(user) }; } },
  'oracle-invisibility': {
    name: 'Invisibility', action: 'standard', target: 'self',
    use({ user }) {
      const greater = ol(user) >= 9;
      user.addEffect(makeEffect({ key: 'spell:invisibility', name: greater ? 'Greater invisibility' : 'Invisibility', remaining: greater ? ol(user) : 10 * ol(user), flags: ['invisible'], breaksOnAttack: !greater }));
      return { greater };
    },
  },
  'channel-energy-oracle': {
    name: 'Channel Energy', action: 'standard', target: 'area',
    use(ctx) {
      spend(ctx.user, 'oracleChannel');
      const { channel } = require('./classAbilities');
      return channel(ctx, Math.ceil(ol(ctx.user) / 2), 10 + half(ol(ctx.user)) + ctx.user.abilityMod('cha'), 'positive');
    },
  },
  'brain-drain': {
    name: 'Brain Drain', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: onePlusPerFive,
    use({ user, target, rng }) {
      const s = checks.savingThrow(target, 'will', { dc: revDC(user), rng, tags: ['mind-affecting'] });
      if (s.success) return { target: target.id, save: s, note: 'saved' };
      const res = applyDamage(target, [{ amount: dice.total(`${ol(user)}d4`, rng), type: 'untyped' }]);
      return { target: target.id, save: s, damage: res.total, state: res.state };
    },
  },
  'life-leach': {
    name: 'Life Leach', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => 1 + Math.floor((ol(u) - 7) / 4),
    use({ user, target, rng }) {
      if (!target.isLiving()) throw err('Life leach only affects living creatures');
      const s = checks.savingThrow(target, 'fort', { dc: revDC(user), rng });
      const amt = dice.total(`${Math.min(10, Math.max(1, half(ol(user))))}d6`, rng);
      const res = applyDamage(target, [{ amount: s.success ? half(amt) : amt, type: 'untyped' }]);
      user.addTempHp(res.total, 'rev:life-leach');
      return { target: target.id, save: s, damage: res.total, tempHp: res.total };
    },
  },

  // ------------------------------------------------------------ Witch hexes
  cackle: {
    name: 'Cackle', action: 'move', target: 'none',
    use({ user, encounter }) {
      const pool = encounter ? encounter.within(user, 30) : [];
      let n = 0;
      for (const c of pool) for (const e of c.effects) if ((e.key || '').startsWith('hex:') && e.sourceId === user.id && e.remaining !== null) { e.remaining += 1; n++; c.touch(); }
      return { extended: n };
    },
  },
  'evil-eye': hex('Evil Eye', {
    save: 'will', oncePerDay: false,
    apply({ user, options }, t, s) {
      const pen = wl(user) >= 8 ? -4 : -2;
      const target = ['ac', 'abilityCheck', 'attack', 'save', 'skill'].includes(options.penalty) ? options.penalty : 'ac';
      const rounds = s && s.success ? 1 : 3 + intMod(user);
      t.addEffect(makeEffect({ key: `hex:evil-eye:${target}`, name: `Evil Eye (${target})`, sourceId: user.id, remaining: rounds, modifiers: [mod(target, pen, 'untyped', 'Evil eye')], tags: ['mind-affecting', 'hex'] }));
      return { penalty: pen, on: target, rounds };
    },
  }),
  misfortune: hex('Misfortune', {
    save: 'will',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      const rounds = 1 + (wl(user) >= 8 ? 1 : 0) + (wl(user) >= 16 ? 1 : 0);
      t.addEffect(makeEffect({ key: 'hex:misfortune', name: 'Misfortune', sourceId: user.id, remaining: rounds, flags: ['rollTwiceWorse'], tags: ['hex'] }));
      return { rounds };
    },
  }),
  fortune: hex('Fortune', {
    side: 'ally',
    apply({ user }, t) {
      const rounds = 1 + (wl(user) >= 8 ? 1 : 0) + (wl(user) >= 16 ? 1 : 0);
      t.addEffect(makeEffect({ key: 'hex:fortune', name: 'Fortune', sourceId: user.id, remaining: rounds, flags: ['rollTwiceBetter'], tags: ['hex'] }));
      return { rounds };
    },
  }),
  slumber: hex('Slumber', {
    save: 'will',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      if (t.isImmune(['sleep', 'mind-affecting'])) return { note: 'immune' };
      t.addEffect(makeEffect({ key: 'hex:slumber', name: 'Slumber', kind: 'condition', sourceId: user.id, remaining: wl(user), conditions: ['unconscious'], wakeOnDamage: true, tags: ['sleep', 'hex'] }));
      return { rounds: wl(user) };
    },
  }),
  'hex-charm': hex('Charm', { save: 'will', apply({ user }, t, s) { if (s && s.success) return { note: 'saved' }; t.addCondition('charmed', Math.max(1, intMod(user)), { id: user.id, name: 'Charm hex' }); return { condition: 'charmed' }; } }),
  'hex-healing': hex('Healing', { side: 'ally', apply(ctx, t) { return { result: resolveSpell({ caster: ctx.user, spell: require('../data/spells').SPELLS[wl(ctx.user) >= 5 ? 'cure-moderate-wounds' : 'cure-light-wounds'], cl: wl(ctx.user), dc: 0, targets: [t], rng: ctx.rng }).results[0] }; } }),
  'major-healing': hex('Major Healing', { side: 'ally', apply(ctx, t) { return { result: resolveSpell({ caster: ctx.user, spell: require('../data/spells').SPELLS[wl(ctx.user) >= 15 ? 'cure-critical-wounds' : 'cure-serious-wounds'], cl: wl(ctx.user), dc: 0, targets: [t], rng: ctx.rng }).results[0] }; } }),
  ward: hex('Ward', {
    side: 'ally', oncePerDay: false,
    apply({ user, encounter }, t) {
      if (t.id === user.id) throw err('Ward cannot target the witch herself');
      const b = wl(user) >= 16 ? 4 : wl(user) >= 8 ? 3 : 2;
      for (const c of encounter ? encounter.creatures() : [t]) c.removeEffectsWhere((e) => e.key === 'hex:ward' && e.sourceId === user.id);
      t.addEffect(makeEffect({ key: 'hex:ward', name: 'Ward', sourceId: user.id, remaining: null, modifiers: [mod('ac', b, 'deflection', 'Ward'), mod('save', b, 'resistance', 'Ward')], breaksWhenHit: true, tags: ['hex'] }));
      return { bonus: b };
    },
  }),
  'hex-flight': {
    name: 'Flight', action: 'standard', target: 'self',
    use({ user }) {
      if (wl(user) < 5) throw err('Flying with the flight hex requires 5th level (feather fall and levitate are always available)');
      const max = wl(user) * 10;
      const used = user.resourcesUsed.hexFlight || 0;
      if (used >= max) throw err('No flight remaining today');
      user.resourcesUsed.hexFlight = max;
      user.addEffect(makeEffect({ key: 'hex:flight', name: 'Flight hex', remaining: max - used, flags: ['fly:60'] }));
      return { rounds: max - used };
    },
  },
  agony: hex('Agony', {
    save: 'fort',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      t.addEffect(makeEffect({ key: 'hex:agony', name: 'Agony', kind: 'condition', sourceId: user.id, remaining: wl(user), conditions: ['nauseated'], saveEachRound: { type: 'fort', dc: hexDC(user) }, tags: ['hex'] }));
      return { rounds: wl(user) };
    },
  }),
  retribution: hex('Retribution', { save: 'will', oncePerDay: false, apply({ user }, t, s) { if (s && s.success) return { note: 'saved' }; t.addEffect(makeEffect({ key: 'hex:retribution', name: 'Retribution', sourceId: user.id, remaining: Math.max(1, intMod(user)), flags: ['retribution'], tags: ['hex'] })); return { rounds: Math.max(1, intMod(user)) }; } }),
  'waxen-image': hex('Waxen Image', { save: 'will', apply({ user }, t, s) { if (s && s.success) return { note: 'saved' }; t.addCondition('dominated', 1, { id: user.id, name: 'Waxen image' }); return { condition: 'dominated', uses: Math.max(1, intMod(user)) }; } }),
  'death-curse': hex('Death Curse', {
    save: 'will',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      t.addCondition('fatigued', 1, { id: user.id, name: 'Death curse' });
      t.addEffect(makeEffect({ key: 'hex:death-curse', name: 'Death Curse', sourceId: user.id, remaining: 3, onEnd: [{ save: 'fort', dc: hexDC(user), slay: true }], tags: ['hex', 'death'] }));
      return { note: 'dies in 3 rounds unless it makes a Fort save' };
    },
  }),
  'eternal-slumber': hex('Eternal Slumber', { save: 'will', apply({ user }, t, s) { if (s && s.success) return { note: 'saved' }; t.addEffect(makeEffect({ key: 'hex:eternal-slumber', name: 'Eternal Slumber', kind: 'condition', sourceId: user.id, remaining: null, conditions: ['unconscious'], tags: ['sleep', 'hex', 'curse'] })); return { condition: 'unconscious' }; } }),
  'life-giver': {
    name: 'Life Giver', action: 'full', target: 'ally', resource: (u, id) => `power:${id}`, perDay: () => 1,
    use(ctx) { return resolveSpell({ caster: ctx.user, spell: require('../data/spells').SPELLS.resurrection, cl: wl(ctx.user), dc: 0, targets: [ctx.target], rng: ctx.rng, options: { noMaterial: true } }); },
  },
};

module.exports = { ABILITIES, throwBomb, mutagenMods };
