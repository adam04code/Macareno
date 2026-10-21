'use strict';

const dice = require('./dice');
const checks = require('./checks');
const { mod } = require('./modifiers');
const { makeEffect } = require('./effects');
const { applyDamage } = require('./attacks');
const { touchAttack, resolveSpell } = require('./spellEffects');
const { hex, areaDamage, hexDC } = require('./abilitiesApg');

/**
 * Activated abilities of the Advanced Class Guide classes. Same format as
 * src/engine/classAbilities.js (which merges this table into ABILITIES).
 */

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
const half = (n) => Math.floor(n / 2);
const spend = (u, r, n = 1) => { if (!u.spendResource(r, n)) throw err(`Not enough ${r} remaining`); };
const pos = (u, a) => Math.max(0, u.abilityMod(a));
const arcL = (u) => u.prog('arcanistLevel');
const exploitDC = (u) => 10 + half(arcL(u)) + u.abilityMod('cha');
const shamanL = (u) => u.classLevel('shaman');
const wpL = (u) => u.prog('warpriestLevel');
const skaldL = (u) => u.prog('skaldLevel');
const SPELLS = () => require('../data/spells').SPELLS;
const ACG = () => require('../data/classOptionsAcg');

/** Dice for arcanist blast exploits: 1d6 + 1d6 per two levels after 1st (max 10d6). */
const exploitDice = (u, die = 6) => `${Math.min(10, 1 + Math.floor((arcL(u) - 1) / 2))}d${die}+${pos(u, 'cha')}`;

/** Ranged-touch arcanist exploit (acid jet, ice missile, lightning lance). */
function exploitRay(name, energy, rider) {
  return {
    name, action: 'standard', target: 'enemy',
    use(ctx) {
      const { user, target, rng } = ctx;
      const cost = rider.greater && user.hasOption('arcanist-exploit', rider.greater) && ctx.options.greater ? 2 : 1;
      spend(user, 'reservoir', cost);
      const atk = touchAttack(user, target, 'rangedTouch', rng);
      if (!atk.hit) return { target: target.id, attack: atk, note: 'missed' };
      const res = applyDamage(target, [{ amount: dice.total(exploitDice(user), rng) * (atk.crit ? 2 : 1), type: energy, damageTypes: [energy], magic: true }]);
      const s = checks.savingThrow(target, 'fort', { dc: exploitDC(user), rng, tags: [energy] });
      if (!s.success && target.isAlive()) target.addCondition(rider.condition, rider.rounds(rng), { id: user.id, name });
      if (cost === 2 && rider.greaterEffect) rider.greaterEffect(ctx, target, s);
      return { target: target.id, attack: atk, damage: res.total, state: res.state, save: s, rider: s.success ? null : rider.condition };
    },
  };
}

/** Line exploits (flame arc, holy water jet): Reflex half against everything in the line. */
function exploitLine(name, energy, { die = 6, filter } = {}) {
  return {
    name, action: 'standard', target: 'area',
    use(ctx) {
      spend(ctx.user, 'reservoir');
      const targets = (ctx.targets || (ctx.target ? [ctx.target] : [])).filter((t) => !filter || filter(t));
      return areaDamage({ ...ctx, targets }, { diceExpr: exploitDice(ctx.user, die), energy, save: 'ref', dc: exploitDC(ctx.user) });
    },
  };
}

/** Self buff that costs a reservoir point. */
function exploitBuff(name, { rounds, build }) {
  return {
    name, action: 'standard', target: 'self',
    use(ctx) {
      spend(ctx.user, 'reservoir');
      const r = rounds(ctx.user);
      ctx.user.removeEffectsWhere((e) => e.key === `exploit:${name}`);
      ctx.user.addEffect(makeEffect({ key: `exploit:${name}`, name, kind: 'ability', remaining: r, ...build(ctx) }));
      return { rounds: r };
    },
  };
}

/** Spirit touch attacks: 3 + Cha mod per day, 1d6 (or 1d4) + 1 per two shaman levels. */
function spiritTouch(name, energy, { die = 6, after, nonlethal } = {}) {
  return {
    name, action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => 3 + pos(u, 'cha'),
    use(ctx) {
      const { user, target, rng } = ctx;
      const atk = touchAttack(user, target, 'meleeTouch', rng);
      if (!atk.hit) return { target: target.id, attack: atk, note: 'missed' };
      const amt = dice.total(`1d${die}+${half(shamanL(user))}`, rng) * (atk.crit ? 2 : 1);
      const res = applyDamage(target, [{ amount: amt, type: energy, nonlethal: !!nonlethal, damageTypes: [energy], magic: true }]);
      const r = { target: target.id, attack: atk, damage: res.total, state: res.state };
      if (after) after(ctx, r);
      return r;
    },
  };
}

