'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/engine/builder');
const sc = require('../src/engine/spellcasting');
const prerequisites = require('../src/engine/prerequisites');
const inventory = require('../src/engine/inventory');
const { make, levelTo, ARRAYS } = require('./helpers');

test('fighter: derived statistics follow the Core Rulebook', () => {
  const f = make({ name: 'Valeros', class: 'fighter', feats: [{ id: 'power-attack' }, { id: 'weapon-focus', param: 'longsword' }, { id: 'dodge' }], skills: { climb: 1, intimidate: 1, perception: 1 } });
  // d10 + Con 2 + favored class 1
  assert.equal(f.maxHp(), 13);
  assert.equal(f.bab(), 1);
  assert.equal(f.save('fort').total, 4);
  assert.equal(f.save('ref').total, 2);
  assert.equal(f.save('will').total, 1);
  // Kit: scale mail (+5, max dex 3), heavy wooden shield (+2), Dodge (+1), Dex 14 (+2)
  assert.deepEqual(f.acSummary(), { ac: 20, touch: 13, flatFooted: 17 });
  assert.equal(f.cmb(), 5);
  assert.equal(f.cmd(), 18);
  assert.equal(f.speed(), 20, 'medium armor reduces speed');
  const sword = f.attackProfiles().find((p) => p.weaponId === 'longsword');
  assert.equal(sword.critRange, 19);
});

test('creation validation: point buy, prerequisites, alignment', () => {
  assert.throws(() => make({ name: 'Too Strong', class: 'fighter', scores: { str: 18, dex: 18, con: 18, int: 10, wis: 10, cha: 10 } }), (e) => e.details[0].includes('Point buy'));
  assert.throws(() => B.createCharacter({ name: 'Bad Monk', race: 'human', racialBonus: 'wis', alignment: 'CN', class: 'monk', abilities: { method: 'pointbuy', scores: ARRAYS.wis }, feats: [{ id: 'dodge' }, { id: 'toughness' }] }), (e) => e.details.some((d) => d.includes('lawful')));
  assert.throws(() => make({ name: 'No Prereq', class: 'fighter', feats: [{ id: 'cleave' }, { id: 'toughness' }, { id: 'dodge' }] }), (e) => e.details.some((d) => d.includes('Power Attack')));
  assert.throws(() => make({ name: 'Rank Hog', class: 'fighter', feats: [{ id: 'power-attack' }, { id: 'toughness' }, { id: 'dodge' }], skills: { climb: 2 } }), (e) => e.details.some((d) => d.includes('cannot exceed')));
});

test('feat prerequisites', () => {
  const f = make({ name: 'Prereq', class: 'fighter', feats: [{ id: 'power-attack' }, { id: 'toughness' }, { id: 'dodge' }] });
  assert.equal(prerequisites.featPrereqs(f, 'cleave').ok, true);
  assert.equal(prerequisites.featPrereqs(f, 'great-cleave').ok, false);
  assert.equal(prerequisites.featPrereqs(f, 'weapon-specialization', 'longsword').ok, false);
  assert.equal(prerequisites.featPrereqs(f, 'mobility').ok, true);
});

test('wizard: spellbook, school slot, preparation and DCs', () => {
  const w = B.createCharacter({ name: 'Ezren', race: 'elf', alignment: 'N', class: 'wizard', abilities: { method: 'pointbuy', scores: ARRAYS.int }, feats: [{ id: 'spell-focus', param: 'evocation' }], skills: { 'knowledge-arcana': 1, spellcraft: 1, 'knowledge-planes': 1, perception: 1 }, choices: { school: 'evocation', opposition: ['enchantment', 'necromancy'] }, spells: { spellbook: ['magic-missile', 'shield', 'mage-armor', 'burning-hands', 'color-spray', 'grease'] } });
  // Int 19 (+4): 1 + 1 bonus + 1 school slot.
  assert.deepEqual(sc.slotsPerDay(w, 'wizard'), [3, 3]);
  assert.throws(() => sc.prepareSpells(w, 'wizard', ['magic-missile', 'shield', 'mage-armor', 'grease']), /Too many/);
  assert.throws(() => sc.prepareSpells(w, 'wizard', ['shield', 'mage-armor', 'grease']), /school slot/);
  sc.prepareSpells(w, 'wizard', ['magic-missile', 'shield', 'burning-hands', 'ray-of-frost', 'light', 'detect-magic']);
  const plan = sc.planCast(w, 'wizard', 'magic-missile');
  sc.consume(w, plan);
  assert.throws(() => sc.planCast(w, 'wizard', 'magic-missile'), /not prepared or already cast/);
  // Cantrips are never expended.
  sc.consume(w, sc.planCast(w, 'wizard', 'ray-of-frost'));
  assert.ok(sc.planCast(w, 'wizard', 'ray-of-frost'));
  const { SPELLS } = require('../src/data/spells');
  assert.equal(sc.spellDC(w, SPELLS['burning-hands'], 1, 'int'), 10 + 1 + 4 + 1);
  sc.restoreSlots(w);
  assert.ok(sc.planCast(w, 'wizard', 'magic-missile'));
});

