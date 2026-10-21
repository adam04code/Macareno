'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Equipment: weapons (Table 6-4), armor & shields (Table 6-6), adventuring
 * gear, alchemical items and the common magic items from the Core Rulebook.
 * Damage is listed for Medium wielders; other sizes are derived.
 * Costs are in gp, weights in lbs.
 */

function w(name, category, use, cost, dmg, crit, range, weight, types, groups, special = []) {
  const [critRange, critMult] = crit;
  return { name, kind: 'weapon', category, use, cost, damage: dmg, critRange, critMult, range, weight, damageTypes: types, groups, special, slot: 'hand' };
}

const S = ['slashing'], P = ['piercing'], B = ['bludgeoning'];
const PS = ['piercing', 'slashing'], BP = ['bludgeoning', 'piercing'];

const WEAPONS = {
  // Simple
  'unarmed-strike': w('Unarmed Strike', 'simple', 'light', 0, '1d3', [20, 2], 0, 0, B, ['close', 'monk', 'natural'], ['nonlethal', 'unarmed']),
  gauntlet: w('Gauntlet', 'simple', 'light', 2, '1d3', [20, 2], 0, 1, B, ['close']),
  dagger: w('Dagger', 'simple', 'light', 2, '1d4', [19, 2], 10, 1, PS, ['light-blades', 'thrown'], ['thrown']),
  'punching-dagger': w('Punching Dagger', 'simple', 'light', 2, '1d4', [20, 3], 0, 1, P, ['light-blades']),
  'spiked-gauntlet': w('Spiked Gauntlet', 'simple', 'light', 5, '1d4', [20, 2], 0, 1, P, ['close']),
  'light-mace': w('Light Mace', 'simple', 'light', 5, '1d6', [20, 2], 0, 4, B, ['hammers']),
  sickle: w('Sickle', 'simple', 'light', 6, '1d6', [20, 2], 0, 2, S, ['light-blades'], ['trip']),
  club: w('Club', 'simple', 'one-handed', 0, '1d6', [20, 2], 10, 3, B, ['hammers', 'thrown'], ['thrown']),
  'heavy-mace': w('Heavy Mace', 'simple', 'one-handed', 12, '1d8', [20, 2], 0, 8, B, ['hammers']),
  morningstar: w('Morningstar', 'simple', 'one-handed', 8, '1d8', [20, 2], 0, 6, BP, ['hammers']),
  shortspear: w('Shortspear', 'simple', 'one-handed', 1, '1d6', [20, 2], 20, 3, P, ['spears', 'thrown'], ['thrown']),
  longspear: w('Longspear', 'simple', 'two-handed', 5, '1d8', [20, 3], 0, 9, P, ['polearms', 'spears'], ['brace', 'reach']),
  quarterstaff: w('Quarterstaff', 'simple', 'two-handed', 0, '1d6', [20, 2], 0, 4, B, ['double', 'monk'], ['double', 'monk']),
  spear: w('Spear', 'simple', 'two-handed', 2, '1d8', [20, 3], 20, 6, P, ['spears', 'thrown'], ['brace', 'thrown']),
  dart: w('Dart', 'simple', 'ranged', 0.5, '1d4', [20, 2], 20, 0.5, P, ['thrown'], ['thrown']),
  javelin: w('Javelin', 'simple', 'ranged', 1, '1d6', [20, 2], 30, 2, P, ['spears', 'thrown'], ['thrown']),
  sling: w('Sling', 'simple', 'ranged', 0, '1d4', [20, 2], 50, 0, B, ['thrown'], ['ammo:sling-bullets', 'strDamage']),
  'light-crossbow': w('Light Crossbow', 'simple', 'ranged', 35, '1d8', [19, 2], 80, 4, P, ['crossbows'], ['ammo:bolts', 'reload:move']),
  'heavy-crossbow': w('Heavy Crossbow', 'simple', 'ranged', 50, '1d10', [19, 2], 120, 8, P, ['crossbows'], ['ammo:bolts', 'reload:full']),
  // Martial
  'throwing-axe': w('Throwing Axe', 'martial', 'light', 8, '1d6', [20, 2], 10, 2, S, ['axes', 'thrown'], ['thrown']),
  'light-hammer': w('Light Hammer', 'martial', 'light', 1, '1d4', [20, 2], 20, 2, B, ['hammers', 'thrown'], ['thrown']),
  handaxe: w('Handaxe', 'martial', 'light', 6, '1d6', [20, 3], 0, 3, S, ['axes']),
  kukri: w('Kukri', 'martial', 'light', 8, '1d4', [18, 2], 0, 2, S, ['light-blades']),
  'light-pick': w('Light Pick', 'martial', 'light', 4, '1d4', [20, 4], 0, 3, P, ['axes']),
  sap: w('Sap', 'martial', 'light', 1, '1d6', [20, 2], 0, 2, B, ['hammers'], ['nonlethal']),
  'short-sword': w('Short Sword', 'martial', 'light', 10, '1d6', [19, 2], 0, 2, P, ['light-blades']),
  starknife: w('Starknife', 'martial', 'light', 24, '1d4', [20, 3], 20, 3, P, ['light-blades', 'thrown'], ['thrown']),
  battleaxe: w('Battleaxe', 'martial', 'one-handed', 10, '1d8', [20, 3], 0, 6, S, ['axes']),
  flail: w('Flail', 'martial', 'one-handed', 8, '1d8', [20, 2], 0, 5, B, ['flails'], ['disarm', 'trip']),
  longsword: w('Longsword', 'martial', 'one-handed', 15, '1d8', [19, 2], 0, 4, S, ['heavy-blades']),
  'heavy-pick': w('Heavy Pick', 'martial', 'one-handed', 8, '1d6', [20, 4], 0, 6, P, ['axes']),
  rapier: w('Rapier', 'martial', 'one-handed', 20, '1d6', [18, 2], 0, 2, P, ['light-blades'], ['finesse']),
  scimitar: w('Scimitar', 'martial', 'one-handed', 15, '1d6', [18, 2], 0, 4, S, ['heavy-blades']),
  trident: w('Trident', 'martial', 'one-handed', 15, '1d8', [20, 2], 10, 4, P, ['spears', 'thrown'], ['brace', 'thrown']),
  warhammer: w('Warhammer', 'martial', 'one-handed', 12, '1d8', [20, 3], 0, 5, B, ['hammers']),
  falchion: w('Falchion', 'martial', 'two-handed', 75, '2d4', [18, 2], 0, 8, S, ['heavy-blades']),
  glaive: w('Glaive', 'martial', 'two-handed', 8, '1d10', [20, 3], 0, 10, S, ['polearms'], ['reach']),
  greataxe: w('Greataxe', 'martial', 'two-handed', 20, '1d12', [20, 3], 0, 12, S, ['axes']),
  greatclub: w('Greatclub', 'martial', 'two-handed', 5, '1d10', [20, 2], 0, 8, B, ['hammers']),
  'heavy-flail': w('Heavy Flail', 'martial', 'two-handed', 15, '1d10', [19, 2], 0, 10, B, ['flails'], ['disarm', 'trip']),
  greatsword: w('Greatsword', 'martial', 'two-handed', 50, '2d6', [19, 2], 0, 8, S, ['heavy-blades']),
  guisarme: w('Guisarme', 'martial', 'two-handed', 9, '2d4', [20, 3], 0, 12, S, ['polearms'], ['reach', 'trip']),
  halberd: w('Halberd', 'martial', 'two-handed', 10, '1d10', [20, 3], 0, 12, PS, ['polearms'], ['brace', 'trip']),
  lance: w('Lance', 'martial', 'two-handed', 10, '1d8', [20, 3], 0, 10, P, ['spears'], ['reach']),
  ranseur: w('Ranseur', 'martial', 'two-handed', 10, '2d4', [20, 3], 0, 12, P, ['polearms'], ['disarm', 'reach']),
  scythe: w('Scythe', 'martial', 'two-handed', 18, '2d4', [20, 4], 0, 10, PS, ['heavy-blades'], ['trip']),
  shortbow: w('Shortbow', 'martial', 'ranged', 30, '1d6', [20, 3], 60, 2, P, ['bows'], ['ammo:arrows']),
  'composite-shortbow': w('Composite Shortbow', 'martial', 'ranged', 75, '1d6', [20, 3], 70, 2, P, ['bows'], ['ammo:arrows', 'composite']),
  longbow: w('Longbow', 'martial', 'ranged', 75, '1d8', [20, 3], 100, 3, P, ['bows'], ['ammo:arrows']),
  'composite-longbow': w('Composite Longbow', 'martial', 'ranged', 100, '1d8', [20, 3], 110, 3, P, ['bows'], ['ammo:arrows', 'composite']),
  // Exotic
  kama: w('Kama', 'exotic', 'light', 2, '1d6', [20, 2], 0, 2, S, ['monk'], ['monk', 'trip']),
  nunchaku: w('Nunchaku', 'exotic', 'light', 2, '1d6', [20, 2], 0, 2, B, ['monk'], ['disarm', 'monk']),
  sai: w('Sai', 'exotic', 'light', 1, '1d4', [20, 2], 0, 1, B, ['light-blades', 'monk'], ['disarm', 'monk']),
  siangham: w('Siangham', 'exotic', 'light', 3, '1d6', [20, 2], 0, 1, P, ['monk'], ['monk']),
  'bastard-sword': w('Bastard Sword', 'exotic', 'one-handed', 35, '1d10', [19, 2], 0, 6, S, ['heavy-blades'], ['twoHandMartial']),
  'dwarven-waraxe': w('Dwarven Waraxe', 'exotic', 'one-handed', 30, '1d10', [20, 3], 0, 8, S, ['axes'], ['twoHandMartial']),
  whip: w('Whip', 'exotic', 'one-handed', 1, '1d3', [20, 2], 0, 2, S, ['flails'], ['disarm', 'nonlethal', 'reach', 'trip', 'finesse']),
  'elven-curve-blade': w('Elven Curve Blade', 'exotic', 'two-handed', 80, '1d10', [18, 2], 0, 7, S, ['heavy-blades'], ['finesse']),
  'orc-double-axe': w('Orc Double Axe', 'exotic', 'two-handed', 60, '1d8', [20, 3], 0, 15, S, ['axes', 'double'], ['double']),
  'spiked-chain': w('Spiked Chain', 'exotic', 'two-handed', 25, '2d4', [20, 2], 0, 10, P, ['flails'], ['disarm', 'trip', 'finesse']),
  'two-bladed-sword': w('Two-Bladed Sword', 'exotic', 'two-handed', 100, '1d8', [19, 2], 0, 10, S, ['double', 'heavy-blades'], ['double']),
  'dwarven-urgrosh': w('Dwarven Urgrosh', 'exotic', 'two-handed', 50, '1d8', [20, 3], 0, 12, PS, ['double', 'axes'], ['brace', 'double']),
  'hand-crossbow': w('Hand Crossbow', 'exotic', 'ranged', 100, '1d4', [19, 2], 30, 2, P, ['crossbows'], ['ammo:bolts', 'reload:move']),
  shuriken: w('Shuriken', 'exotic', 'ranged', 0.2, '1d2', [20, 2], 10, 0.1, P, ['monk', 'thrown'], ['monk', 'thrown']),
  bolas: w('Bolas', 'exotic', 'ranged', 5, '1d4', [20, 2], 10, 2, B, ['thrown'], ['nonlethal', 'trip', 'thrown']),
};