/** Bloodrage bonuses by bloodrager level (as rage: greater at 11th, mighty at 20th). */
function bloodrageBonuses(u) {
  const l = u.classLevel('bloodrager');
  if (l >= 20) return { abil: 8, will: 4 };
  if (l >= 11) return { abil: 6, will: 3 };
  return { abil: 4, will: 2 };
}

/** Raging song helper: spend rounds and apply an effect to allies (or enemies). */
function ragingSong(name, { minLevel = 1, side = 'allies', build, save }) {
  return {
    name, action: 'standard', target: side,
    use(ctx) {
      const { user, rng } = ctx;
      if (skaldL(user) < minLevel) throw err(`${name} requires skald level ${minLevel}`);
      const rounds = Math.min(ctx.options.rounds || 1, user.resourceRemaining('ragingSong'));
      if (rounds < 1) throw err('No raging song rounds remaining');
      spend(user, 'ragingSong', rounds);
      const targets = side === 'allies' ? ctx.allies || [user] : ctx.enemies || (ctx.target ? [ctx.target] : []);
      const dc = 10 + half(skaldL(user)) + user.abilityMod('cha');
      const results = [];
      for (const t of targets) {
        if (save) {
          const s = checks.savingThrow(t, save, { dc, rng, tags: ['mind-affecting', 'performance'] });
          if (s.success) { results.push({ target: t.id, save: s, note: 'saved' }); continue; }
        }
        t.removeEffectsWhere((e) => e.key === `song:${name}` && e.sourceId === user.id);
        t.addEffect(makeEffect({ key: `song:${name}`, name, kind: 'ability', sourceId: user.id, remaining: rounds, ...build(user, t) }));
        results.push({ target: t.id, effect: name, rounds });
      }
      return { rounds, results };
    },
  };
}

/** Warpriest blessing effect (minor or major) on a target. */
function blessingEffect(user, id, major) {
  const b = ACG().BLESSINGS[id];
  const part = major ? b.major : b.minor;
  const fx = part.fx ? part.fx(wpL(user)) : {};
  const { rounds = 10, ...rest } = fx;
  return { part, effect: makeEffect({ key: `blessing:${id}:${major ? 'major' : 'minor'}`, name: part.name, kind: 'ability', sourceId: user.id, remaining: rounds, ...rest }) };
}

