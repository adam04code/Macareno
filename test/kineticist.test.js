'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { useAbility } = require('../src/engine/classAbilities');
const { RNG } = require('../src/engine/rng');
const { knownBlasts } = require('../src/data/kineticist');
const { make, levelTo } = require('./helpers');

const scores = { str: 10, dex: 14, con: 17, int: 10, wis: 12, cha: 8 };
const foe = () => make({ name: 'Target', class: 'fighter', feats: [{ id: 'toughness' }, { id: 'iron-will' }, { id: 'power-attack' }] });

test('kineticist: blasts, burn, infusions and elemental defense', () => {
  const k = make({ name: 'Kin', class: 'kineticist', scores, racialBonus: 'con', feats: [{ id: 'toughness' }, { id: 'iron-will' }], choices: { element: 'water', blast: 'cold-blast', infusion: 'extended-range' } });
  assert.deepEqual(knownBlasts(k), ['cold-blast']);
  assert.ok(k.isClassSkill('swim'));
  assert.equal(k.resources().burn.max, 3 + k.abilityMod('con'));
  const rng = new RNG(4);
  // Simple blast: no burn.
  const r = useAbility(k, 'kinetic-blast', { rng, target: foe(), options: {} });
  assert.equal(r.burn, 0);
  // Extended range costs 1 burn: 1 nonlethal per character level that healing can't remove.
  const r2 = useAbility(k, 'kinetic-blast', { rng, target: foe(), options: { form: 'extended-range' } });
  assert.equal(r2.burn, 1);
  assert.equal(r2.range, 120);
  assert.equal(k.hp.nonlethal, 1);
  k.heal(10);
  assert.equal(k.hp.nonlethal, 1, 'burn damage is not healed');
  assert.throws(() => useAbility(k, 'kinetic-blast', { rng, target: foe(), options: { form: 'extended-range' } }), /per round/);

  levelTo(k, 'kineticist', 6, (c) => (c.classLevel('kineticist') === 4 ? { choices: { infusion: 'entangling' } } : c.classLevel('kineticist') === 1 ? { choices: { 'wild-talent': 'kinetic-healer' } } : {}));
  assert.ok(k.hasOption('infusion', 'entangling'));
  assert.equal(k.classLevel('kineticist'), 7);
  k.restoreResources();
  k.hp.nonlethal = 0;
  // Shroud of water at 7th: +4 armor, +1 per four levels beyond 2nd.
  assert.equal(k.ac().total, 10 + k.abilityMod('dex') + 5);
  // Entangling (2 burn) less infusion specialization 1 = 1 burn; the defense grows with burn.
  const r3 = useAbility(k, 'kinetic-blast', { rng, target: foe(), options: { substance: 'entangling' } });
  assert.equal(r3.burn, 1);
  assert.equal(k.prog('overflowCap'), 2);
});

test('kineticist: expanded element unlocks composite blasts', () => {
  const k = make({ name: 'Kinn', class: 'kineticist', scores, racialBonus: 'con', feats: [{ id: 'toughness' }, { id: 'iron-will' }], choices: { element: 'fire', infusion: 'fan-of-flames' } });
  levelTo(k, 'kineticist', 6, (c) => (c.classLevel('kineticist') === 6 ? { choices: { 'expanded-element': 'fire' } } : {}));
  assert.equal(k.classLevel('kineticist'), 7);
  assert.ok(knownBlasts(k).includes('fire-blast'));
  const air = make({ name: 'Kinna', class: 'kineticist', scores, racialBonus: 'con', feats: [{ id: 'toughness' }, { id: 'iron-will' }], choices: { element: 'air', blast: 'air-blast', infusion: 'extended-range' } });
  levelTo(air, 'kineticist', 6, (c) => (c.classLevel('kineticist') === 6 ? { choices: { 'expanded-element': 'fire' } } : {}));
  assert.ok(knownBlasts(air).includes('plasma-blast'));
  assert.ok(air.flagValue('rangedMissChance') >= 20, 'enveloping winds');
});