// Armor (Table 6-6). bonus, maxDex, acp, asf (arcane spell failure %), speed30 (speed for 30ft base).
function a(name, type, cost, bonus, maxDex, acp, asf, weight) {
  return { name, kind: type === 'shield' ? 'shield' : 'armor', armorType: type, cost, bonus, maxDex, acp, asf, weight, slot: type === 'shield' ? 'shield' : 'armor' };
}
const ARMOR = {
  padded: a('Padded', 'light', 5, 1, 8, 0, 5, 10),
  leather: a('Leather', 'light', 10, 2, 6, 0, 10, 15),
  'studded-leather': a('Studded Leather', 'light', 25, 3, 5, -1, 15, 20),
  'chain-shirt': a('Chain Shirt', 'light', 100, 4, 4, -2, 20, 25),
  hide: a('Hide', 'medium', 15, 4, 4, -3, 20, 25),
  'scale-mail': a('Scale Mail', 'medium', 50, 5, 3, -4, 25, 30),
  chainmail: a('Chainmail', 'medium', 150, 6, 2, -5, 30, 40),
  breastplate: a('Breastplate', 'medium', 200, 6, 3, -4, 25, 30),
  'splint-mail': a('Splint Mail', 'heavy', 200, 7, 0, -7, 40, 45),
  'banded-mail': a('Banded Mail', 'heavy', 250, 7, 1, -6, 35, 35),
  'half-plate': a('Half-Plate', 'heavy', 600, 8, 0, -7, 40, 50),
  'full-plate': a('Full Plate', 'heavy', 1500, 9, 1, -6, 35, 50),
  buckler: a('Buckler', 'shield', 5, 1, null, -1, 5, 5),
  'light-wooden-shield': a('Light Wooden Shield', 'shield', 3, 1, null, -1, 5, 5),
  'light-steel-shield': a('Light Steel Shield', 'shield', 9, 1, null, -1, 5, 6),
  'heavy-wooden-shield': a('Heavy Wooden Shield', 'shield', 7, 2, null, -2, 15, 10),
  'heavy-steel-shield': a('Heavy Steel Shield', 'shield', 20, 2, null, -2, 15, 15),
  'tower-shield': a('Tower Shield', 'shield', 30, 4, 2, -10, 50, 45),
};
ARMOR.buckler.shieldType = 'buckler';
ARMOR['tower-shield'].shieldType = 'tower';
for (const k of ['light-wooden-shield', 'light-steel-shield']) ARMOR[k].shieldType = 'light';
for (const k of ['heavy-wooden-shield', 'heavy-steel-shield']) ARMOR[k].shieldType = 'heavy';

