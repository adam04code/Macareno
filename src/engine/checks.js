'use strict';

const { defaultRng } = require('./rng');
const { SKILLS, KNOWLEDGE_BY_TYPE, ABILITIES } = require('../data/core');
const { crToNumber } = require('./tables');

/**
 * The check system: every d20 roll in the game goes through here so that
 * natural 1/20 rules, take 10/20, and audit logging are consistent.
 */

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/**
 * Core d20 roll. opts: { bonus, dc, rng, take10, take20, autoNatural (nat 1 fails/nat 20 succeeds), label }.
 */
function d20Check(opts) {
  const rng = opts.rng || defaultRng;
  let roll;
  let method = 'roll';
  if (opts.take20) {
    roll = 20;
    method = 'take20';
  } else if (opts.take10) {
    roll = 10;
    method = 'take10';
  } else if (opts.rollTwice) {
    const a = rng.die(20);
    const b = rng.die(20);
    roll = opts.rollTwice === 'worse' ? Math.min(a, b) : Math.max(a, b);
    method = `roll-twice-${opts.rollTwice}`;
  } else {
    roll = rng.die(20);
  }
  const total = roll + (opts.bonus || 0);
  const result = { label: opts.label, roll, bonus: opts.bonus || 0, total, method };
  if (opts.dc !== undefined && opts.dc !== null) {
    result.dc = opts.dc;
    result.success = total >= opts.dc;
    if (opts.autoNatural && method === 'roll') {
      if (roll === 20) result.success = true;
      if (roll === 1) result.success = false;
    }
    result.margin = total - opts.dc;
  }
  result.natural20 = method === 'roll' && roll === 20;
  result.natural1 = method === 'roll' && roll === 1;
  return result;
}

/** Fortune and misfortune effects: roll twice and take the better or worse result (they cancel out). */
function rollTwiceMode(creature) {
  if (!creature || !creature.hasFlag) return null;
  const better = creature.hasFlag('rollTwiceBetter');
  const worse = creature.hasFlag('rollTwiceWorse');
  if (better === worse) return null;
  return better ? 'better' : 'worse';
}

/** One d20 for a creature, honouring fortune/misfortune. */
function creatureD20(creature, rng = defaultRng) {
  const mode = rollTwiceMode(creature);
  if (!mode) return rng.die(20);
  const a = rng.die(20);
  const b = rng.die(20);
  return mode === 'better' ? Math.max(a, b) : Math.min(a, b);
}

function skillCheck(creature, skillId, opts = {}) {
  const def = SKILLS[skillId];
  if (!def) throw err(`Unknown skill: ${skillId}`);
  if (creature.canUseSkill && !creature.canUseSkill(skillId)) throw err(`${def.name} can only be used trained`);
  const sk = creature.skill(skillId, opts.tags || []);
  if (sk.blocked) throw err(`Cannot use ${def.name} while raging`);
  if (opts.take20 && opts.inCombat) throw err('Cannot take 20 while in combat or threatened');
  if (opts.take10 && opts.inCombat && !opts.allowTake10Stressed) throw err('Cannot take 10 while threatened or distracted');
  return { type: 'skill', skill: skillId, name: def.name, ...d20Check({ rollTwice: rollTwiceMode(creature), ...opts, bonus: sk.total + (opts.circumstance || 0), label: def.name }), breakdown: sk.breakdown };
}

function abilityCheck(creature, ability, opts = {}) {
  if (!ABILITIES.includes(ability)) throw err(`Unknown ability: ${ability}`);
  const bonus = creature.abilityMod(ability) + creature.stat(['abilityCheck', `abilityCheck.${ability}`], opts.tags || []).total + (opts.circumstance || 0);
  return { type: 'ability', ability, ...d20Check({ rollTwice: rollTwiceMode(creature), ...opts, bonus, label: `${ability.toUpperCase()} check` }) };
}

/** Saving throw: natural 1 always fails, natural 20 always succeeds. */
function savingThrow(creature, type, opts = {}) {
  if (!['fort', 'ref', 'will'].includes(type)) throw err(`Unknown save: ${type}`);
  const s = creature.save(type, opts.tags || []);
  const res = d20Check({ rollTwice: rollTwiceMode(creature), ...opts, bonus: s.total + (opts.circumstance || 0), autoNatural: true, label: `${{ fort: 'Fortitude', ref: 'Reflex', will: 'Will' }[type]} save` });
  return { type: 'save', save: type, ...res, breakdown: s.breakdown };
}

function casterLevelCheck(creature, opts = {}) {
  const bonus = creature.casterLevel(opts.classId) + (opts.vsSr ? creature.stat('srCheck').total : 0) + (opts.circumstance || 0);
  return { type: 'casterLevel', ...d20Check({ ...opts, bonus, label: 'Caster level check' }) };
}

/** Spell resistance: caster level check vs SR. Returns { blocked, check }. */
function spellResistance(caster, target, opts = {}) {
  const sr = target.sr();
  if (!sr || opts.harmless) return { blocked: false, sr };
  const check = casterLevelCheck(caster, { ...opts, dc: sr, vsSr: true });
  return { blocked: !check.success, sr, check };
}

function concentrationCheck(caster, opts = {}) {
  const spellcasting = require('./spellcasting');
  const bonus = spellcasting.concentrationBonus(caster, opts.classId) + caster.stat('concentration', opts.tags || []).total;
  return { type: 'concentration', ...d20Check({ ...opts, bonus, label: 'Concentration' }) };
}

