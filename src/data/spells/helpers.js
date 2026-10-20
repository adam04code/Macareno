'use strict';

const { mod } = require('../../engine/modifiers');

/**
 * Helpers for declaring spells compactly.
 *
 * Every spell: { name, school, subschool?, descriptors[], levels{class: lvl},
 * castingTime, components, range, target|area, duration, save, sr,
 * description, effect }.
 *
 * effect.kind (resolved by src/engine/spellEffects.js):
 *   damage     dice(cl) energy save{type,effect} attack('rangedTouch'|'meleeTouch') count(cl) area
 *   heal       dice(cl), harmsUndead
 *   inflict    dice(cl), healsUndead
 *   buff       duration(cl) modifiers(cl, caster) flags tempHp(cl) dr resist
 *   condition  condition duration(cl)|dice save hdLimit onSave
 *   debuff     modifiers save duration
 *   remove     conditions[], negativeLevels, abilityDamage
 *   dispel, summon{table}, revive{negativeLevels}, slay, powerWord, teleport, utility, multi{parts}
 */

const DEFAULTS = { castingTime: 'standard', components: 'V, S', sr: true, descriptors: [] };

function spell(name, school, levels, meta, effect) {
  return { ...DEFAULTS, name, school, levels, ...meta, effect: effect || { kind: 'utility' } };
}

const cap = (n, max) => Math.min(n, max);
const perLevel = (die, max, plus = 0) => (cl) => `${cap(cl, max)}d${die}${plus ? `+${plus}` : ''}`;
const perTwoLevels = (die, max) => (cl) => `${Math.max(1, cap(Math.floor(cl / 2), max))}d${die}`;

// Durations in rounds (1 round = 6 seconds).
const D = {
  rounds: (n = 1) => (cl) => n * cl,
  minutes: (n = 1) => (cl) => 10 * n * cl,
  tenMinutes: (cl) => 100 * cl,
  hours: (n = 1) => (cl) => 600 * n * cl,
  fixed: (r) => () => r,
  permanent: () => null,
};

const save = (type, effect = 'negates') => ({ type, effect });

function buff(duration, modifiers, extra = {}) {
  return { kind: 'buff', duration, modifiers, ...extra };
}

function damage(dice, energy, extra = {}) {
  return { kind: 'damage', dice, energy, ...extra };
}

function condition(cond, duration, extra = {}) {
  return { kind: 'condition', condition: cond, duration, ...extra };
}

// Ability enhancement buffs (bull's strength etc.).
const abilityBuff = (ability, amount = 4) => buff(D.minutes(1), (cl, c, s) => [mod(ability, amount, 'enhancement', s)]);

// Cure / inflict families.
const cure = (die, count, maxBonus) => ({ kind: 'heal', dice: (cl) => `${count}d${die}+${cap(cl, maxBonus)}`, harmsUndead: true, save: save('will', 'half') });
const inflict = (die, count, maxBonus) => ({ kind: 'inflict', dice: (cl) => `${count}d${die}+${cap(cl, maxBonus)}`, healsUndead: true, save: save('will', 'half'), attack: 'meleeTouch' });

module.exports = { spell, D, save, buff, damage, condition, abilityBuff, cure, inflict, perLevel, perTwoLevels, cap, mod };