// Weapon special abilities (Table 15-9): bonus = enhancement-equivalent price.
const WEAPON_SPECIALS = {
  flaming: { name: 'Flaming', bonus: 1, extraDamage: { dice: '1d6', type: 'fire' } },
  frost: { name: 'Frost', bonus: 1, extraDamage: { dice: '1d6', type: 'cold' } },
  shock: { name: 'Shock', bonus: 1, extraDamage: { dice: '1d6', type: 'electricity' } },
  corrosive: { name: 'Corrosive', bonus: 1, extraDamage: { dice: '1d6', type: 'acid' } },
  keen: { name: 'Keen', bonus: 1, doublesThreat: true, requires: ['piercing', 'slashing'] },
  'ghost-touch': { name: 'Ghost Touch', bonus: 1, ghostTouch: true },
  merciful: { name: 'Merciful', bonus: 1, extraDamage: { dice: '1d6', type: 'nonlethal' }, nonlethal: true },
  bane: { name: 'Bane', bonus: 1, bane: true },
  'flaming-burst': { name: 'Flaming Burst', bonus: 2, extraDamage: { dice: '1d6', type: 'fire' }, burst: { type: 'fire' } },
  'icy-burst': { name: 'Icy Burst', bonus: 2, extraDamage: { dice: '1d6', type: 'cold' }, burst: { type: 'cold' } },
  'shocking-burst': { name: 'Shocking Burst', bonus: 2, extraDamage: { dice: '1d6', type: 'electricity' }, burst: { type: 'electricity' } },
  holy: { name: 'Holy', bonus: 2, alignedDamage: { dice: '2d6', vs: 'evil' }, alignment: 'good' },
  unholy: { name: 'Unholy', bonus: 2, alignedDamage: { dice: '2d6', vs: 'good' }, alignment: 'evil' },
  axiomatic: { name: 'Axiomatic', bonus: 2, alignedDamage: { dice: '2d6', vs: 'chaotic' }, alignment: 'lawful' },
  anarchic: { name: 'Anarchic', bonus: 2, alignedDamage: { dice: '2d6', vs: 'lawful' }, alignment: 'chaotic' },
  wounding: { name: 'Wounding', bonus: 2, bleed: 1 },
  speed: { name: 'Speed', bonus: 3, extraAttack: true },
  vorpal: { name: 'Vorpal', bonus: 5, vorpal: true, requires: ['slashing'] },
};

