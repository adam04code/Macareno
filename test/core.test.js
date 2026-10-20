'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const dice = require('../src/engine/dice');
const { RNG } = require('../src/engine/rng');
const { resolve, mod } = require('../src/engine/modifiers');
const T = require('../src/engine/tables');
const checks = require('../src/engine/checks');
const { make } = require('./helpers');

test('dice: parse and roll expressions', () => {
  const rng = new RNG(1);
  for (let i = 0; i < 200; i++) {
    const r = dice.roll('2d6+3', rng);
    assert.ok(r.total >= 5 && r.total <= 15);
  }
  assert.equal(dice.average('1d8+2'), 6.5);
  assert.equal(dice.max('3d6-1'), 17);
  assert.equal(dice.roll('4', rng).total, 4);
  const kh = dice.roll('4d6kh3', rng);
  assert.equal(kh.terms[0].kept.length, 3);
  assert.throws(() => dice.parse('2x6'));
  assert.equal(dice.scaleDiceCount('2d6+3', 2), '4d6+3');
});

test('dice: seeded RNG is deterministic', () => {
  const a = new RNG(99);
  const b = new RNG(99);
  const ra = Array.from({ length: 20 }, () => a.die(20));
  const rb = Array.from({ length: 20 }, () => b.die(20));
  assert.deepEqual(ra, rb);
});

test('modifiers: same-type bonuses do not stack, dodge/untyped/penalties do', () => {
  const mods = [
    mod('ac', 2, 'deflection', 'Ring'), mod('ac', 3, 'deflection', 'Shield of faith'),
    mod('ac', 1, 'dodge', 'Dodge'), mod('ac', 1, 'dodge', 'Haste'),
    mod('ac', 2, 'untyped', 'A'), mod('ac', -2, 'untyped', 'Rage'), mod('ac', -1, 'untyped', 'Slow'),
    mod('ac', 4, 'dodge', 'Mobility', ['aooMovement']),
  ];
  assert.equal(resolve(mods, 'ac').total, 3 + 2 + 2 - 3);
  assert.equal(resolve(mods, 'ac', ['aooMovement']).total, 3 + 2 + 2 - 3 + 4);
});

test('tables: BAB, saves, XP and CR awards', () => {
  assert.equal(T.BAB.full(7), 7);
  assert.equal(T.BAB.threeQuarter(7), 5);
  assert.equal(T.BAB.half(7), 3);
  assert.equal(T.SAVES.base.good(1), 2);
  assert.equal(T.SAVES.base.poor(1), 0);
  assert.equal(T.SAVES.prestige.good(1), 1);
  assert.equal(T.SAVES.prestige.poor(2), 1);
  assert.deepEqual(T.iterativeAttacks(16), [16, 11, 6, 1]);
  assert.equal(T.levelForXp(2000), 2);
  assert.equal(T.levelForXp(1999), 1);
  assert.equal(T.xpForCr('1/3'), 135);
  assert.equal(T.xpForCr(10), 9600);
  assert.equal(T.abilityMod(7), -2);
  assert.equal(T.bonusSpells(4, 1), 1);
  assert.equal(T.bonusSpells(5, 1), 2);
  assert.deepEqual(T.carryingCapacity(10), { light: 33, medium: 66, heavy: 100 });
});

test('checks: natural 1 and 20 on saves, take 10/20 on skills', () => {
  const c = make({ name: 'Checker', class: 'fighter', feats: [{ id: 'power-attack' }, { id: 'toughness' }, { id: 'dodge' }], skills: { climb: 1 } });
  const rng = new RNG(3);
  const s = checks.savingThrow(c, 'fort', { dc: 1, rng, take10: false });
  assert.ok(['save'].includes(s.type));
  const t10 = checks.skillCheck(c, 'climb', { take10: true, dc: 10 });
  assert.equal(t10.roll, 10);
  assert.equal(t10.total, 10 + c.skill('climb').total);
  assert.throws(() => checks.skillCheck(c, 'climb', { take20: true, inCombat: true }));
  assert.throws(() => checks.skillCheck(c, 'knowledge-arcana', {}), /trained/);
  const always = checks.d20Check({ bonus: -100, dc: 5, autoNatural: true, rng: { die: () => 20 } });
  assert.equal(always.success, true);
  const never = checks.d20Check({ bonus: 100, dc: 5, autoNatural: true, rng: { die: () => 1 } });
  assert.equal(never.success, false);
});