test('cleric: domain slot, orisons, spontaneous cure conversion', () => {
  const c = make({ name: 'Kyra', class: 'cleric', alignment: 'NG', deity: 'the-dawnflame', scores: ARRAYS.wis, racialBonus: 'wis', feats: [{ id: 'toughness' }, { id: 'improved-initiative' }], choices: { domains: ['healing', 'sun'] } });
  assert.deepEqual(sc.slotsPerDay(c, 'cleric'), [3, 3]);
  sc.prepareSpells(c, 'cleric', ['bless', 'shield-of-faith', 'cure-light-wounds', 'guidance', 'light', 'stabilize']);
  const plan = sc.planCast(c, 'cleric', 'cure-light-wounds', { convertFrom: 'bless' });
  assert.equal(plan.entry.spell, 'bless');
  assert.throws(() => make({ name: 'Wrong God', class: 'cleric', alignment: 'LE', deity: 'the-dawnflame', scores: ARRAYS.wis, racialBonus: 'wis', feats: [{ id: 'toughness' }, { id: 'improved-initiative' }], choices: { domains: ['healing', 'sun'] } }), (e) => e.details.some((d) => d.includes('one step')));
});

test('sorcerer and bard: spontaneous spells known limits', () => {
  const s = make({ name: 'Seoni', class: 'sorcerer', scores: ARRAYS.cha, racialBonus: 'cha', feats: [{ id: 'toughness' }, { id: 'iron-will' }], choices: { bloodline: 'draconic', dragonType: 'blue' }, spells: { known: ['acid-splash', 'detect-magic', 'light', 'ray-of-frost', 'magic-missile', 'shield'] } });
  assert.equal(sc.slotsPerDay(s, 'sorcerer')[1], 3 + 1);
  assert.throws(() => sc.learnSpell(s, 'sorcerer', 'grease'), /No spells known remaining/);
  assert.equal(s.dragonEnergy(), 'electricity');
  assert.ok(s.attackProfiles().some((p) => p.name === 'Claw'));
  assert.throws(() => make({ name: 'Mute Bard', class: 'bard', scores: ARRAYS.cha, racialBonus: 'cha', feats: [{ id: 'toughness' }, { id: 'iron-will' }], spells: { known: ['light'] } }), /Invalid character/);
});

test('level up: hit points, feats, skills, ability increases', () => {
  const f = make({ name: 'Leveler', class: 'fighter', feats: [{ id: 'power-attack' }, { id: 'toughness' }, { id: 'dodge' }] });
  assert.throws(() => B.levelUp(f, { class: 'fighter' }), /Not enough XP/);
  f.xp = 2000;
  const r = B.levelUp(f, B.autoLevelSpec(f, 'fighter', { feats: ['cleave'], choices: {} }));
  assert.equal(r.level, 2);
  assert.equal(f.bab(), 2);
  assert.ok(f.hasFeat('cleave'));
  // Level 1: 10 + Con 2 + favored 1 + Toughness 3 = 16. Level 2: average d10 (6) + Con 2 + favored 1.
  assert.equal(f.maxHp(), 16 + 6 + 2 + 1);
  levelTo(f, 'fighter', 2);
  assert.equal(f.abilityIncreases.length, 1);
});