const ARMOR_SPECIALS = {
  'light-fortification': { name: 'Light Fortification', bonus: 1, fortification: 25 },
  'moderate-fortification': { name: 'Moderate Fortification', bonus: 3, fortification: 50 },
  'heavy-fortification': { name: 'Heavy Fortification', bonus: 5, fortification: 75 },
  'spell-resistance-13': { name: 'Spell Resistance (13)', bonus: 2, sr: 13 },
  'spell-resistance-15': { name: 'Spell Resistance (15)', bonus: 3, sr: 15 },
  'fire-resistance': { name: 'Energy Resistance (fire)', costGp: 18000, resist: { fire: 10 } },
  'cold-resistance': { name: 'Energy Resistance (cold)', costGp: 18000, resist: { cold: 10 } },
  shadow: { name: 'Shadow', costGp: 3750, skill: { stealth: 5 } },
};

function wondrous(name, slot, cost, modifiers, extra = {}) {
  return { name, kind: 'wondrous', slot, cost, weight: extra.weight ?? 1, modifiers, ...extra };
}

const bonusLadder = (prefix, nameFn, slot, costPerSq, modFn, max = 5) => {
  const out = {};
  for (let b = 1; b <= max; b++) out[`${prefix}-${b}`] = wondrous(nameFn(b), slot, costPerSq * b * b, (s) => modFn(b, s));
  return out;
};

