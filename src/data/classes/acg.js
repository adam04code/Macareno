'use strict';

const T = require('./spellTables');
const { KNOWLEDGE_ALL } = require('./base');

/**
 * Advanced Class Guide classes that appear in this engine: arcanist,
 * bloodrager, hunter, shaman, skald, slayer and warpriest. Feature keys refer
 * to src/data/featuresAcg.js; option groups to src/data/classOptionsAcg.js.
 */

const every = (start, step) => (l) => (l < start ? 0 : 1 + Math.floor((l - start) / step));
const at = (levels, key) => Object.fromEntries(levels.map((l) => [l, [key]]));
function merge(...maps) {
  const out = {};
  for (const m of maps) for (const [l, keys] of Object.entries(m)) out[l] = [...(out[l] || []), ...keys];
  return out;
}

// Warpriest orisons: 3 at 1st, 4 at 2nd-5th, 5 from 6th; other levels as the bard/inquisitor table.
const WARPRIEST_PER_DAY = T.BARD_PER_DAY.map((row, l) => (row ? [l >= 6 ? 5 : l >= 2 ? 4 : 3, ...row.slice(1)] : row));

const CLASSES = {
  arcanist: {
    name: 'Arcanist', type: 'base', source: 'Advanced Class Guide', hitDie: 6, skillRanks: 2, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['appraise', 'craft', 'fly', ...KNOWLEDGE_ALL, 'linguistics', 'profession', 'spellcraft', 'use-magic-device'],
    proficiencies: { weapons: ['simple'], armor: [], shields: [] },
    spellcasting: {
      tradition: 'arcane', style: 'spontaneous', ability: 'int', list: 'arcanist', perDay: T.ARCANIST_PER_DAY, known: T.ARCANIST_PREPARED,
      spellbook: true, preparesKnown: true, reservoir: true,
    },
    features: merge(
      { 1: ['arcane-reservoir', 'cantrips', 'consume-spells'], 11: ['greater-exploits'], 20: ['magical-supremacy'] },
      at([1, 3, 5, 7, 9, 11, 13, 15, 17, 19], 'arcanist-exploit'),
    ),
    progressions: { arcanistLevel: (l) => l, reservoirMax: (l) => 3 + l, reservoirDaily: (l) => 3 + Math.floor(l / 2) },
    startingWealth: 70,
  },

  bloodrager: {
    name: 'Bloodrager', type: 'base', source: 'Advanced Class Guide', hitDie: 10, skillRanks: 4, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'poor' },
    alignment: (al) => al[0] !== 'L', alignmentText: 'Any nonlawful',
    classSkills: ['acrobatics', 'climb', 'craft', 'handle-animal', 'intimidate', 'knowledge-arcana', 'perception', 'ride', 'spellcraft', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium'], shields: ['shield'] },
    spellcasting: {
      tradition: 'arcane', style: 'spontaneous', ability: 'cha', list: 'bloodrager', perDay: T.BLOODRAGER_PER_DAY, known: T.BLOODRAGER_KNOWN,
      casterLevelOffset: -3, startsAt: 4, armorSpellFailureIgnored: ['light', 'medium'], bloodragerSpells: true,
    },
    features: {
      1: ['bloodrager-bloodline', 'bloodrage', 'fast-movement'], 2: ['uncanny-dodge-bloodrager'], 3: ['blood-sanctuary'], 4: ['blood-casting', 'eschew-materials-class'],
      5: ['improved-uncanny-dodge'], 7: ['damage-reduction-bloodrager'], 11: ['greater-bloodrage'], 14: ['indomitable-will-bloodrager'], 17: ['tireless-bloodrage'], 20: ['mighty-bloodrage'],
    },
    progressions: {
      bloodrageRounds: (l) => 4 + 2 * (l - 1), bloodragerLevel: (l) => l, bloodragerBloodlineLevel: (l) => l,
      drUntyped: (l) => (l >= 7 ? 1 + Math.floor((l - 7) / 3) : 0), uncannyDodge: (l) => (l >= 2 ? 1 : 0), improvedUncannyDodgeLevels: (l) => (l >= 5 ? l : 0),
    },
    bonusFeats: { levels: [6, 9, 12, 15, 18], list: 'bloodrager-bloodline' },
    startingWealth: 105,
  },

  hunter: {
    name: 'Hunter', type: 'base', source: 'Advanced Class Guide', hitDie: 8, skillRanks: 6, bab: 'threeQuarter', saves: { fort: 'good', ref: 'good', will: 'poor' },
    classSkills: ['climb', 'craft', 'handle-animal', 'heal', 'intimidate', 'knowledge-dungeoneering', 'knowledge-geography', 'knowledge-nature', 'perception', 'profession', 'ride', 'spellcraft', 'stealth', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium'], shields: ['shield'] },
    spellcasting: { tradition: 'divine', style: 'spontaneous', ability: 'wis', list: 'hunter', perDay: T.BARD_PER_DAY, known: T.BARD_KNOWN, knowsSummonNaturesAlly: true },
    features: {
      1: ['hunter-companion', 'animal-focus', 'nature-training', 'orisons', 'wild-empathy-druid'], 2: ['precise-companion', 'track-hunter'], 3: ['hunter-tactics', 'hunter-teamwork'],
      4: ['improved-empathic-link'], 5: ['woodland-stride'], 6: ['hunter-teamwork'], 7: ['bonus-trick'], 8: ['second-animal-focus', 'swift-tracker'], 9: ['hunter-teamwork'],
      10: ['raise-animal-companion'], 11: ['speak-with-master'], 12: ['hunter-teamwork'], 13: ['bonus-trick'], 14: ['greater-empathic-link'], 15: ['hunter-teamwork'],
      17: ['one-with-the-wild'], 18: ['hunter-teamwork'], 19: ['bonus-trick'], 20: ['master-hunter-acg'],
    },
    progressions: { hunterLevel: (l) => l, companionLevel: (l) => l, track: (l) => Math.max(1, Math.floor(l / 2)) },
    bonusFeats: { levels: [3, 6, 9, 12, 15, 18], list: 'teamwork' },
    extraFeatSlots: { 2: ['precise-companion'] },
    startingWealth: 140,
  },

  shaman: {
    name: 'Shaman', type: 'base', source: 'Advanced Class Guide', hitDie: 8, skillRanks: 4, bab: 'threeQuarter', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['craft', 'diplomacy', 'fly', 'handle-animal', 'heal', 'knowledge-nature', 'knowledge-planes', 'knowledge-religion', 'profession', 'ride', 'spellcraft', 'survival'],
    proficiencies: { weapons: ['simple'], armor: ['light', 'medium'], shields: [] },
    spellcasting: { tradition: 'divine', style: 'prepared', ability: 'wis', list: 'shaman', perDay: T.FULL_PREPARED, knowsWholeList: true, domainSlots: 'spirit' },
    features: merge(
      { 1: ['orisons', 'spirit', 'spirit-animal', 'spirit-magic'], 4: ['wandering-spirit'], 6: ['wandering-hex'], 8: ['greater-spirit'], 16: ['true-spirit'], 20: ['manifestation'] },
      at([2, 4, 8, 10, 12, 16, 18, 20], 'shaman-hex'),
    ),
    progressions: { shamanLevel: (l) => l, shamanHexLevel: (l) => l, hexLevel: (l) => l },
    startingWealth: 105,
  },

  skald: {
    name: 'Skald', type: 'base', source: 'Advanced Class Guide', hitDie: 8, skillRanks: 4, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
    classSkills: ['acrobatics', 'appraise', 'bluff', 'climb', 'craft', 'diplomacy', 'escape-artist', 'handle-animal', 'intimidate', ...KNOWLEDGE_ALL, 'linguistics', 'perception', 'perform', 'profession', 'ride', 'sense-motive', 'spellcraft', 'swim', 'use-magic-device'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium'], shields: ['shield'] },
    spellcasting: { tradition: 'arcane', style: 'spontaneous', ability: 'cha', list: 'skald', perDay: T.BARD_PER_DAY, known: T.BARD_KNOWN, armorSpellFailureIgnored: ['light', 'medium'] },
    features: merge(
      { 1: ['bardic-knowledge', 'cantrips', 'raging-song', 'inspired-rage', 'scribe-scroll-class'], 2: ['versatile-performance', 'well-versed'], 3: ['song-of-marching'], 4: ['uncanny-dodge-skald'],
        5: ['spell-kenning'], 6: ['song-of-strength'], 7: ['lore-master'], 8: ['improved-uncanny-dodge'], 9: ['damage-reduction-skald'], 10: ['dirge-of-doom-skald'], 14: ['song-of-the-fallen'], 20: ['master-skald'] },
      at([3, 6, 9, 12, 15, 18], 'rage-power'),
    ),
    progressions: {
      skaldLevel: (l) => l, ragingSongRounds: (l) => 3 + 2 * (l - 1), ragePowerLevel: (l) => l, bardicKnowledge: (l) => Math.max(1, Math.floor(l / 2)), loreMasterUses: every(7, 6),
      drUntyped: (l) => (l >= 19 ? 3 : l >= 14 ? 2 : l >= 9 ? 1 : 0), uncannyDodge: (l) => (l >= 4 ? 1 : 0), improvedUncannyDodgeLevels: (l) => (l >= 8 ? l : 0),
    },
    startingWealth: 105,
  },

  slayer: {
    name: 'Slayer', type: 'base', source: 'Advanced Class Guide', hitDie: 10, skillRanks: 6, bab: 'full', saves: { fort: 'good', ref: 'good', will: 'poor' },
    classSkills: ['acrobatics', 'bluff', 'climb', 'craft', 'disguise', 'heal', 'intimidate', 'knowledge-dungeoneering', 'knowledge-geography', 'knowledge-local', 'perception', 'profession', 'ride', 'sense-motive', 'stealth', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium'], shields: ['shield'] },
    features: merge(
      { 1: ['studied-target', 'track-slayer'], 3: ['sneak-attack'], 7: ['stalker'], 10: ['advanced-talents-slayer'], 11: ['swift-tracker'], 13: ['slayers-advance'], 14: ['quarry-slayer'], 19: ['improved-quarry-slayer'], 20: ['master-slayer'] },
      at([2, 4, 6, 8, 10, 12, 14, 16, 18, 20], 'slayer-talent'),
    ),
    progressions: {
      slayerLevel: (l) => l, sneakAttack: (l) => Math.floor(l / 3), studiedBonus: (l) => 1 + Math.floor(l / 5), studiedTargets: (l) => 1 + Math.floor(l / 5),
      track: (l) => Math.max(1, Math.floor(l / 2)), rogueTalentLevel: (l) => l, slayersAdvance: (l) => (l >= 17 ? 2 : l >= 13 ? 1 : 0),
    },
    startingWealth: 175,
  },

  warpriest: {
    name: 'Warpriest', type: 'base', source: 'Advanced Class Guide', hitDie: 8, skillRanks: 2, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
    alignmentText: "Within one step of the deity's alignment", requiresDeity: true,
    classSkills: ['climb', 'craft', 'diplomacy', 'handle-animal', 'heal', 'intimidate', 'knowledge-engineering', 'knowledge-religion', 'profession', 'ride', 'sense-motive', 'spellcraft', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'martial', 'deity-favored'], armor: ['light', 'medium', 'heavy'], shields: ['shield'] },
    spellcasting: { tradition: 'divine', style: 'prepared', ability: 'wis', list: 'warpriest', perDay: WARPRIEST_PER_DAY, knowsWholeList: true, spontaneous: 'cure-or-inflict' },
    features: {
      1: ['blessings', 'focus-weapon', 'orisons', 'sacred-weapon'], 2: ['fervor'], 4: ['channel-energy-warpriest'], 7: ['sacred-armor'], 10: ['major-blessings'], 20: ['aspect-of-war'],
    },
    progressions: {
      warpriestLevel: (l) => l, blessingUses: (l) => Math.min(13, 3 + Math.floor(l / 2)), fervorUses: (l) => (l >= 2 ? Math.floor(l / 2) : 0),
      fervorDice: (l) => (l >= 2 ? 1 + Math.floor((l - 2) / 3) : 0), sacredWeaponBonus: (l) => (l >= 4 ? Math.min(5, 1 + Math.floor((l - 4) / 4)) : 0),
      sacredArmorBonus: (l) => (l >= 7 ? Math.min(5, 1 + Math.floor((l - 7) / 3)) : 0),
    },
    bonusFeats: { levels: [3, 6, 9, 12, 15, 18], list: 'combat' },
    startingWealth: 175,
  },
};

for (const [id, c] of Object.entries(CLASSES)) {
  c.id = id;
  c.maxLevel = 20;
  c.saveFormula = 'base';
}

module.exports = { CLASSES, WARPRIEST_PER_DAY };