test('prestige requirements are enforced', () => {
  const f = make({ name: 'Wannabe', class: 'fighter', scores: ARRAYS.dex, racialBonus: 'dex', feats: [{ id: 'weapon-finesse' }, { id: 'dodge' }, { id: 'combat-reflexes' }] });
  const res = prerequisites.classRequirements(f, 'duelist');
  assert.equal(res.ok, false);
  assert.ok(res.failures.some((x) => x.includes('Base attack bonus')));
  assert.throws(() => B.levelUp(f, { class: 'duelist' }, { force: true }), /Cannot take a level of Duelist/);
  const ek = prerequisites.classRequirements(f, 'eldritch-knight');
  assert.ok(ek.failures.some((x) => x.includes('arcane')));
  const assassin = prerequisites.classRequirements(f, 'assassin');
  assert.ok(assassin.failures.some((x) => x.includes('evil')));
});

test('every prestige class can be reached and advanced to 10th level', () => {
  const duel = make({ name: 'Duel', class: 'fighter', scores: ARRAYS.dex, racialBonus: 'dex', feats: [{ id: 'weapon-finesse' }, { id: 'dodge' }, { id: 'combat-reflexes' }], skills: { acrobatics: 1, perform: 1 } });
  levelTo(duel, 'fighter', 5, { feats: ['mobility'], skills: ['acrobatics', 'perform'], choices: { 'weapon-training': 'light-blades' } });
  levelTo(duel, 'duelist', 10, { skills: ['acrobatics', 'perform'] });
  assert.equal(duel.classLevel('duelist'), 10);
  assert.equal(duel.bab(), 16);

  const ek = make({ name: 'Ek', class: 'fighter', scores: ARRAYS.int, racialBonus: 'int', feats: [{ id: 'dodge' }, { id: 'combat-casting' }, { id: 'weapon-focus', param: 'longsword' }] });
  levelTo(ek, 'wizard', 5, { choices: { school: 'universalist' } });
  levelTo(ek, 'eldritch-knight', 10, { spellProgression: 'wizard' });
  assert.equal(ek.casterLevel('wizard'), 14);

  const at = make({ name: 'Trick', class: 'rogue', alignment: 'CN', scores: ARRAYS.int, racialBonus: 'int', feats: [{ id: 'weapon-finesse' }, { id: 'dodge' }], skills: { 'disable-device': 1, 'escape-artist': 1 } });
  levelTo(at, 'rogue', 2, { skills: ['disable-device', 'escape-artist', 'knowledge-arcana'] });
  levelTo(at, 'wizard', 3, { skills: ['knowledge-arcana', 'escape-artist', 'disable-device'], choices: { school: 'universalist' } });
  levelTo(at, 'arcane-trickster', 10, { spellProgression: 'wizard' });
  assert.equal(at.prog('sneakAttack'), 7);
  assert.equal(at.casterLevel('wizard'), 13);

  const as = make({ name: 'Assa', class: 'rogue', alignment: 'NE', scores: ARRAYS.dex, racialBonus: 'dex', feats: [{ id: 'weapon-finesse' }, { id: 'dodge' }], skills: { stealth: 1, disguise: 1 } });
  as.choices.specialRequirements = ['assassin'];
  levelTo(as, 'rogue', 4, { skills: ['stealth', 'disguise'] });
  levelTo(as, 'assassin', 10);
  assert.equal(as.prog('sneakAttack'), 8);
  assert.ok(as.activatedAbilities().includes('study-target'));

  const dd = make({ name: 'Drac', class: 'sorcerer', scores: { str: 10, dex: 12, con: 12, int: 12, wis: 10, cha: 17 }, racialBonus: 'cha', languages: ['Draconic'], feats: [{ id: 'combat-casting' }, { id: 'toughness' }], skills: { 'knowledge-arcana': 1 }, choices: { bloodline: 'draconic', dragonType: 'red' }, spells: { known: ['acid-splash', 'detect-magic', 'light', 'ray-of-frost', 'magic-missile', 'shield'] } });
  levelTo(dd, 'sorcerer', 4, { skills: ['knowledge-arcana'] });
  levelTo(dd, 'dragon-disciple', 10, { spellProgression: 'sorcerer' });
  assert.equal(dd.casterLevel('sorcerer'), 12);
  assert.ok(dd.hasFlag('fly:60'));
  assert.ok(dd.activatedAbilities().includes('breath-weapon'));

  const mt = make({ name: 'Myst', class: 'cleric', deity: 'the-deep-mother', scores: { str: 10, dex: 12, con: 12, int: 15, wis: 15, cha: 10 }, racialBonus: 'wis', feats: [{ id: 'toughness' }, { id: 'combat-casting' }], skills: { 'knowledge-arcana': 1, 'knowledge-religion': 1 }, choices: { domains: ['knowledge', 'healing'] } });
  levelTo(mt, 'cleric', 2, { skills: ['knowledge-arcana', 'knowledge-religion'] });
  levelTo(mt, 'wizard', 3, { skills: ['knowledge-arcana', 'knowledge-religion'], choices: { school: 'universalist' } });
  levelTo(mt, 'mystic-theurge', 10, { spellProgression: { arcane: 'wizard', divine: 'cleric' } });
  assert.equal(mt.casterLevel('cleric'), 13);
  assert.equal(mt.casterLevel('wizard'), 13);
});