const WONDROUS = {
  ...bonusLadder('ring-of-protection', (b) => `Ring of Protection +${b}`, 'ring', 2000, (b, s) => [mod('ac', b, 'deflection', s)]),
  ...bonusLadder('amulet-of-natural-armor', (b) => `Amulet of Natural Armor +${b}`, 'neck', 2000, (b, s) => [mod('ac', b, 'natural-enhancement', s)]),
  ...bonusLadder('cloak-of-resistance', (b) => `Cloak of Resistance +${b}`, 'shoulders', 1000, (b, s) => [mod('save', b, 'resistance', s)]),
  ...bonusLadder('bracers-of-armor', (b) => `Bracers of Armor +${b}`, 'wrists', 1000, (b, s) => [mod('ac', b, 'armor', s)], 8),
  'belt-of-giant-strength-2': wondrous('Belt of Giant Strength +2', 'belt', 4000, (s) => [mod('str', 2, 'enhancement', s)]),
  'belt-of-giant-strength-4': wondrous('Belt of Giant Strength +4', 'belt', 16000, (s) => [mod('str', 4, 'enhancement', s)]),
  'belt-of-giant-strength-6': wondrous('Belt of Giant Strength +6', 'belt', 36000, (s) => [mod('str', 6, 'enhancement', s)]),
  'belt-of-incredible-dexterity-2': wondrous('Belt of Incredible Dexterity +2', 'belt', 4000, (s) => [mod('dex', 2, 'enhancement', s)]),
  'belt-of-incredible-dexterity-4': wondrous('Belt of Incredible Dexterity +4', 'belt', 16000, (s) => [mod('dex', 4, 'enhancement', s)]),
  'belt-of-mighty-constitution-2': wondrous('Belt of Mighty Constitution +2', 'belt', 4000, (s) => [mod('con', 2, 'enhancement', s)]),
  'belt-of-mighty-constitution-4': wondrous('Belt of Mighty Constitution +4', 'belt', 16000, (s) => [mod('con', 4, 'enhancement', s)]),
  'headband-of-vast-intelligence-2': wondrous('Headband of Vast Intelligence +2', 'headband', 4000, (s) => [mod('int', 2, 'enhancement', s)]),
  'headband-of-vast-intelligence-4': wondrous('Headband of Vast Intelligence +4', 'headband', 16000, (s) => [mod('int', 4, 'enhancement', s)]),
  'headband-of-inspired-wisdom-2': wondrous('Headband of Inspired Wisdom +2', 'headband', 4000, (s) => [mod('wis', 2, 'enhancement', s)]),
  'headband-of-inspired-wisdom-4': wondrous('Headband of Inspired Wisdom +4', 'headband', 16000, (s) => [mod('wis', 4, 'enhancement', s)]),
  'headband-of-alluring-charisma-2': wondrous('Headband of Alluring Charisma +2', 'headband', 4000, (s) => [mod('cha', 2, 'enhancement', s)]),
  'headband-of-alluring-charisma-4': wondrous('Headband of Alluring Charisma +4', 'headband', 16000, (s) => [mod('cha', 4, 'enhancement', s)]),
  'boots-of-elvenkind': wondrous('Boots of Elvenkind', 'feet', 2500, (s) => [mod('skill.acrobatics', 5, 'competence', s)]),
  'cloak-of-elvenkind': wondrous('Cloak of Elvenkind', 'shoulders', 2500, (s) => [mod('skill.stealth', 5, 'competence', s)]),
  'boots-of-striding-and-springing': wondrous('Boots of Striding and Springing', 'feet', 5500, (s) => [mod('speed', 10, 'enhancement', s), mod('skill.acrobatics', 5, 'competence', s, ['jump'])]),
  'eyes-of-the-eagle': wondrous('Eyes of the Eagle', 'eyes', 2500, (s) => [mod('skill.perception', 5, 'competence', s)]),
  'gloves-of-swimming-and-climbing': wondrous('Gloves of Swimming and Climbing', 'hands', 6250, (s) => [mod('skill.swim', 5, 'competence', s), mod('skill.climb', 5, 'competence', s)]),
  'headband-of-mental-prowess': wondrous('Headband of Mental Prowess +2 (Int/Wis)', 'headband', 10000, (s) => [mod('int', 2, 'enhancement', s), mod('wis', 2, 'enhancement', s)]),
  'periapt-of-wisdom-2': wondrous('Periapt of Wisdom +2', 'neck', 4000, (s) => [mod('wis', 2, 'enhancement', s)]),
  'ioun-stone-dusty-rose': wondrous('Ioun Stone (dusty rose prism)', 'none', 5000, (s) => [mod('ac', 1, 'insight', s)]),
  'stone-of-good-luck': wondrous('Stone of Good Luck (Luckstone)', 'none', 20000, (s) => [mod('save', 1, 'luck', s), mod('skill', 1, 'luck', s), mod('abilityCheck', 1, 'luck', s)]),
  'bag-of-holding-1': wondrous('Bag of Holding (type I)', 'none', 2500, () => [], { weight: 15, capacity: 250 }),
  'handy-haversack': wondrous("Handy Haversack", 'none', 2000, () => [], { weight: 5, capacity: 120 }),
  'pearl-of-power-1': wondrous('Pearl of Power (1st)', 'none', 1000, () => [], { recallSpellLevel: 1 }),
  'pearl-of-power-2': wondrous('Pearl of Power (2nd)', 'none', 4000, () => [], { recallSpellLevel: 2 }),
  'pearl-of-power-3': wondrous('Pearl of Power (3rd)', 'none', 9000, () => [], { recallSpellLevel: 3 }),
};

