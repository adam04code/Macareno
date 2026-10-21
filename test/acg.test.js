'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sc = require('../src/engine/spellcasting');
const { useAbility } = require('../src/engine/classAbilities');
const { RNG } = require('../src/engine/rng');
const { spellLevelFor, SPELLS } = require('../src/data/spells');
const { make, levelTo, ARRAYS } = require('./helpers');

const base = { feats: [{ id: 'toughness' }, { id: 'iron-will' }] };

test('bloodrager: bloodrage bonuses, draconic powers while raging and bloodline spells', () => {
  const br = make({ name: 'Br', class: 'bloodrager', alignment: 'CN', ...base, choices: { 'bloodrager-bloodline': 'draconic', dragonType: 'blue' } });
  levelTo(br, 'bloodrager', 11);
  assert.equal(br.classLevel('bloodrager'), 12);
  const str = br.ability('str');
  assert.equal(br.naturalAttacks().length, 0, 'claws only while bloodraging');
  useAbility(br, 'bloodrage', { rng: new RNG(1), options: {} });
  assert.equal(br.ability('str'), str + 6, 'greater bloodrage at 11th');
  assert.equal(br.sourceResistances().electricity, 10);
  const claws = br.naturalAttacks();
  assert.equal(claws.length, 2);
  assert.equal(claws[0].damageDice, '1d8');
  assert.deepEqual(claws[0].extraDamage, [{ dice: '1d6', type: 'electricity' }]);
  assert.equal(br.flagValue('fly'), 60);
  assert.ok(br.hasFeat('blind-fight') || br.hasFeat('great-fortitude') || br.hasFeat('improved-initiative'), 'bloodline bonus feats');
  assert.deepEqual(sc.grantedSpells(br, 'bloodrager')[1], ['shield'], 'draconic bonus spell at 7th');
  assert.equal(spellLevelFor(SPELLS['black-tentacles'], 'bloodrager'), 4);
});

test('arcanist: spellbook plus daily preparations cast spontaneously; reservoir and consume spells', () => {
  const ar = make({ name: 'Ar', class: 'arcanist', scores: ARRAYS.int, racialBonus: 'int', ...base, choices: { 'arcanist-exploit': 'acid-jet' }, spells: { spellbook: ['magic-missile', 'shield', 'grease', 'mage-armor'] } });
  const st = sc.state(ar, 'arcanist');
  assert.equal(st.known[1].length, 2, 'two 1st-level spells prepared at 1st level');
  assert.equal(ar.resources().reservoir.max, 3);
  sc.prepareSpells(ar, 'arcanist', ['acid-splash', 'magic-missile', 'grease']);
  assert.deepEqual(sc.availableSpells(ar, 'arcanist')[1], ['magic-missile', 'grease']);
  assert.throws(() => sc.prepareSpells(ar, 'arcanist', ['color-spray']), /not in your spellbook/);
  assert.throws(() => sc.prepareSpells(ar, 'arcanist', ['magic-missile', 'grease', 'shield']), /Too many/);
  useAbility(ar, 'acid-jet', { rng: new RNG(2), target: make({ name: 'Dummy', class: 'fighter', feats: [{ id: 'toughness' }, { id: 'iron-will' }, { id: 'power-attack' }] }), options: {} });
  assert.equal(ar.resourceRemaining('reservoir'), 2);
  const gained = useAbility(ar, 'consume-spells', { rng: new RNG(2), options: { level: 1 } });
  assert.equal(gained.gained, 1);
  assert.equal(ar.resourceRemaining('reservoir'), 3);
});

test('shaman: spirit magic, wandering spirit and greater spirit', () => {
  const sh = make({ name: 'Sh', class: 'shaman', scores: ARRAYS.wis, racialBonus: 'wis', ...base, choices: { spirit: 'flame', familiar: 'toad' } });
  levelTo(sh, 'shaman', 7, { choices: { 'wandering-spirit': 'life' } });
  const spirit = sc.domainSpells(sh, 'shaman');
  assert.ok(spirit[3].includes('fireball'));
  assert.ok(spirit[3].includes('neutralize-poison'), 'wandering spirit spells');
  assert.equal(sh.sourceResistances().fire, 10, 'fiery soul at 8th');
  assert.ok(sh.activatedAbilities().includes('touch-of-flames'));
  assert.equal(spellLevelFor(SPELLS['flame-strike'], 'shaman'), 5);
});

test('hunter, skald, slayer and warpriest class features', () => {
  const rng = new RNG(3);
  const hu = make({ name: 'Hu', class: 'hunter', scores: ARRAYS.wis, racialBonus: 'wis', ...base, choices: { companion: 'wolf' }, spells: { known: ['guidance', 'light', 'virtue', 'stabilize', 'entangle', 'magic-fang'] } });
  levelTo(hu, 'hunter', 7);
  assert.equal(hu.companion.type, 'wolf');
  assert.ok(hu.hasFeat('precise-shot') || hu.hasFeat('outflank'));
  assert.ok(sc.availableSpells(hu, 'hunter')[2].includes('summon-natures-ally-ii'));
  const str = hu.ability('str');
  useAbility(hu, 'animal-focus', { rng, options: { aspect: 'bull' } });
  assert.equal(hu.ability('str'), str + 4, 'bull aspect +4 at 8th');

  const sk = make({ name: 'Sk', class: 'skald', scores: ARRAYS.cha, racialBonus: 'cha', ...base, spells: { known: ['dancing-lights', 'detect-magic', 'light', 'mage-hand', 'cure-light-wounds', 'grease'] } });
  levelTo(sk, 'skald', 7);
  const skStr = sk.ability('str');
  useAbility(sk, 'inspired-rage', { rng, allies: [sk], options: { rounds: 2 } });
  assert.equal(sk.ability('str'), skStr + 4);
  assert.ok(sk.hasFlag('raging'));

  const sl = make({ name: 'Sl', class: 'slayer', scores: ARRAYS.dex, racialBonus: 'dex', ...base });
  levelTo(sl, 'slayer', 9);
  assert.equal(sl.prog('sneakAttack'), 3);
  const foe = make({ name: 'Foe', class: 'fighter', feats: [{ id: 'toughness' }, { id: 'iron-will' }, { id: 'power-attack' }] });
  const atk = sl.stat('attack', [`id:${foe.id}`]).total;
  useAbility(sl, 'studied-target', { rng, target: foe, options: {} });
  assert.equal(sl.stat('attack', [`id:${foe.id}`]).total, atk + 3);

  const wp = make({ name: 'Wp', class: 'warpriest', scores: ARRAYS.wis, racialBonus: 'wis', deity: 'the-iron-judge', alignment: 'LN', ...base, choices: { blessings: ['law', 'war'] } });
  assert.equal(wp.stat('attack', ['weapon:warhammer']).total - wp.stat('attack', ['weapon:longsword']).total, 1, 'focus weapon');
  assert.equal(spellLevelFor(SPELLS['cure-light-wounds'], 'warpriest'), 1);
  assert.equal(spellLevelFor(SPELLS['miracle'], 'warpriest'), null, 'warpriests cast up to 6th level');
  useAbility(wp, 'blessing', { rng, target: wp, options: { blessing: 'war' } });
  assert.equal(wp.resourceRemaining('blessing'), 2);
});