test('all base classes level to 20', () => {
  const setups = {
    fighter: { feats: [{ id: 'power-attack' }, { id: 'toughness' }, { id: 'dodge' }] },
    barbarian: { alignment: 'CN' },
    rogue: { scores: ARRAYS.dex, racialBonus: 'dex' },
    wizard: { scores: ARRAYS.int, racialBonus: 'int', choices: { school: 'universalist' } },
    sorcerer: { scores: ARRAYS.cha, racialBonus: 'cha', choices: { bloodline: 'arcane' }, spells: { known: ['acid-splash', 'detect-magic', 'light', 'ray-of-frost', 'magic-missile', 'shield'] } },
    bard: { scores: ARRAYS.cha, racialBonus: 'cha', spells: { known: ['dancing-lights', 'detect-magic', 'light', 'mage-hand', 'cure-light-wounds', 'grease'] } },
    cleric: { scores: ARRAYS.wis, racialBonus: 'wis', deity: 'the-iron-judge', alignment: 'LN', choices: { domains: ['law', 'war'] } },
    monk: { scores: ARRAYS.wis, alignment: 'LN', racialBonus: 'wis', feats: [{ id: 'toughness' }, { id: 'iron-will' }, { id: 'dodge' }] },
    paladin: { alignment: 'LG', scores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 14 } },
    ranger: { scores: ARRAYS.dex, racialBonus: 'dex', choices: { 'favored-enemy': 'humanoid:orc' } },
    magus: { scores: { str: 16, dex: 12, con: 12, int: 15, wis: 10, cha: 8 }, racialBonus: 'int', spells: { spellbook: ['shocking-grasp', 'magic-missile', 'shield', 'frostbite', 'true-strike', 'grease'] } },
    druid: { scores: ARRAYS.wis, racialBonus: 'wis', choices: { 'nature-bond': 'animal-companion', companion: 'wolf' } },
  };
  const { BASE_CLASSES } = require('../src/data/classes');
  for (const id of Object.keys(BASE_CLASSES)) assert.ok(setups[id], `level-20 test setup missing for ${id}`);
  for (const [cls, extra] of Object.entries(setups)) {
    const c = make({ name: `${cls[0].toUpperCase()}${cls.slice(1)} Test`, class: cls, feats: [{ id: 'toughness' }, { id: 'iron-will' }], ...extra });
    levelTo(c, cls, 19);
    assert.equal(c.classLevel(cls), 20, cls);
  }
});

test('inventory: buy, equip, two-handed rules, sell', () => {
  const f = make({ name: 'Shopper', class: 'fighter', feats: [{ id: 'power-attack' }, { id: 'toughness' }, { id: 'dodge' }], kit: false });
  const start = f.money;
  const { item } = inventory.buy(f, 'greatsword');
  assert.equal(f.money, start - 5000);
  inventory.buy(f, 'heavy-steel-shield');
  inventory.equip(f, 'heavy-steel-shield');
  inventory.equip(f, item.uid);
  assert.equal(f.shieldItem(), null, 'two-handed weapon removes the shield');
  const sold = inventory.sell(f, f.inventory.find((i) => i.itemId === 'heavy-steel-shield').uid);
  assert.equal(sold.value, 1000);
  assert.throws(() => inventory.buy(f, 'full-plate'), /Not enough money/);
});