// Consumables: potions/scrolls/wands cast a spell at a caster level.
function potion(spell, cl, cost, name) {
  return { name: name || `Potion of ${spell.replace(/-/g, ' ')}`, kind: 'potion', spell, cl, cost, weight: 0.1, consumable: true };
}
const CONSUMABLES = {
  'potion-cure-light-wounds': potion('cure-light-wounds', 1, 50, 'Potion of Cure Light Wounds'),
  'potion-cure-moderate-wounds': potion('cure-moderate-wounds', 3, 300, 'Potion of Cure Moderate Wounds'),
  'potion-cure-serious-wounds': potion('cure-serious-wounds', 5, 750, 'Potion of Cure Serious Wounds'),
  'potion-bulls-strength': potion('bulls-strength', 3, 300, "Potion of Bull's Strength"),
  'potion-cats-grace': potion('cats-grace', 3, 300, "Potion of Cat's Grace"),
  'potion-bears-endurance': potion('bears-endurance', 3, 300, "Potion of Bear's Endurance"),
  'potion-barkskin': potion('barkskin', 3, 300, 'Potion of Barkskin'),
  'potion-invisibility': potion('invisibility', 3, 300, 'Potion of Invisibility'),
  'potion-enlarge-person': potion('enlarge-person', 1, 50, 'Potion of Enlarge Person'),
  'potion-shield-of-faith': potion('shield-of-faith', 1, 50, 'Potion of Shield of Faith'),
  'potion-protection-from-evil': potion('protection-from-evil', 1, 50, 'Potion of Protection from Evil'),
  'potion-fly': potion('fly', 5, 750, 'Potion of Fly'),
  'potion-haste': potion('haste', 5, 750, 'Potion of Haste'),
  'potion-lesser-restoration': potion('lesser-restoration', 3, 300, 'Potion of Lesser Restoration'),
  'potion-remove-fear': potion('remove-fear', 1, 50, 'Potion of Remove Fear'),
  'potion-neutralize-poison': potion('neutralize-poison', 7, 1050, 'Potion of Neutralize Poison'),
  'scroll-magic-missile': { name: 'Scroll of Magic Missile', kind: 'scroll', spell: 'magic-missile', cl: 1, cost: 25, weight: 0, consumable: true, tradition: 'arcane' },
  'scroll-fireball': { name: 'Scroll of Fireball', kind: 'scroll', spell: 'fireball', cl: 5, cost: 375, weight: 0, consumable: true, tradition: 'arcane' },
  'scroll-cure-light-wounds': { name: 'Scroll of Cure Light Wounds', kind: 'scroll', spell: 'cure-light-wounds', cl: 1, cost: 25, weight: 0, consumable: true, tradition: 'divine' },
  'scroll-raise-dead': { name: 'Scroll of Raise Dead', kind: 'scroll', spell: 'raise-dead', cl: 9, cost: 1125 + 5000, weight: 0, consumable: true, tradition: 'divine' },
  'wand-cure-light-wounds': { name: 'Wand of Cure Light Wounds', kind: 'wand', spell: 'cure-light-wounds', cl: 1, cost: 750, charges: 50, weight: 0.1 },
  'wand-magic-missile': { name: 'Wand of Magic Missile', kind: 'wand', spell: 'magic-missile', cl: 1, cost: 750, charges: 50, weight: 0.1 },
  'wand-scorching-ray': { name: 'Wand of Scorching Ray', kind: 'wand', spell: 'scorching-ray', cl: 3, cost: 4500, charges: 50, weight: 0.1 },
  'wand-lightning-bolt': { name: 'Wand of Lightning Bolt', kind: 'wand', spell: 'lightning-bolt', cl: 5, cost: 11250, charges: 50, weight: 0.1 },
  // Alchemical (thrown splash weapons): ranged touch attacks.
  'alchemists-fire': { name: "Alchemist's Fire", kind: 'splash', cost: 20, weight: 1, damage: '1d6', damageType: 'fire', splash: 1, range: 10, burning: '1d6', consumable: true },
  'acid-flask': { name: 'Acid (flask)', kind: 'splash', cost: 10, weight: 1, damage: '1d6', damageType: 'acid', splash: 1, range: 10, consumable: true },
  'holy-water': { name: 'Holy Water (flask)', kind: 'splash', cost: 25, weight: 1, damage: '2d4', damageType: 'positive', splash: 1, range: 10, onlyVs: ['undead', 'evil-outsider'], consumable: true },
  'tanglefoot-bag': { name: 'Tanglefoot Bag', kind: 'splash', cost: 50, weight: 4, range: 10, condition: { id: 'entangled', rounds: '2d4', save: { type: 'ref', dc: 15 } }, consumable: true },
  antitoxin: { name: 'Antitoxin', kind: 'alchemical', cost: 50, weight: 0, modifiers: (s) => [mod('save', 5, 'alchemical', s, ['poison'])], durationRounds: 600, consumable: true },
  sunrod: { name: 'Sunrod', kind: 'gear', cost: 2, weight: 1, light: 30 },
};

