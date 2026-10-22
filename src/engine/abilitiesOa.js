'use strict';

const dice = require('./dice');
const checks = require('./checks');
const { mod } = require('./modifiers');
const { makeEffect } = require('./effects');
const { applyDamage } = require('./attacks');
const { touchAttack } = require('./spellEffects');

/**
 * Kineticist abilities (Occult Adventures): kinetic blast with infusions,
 * metakinesis and burn, gather power, internal buffer and a few utility
 * wild talents. Same format as src/engine/classAbilities.js.
 */

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
const K = () => require('../data/kineticist');
const kl = (u) => u.prog('kineticistLevel');
const half = (n) => Math.floor(n / 2);
const esl = (u) => Math.min(9, Math.max(1, half(kl(u))));
const burnNow = (u) => u.resourcesUsed.burn || 0;
const maxBurn = (u) => 3 + Math.max(0, u.abilityMod('con'));

const METAKINESIS = { empower: { level: 5, burn: 1 }, maximize: { level: 9, burn: 2 }, quicken: { level: 13, burn: 3 }, twice: { level: 17, burn: 4 } };

/**
 * Accept burn: check the per-round and total limits, then take 1 nonlethal
 * damage per character level for each point.
 */
function acceptBurn(user, n) {
  if (n <= 0) return 0;
  if (user.isImmune && user.isImmune('nonlethal')) throw err('Creatures immune to nonlethal damage cannot accept burn');
  const round = user.effects.find((e) => e.key === 'kineticist:burn-round');
  const thisRound = round ? round.data.n : 0;
  if (thisRound + n > user.prog('burnPerRound')) throw err(`You can accept only ${user.prog('burnPerRound')} burn per round`);
  if (burnNow(user) + n > maxBurn(user)) throw err(`Accepting ${n} burn would exceed your maximum of ${maxBurn(user)}`);
  user.resourcesUsed.burn = burnNow(user) + n;
  if (round) round.data.n += n;
  else user.addEffect(makeEffect({ key: 'kineticist:burn-round', name: 'Burn accepted this round', kind: 'ability', remaining: 1, data: { n } }));
  user.takeDamage(n * user.hitDice(), { nonlethal: true });
  user.touch();
  return n;
}

/** Damage expression for a blast (flurry blasts use 1st-level dice). */
function blastDamage(user, blast, { firstLevel = false } = {}) {
  const n = firstLevel ? 1 : user.prog('blastDice');
  const k = blast.composite ? 2 : 1;
  const con = user.abilityMod('con');
  return blast.kind === 'physical' ? { count: n * k, sides: 6, flat: n * k + con } : { count: n * k, sides: 6, flat: Math.floor(con / 2) };
}

function rollBlast(user, blast, meta, rng, opts) {
  const d = blastDamage(user, blast, opts);
  const max = d.count * d.sides + d.flat;
  let amt = meta === 'maximize' ? max : dice.total(`${d.count}d${d.sides}`, rng) + d.flat;
  if (meta === 'empower') amt = Math.floor(amt * 1.5);
  return Math.max(1, amt);
}

/** Damage packets for a blast (split blasts are half one type, half the other). */
function packets(blast, amount, options, extraTypes = []) {
  const physical = ['bludgeoning', 'piercing', 'slashing'];
  const types = blast.anyOne ? [blast.types.includes(options.damageType) ? options.damageType : blast.types[0]] : blast.types;
  if (blast.split) {
    const a = Math.ceil(amount / 2);
    return types.map((t, i) => ({ amount: i === 0 ? a : amount - a, type: t, physical: physical.includes(t), magic: true, damageTypes: [t, ...extraTypes] }));
  }
  const t = types.filter((x) => physical.includes(x));
  return [{ amount, type: types[0], physical: t.length > 0, magic: true, damageTypes: [...types, ...extraTypes] }];
}

/** Apply a substance infusion's rider to a damaged target. */
function substanceRider(user, sub, target, rng) {
  const s = sub && sub.substance;
  if (!s || !target.isAlive()) return null;
  const dc = 10 + esl(user) + user.abilityMod('con');
  if (s.save) {
    const r = checks.savingThrow(target, s.save, { dc, rng, tags: ['kineticist'] });
    if (r.success) return { save: r, note: 'resisted' };
    if (s.condition) target.addCondition(s.condition, s.rounds(user), { id: user.id, name: sub.name });
    if (s.ongoing) target.addEffect(makeEffect({ key: `infusion:${sub.name}`, name: sub.name, sourceId: user.id, remaining: s.rounds, ongoing: s.ongoing }));
    return { save: r, applied: s.condition || sub.name };
  }
  if (s.modifiers) target.addEffect(makeEffect({ key: `infusion:${sub.name}`, name: sub.name, sourceId: user.id, remaining: s.rounds || 1, modifiers: s.modifiers }));
  if (s.maneuver) return { maneuver: s.maneuver, note: `${s.maneuver} using Con (resolve with the maneuver action)` };
  return { applied: sub.name };
}

