'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const prerequisites = require('../src/engine/prerequisites');
const { useAbility } = require('../src/engine/classAbilities');
const { applyDamage } = require('../src/engine/attacks');
const { RNG } = require('../src/engine/rng');
const { make, levelTo, ARRAYS } = require('./helpers');

const feats = [{ id: 'toughness' }, { id: 'power-attack' }];

test('dhampir, kitsune and oread racial traits', () => {
  const d = make({ name: 'Dham', class: 'fighter', race: 'dhampir', feats });
  assert.equal(d.ability('cha'), 8 + 2);
  d.takeDamage(5);
  const before = d.hp.current;
  applyDamage(d, [{ amount: 3, type: 'negative' }]);
  assert.ok(d.hp.current > before, 'negative energy heals a dhampir');
  assert.ok(d.activatedAbilities().includes('sla:detect-undead'));
  const k = make({ name: 'Kit', class: 'fighter', race: 'kitsune', feats: [{ id: 'toughness' }, { id: 'dodge' }], scores: ARRAYS.dex });
  assert.ok(k.naturalAttacks().some((n) => n.name === 'Bite'));
  const o = make({ name: 'Ore', class: 'fighter', race: 'oread', feats });
  assert.equal(o.sourceResistances().acid, 5);
});

test('stalwart defender: requirements, defensive stance and DR', () => {
  const f = make({ name: 'Wall', class: 'fighter', feats: [{ id: 'toughness' }, { id: 'dodge' }, { id: 'endurance' }], scores: ARRAYS.str });
  assert.equal(prerequisites.classRequirements(f, 'stalwart-defender').ok, false);
  levelTo(f, 'fighter', 6);
  assert.ok(prerequisites.classRequirements(f, 'stalwart-defender').ok, prerequisites.classRequirements(f, 'stalwart-defender').failures.join('; '));
  levelTo(f, 'stalwart-defender', 7);
  assert.equal(f.classLevel('stalwart-defender'), 7);
  assert.ok(f.dr().some((x) => x.amount === 3 && x.bypass === '-'));
  const str = f.ability('str');
  useAbility(f, 'defensive-stance', { rng: new RNG(1), options: { rounds: 2 } });
  assert.equal(f.ability('str'), str + 4);
  assert.equal([].concat(f.choices['defensive-power']).length, 3);
});

test('loremaster requirements and secrets', () => {
  const w = make({ name: 'Sage', class: 'wizard', scores: ARRAYS.int, racialBonus: 'int', feats: [{ id: 'skill-focus', param: 'knowledge-arcana' }, { id: 'toughness' }], choices: { school: 'universalist' }, skills: { 'knowledge-arcana': 1, 'knowledge-history': 1 } });
  const r = prerequisites.classRequirements(w, 'loremaster');
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((x) => x.includes('Knowledge')));
  assert.ok(r.failures.some((x) => x.includes('divination')));
});