const GEAR = {
  backpack: { name: 'Backpack', kind: 'gear', cost: 2, weight: 2 },
  bedroll: { name: 'Bedroll', kind: 'gear', cost: 0.1, weight: 5 },
  'rope-hemp': { name: 'Hemp Rope (50 ft.)', kind: 'gear', cost: 1, weight: 10 },
  'rope-silk': { name: 'Silk Rope (50 ft.)', kind: 'gear', cost: 10, weight: 5 },
  torch: { name: 'Torch', kind: 'gear', cost: 0.01, weight: 1, light: 20 },
  'trail-rations': { name: 'Trail Rations (1 day)', kind: 'gear', cost: 0.5, weight: 1 },
  waterskin: { name: 'Waterskin', kind: 'gear', cost: 1, weight: 4 },
  'flint-and-steel': { name: 'Flint and Steel', kind: 'gear', cost: 1, weight: 0 },
  'healers-kit': { name: "Healer's Kit", kind: 'tool', cost: 50, weight: 1, uses: 10, skillBonus: { skill: 'heal', value: 2 } },
  'thieves-tools': { name: "Thieves' Tools", kind: 'tool', cost: 30, weight: 1, skillBonus: { skill: 'disable-device', value: 0 }, required: 'disable-device' },
  'masterwork-thieves-tools': { name: "Masterwork Thieves' Tools", kind: 'tool', cost: 100, weight: 2, skillBonus: { skill: 'disable-device', value: 2 } },
  'climbers-kit': { name: "Climber's Kit", kind: 'tool', cost: 80, weight: 5, skillBonus: { skill: 'climb', value: 2 } },
  'disguise-kit': { name: 'Disguise Kit', kind: 'tool', cost: 50, weight: 8, skillBonus: { skill: 'disguise', value: 2 } },
  'spell-component-pouch': { name: 'Spell Component Pouch', kind: 'gear', cost: 5, weight: 2 },
  'holy-symbol-wooden': { name: 'Wooden Holy Symbol', kind: 'gear', cost: 1, weight: 0 },
  'holy-symbol-silver': { name: 'Silver Holy Symbol', kind: 'gear', cost: 25, weight: 1 },
  spellbook: { name: 'Spellbook (blank)', kind: 'gear', cost: 15, weight: 3 },
  arrows: { name: 'Arrows (20)', kind: 'ammo', ammoType: 'arrows', cost: 1, weight: 3, qtyPer: 20 },
  bolts: { name: 'Crossbow Bolts (10)', kind: 'ammo', ammoType: 'bolts', cost: 1, weight: 1, qtyPer: 10 },
  'sling-bullets': { name: 'Sling Bullets (10)', kind: 'ammo', ammoType: 'sling-bullets', cost: 0.1, weight: 5, qtyPer: 10 },
  'musical-instrument': { name: 'Musical Instrument (common)', kind: 'tool', cost: 5, weight: 3 },
  'masterwork-instrument': { name: 'Masterwork Musical Instrument', kind: 'tool', cost: 100, weight: 3, skillBonus: { skill: 'perform', value: 2 } },
  'pearl-dust-100': { name: 'Diamond Dust (100 gp)', kind: 'component', cost: 100, weight: 0 },
  'diamond-5000': { name: 'Diamond (5,000 gp)', kind: 'component', cost: 5000, weight: 0 },
};