const ABILITIES = {
  // ---------------------------------------------------------------- Arcanist
  'consume-spells': {
    name: 'Consume Spells', action: 'move', target: 'self',
    use({ user, options }) {
      const sc = require('./spellcasting');
      const lvl = Number(options.level);
      const slots = sc.slotsPerDay(user, 'arcanist');
      const st = sc.state(user, 'arcanist');
      if (!lvl || lvl < 1 || !slots[lvl]) throw err('options.level must be a spell level with arcanist slots');
      if ((st.used[lvl] || 0) >= slots[lvl]) throw err(`No level ${lvl} slots remaining to consume`);
      const r = user.resources().reservoir;
      const left = user.resourceRemaining('reservoir');
      const max = user.prog('reservoirMax') + (user.hasFeat('extra-reservoir') ? 3 * user.featCount('extra-reservoir') : 0);
      const gain = Math.min(lvl, Math.max(0, max - left));
      if (!r || gain < 1) throw err('Arcane reservoir is full');
      st.used[lvl] = (st.used[lvl] || 0) + 1;
      user.resourcesUsed.reservoir = (user.resourcesUsed.reservoir || 0) - gain;
      user.touch();
      return { consumed: lvl, gained: gain };
    },
  },
  'acid-jet': exploitRay('Acid Jet', 'acid', {
    condition: 'sickened', rounds: (rng) => dice.total('1d4', rng), greater: 'lingering-acid',
    greaterEffect: ({ user }, t) => t.addEffect(makeEffect({ key: 'exploit:lingering-acid', name: 'Lingering Acid', sourceId: user.id, remaining: Math.max(1, pos(user, 'cha')), ongoing: { dice: `${Math.max(1, half(Math.min(10, 1 + Math.floor((arcL(user) - 1) / 2))))}d6`, type: 'acid' } })),
  }),
  'ice-missile': exploitRay('Ice Missile', 'cold', {
    condition: 'staggered', rounds: () => 1, greater: 'icy-tomb',
    greaterEffect: ({ user }, t, s) => { if (!s.success) t.addCondition('entangled', Math.max(1, pos(user, 'cha')), { id: user.id, name: 'Icy tomb' }); },
  }),
  'lightning-lance': exploitRay('Lightning Lance', 'electricity', { condition: 'dazzled', rounds: () => 1 }),
  'flame-arc': exploitLine('Flame Arc', 'fire'),
  'holy-water-jet': exploitLine('Holy Water Jet', 'positive', { die: 8, filter: (t) => t.creatureType() === 'undead' || (t.creatureType() === 'outsider' && t.axes().evil) }),
  'force-strike': {
    name: 'Force Strike', action: 'standard', target: 'enemy',
    use({ user, target, rng }) {
      spend(user, 'reservoir');
      const res = applyDamage(target, [{ amount: dice.total(`1d4+${arcL(user)}`, rng), type: 'force', damageTypes: ['force'], magic: true }]);
      return { target: target.id, damage: res.total, state: res.state };
    },
  },
  'arcane-barrier': {
    name: 'Arcane Barrier', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'reservoir');
      const hp = arcL(user) + pos(user, 'cha');
      user.addTempHp(hp, 'arcane-barrier');
      return { tempHp: hp };
    },
  },
  'arcane-weapon': exploitBuff('Arcane Weapon', {
    rounds: (u) => 10 * Math.max(1, pos(u, 'cha')),
    build: ({ user }) => {
      const l = arcL(user);
      const b = l >= 17 ? 4 : l >= 13 ? 3 : l >= 9 ? 2 : 1;
      return { modifiers: [mod('attack', b, 'enhancement', 'Arcane weapon', ['weapon']), mod('damage', b, 'enhancement', 'Arcane weapon', ['weapon'])], flags: ['magicWeapon'] };
    },
  }),
  'energy-shield': exploitBuff('Energy Shield', {
    rounds: (u) => 10 * arcL(u),
    build: ({ user, options }) => {
      const energy = ['acid', 'cold', 'electricity', 'fire', 'sonic'].includes(options.energy) ? options.energy : 'fire';
      return { resist: { [energy]: Math.min(30, 10 + 5 * Math.floor(arcL(user) / 5)) } };
    },
  }),
  'wooden-flesh': exploitBuff('Wooden Flesh', {
    rounds: (u) => 10 * arcL(u),
    build: ({ user }) => ({ modifiers: [mod('ac', 2, 'natural', 'Wooden flesh')], dr: [{ amount: Math.max(1, pos(user, 'cha')), bypass: 'slashing' }] }),
  }),
  'dimensional-slide': {
    name: 'Dimensional Slide', action: 'move', target: 'none',
    use({ user }) {
      spend(user, 'reservoir');
      return { range: 10 * arcL(user), note: 'move up to this distance without provoking (teleportation)' };
    },
  },

  // ---------------------------------------------------------------- Bloodrager
  bloodrage: {
    name: 'Bloodrage', action: 'free', target: 'self',
    use({ user, options, rng }) {
      if (user.hasFlag('raging')) throw err('Already raging');
      if (user.hasCondition('fatigued')) throw err('Cannot bloodrage while fatigued');
      const rounds = Math.min(options.rounds || user.resourceRemaining('bloodrage'), user.resourceRemaining('bloodrage'));
      if (rounds < 1) throw err('No bloodrage rounds remaining');
      spend(user, 'bloodrage', rounds);
      const b = bloodrageBonuses(user);
      const tireless = user.hasFeature('tireless-bloodrage');
      const bl = ACG().BLOODRAGER_BLOODLINES[user.choices['bloodrager-bloodline']];
      const extra = [];
      // Abyssal demonic bulk / arcane bloodrage: the chosen spell-like transformation rides along.
      if (bl && bl.rageSpells && options.spell && bl.rageSpells(user).includes(options.spell)) extra.push(options.spell);
      user.addEffect(makeEffect({
        key: 'ability:bloodrage', name: 'Bloodrage', kind: 'ability', remaining: rounds, flags: ['raging', 'bloodraging', ...(user.hasFeature('blood-casting') ? [] : ['noConcentration'])],
        modifiers: [mod('str', b.abil, 'morale', 'Bloodrage'), mod('con', b.abil, 'morale', 'Bloodrage'), mod('save.will', b.will, 'morale', 'Bloodrage'), mod('ac', -2, 'untyped', 'Bloodrage')],
        onEnd: tireless ? [] : [{ condition: 'fatigued', rounds: rounds * 2 }], data: { rounds },
      }));
      const results = extra.map((sp) => resolveSpell({ caster: user, spell: SPELLS()[sp], cl: user.classLevel('bloodrager'), dc: 0, targets: [user], rng }).results[0]);
      return { rounds, bonus: b, ...(results.length ? { spell: extra[0], results } : {}) };
    },
  },
  'end-bloodrage': {
    name: 'End Bloodrage', action: 'free', target: 'self',
    use({ user }) {
      const e = user.effects.find((x) => x.key === 'ability:bloodrage');
      if (!e) throw err('Not bloodraging');
      const unused = Math.max(0, e.remaining || 0);
      user.resourcesUsed.bloodrage = Math.max(0, (user.resourcesUsed.bloodrage || 0) - unused);
      const used = (e.data.rounds || 0) - unused;
      user.removeEffect(e.id);
      if (!user.hasFeature('tireless-bloodrage')) user.addCondition('fatigued', Math.max(1, used * 2), { name: 'Bloodrage' });
      return { refunded: unused };
    },
  },
  'elemental-strikes': {
    name: 'Elemental Strikes', action: 'swift', target: 'self', resource: (u, id) => `power:${id}`, perDay: (u) => (u.prog('bloodragerBloodlineLevel') >= 8 ? 5 : 3),
    use({ user }) {
      if (!user.hasFlag('raging')) throw err('Must be bloodraging');
      const energy = { air: 'electricity', earth: 'acid', fire: 'fire', water: 'cold' }[user.choices.element] || 'fire';
      user.addEffect(makeEffect({ key: 'power:elemental-strikes', name: 'Elemental Strikes', kind: 'ability', remaining: 1, bonusDamage: [{ dice: '1d6', type: energy, weaponOnly: true }] }));
      return { energy };
    },
  },
  'hellfire-strike': {
    name: 'Hellfire Strike', action: 'swift', target: 'self', resource: (u, id) => `power:${id}`, perDay: (u) => (u.prog('bloodragerBloodlineLevel') >= 12 ? 5 : 3),
    use({ user }) {
      if (!user.hasFlag('raging')) throw err('Must be bloodraging');
      user.addEffect(makeEffect({ key: 'power:hellfire-strike', name: 'Hellfire Strike', kind: 'ability', remaining: 1, bonusDamage: [{ dice: '1d6', type: 'fire', weaponOnly: true }] }));
      return { bonus: '1d6 fire' };
    },
  },
  'bloodrager-breath': {
    name: 'Breath Weapon', action: 'standard', target: 'area', resource: (u, id) => `power:${id}`,
    perDay: (u) => (u.prog('bloodragerBloodlineLevel') >= 20 ? 3 : u.prog('bloodragerBloodlineLevel') >= 16 ? 2 : 1),
    use(ctx) {
      const l = ctx.user.prog('bloodragerBloodlineLevel');
      return areaDamage(ctx, { diceExpr: `${l}d6`, energy: ctx.user.dragonEnergy(), save: 'ref', dc: 10 + half(l) + ctx.user.abilityMod('con') });
    },
  },

  // ---------------------------------------------------------------- Hunter
  'animal-focus': {
    name: 'Animal Focus', action: 'swift', target: 'self',
    use({ user, options }) {
      const aspects = ACG().ANIMAL_ASPECTS;
      const picks = [].concat(options.aspect || []);
      const max = user.hasFeature('second-animal-focus') ? 2 : 1;
      if (!picks.length || picks.length > max || picks.some((a) => !aspects[a])) throw err(`options.aspect: up to ${max} of ${Object.keys(aspects).join(', ')}`);
      const l = user.prog('hunterLevel');
      user.removeEffectsWhere((e) => (e.key || '').startsWith('focus:'));
      for (const a of picks) {
        const fx = aspects[a].build(l);
        user.addEffect(makeEffect({ key: `focus:${a}`, name: `Animal Focus (${aspects[a].name})`, kind: 'ability', remaining: user.hasFlag('permanentAnimalFocus') ? null : 10 * l, ...fx }));
      }
      return { aspects: picks };
    },
  },

  // ---------------------------------------------------------------- Shaman spirits
  'battle-spirit': {
    name: 'Battle Spirit', action: 'standard', target: 'allies', resource: (u, id) => `power:${id}`, perDay: (u) => 1,
    use(ctx) {
      const l = shamanL(ctx.user);
      const b = l >= 16 ? 3 : l >= 8 ? 2 : 1;
      const rounds = 3 + pos(ctx.user, 'cha');
      for (const t of ctx.allies || [ctx.user]) t.addEffect(makeEffect({ key: 'spirit:battle', name: 'Battle Spirit', sourceId: ctx.user.id, remaining: rounds, modifiers: [mod('attack', b, 'morale', 'Battle spirit'), mod('damage', b, 'morale', 'Battle spirit', ['weapon'])] }));
      return { bonus: b, rounds };
    },
  },
  'touch-of-the-grave': spiritTouch('Touch of the Grave', 'negative', { die: 4 }),
  'touch-of-flames': spiritTouch('Touch of Flames', 'fire'),
  'touch-of-acid-shaman': spiritTouch('Touch of Acid', 'acid'),
  'shocking-touch': spiritTouch('Shocking Touch', 'electricity'),
  'wave-strike': spiritTouch('Wave Strike', 'bludgeoning', { nonlethal: true }),
  stardust: {
    name: 'Stardust', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => 3 + pos(u, 'cha'),
    use({ user, target }) {
      const pen = -(1 + Math.floor(shamanL(user) / 4));
      const rounds = Math.max(1, half(shamanL(user)));
      target.addEffect(makeEffect({ key: 'spirit:stardust', name: 'Stardust', sourceId: user.id, remaining: rounds, flags: ['outlined'], modifiers: [mod('attack', pen, 'untyped', 'Stardust'), mod('skill.perception', pen, 'untyped', 'Stardust')] }));
      return { target: target.id, penalty: pen, rounds };
    },
  },
  'storm-burst-shaman': {
    name: 'Storm Burst', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => 3 + pos(u, 'cha'),
    use({ user, target }) {
      const rounds = Math.max(1, half(shamanL(user)));
      target.addEffect(makeEffect({ key: 'spirit:storm-burst', name: 'Storm Burst', sourceId: user.id, remaining: rounds, flags: ['attackMissChance:20'] }));
      return { target: target.id, rounds };
    },
  },
  'monstrous-insight': {
    name: 'Monstrous Insight', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => 3 + pos(u, 'cha'),
    use({ user, target }) {
      const tag = `id:${target.id}`;
      user.addEffect(makeEffect({ key: `spirit:insight:${target.id}`, name: `Monstrous Insight (${target.name})`, kind: 'ability', remaining: 10, modifiers: [mod('attack', 2, 'insight', 'Monstrous insight', [tag]), mod('ac', 2, 'insight', 'Monstrous insight', [`attacker:${target.id}`])] }));
      return { target: target.id, rounds: 10 };
    },
  },
  'channel-energy-shaman': {
    name: 'Channel Positive Energy', action: 'standard', target: 'area', resource: (u, id) => `power:${id}`, perDay: (u) => 1 + pos(u, 'cha'),
    use(ctx) {
      const { channel } = require('./classAbilities');
      const l = shamanL(ctx.user);
      return channel(ctx, Math.ceil(l / 2), 10 + half(l) + ctx.user.abilityMod('cha'), 'positive');
    },
  },
  // Spirit hexes (DC 10 + 1/2 shaman level + Wis).
  fury: hex('Fury', {
    side: 'ally',
    apply({ user }, t) {
      const b = 2 + (shamanL(user) >= 8 ? 1 : 0) + (shamanL(user) >= 16 ? 1 : 0);
      const rounds = Math.max(1, pos(user, 'wis'));
      t.addEffect(makeEffect({ key: 'hex:fury', name: 'Fury', sourceId: user.id, remaining: rounds, modifiers: [mod('attack', b, 'morale', 'Fury'), mod('save', b, 'resistance', 'Fury', ['fear'])], tags: ['hex'] }));
      return { bonus: b, rounds };
    },
  }),
  'battle-ward': hex('Battle Ward', {
    side: 'ally', oncePerDay: false,
    apply({ user }, t) {
      const b = shamanL(user) >= 16 ? 5 : shamanL(user) >= 8 ? 4 : 3;
      t.removeEffectsWhere((e) => e.key === 'hex:battle-ward');
      t.addEffect(makeEffect({ key: 'hex:battle-ward', name: 'Battle Ward', sourceId: user.id, remaining: null, modifiers: [mod('ac', b, 'deflection', 'Battle ward')], tags: ['hex'] }));
      return { bonus: b };
    },
  }),
  'bone-ward': hex('Bone Ward', {
    side: 'ally', oncePerDay: false,
    apply({ user }, t) {
      const b = shamanL(user) >= 16 ? 4 : shamanL(user) >= 8 ? 3 : 2;
      t.addEffect(makeEffect({ key: 'hex:bone-ward', name: 'Bone Ward', sourceId: user.id, remaining: shamanL(user), modifiers: [mod('ac', b, 'deflection', 'Bone ward')], tags: ['hex'] }));
      return { bonus: b, rounds: shamanL(user) };
    },
  }),
  'hampering-hex': hex('Hampering Hex', {
    save: 'will',
    apply({ user }, t, s) {
      const pen = shamanL(user) >= 8 ? -4 : -2;
      const rounds = s && s.success ? 1 : shamanL(user);
      t.addEffect(makeEffect({ key: 'hex:hampering', name: 'Hampering Hex', sourceId: user.id, remaining: rounds, modifiers: [mod('ac', pen, 'penalty', 'Hampering hex'), mod('cmd', pen, 'penalty', 'Hampering hex')], tags: ['hex'] }));
      return { penalty: pen, rounds };
    },
  }),
  'bone-lock': hex('Bone Lock', {
    save: 'fort',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      const rounds = shamanL(user) >= 16 ? 3 : shamanL(user) >= 8 ? 2 : 1;
      t.addCondition('staggered', rounds, { id: user.id, name: 'Bone lock' });
      return { condition: 'staggered', rounds };
    },
  }),
  'fearful-gaze': hex('Fearful Gaze', {
    save: 'will',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      const cond = shamanL(user) >= 16 ? 'panicked' : shamanL(user) >= 8 ? 'frightened' : 'shaken';
      t.addCondition(cond, 1, { id: user.id, name: 'Fearful gaze' });
      return { condition: cond };
    },
  }),
  'fire-nimbus': hex('Fire Nimbus', {
    save: 'will',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      t.addEffect(makeEffect({ key: 'hex:fire-nimbus', name: 'Fire Nimbus', sourceId: user.id, remaining: shamanL(user), flags: ['outlined'], modifiers: [mod('save', -2, 'penalty', 'Fire nimbus', ['fire'])], tags: ['hex'] }));
      return { rounds: shamanL(user) };
    },
  }),
  'flame-curse': hex('Flame Curse', {
    save: 'will', oncePerDay: false,
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      t.addEffect(makeEffect({ key: 'hex:flame-curse', name: 'Flame Curse', sourceId: user.id, remaining: 1, flags: ['vulnerable:fire'], tags: ['hex', 'curse'] }));
      return { rounds: 1 };
    },
  }),
  starburn: {
    name: 'Starburn', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: (u) => Math.max(1, pos(u, 'cha')),
    use(ctx) {
      const l = shamanL(ctx.user);
      return areaDamage({ ...ctx, targets: [ctx.target] }, { diceExpr: `${Math.max(1, half(l))}d6`, energy: 'fire', save: 'fort', dc: hexDC(ctx.user) });
    },
  },
  'confusion-curse': hex('Confusion Curse', {
    save: 'will',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      const rounds = Math.max(1, pos(user, 'cha'));
      t.addCondition('confused', rounds, { id: user.id, name: 'Confusion curse' });
      return { condition: 'confused', rounds };
    },
  }),
  'entangling-curse': hex('Entangling Curse', {
    save: 'ref',
    apply({ user }, t, s) {
      if (s && s.success) return { note: 'saved' };
      const rounds = Math.max(1, pos(user, 'cha'));
      t.addCondition('entangled', rounds, { id: user.id, name: 'Entangling curse' });
      return { condition: 'entangled', rounds };
    },
  }),
  'air-barrier': {
    name: 'Air Barrier', action: 'standard', target: 'self',
    use({ user }) {
      const l = shamanL(user);
      const bonus = 4 + (l >= 7 ? 2 + 2 * Math.floor((l - 7) / 4) : 0);
      user.removeEffectsWhere((e) => e.key === 'hex:air-barrier');
      user.addEffect(makeEffect({ key: 'hex:air-barrier', name: 'Air Barrier', kind: 'ability', remaining: 600 * l, modifiers: [mod('ac', bonus, 'armor', 'Air barrier')], flags: l >= 13 ? ['rangedMissChance:50'] : [] }));
      return { bonus };
    },
  },

  // ---------------------------------------------------------------- Skald
  'inspired-rage': ragingSong('Inspired Rage', {
    build: (u, t) => {
      const l = skaldL(u);
      const abil = l >= 16 ? 6 : l >= 8 ? 4 : 2;
      const will = 1 + Math.floor(l / 4);
      const mods = [mod('str', abil, 'morale', 'Inspired rage'), mod('con', abil, 'morale', 'Inspired rage'), mod('save.will', will, 'morale', 'Inspired rage')];
      if (!u.hasFlag('masterSkald')) mods.push(mod('ac', -1, 'untyped', 'Inspired rage'));
      const dr = l >= 9 && t.id !== u.id ? [{ amount: l >= 19 ? 3 : l >= 14 ? 2 : 1, bypass: '-' }] : [];
      return { modifiers: mods, flags: ['raging', 'noConcentration'], dr, data: { ragePowersFrom: u.id } };
    },
  }),
  'end-raging-song': {
    name: 'End Raging Song', action: 'free', target: 'none',
    use({ user, encounter }) {
      let n = 0;
      const mine = (e) => (e.key || '').startsWith('song:') && e.sourceId === user.id;
      for (const c of encounter ? encounter.creatures() : [user]) {
        n += c.effects.filter(mine).length;
        c.removeEffectsWhere(mine);
      }
      return { ended: n };
    },
  },
  'song-of-marching': ragingSong('Song of Marching', { minLevel: 3, build: () => ({ flags: ['noHustleFatigue'] }) }),
  'song-of-strength': ragingSong('Song of Strength', { minLevel: 6, build: (u) => ({ modifiers: [mod('strCheck', half(skaldL(u)), 'untyped', 'Song of strength'), ...['climb', 'swim'].map((s) => mod(`skill.${s}`, half(skaldL(u)), 'untyped', 'Song of strength'))] }) }),
  'dirge-of-doom-skald': ragingSong('Dirge of Doom', { minLevel: 10, side: 'enemies', build: () => ({ conditions: ['shaken'], tags: ['fear', 'mind-affecting'] }) }),

  // ---------------------------------------------------------------- Slayer
  'studied-target': {
    name: 'Studied Target', action: 'move', target: 'enemy',
    use({ user, target }) {
      const b = user.prog('studiedBonus');
      const max = user.prog('studiedTargets');
      const tag = `id:${target.id}`;
      const existing = user.effects.filter((e) => (e.key || '').startsWith('studied:'));
      if (existing.length >= max) user.removeEffect(existing[0].id);
      user.removeEffectsWhere((e) => e.key === `studied:${target.id}`);
      user.addEffect(makeEffect({
        key: `studied:${target.id}`, name: `Studied Target (${target.name})`, kind: 'ability', data: { targetId: target.id },
        modifiers: [mod('attack', b, 'untyped', 'Studied target', [tag]), mod('damage', b, 'untyped', 'Studied target', [tag, 'weapon']), ...['bluff', 'perception', 'sense-motive', 'survival'].map((s) => mod(`skill.${s}`, b, 'untyped', 'Studied target', [tag]))],
      }));
      return { target: target.id, bonus: b };
    },
  },
  assassinate: {
    name: 'Assassinate', action: 'full', target: 'enemy',
    use({ user, target, rng }) {
      if (!user.effects.some((e) => e.key === `studied:${target.id}`)) throw err('Target must be your studied target');
      const dc = 10 + half(user.classLevel('slayer')) + user.abilityMod('int');
      const s = checks.savingThrow(target, 'fort', { dc, rng, tags: ['death'] });
      if (!s.success && !target.isImmune(['death'])) { target.die(); return { target: target.id, save: s, slain: true }; }
      return { target: target.id, save: s, slain: false };
    },
  },
  'master-slayer': {
    name: 'Master Slayer', action: 'standard', target: 'enemy',
    use({ user, target, rng }) {
      if (!user.effects.some((e) => e.key === `studied:${target.id}`)) throw err('Target must be your studied target');
      const dc = 10 + half(user.classLevel('slayer')) + user.abilityMod('int');
      const s = checks.savingThrow(target, 'fort', { dc, rng, tags: ['death'] });
      if (!s.success && !target.isImmune(['death'])) { target.die(); return { target: target.id, save: s, slain: true }; }
      return { target: target.id, save: s, slain: false };
    },
  },

  // ---------------------------------------------------------------- Warpriest
  blessing: {
    name: 'Blessing', action: 'standard', target: 'ally',
    use({ user, target, options }) {
      const id = options.blessing;
      if (!user.hasOption('blessings', id)) throw err(`options.blessing must be one of your blessings (${[].concat(user.choices.blessings || []).join(', ')})`);
      const major = !!options.major;
      if (major && wpL(user) < 10) throw err('Major blessings require warpriest level 10');
      const free = major && user.hasFlag('aspectOfWar');
      if (!free) spend(user, 'blessing', major ? 2 : 1);
      const t = target || user;
      const { part, effect } = blessingEffect(user, id, major);
      if (part.summon) return { blessing: part.name, summon: part.summon, note: 'cast the summon spell through the encounter' };
      if (part.fx) t.addEffect(effect);
      return { target: t.id, blessing: part.name, rounds: part.fx ? effect.remaining : 0 };
    },
  },
  'sacred-weapon': {
    name: 'Sacred Weapon', action: 'swift', target: 'self',
    use({ user, options }) {
      const b = user.prog('sacredWeaponBonus');
      if (!b) throw err('Sacred weapon enhancement requires warpriest level 4');
      const rounds = Math.min(options.rounds || user.resourceRemaining('sacredWeapon'), user.resourceRemaining('sacredWeapon'));
      if (rounds < 1) throw err('No sacred weapon rounds remaining');
      spend(user, 'sacredWeapon', rounds);
      user.removeEffectsWhere((e) => e.key === 'ability:sacred-weapon');
      user.addEffect(makeEffect({ key: 'ability:sacred-weapon', name: 'Sacred Weapon', kind: 'ability', remaining: rounds, modifiers: [mod('attack', b, 'enhancement', 'Sacred weapon', ['weapon']), mod('damage', b, 'enhancement', 'Sacred weapon', ['weapon'])], flags: ['magicWeapon'] }));
      return { bonus: b, rounds };
    },
  },
  'sacred-armor': {
    name: 'Sacred Armor', action: 'swift', target: 'self',
    use({ user, options }) {
      const b = user.prog('sacredArmorBonus');
      if (!b) throw err('Sacred armor requires warpriest level 7');
      const minutes = Math.min(options.minutes || user.resourceRemaining('sacredArmor'), user.resourceRemaining('sacredArmor'));
      if (minutes < 1) throw err('No sacred armor minutes remaining');
      spend(user, 'sacredArmor', minutes);
      user.removeEffectsWhere((e) => e.key === 'ability:sacred-armor');
      user.addEffect(makeEffect({ key: 'ability:sacred-armor', name: 'Sacred Armor', kind: 'ability', remaining: 10 * minutes, modifiers: [mod('ac', b, 'enhancement', 'Sacred armor', ['armor'])] }));
      return { bonus: b, minutes };
    },
  },
  fervor: {
    name: 'Fervor', action: 'swift', target: 'ally',
    use(ctx) {
      const { user, target, rng } = ctx;
      spend(user, 'fervor');
      const t = target || user;
      const amt = dice.total(`${user.prog('fervorDice')}d6`, rng);
      if (t.creatureType() === 'undead') {
        const atk = t.id === user.id ? { hit: true } : touchAttack(user, t, 'meleeTouch', rng);
        if (!atk.hit) return { target: t.id, attack: atk, note: 'missed' };
        const res = applyDamage(t, [{ amount: amt, type: 'positive' }]);
        return { target: t.id, damage: res.total, state: res.state };
      }
      return { target: t.id, healed: t.heal(amt) };
    },
  },
  'channel-energy-warpriest': {
    name: 'Channel Energy', action: 'standard', target: 'area',
    use(ctx) {
      const { channel } = require('./classAbilities');
      spend(ctx.user, 'fervor', 2);
      const l = wpL(ctx.user);
      const energy = ctx.options.energy || (ctx.user.alignment[1] === 'E' ? 'negative' : 'positive');
      return channel(ctx, ctx.user.prog('fervorDice'), 10 + half(l) + ctx.user.abilityMod('wis'), energy);
    },
  },
  'aspect-of-war': {
    name: 'Aspect of War', action: 'swift', target: 'self', resource: (u, id) => `power:${id}`, perDay: () => 1,
    use({ user }) {
      user.addEffect(makeEffect({ key: 'ability:aspect-of-war', name: 'Aspect of War', kind: 'ability', remaining: 10, flags: ['babEqualsLevel', 'aspectOfWar'], dr: [{ amount: 10, bypass: '-' }], modifiers: [mod('speed', 10, 'enhancement', 'Aspect of war')] }));
      return { rounds: 10 };
    },
  },
};

module.exports = { ABILITIES, bloodrageBonuses };