function knownInfusion(user, id, type, blastId) {
  if (!id) return null;
  const inf = K().INFUSIONS[id];
  if (!inf || !user.hasOption('infusion', id)) throw err(`You don't know the ${id} infusion`);
  if (inf.type !== type) throw err(`${inf.name} is a ${inf.type} infusion`);
  const blast = K().BLASTS[blastId];
  const els = [].concat(blast.element);
  if (inf.elements !== 'universal' && !inf.elements.some((e) => els.includes(e))) throw err(`${inf.name} cannot be used with ${blast.name}`);
  if (inf.blasts && !inf.blasts.includes(blastId)) throw err(`${inf.name} only works with ${inf.blasts.join(', ')}`);
  return inf;
}

const ABILITIES = {
  'kinetic-blast': {
    name: 'Kinetic Blast', action: 'standard', target: 'enemy',
    use(ctx) {
      const { user, rng } = ctx;
      const options = ctx.options || {};
      const known = K().knownBlasts(user);
      const blastId = options.blast || known[0];
      const blast = K().BLASTS[blastId];
      if (!blast || !known.includes(blastId)) throw err(`Unknown blast; you know ${known.join(', ')}`);
      const form = knownInfusion(user, options.form, 'form', blastId);
      const sub = knownInfusion(user, options.substance, 'substance', blastId);
      const meta = options.metakinesis;
      if (meta && (!METAKINESIS[meta] || kl(user) < METAKINESIS[meta].level)) throw err(`Metakinesis must be one of ${Object.entries(METAKINESIS).filter(([, m]) => kl(user) >= m.level).map(([k]) => k).join(', ') || '(none yet)'}`);

      // Burn: blast + infusions (less specialization) + metakinesis, less gathered power and buffer.
      let cost = Math.max(0, blast.burn - (blast.composite && user.hasFeature('composite-specialization') ? 1 : 0));
      cost += Math.max(0, (form ? form.burn : 0) + (sub ? sub.burn : 0) - user.prog('infusionSpecialization'));
      if (meta) cost += Math.max(0, METAKINESIS[meta].burn - (user.choices.metakineticMaster === meta && user.hasFeature('metakinetic-master') ? 1 : 0));
      const gathered = user.effects.find((e) => e.key === 'kineticist:gathered');
      if (gathered) cost = Math.max(0, cost - gathered.data.amount);
      if (options.buffer && cost > 0 && user.spendResource('internalBuffer', 1)) cost -= 1;
      const accepted = acceptBurn(user, cost);
      if (gathered) user.removeEffect(gathered.id);

      // Attack and damage bonuses: elemental overflow, Weapon Focus (kinetic blast), doubled primary element.
      const overflow = kl(user) >= 3 ? Math.min(burnNow(user), user.prog('overflowCap')) : 0;
      const primaryTwice = [].concat(user.choices['expanded-element'] || []).filter((e) => e === user.choices.element).length >= 2 && [].concat(blast.element).includes(user.choices.element) ? 1 : 0;
      const atkBonus = overflow + primaryTwice + (user.featParams('weapon-focus').includes('kinetic-blast') ? 1 : 0);
      const dmgBonus = 2 * overflow + primaryTwice + (user.hasFlag('firesFury') && blastId === 'fire-blast' ? 2 * overflow : 0);
      const dc = 10 + esl(user) + primaryTwice + user.abilityMod(form ? 'dex' : 'con');
      const f = (form && form.form) || {};
      const range = f.range || 30;
      const energy = blast.kind === 'energy';
      const results = [];

      const strike = (target, { firstLevel = false, attackRoll = true } = {}) => {
        let atk = null;
        if (attackRoll) {
          const kind = f.melee ? (energy ? 'meleeTouch' : 'melee') : energy ? 'rangedTouch' : 'ranged';
          atk = touchAttack(user, target, kind, rng, atkBonus);
          if (!atk.hit) return { target: target.id, attack: atk, note: 'missed' };
        }
        let amt = rollBlast(user, blast, meta, rng, { firstLevel }) + dmgBonus;
        if (atk && atk.crit) amt *= 2;
        if (f.damageMult) amt = Math.max(1, Math.floor(amt * (energy && f.damageMult === 0.25 ? 0.5 : f.damageMult)));
        const res = applyDamage(target, packets(blast, amt, options));
        return { target: target.id, attack: atk, damage: res.total, state: res.state, rider: substanceRider(user, sub, target, rng) };
      };

      const passes = meta === 'twice' ? 2 : 1;
      for (let p = 0; p < passes; p++) {
        if (f.area) {
          const targets = ctx.targets || (ctx.target ? [ctx.target] : []);
          if (f.attackEach) {
            for (const t of targets) results.push(strike(t));
          } else {
            for (const t of targets) {
              let amt = rollBlast(user, blast, meta, rng) + dmgBonus;
              if (f.damageMult) amt = Math.max(1, Math.floor(amt * (energy && f.damageMult === 0.25 ? 0.5 : f.damageMult)));
              const s = f.save ? checks.savingThrow(t, f.save, { dc, rng, tags: ['kineticist', ...blast.types] }) : null;
              if (s && s.success) amt = f.effect === 'negates' || (f.save === 'ref' && t.hasFlag('evasion')) ? 0 : half(amt);
              else if (s && f.save === 'ref' && t.hasFlag('improvedEvasion')) amt = half(amt);
              const res = amt > 0 ? applyDamage(t, packets(blast, amt, options)) : { total: 0, state: t.hpState() };
              results.push({ target: t.id, save: s, damage: res.total, state: res.state, rider: amt > 0 && !(s && s.success) ? substanceRider(user, sub, t, rng) : null });
            }
          }
        } else if (f.flurry) {
          const n = kl(user) >= 20 ? 5 : kl(user) >= 16 ? 4 : kl(user) >= 10 ? 3 : 2;
          const targets = ctx.targets && ctx.targets.length ? ctx.targets : [ctx.target];
          for (let i = 0; i < n; i++) results.push(strike(targets[i % targets.length], { firstLevel: true }));
        } else {
          if (!ctx.target) throw err('Choose a target');
          results.push(strike(ctx.target));
          if (f.chain && results[results.length - 1].attack && results[results.length - 1].attack.hit) {
            for (const t of (ctx.targets || []).filter((x) => x.id !== ctx.target.id)) results.push(strike(t));
          }
        }
      }
      return { blast: blast.name, form: form && form.name, substance: sub && sub.name, metakinesis: meta, burn: accepted, totalBurn: burnNow(user), range, dc: f.save ? dc : undefined, results };
    },
  },
  'gather-power': {
    name: 'Gather Power', action: 'move', target: 'self',
    use({ user, options }) {
      const supercharge = user.hasFeature('supercharge') ? 1 : 0;
      const step = options.fullRound ? 2 + supercharge : 1 + supercharge;
      const prev = user.effects.find((e) => e.key === 'kineticist:gathered');
      const amount = Math.min(3 + supercharge, (prev ? prev.data.amount : 0) + step);
      if (prev) user.removeEffect(prev.id);
      user.addEffect(makeEffect({ key: 'kineticist:gathered', name: 'Gathered Power', kind: 'ability', remaining: options.fullRound ? 2 : 1, data: { amount } }));
      return { reduction: amount, note: options.fullRound ? 'full-round action' : 'move action' };
    },
  },
  'internal-buffer': {
    name: 'Internal Buffer', action: 'full', target: 'self',
    use({ user }) {
      const r = user.resources().internalBuffer;
      if (!r || !r.max) throw err('No internal buffer');
      if ((user.resourcesUsed.internalBuffer || 0) === 0) throw err('Internal buffer is full');
      acceptBurn(user, 1);
      user.resourcesUsed.internalBuffer -= 1;
      return { buffer: user.resourceRemaining('internalBuffer') };
    },
  },
  celerity: {
    name: 'Celerity', action: 'standard', target: 'self',
    use({ user, options }) {
      const burn = options.extended ? acceptBurn(user, 1) : 0;
      const rounds = burn ? kl(user) : 1;
      user.addEffect(makeEffect({ key: 'kineticist:celerity', name: 'Celerity (haste)', kind: 'ability', remaining: rounds, flags: ['hasted'], modifiers: [mod('attack', 1, 'untyped', 'Haste'), mod('ac', 1, 'dodge', 'Haste'), mod('save.ref', 1, 'dodge', 'Haste'), mod('speed', 30, 'enhancement', 'Haste')] }));
      return { rounds, burn };
    },
  },
  'kinetic-form': {
    name: 'Kinetic Form', action: 'standard', target: 'self',
    use({ user }) {
      acceptBurn(user, 1);
      const huge = kl(user) >= 16;
      user.addEffect(makeEffect({ key: 'kineticist:form', name: 'Kinetic Form', kind: 'ability', remaining: kl(user), flags: [huge ? 'size:huge' : 'size:large'], modifiers: [mod('str', huge ? 4 : 2, 'size', 'Kinetic form'), mod('con', 2, 'size', 'Kinetic form'), mod('ac', huge ? 3 : 2, 'natural', 'Kinetic form')] }));
      return { size: huge ? 'huge' : 'large', rounds: kl(user) };
    },
  },
  'kinetic-healer': {
    name: 'Kinetic Healer', action: 'standard', target: 'ally',
    use({ user, target, rng, options }) {
      const t = target || user;
      acceptBurn(user, options.recipientBurn && t.id !== user.id ? 0 : 1);
      const n = user.prog('blastDice');
      return { target: t.id, healed: t.heal(dice.total(`${n}d6`, rng)) };
    },
  },
};

module.exports = { ABILITIES, acceptBurn, blastDamage };