const ITEMS = {};
for (const [id, it] of Object.entries(WEAPONS)) ITEMS[id] = { id, ...it };
for (const [id, it] of Object.entries(ARMOR)) ITEMS[id] = { id, ...it };
for (const [id, it] of Object.entries(WONDROUS)) ITEMS[id] = { id, ...it };
for (const [id, it] of Object.entries(CONSUMABLES)) ITEMS[id] = { id, ...it };
for (const [id, it] of Object.entries(GEAR)) ITEMS[id] = { id, ...it };

// Masterwork and enhancement pricing (Chapter 15).
function itemPrice(def, inst = {}) {
  let cost = def.cost;
  const special = inst.special || [];
  if (def.kind === 'weapon') {
    if (inst.masterwork || inst.enhancement) cost += 300;
    const b = (inst.enhancement || 0) + special.reduce((s, k) => s + (WEAPON_SPECIALS[k]?.bonus || 0), 0);
    cost += 2000 * b * b;
  } else if (def.kind === 'armor' || def.kind === 'shield') {
    if (inst.masterwork || inst.enhancement) cost += 150;
    const b = (inst.enhancement || 0) + special.reduce((s, k) => s + (ARMOR_SPECIALS[k]?.bonus || 0), 0);
    cost += 1000 * b * b + special.reduce((s, k) => s + (ARMOR_SPECIALS[k]?.costGp || 0), 0);
  }
  return cost;
}

const SMALL_DAMAGE = { '1d2': '1', '1d3': '1d2', '1d4': '1d3', '1d6': '1d4', '1d8': '1d6', '1d10': '1d8', '1d12': '1d10', '2d4': '1d6', '2d6': '1d10', '2d8': '2d6', '2d10': '2d8' };
const LARGE_DAMAGE = { '1d2': '1d3', '1d3': '1d4', '1d4': '1d6', '1d6': '1d8', '1d8': '2d6', '1d10': '2d8', '1d12': '3d6', '2d4': '2d6', '2d6': '3d6', '2d8': '3d8', '2d10': '4d8' };

function weaponDamageForSize(dmg, size) {
  if (size === 'small') return SMALL_DAMAGE[dmg] || dmg;
  if (size === 'large') return LARGE_DAMAGE[dmg] || dmg;
  return dmg;
}

// Starting wealth by class (average gp, Table 6-1).
const STARTING_WEALTH = { barbarian: 105, bard: 105, cleric: 140, druid: 70, fighter: 175, monk: 35, paladin: 175, ranger: 175, rogue: 140, sorcerer: 70, wizard: 70, magus: 140 };

module.exports = { WEAPONS, ARMOR, WEAPON_SPECIALS, ARMOR_SPECIALS, WONDROUS, CONSUMABLES, GEAR, ITEMS, itemPrice, weaponDamageForSize, STARTING_WEALTH };
