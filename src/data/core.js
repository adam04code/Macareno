'use strict';

/** Basic rules vocabulary: abilities, sizes, alignments, creature types, skills, languages. */

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

// Size categories (Table 8-1 plus CMB "special size modifier").
const SIZES = {
  fine: { order: 0, name: 'Fine', mod: 8, special: -8, fly: 8, stealth: 16, space: 0.5, reach: 0, carry: 1 / 8 },
  diminutive: { order: 1, name: 'Diminutive', mod: 4, special: -4, fly: 6, stealth: 12, space: 1, reach: 0, carry: 1 / 4 },
  tiny: { order: 2, name: 'Tiny', mod: 2, special: -2, fly: 4, stealth: 8, space: 2.5, reach: 0, carry: 1 / 2 },
  small: { order: 3, name: 'Small', mod: 1, special: -1, fly: 2, stealth: 4, space: 5, reach: 5, carry: 3 / 4 },
  medium: { order: 4, name: 'Medium', mod: 0, special: 0, fly: 0, stealth: 0, space: 5, reach: 5, carry: 1 },
  large: { order: 5, name: 'Large', mod: -1, special: 1, fly: -2, stealth: -4, space: 10, reach: 10, carry: 2 },
  huge: { order: 6, name: 'Huge', mod: -2, special: 2, fly: -4, stealth: -8, space: 15, reach: 15, carry: 4 },
  gargantuan: { order: 7, name: 'Gargantuan', mod: -4, special: 4, fly: -6, stealth: -12, space: 20, reach: 20, carry: 8 },
  colossal: { order: 8, name: 'Colossal', mod: -8, special: 8, fly: -8, stealth: -16, space: 30, reach: 30, carry: 16 },
};
const SIZE_ORDER = Object.keys(SIZES);

function shiftSize(size, steps) {
  const i = Math.max(0, Math.min(SIZE_ORDER.length - 1, SIZES[size].order + steps));
  return SIZE_ORDER[i];
}

const ALIGNMENTS = {
  LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good',
  LN: 'Lawful Neutral', N: 'True Neutral', CN: 'Chaotic Neutral',
  LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil',
};

function alignmentAxes(al) {
  const a = al === 'N' ? 'NN' : al;
  return {
    lawful: a[0] === 'L', chaotic: a[0] === 'C',
    good: a[1] === 'G', evil: a[1] === 'E',
    neutralEthic: a[0] === 'N', neutralMoral: a[1] === 'N',
  };
}

/** True when two alignments are within one step of each other (cleric/deity rule). */
function alignmentStepDistance(a, b) {
  const idx = (al) => {
    const s = al === 'N' ? 'NN' : al;
    return [{ L: 0, N: 1, C: 2 }[s[0]], { G: 0, N: 1, E: 2 }[s[1]]];
  };
  const [a1, a2] = idx(a);
  const [b1, b2] = idx(b);
  return Math.abs(a1 - b1) + Math.abs(a2 - b2);
}

// Creature types (Bestiary "Creature Types"): hit die, BAB progression, good saves, traits.
const IMMUNE_MIND_POISON = ['mind-affecting', 'poison', 'sleep', 'paralysis', 'stun', 'disease', 'death', 'critical', 'nonlethal', 'ability-drain', 'energy-drain', 'fatigue', 'exhaustion', 'precision'];
const CREATURE_TYPES = {
  aberration: { hd: 8, bab: 'threeQuarter', goodSaves: ['will'], senses: ['darkvision 60'] },
  animal: { hd: 8, bab: 'threeQuarter', goodSaves: ['fort', 'ref'], senses: ['low-light vision'] },
  construct: { hd: 10, bab: 'full', goodSaves: [], immunities: [...IMMUNE_MIND_POISON, 'fort-unless-object', 'bleed'], noCon: true, senses: ['darkvision 60', 'low-light vision'] },
  dragon: { hd: 12, bab: 'full', goodSaves: ['fort', 'ref', 'will'], immunities: ['sleep', 'paralysis'], senses: ['darkvision 60', 'low-light vision'] },
  fey: { hd: 6, bab: 'half', goodSaves: ['ref', 'will'], senses: ['low-light vision'] },
  humanoid: { hd: 8, bab: 'threeQuarter', goodSaves: ['ref'] },
  'magical beast': { hd: 10, bab: 'full', goodSaves: ['fort', 'ref'], senses: ['darkvision 60', 'low-light vision'] },
  'monstrous humanoid': { hd: 10, bab: 'full', goodSaves: ['ref', 'will'], senses: ['darkvision 60'] },
  ooze: { hd: 8, bab: 'threeQuarter', goodSaves: [], immunities: ['critical', 'flanking', 'mind-affecting', 'poison', 'sleep', 'paralysis', 'polymorph', 'stun', 'precision', 'gaze', 'visual'], senses: ['blindsight 60'] },
  outsider: { hd: 10, bab: 'full', goodSaves: ['ref', 'will'], senses: ['darkvision 60'] },
  plant: { hd: 8, bab: 'threeQuarter', goodSaves: ['fort'], immunities: ['mind-affecting', 'paralysis', 'poison', 'polymorph', 'sleep', 'stun'], senses: ['low-light vision'] },
  undead: { hd: 8, bab: 'threeQuarter', goodSaves: ['will'], immunities: IMMUNE_MIND_POISON, noCon: true, usesChaForHp: true, senses: ['darkvision 60'], healedByNegative: true },
  vermin: { hd: 8, bab: 'threeQuarter', goodSaves: ['fort'], immunities: ['mind-affecting'], senses: ['darkvision 60'] },
};

