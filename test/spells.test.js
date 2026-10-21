'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { SPELLS, spellList } = require('../src/data/spells');
const { resolveSpell } = require('../src/engine/spellEffects');
const { Monster } = require('../src/engine/monster');
const { make, levelTo, ARRAYS } = require('./helpers');
const { RNG } = require('../src/engine/rng');

test('every spell has valid metadata and resolves without throwing', () => {
  const caster = levelTo(make({ name: 'Caster', class: 'wizard', scores: ARRAYS.int, racialBonus: 'int', feats: [{ id: 'toughness' }, { id: 'combat-casting' }], spells: { spellbook: ['magic-missile', 'shield', 'sleep'] } }), 'wizard', 14);
  const rng = new RNG(42);
  for (const [id, s] of Object.entries(SPELLS)) {
    assert.ok(s.name && s.school && s.levels && Object.keys(s.levels).length, `${id} metadata`);
    for (const lvl of Object.values(s.levels)) assert.ok(Number.isInteger(lvl) && lvl >= 0 && lvl <= 9, `${id} level`);
    const targets = [new Monster({ templateId: 'orc' }), new Monster({ templateId: 'skeleton' })];
    try {
      resolveSpell({ caster, spell: s, cl: 15, dc: 20, targets, rng, options: {} });
    } catch (e) {
      if (e.status !== 400) throw new Error(`${id}: ${e.stack}`);
    }
  }
});

test('core spell lists are complete', () => {
  const count = (list) => Array.from({ length: 10 }, (_, l) => spellList(list, l).length);
  const atLeast = (actual, min, label) => min.forEach((n, i) => assert.ok(actual[i] >= n, `${label} level ${i}: ${actual[i]} < ${n}`));
  // Core Rulebook list sizes (expansion spells only add to them).
  atLeast(count('druid'), [13, 20, 26, 22, 17, 19, 18, 13, 11, 10], 'druid');
  atLeast(count('paladin').slice(1, 5), [16, 9, 11, 9], 'paladin');
  atLeast(count('ranger').slice(1, 5), [19, 12, 13, 7], 'ranger');
  atLeast(count('cleric'), [12, 31, 32, 34, 27, 28, 26, 18, 17, 11], 'cleric');
  assert.ok(count('wizard').every((n) => n >= 19));
  for (const list of ['alchemist', 'inquisitor', 'witch']) assert.ok(count(list).slice(1).some((n) => n > 10), list);
});