/** Opposed check: higher total wins; ties go to the higher bonus, then a reroll. */
function opposed(aRes, bRes, rng = defaultRng) {
  if (aRes.total !== bRes.total) return aRes.total > bRes.total ? 'a' : 'b';
  if (aRes.bonus !== bRes.bonus) return aRes.bonus > bRes.bonus ? 'a' : 'b';
  return rng.die(2) === 1 ? 'a' : 'b';
}

function opposedSkills(a, skillA, b, skillB, opts = {}) {
  const ra = skillCheck(a, skillA, opts.a || {});
  const rb = skillCheck(b, skillB, opts.b || {});
  const winner = opposed(ra, rb, opts.rng);
  return { a: ra, b: rb, winner: winner === 'a' ? a.id : b.id };
}

function initiativeRoll(creature, rng = defaultRng) {
  const bonus = creature.initiative();
  // War sight (oracle): roll initiative two or three times and keep the best.
  const times = Math.max(1, (creature.flagValue && creature.flagValue('initiativeRolls')) || 1);
  let roll = 0;
  for (let i = 0; i < times; i++) roll = Math.max(roll, rng.die(20));
  return { roll, bonus, total: roll + bonus, tiebreak: bonus * 100 + rng.die(99) };
}

/** Stabilize: DC 10 Con check, penalty equal to negative hit points. */
function stabilizeCheck(creature, rng = defaultRng) {
  const penalty = Math.min(0, creature.hp.current);
  return { type: 'stabilize', ...d20Check({ rng, bonus: creature.abilityMod('con') + penalty, dc: 10, label: 'Stabilize (Con)' }) };
}

/** Identify a creature with the appropriate Knowledge skill: DC 10 + CR. */
function identifyCreature(char, monster, opts = {}) {
  const skill = KNOWLEDGE_BY_TYPE[monster.creatureType()] || 'knowledge-local';
  const dc = 10 + Math.max(0, Math.floor(crToNumber(monster.cr())));
  const res = skillCheck(char, skill, { ...opts, dc });
  const facts = res.success ? 1 + Math.floor(res.margin / 5) : 0;
  return { ...res, facts, revealed: res.success ? revealFacts(monster, facts) : [] };
}

function revealFacts(monster, n) {
  const d = monster.def;
  const facts = [
    `${d.name}: ${d.size} ${d.type}${d.subtypes.length ? ` (${d.subtypes.join(', ')})` : ''}, CR ${d.cr}.`,
    d.immune.length ? `Immune to ${d.immune.join(', ')}.` : 'No notable immunities.',
    d.dr.length ? `Damage reduction ${d.dr.map((x) => `${x.amount}/${x.bypass}`).join(' and ')}.` : 'No damage reduction.',
    (d.vulnerable || []).length ? `Vulnerable to ${d.vulnerable.join(', ')}.` : d.regeneration ? `Regeneration ${d.regeneration.amount} (stopped by ${d.regeneration.bypass.join('/')}).` : 'No special weaknesses known.',
    d.special.length ? `Special abilities: ${d.special.map((s) => s.name || s.kind).join(', ')}.` : 'No special abilities.',
  ];
  return facts.slice(0, n);
}

/** DCs for common skill uses (Chapter 4), for clients and the world engine. */
const SKILL_DCS = {
  'climb:slope': 0, 'climb:rope-wall': 5, 'climb:knotted-rope': 5, 'climb:rough-wall': 15, 'climb:rough-natural': 20, 'climb:smooth-wall': 25,
  'swim:calm': 10, 'swim:rough': 15, 'swim:stormy': 20,
  'acrobatics:narrow-surface': 10, 'acrobatics:move-through-threatened': 'cmd', 'acrobatics:jump-per-5ft': 5,
  'heal:first-aid': 15, 'heal:treat-poison': 'poison-dc', 'heal:long-term-care': 15, 'heal:treat-deadly-wounds': 20,
  'disable-device:simple': 10, 'disable-device:tricky': 15, 'disable-device:difficult': 20, 'disable-device:extreme': 25,
  'disable-device:simple-lock': 20, 'disable-device:average-lock': 25, 'disable-device:good-lock': 30, 'disable-device:superior-lock': 40,
  'perception:hear-battle': -10, 'perception:hear-conversation': 0, 'perception:notice-visible-creature': 0, 'perception:hear-whisper': 15,
  'survival:get-along-in-wild': 10, 'survival:track-soft-ground': 5, 'survival:track-firm-ground': 15, 'survival:track-hard-ground': 20,
  'diplomacy:hostile': 25, 'diplomacy:unfriendly': 20, 'diplomacy:indifferent': 15, 'diplomacy:friendly': 10, 'diplomacy:helpful': 0,
  'spellcraft:identify-spell': '15+level', 'spellcraft:identify-item': '15+cl', 'spellcraft:learn-spell': '15+level',
  'use-magic-device:activate-wand': 20, 'use-magic-device:scroll': '20+cl',
  'escape-artist:rope': '20+cmb', 'escape-artist:net': 20, 'escape-artist:manacles': 30,
  'intimidate:demoralize': '10+hd+wis', 'bluff:feint': '10+bab+wis or sense motive',
};

module.exports = { d20Check, rollTwiceMode, creatureD20, skillCheck, abilityCheck, savingThrow, casterLevelCheck, spellResistance, concentrationCheck, opposed, opposedSkills, initiativeRoll, stabilizeCheck, identifyCreature, SKILL_DCS };