// Skills (Chapter 4). acp = armor check penalty applies; trained = trained only.
const SKILLS = {
  acrobatics: { name: 'Acrobatics', ability: 'dex', acp: true },
  appraise: { name: 'Appraise', ability: 'int' },
  bluff: { name: 'Bluff', ability: 'cha' },
  climb: { name: 'Climb', ability: 'str', acp: true },
  craft: { name: 'Craft', ability: 'int' },
  diplomacy: { name: 'Diplomacy', ability: 'cha' },
  'disable-device': { name: 'Disable Device', ability: 'dex', acp: true, trained: true },
  disguise: { name: 'Disguise', ability: 'cha' },
  'escape-artist': { name: 'Escape Artist', ability: 'dex', acp: true },
  fly: { name: 'Fly', ability: 'dex', acp: true },
  'handle-animal': { name: 'Handle Animal', ability: 'cha', trained: true },
  heal: { name: 'Heal', ability: 'wis' },
  intimidate: { name: 'Intimidate', ability: 'cha' },
  'knowledge-arcana': { name: 'Knowledge (arcana)', ability: 'int', trained: true, knowledge: true },
  'knowledge-dungeoneering': { name: 'Knowledge (dungeoneering)', ability: 'int', trained: true, knowledge: true },
  'knowledge-engineering': { name: 'Knowledge (engineering)', ability: 'int', trained: true, knowledge: true },
  'knowledge-geography': { name: 'Knowledge (geography)', ability: 'int', trained: true, knowledge: true },
  'knowledge-history': { name: 'Knowledge (history)', ability: 'int', trained: true, knowledge: true },
  'knowledge-local': { name: 'Knowledge (local)', ability: 'int', trained: true, knowledge: true },
  'knowledge-nature': { name: 'Knowledge (nature)', ability: 'int', trained: true, knowledge: true },
  'knowledge-nobility': { name: 'Knowledge (nobility)', ability: 'int', trained: true, knowledge: true },
  'knowledge-planes': { name: 'Knowledge (planes)', ability: 'int', trained: true, knowledge: true },
  'knowledge-religion': { name: 'Knowledge (religion)', ability: 'int', trained: true, knowledge: true },
  linguistics: { name: 'Linguistics', ability: 'int', trained: true },
  perception: { name: 'Perception', ability: 'wis' },
  perform: { name: 'Perform', ability: 'cha' },
  profession: { name: 'Profession', ability: 'wis', trained: true },
  ride: { name: 'Ride', ability: 'dex', acp: true },
  'sense-motive': { name: 'Sense Motive', ability: 'wis' },
  'sleight-of-hand': { name: 'Sleight of Hand', ability: 'dex', acp: true, trained: true },
  spellcraft: { name: 'Spellcraft', ability: 'int', trained: true },
  stealth: { name: 'Stealth', ability: 'dex', acp: true },
  survival: { name: 'Survival', ability: 'wis' },
  swim: { name: 'Swim', ability: 'str', acp: true, doubleAcp: false },
  'use-magic-device': { name: 'Use Magic Device', ability: 'cha', trained: true },
};
const KNOWLEDGE_SKILLS = Object.keys(SKILLS).filter((k) => SKILLS[k].knowledge);

// Which knowledge skill identifies which creature type (Knowledge skill table).
const KNOWLEDGE_BY_TYPE = {
  aberration: 'knowledge-dungeoneering', ooze: 'knowledge-dungeoneering',
  construct: 'knowledge-arcana', dragon: 'knowledge-arcana', 'magical beast': 'knowledge-arcana',
  animal: 'knowledge-nature', fey: 'knowledge-nature', 'monstrous humanoid': 'knowledge-nature', plant: 'knowledge-nature', vermin: 'knowledge-nature',
  humanoid: 'knowledge-local', outsider: 'knowledge-planes', undead: 'knowledge-religion',
};

const LANGUAGES = ['Common', 'Abyssal', 'Aklo', 'Aquan', 'Auran', 'Celestial', 'Draconic', 'Druidic', 'Dwarven', 'Elven', 'Giant', 'Gnome', 'Goblin', 'Gnoll', 'Halfling', 'Ignan', 'Infernal', 'Orc', 'Sylvan', 'Terran', 'Undercommon'];

const ENERGY_TYPES = ['acid', 'cold', 'electricity', 'fire', 'sonic'];
const DAMAGE_TYPES = ['bludgeoning', 'piercing', 'slashing', ...ENERGY_TYPES, 'force', 'positive', 'negative', 'untyped', 'bleed', 'precision'];

const SPELL_SCHOOLS = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation', 'universal'];

module.exports = {
  ABILITIES, ABILITY_NAMES, SIZES, SIZE_ORDER, shiftSize, ALIGNMENTS, alignmentAxes, alignmentStepDistance,
  CREATURE_TYPES, SKILLS, KNOWLEDGE_SKILLS, KNOWLEDGE_BY_TYPE, LANGUAGES, ENERGY_TYPES, DAMAGE_TYPES, SPELL_SCHOOLS,
};
