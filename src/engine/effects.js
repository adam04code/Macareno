'use strict';

const crypto = require('crypto');
const { CONDITIONS, FEAR_ORDER, conditionModifiers } = require('../data/conditions');

/**
 * Effects are timed (or permanent) packets of modifiers, flags and
 * conditions attached to a creature: spells, class abilities, conditions,
 * poisons, item activations. They are plain JSON so they persist.
 *
 * {
 *   id, key, name, kind: 'spell'|'condition'|'ability'|'item'|'affliction',
 *   sourceId, sourceName, remaining: rounds|null (null = until removed),
 *   modifiers: [], flags: [], conditions: [], tags: [],
 *   dr: [{amount,bypass}], resist: {fire: 10}, absorb: n, images: n,
 *   ongoing: { dice, type } (damage at start of turn), saveEachRound: {type, dc},
 *   onEnd: [{ condition, rounds }], data: {}
 * }
 */

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

function makeEffect(fields) {
  return {
    id: newId(),
    key: fields.key || fields.name,
    name: fields.name,
    kind: fields.kind || 'spell',
    sourceId: fields.sourceId || null,
    sourceName: fields.sourceName || null,
    remaining: fields.remaining === undefined ? null : fields.remaining,
    modifiers: fields.modifiers || [],
    flags: fields.flags || [],
    conditions: fields.conditions || [],
    tags: fields.tags || [],
    ...Object.fromEntries(Object.entries(fields).filter(([k]) => !['key', 'name', 'kind', 'sourceId', 'sourceName', 'remaining', 'modifiers', 'flags', 'conditions', 'tags'].includes(k))),
  };
}

function conditionEffect(conditionId, rounds, source = {}) {
  const c = CONDITIONS[conditionId];
  return makeEffect({
    key: `condition:${conditionId}`,
    name: c ? c.name : conditionId,
    kind: 'condition',
    remaining: rounds === undefined ? null : rounds,
    conditions: [conditionId],
    sourceId: source.id,
    sourceName: source.name,
    tags: conditionId === 'shaken' || conditionId === 'frightened' || conditionId === 'panicked' ? ['fear'] : [],
  });
}

/** Expand an effect into modifiers (its own plus those of its conditions). */
function effectModifiers(effect) {
  const out = [...(effect.modifiers || [])];
  for (const c of effect.conditions || []) out.push(...conditionModifiers(c, effect.name));
  return out;
}

function effectFlags(effect) {
  const out = [...(effect.flags || [])];
  for (const c of effect.conditions || []) {
    out.push(c);
    if (CONDITIONS[c]) out.push(...CONDITIONS[c].flags);
  }
  return out;
}

/** Fear stacking: shaken+shaken => frightened, frightened+fear => panicked. */
function escalateFear(existing, incoming) {
  const a = FEAR_ORDER.indexOf(existing);
  const b = FEAR_ORDER.indexOf(incoming);
  if (a === -1 || b === -1) return incoming;
  return FEAR_ORDER[Math.min(FEAR_ORDER.length - 1, Math.max(a, b) + 1)];
}

module.exports = { makeEffect, conditionEffect, effectModifiers, effectFlags, escalateFear, newId };
