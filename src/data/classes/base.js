'use strict';

const T = require('./spellTables');

/**
 * Base classes: the 10 Core Rulebook classes (minus druid) plus the magus
 * (Ultimate Magic). Feature keys refer to src/data/features.js.
 *
 * progressions: values summed across every class a character has (so a
 * rogue/assassin adds both classes' sneak attack dice, etc.).
 */

const KNOWLEDGE_ALL = ['knowledge-arcana', 'knowledge-dungeoneering', 'knowledge-engineering', 'knowledge-geography', 'knowledge-history', 'knowledge-local', 'knowledge-nature', 'knowledge-nobility', 'knowledge-planes', 'knowledge-religion'];

const odd = (l) => Math.ceil(l / 2);
const every = (start, step) => (l) => (l < start ? 0 : 1 + Math.floor((l - start) / step));

const MONK_WEAPONS = ['club', 'light-crossbow', 'heavy-crossbow', 'dagger', 'handaxe', 'javelin', 'kama', 'nunchaku', 'quarterstaff', 'sai', 'shortspear', 'short-sword', 'shuriken', 'siangham', 'sling', 'spear'];

const CLASSES = {
  barbarian: {
    name: 'Barbarian', type: 'base', hitDie: 12, skillRanks: 4, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'poor' },
    alignment: (al) => al[0] !== 'L', alignmentText: 'Any nonlawful',
    classSkills: ['acrobatics', 'climb', 'craft', 'handle-animal', 'intimidate', 'knowledge-nature', 'perception', 'ride', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium'], shields: ['shield'] },
    features: {
      1: ['fast-movement', 'rage'], 2: ['rage-power', 'uncanny-dodge'], 3: ['trap-sense'], 4: ['rage-power'], 5: ['improved-uncanny-dodge'],
      6: ['rage-power'], 7: ['damage-reduction'], 8: ['rage-power'], 10: ['rage-power'], 11: ['greater-rage'], 12: ['rage-power'],
      14: ['indomitable-will', 'rage-power'], 16: ['rage-power'], 17: ['tireless-rage'], 18: ['rage-power'], 20: ['mighty-rage', 'rage-power'],
    },
    progressions: {
      rageRounds: (l) => 4 + 2 * (l - 1), trapSense: every(3, 3), uncannyDodge: () => 1,
      drUntyped: every(7, 3), ragePowers: (l) => Math.floor(l / 2), improvedUncannyDodgeLevels: (l) => (l >= 5 ? l : 0),
    },
    choices: { 'rage-power': { list: 'ragePowers' } },
  },

  bard: {
    name: 'Bard', type: 'base', hitDie: 8, skillRanks: 6, bab: 'threeQuarter', saves: { fort: 'poor', ref: 'good', will: 'good' },
    classSkills: ['acrobatics', 'appraise', 'bluff', 'climb', 'craft', 'diplomacy', 'disguise', 'escape-artist', 'intimidate', ...KNOWLEDGE_ALL, 'linguistics', 'perception', 'perform', 'profession', 'sense-motive', 'sleight-of-hand', 'spellcraft', 'stealth', 'use-magic-device'],
    proficiencies: { weapons: ['simple', 'longsword', 'rapier', 'sap', 'short-sword', 'shortbow', 'whip'], armor: ['light'], shields: ['shield'] },
    spellcasting: { tradition: 'arcane', style: 'spontaneous', ability: 'cha', list: 'bard', perDay: T.BARD_PER_DAY, known: T.BARD_KNOWN, armorSpellFailureIgnored: ['light'] },
    features: {
      1: ['bardic-knowledge', 'bardic-performance', 'cantrips', 'countersong', 'distraction', 'fascinate', 'inspire-courage'],
      2: ['versatile-performance', 'well-versed'], 3: ['inspire-competence'], 5: ['lore-master'], 6: ['suggestion'], 8: ['dirge-of-doom'],
      9: ['inspire-greatness'], 10: ['jack-of-all-trades'], 12: ['soothing-performance'], 14: ['frightening-tune'], 15: ['inspire-heroics'],
      18: ['mass-suggestion'], 20: ['deadly-performance'],
    },
    progressions: {
      performanceRounds: (l) => 4 + 2 * (l - 1), inspireCourage: (l) => 1 + every(5, 6)(l), inspireCompetence: (l) => (l >= 3 ? 2 + Math.floor((l - 3) / 4) : 0),
      bardicKnowledge: (l) => Math.max(1, Math.floor(l / 2)), loreMasterUses: every(5, 6),
    },
  },

  cleric: {
    name: 'Cleric', type: 'base', hitDie: 8, skillRanks: 2, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
    alignmentText: "Within one step of the deity's alignment",
    classSkills: ['appraise', 'craft', 'diplomacy', 'heal', 'knowledge-arcana', 'knowledge-history', 'knowledge-nobility', 'knowledge-planes', 'knowledge-religion', 'linguistics', 'profession', 'sense-motive', 'spellcraft'],
    proficiencies: { weapons: ['simple', 'deity-favored'], armor: ['light', 'medium'], shields: ['shield'] },
    spellcasting: { tradition: 'divine', style: 'prepared', ability: 'wis', list: 'cleric', perDay: T.FULL_PREPARED, knowsWholeList: true, domainSlots: true, spontaneous: 'cure-or-inflict' },
    features: { 1: ['aura', 'channel-energy', 'domains', 'orisons', 'spontaneous-casting'] },
    progressions: { channelDice: odd, channelUses: () => 3 },
    choices: { domains: { list: 'domains', count: 2 } },
  },

  fighter: {
    name: 'Fighter', type: 'base', hitDie: 10, skillRanks: 2, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'poor' },
    classSkills: ['climb', 'craft', 'handle-animal', 'intimidate', 'knowledge-dungeoneering', 'knowledge-engineering', 'profession', 'ride', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy'], shields: ['shield', 'tower'] },
    features: {
      1: ['fighter-bonus-feat'], 2: ['bravery', 'fighter-bonus-feat'], 3: ['armor-training'], 4: ['fighter-bonus-feat'], 5: ['weapon-training'],
      6: ['fighter-bonus-feat'], 8: ['fighter-bonus-feat'], 10: ['fighter-bonus-feat'], 12: ['fighter-bonus-feat'], 14: ['fighter-bonus-feat'],
      16: ['fighter-bonus-feat'], 18: ['fighter-bonus-feat'], 19: ['armor-mastery'], 20: ['weapon-mastery', 'fighter-bonus-feat'],
    },
    progressions: { bravery: every(2, 4), armorTraining: (l) => Math.min(4, every(3, 4)(l)), weaponTraining: every(5, 4) },
    bonusFeats: { levels: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20], list: 'combat' },
    choices: { 'weapon-training': { list: 'weaponGroups' } },
  },

  monk: {
    name: 'Monk', type: 'base', hitDie: 8, skillRanks: 4, bab: 'threeQuarter', saves: { fort: 'good', ref: 'good', will: 'good' },
    alignment: (al) => al[0] === 'L', alignmentText: 'Any lawful',
    classSkills: ['acrobatics', 'climb', 'craft', 'escape-artist', 'intimidate', 'knowledge-history', 'knowledge-religion', 'perception', 'perform', 'profession', 'ride', 'sense-motive', 'stealth', 'swim'],
    proficiencies: { weapons: MONK_WEAPONS, armor: [], shields: [] },
    features: {
      1: ['ac-bonus', 'flurry-of-blows', 'improved-unarmed-strike', 'stunning-fist', 'unarmed-strike-damage', 'monk-bonus-feat'],
      2: ['evasion', 'monk-bonus-feat'], 3: ['fast-movement-monk', 'maneuver-training', 'still-mind'], 4: ['ki-pool', 'slow-fall'],
      5: ['high-jump', 'purity-of-body'], 6: ['monk-bonus-feat'], 7: ['wholeness-of-body'], 9: ['improved-evasion'], 10: ['monk-bonus-feat'],
      11: ['diamond-body'], 12: ['abundant-step'], 13: ['diamond-soul'], 14: ['monk-bonus-feat'], 15: ['quivering-palm'],
      17: ['timeless-body', 'tongue-of-sun-and-moon'], 18: ['monk-bonus-feat'], 19: ['empty-body'], 20: ['perfect-self'],
    },
    progressions: {
      monkAcBonus: (l) => Math.floor(l / 4), monkLevel: (l) => l, monkSpeed: (l) => 10 * Math.floor(l / 3), kiPool: (l) => (l >= 4 ? Math.floor(l / 2) : 0),
      evasion: (l) => (l >= 2 ? 1 : 0), stunningFistUses: (l) => l,
    },
    bonusFeats: { levels: [1, 2, 6, 10, 14, 18], list: 'monk' },
  },

  paladin: {
    name: 'Paladin', type: 'base', hitDie: 10, skillRanks: 2, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'good' },
    alignment: (al) => al === 'LG', alignmentText: 'Lawful good',
    classSkills: ['craft', 'diplomacy', 'handle-animal', 'heal', 'knowledge-nobility', 'knowledge-religion', 'profession', 'ride', 'sense-motive', 'spellcraft'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy'], shields: ['shield'] },
    spellcasting: { tradition: 'divine', style: 'prepared', ability: 'cha', list: 'paladin', perDay: T.HALF_CASTER, knowsWholeList: true, casterLevelOffset: -3, startsAt: 4 },
    features: {
      1: ['aura-of-good', 'detect-evil', 'smite-evil'], 2: ['divine-grace', 'lay-on-hands'], 3: ['aura-of-courage', 'divine-health', 'mercy'],
      4: ['channel-positive-energy'], 5: ['divine-bond'], 6: ['mercy'], 8: ['aura-of-resolve'], 9: ['mercy'], 11: ['aura-of-justice'],
      12: ['mercy'], 14: ['aura-of-faith'], 15: ['mercy'], 17: ['aura-of-righteousness'], 18: ['mercy'], 20: ['holy-champion'],
    },
    progressions: {
      smiteUses: every(1, 3), layOnHandsDice: (l) => Math.floor(l / 2), layOnHandsUses: (l) => (l >= 2 ? Math.floor(l / 2) : 0),
      channelDicePaladin: (l) => (l >= 4 ? Math.floor(l / 2) : 0), mercies: every(3, 3), paladinLevel: (l) => l,
    },
    choices: { mercy: { list: 'mercies' } },
  },

  ranger: {
    name: 'Ranger', type: 'base', hitDie: 10, skillRanks: 6, bab: 'full', saves: { fort: 'good', ref: 'good', will: 'poor' },
    classSkills: ['climb', 'craft', 'handle-animal', 'heal', 'intimidate', 'knowledge-dungeoneering', 'knowledge-geography', 'knowledge-nature', 'perception', 'profession', 'ride', 'spellcraft', 'stealth', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium'], shields: ['shield'] },
    spellcasting: { tradition: 'divine', style: 'prepared', ability: 'wis', list: 'ranger', perDay: T.HALF_CASTER, knowsWholeList: true, casterLevelOffset: -3, startsAt: 4 },
    features: {
      1: ['favored-enemy', 'track', 'wild-empathy'], 2: ['combat-style'], 3: ['endurance-ranger', 'favored-terrain'], 4: ['hunters-bond'],
      5: ['favored-enemy'], 6: ['combat-style'], 7: ['woodland-stride'], 8: ['favored-terrain', 'swift-tracker'], 9: ['evasion'],
      10: ['favored-enemy', 'combat-style'], 11: ['quarry'], 12: ['camouflage'], 13: ['favored-terrain'], 14: ['combat-style'],
      15: ['favored-enemy'], 16: ['improved-evasion'], 17: ['hide-in-plain-sight'], 18: ['favored-terrain', 'combat-style'],
      19: ['improved-quarry'], 20: ['favored-enemy', 'master-hunter'],
    },
    progressions: { favoredEnemies: (l) => 1 + Math.floor(l / 5), favoredTerrains: every(3, 5), evasion: (l) => (l >= 9 ? 1 : 0), track: (l) => Math.max(1, Math.floor(l / 2)) },
    choices: { 'favored-enemy': { list: 'creatureTypes' }, 'favored-terrain': { list: 'terrains' }, 'combat-style': { list: 'combatStyles' } },
  },

  rogue: {
    name: 'Rogue', type: 'base', hitDie: 8, skillRanks: 8, bab: 'threeQuarter', saves: { fort: 'poor', ref: 'good', will: 'poor' },
    classSkills: ['acrobatics', 'appraise', 'bluff', 'climb', 'craft', 'diplomacy', 'disable-device', 'disguise', 'escape-artist', 'intimidate', 'knowledge-dungeoneering', 'knowledge-local', 'linguistics', 'perception', 'perform', 'profession', 'sense-motive', 'sleight-of-hand', 'stealth', 'swim', 'use-magic-device'],
    proficiencies: { weapons: ['simple', 'hand-crossbow', 'rapier', 'sap', 'shortbow', 'short-sword'], armor: ['light'], shields: [] },
    features: {
      1: ['sneak-attack', 'trapfinding'], 2: ['evasion', 'rogue-talent'], 3: ['trap-sense'], 4: ['rogue-talent', 'uncanny-dodge'],
      6: ['rogue-talent'], 8: ['improved-uncanny-dodge', 'rogue-talent'], 10: ['advanced-talents', 'rogue-talent'], 12: ['rogue-talent'],
      14: ['rogue-talent'], 16: ['rogue-talent'], 18: ['rogue-talent'], 20: ['master-strike', 'rogue-talent'],
    },
    progressions: {
      sneakAttack: odd, trapSense: every(3, 3), trapfinding: (l) => Math.max(1, Math.floor(l / 2)), evasion: (l) => (l >= 2 ? 1 : 0),
      uncannyDodge: (l) => (l >= 4 ? 1 : 0), improvedUncannyDodgeLevels: (l) => (l >= 8 ? l : 0), rogueLevel: (l) => l,
    },
    choices: { 'rogue-talent': { list: 'rogueTalents' } },
  },

  sorcerer: {
    name: 'Sorcerer', type: 'base', hitDie: 6, skillRanks: 2, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['appraise', 'bluff', 'craft', 'fly', 'intimidate', 'knowledge-arcana', 'profession', 'spellcraft', 'use-magic-device'],
    proficiencies: { weapons: ['simple'], armor: [], shields: [] },
    spellcasting: { tradition: 'arcane', style: 'spontaneous', ability: 'cha', list: 'wizard', perDay: T.SORCERER_PER_DAY, known: T.SORCERER_KNOWN, bloodlineSpells: true },
    features: { 1: ['bloodline', 'cantrips', 'eschew-materials-class'] },
    progressions: { sorcererBloodlineLevel: (l) => l },
    choices: { bloodline: { list: 'bloodlines', count: 1 } },
  },

  wizard: {
    name: 'Wizard', type: 'base', hitDie: 6, skillRanks: 2, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['appraise', 'craft', 'fly', ...KNOWLEDGE_ALL, 'linguistics', 'profession', 'spellcraft'],
    proficiencies: { weapons: ['club', 'dagger', 'heavy-crossbow', 'light-crossbow', 'quarterstaff'], armor: [], shields: [] },
    spellcasting: { tradition: 'arcane', style: 'prepared', ability: 'int', list: 'wizard', perDay: T.FULL_PREPARED, spellbook: true, schoolSlots: true },
    features: { 1: ['arcane-bond', 'arcane-school', 'cantrips', 'scribe-scroll-class'], 5: ['wizard-bonus-feat'], 10: ['wizard-bonus-feat'], 15: ['wizard-bonus-feat'], 20: ['wizard-bonus-feat'] },
    progressions: { wizardSchoolLevel: (l) => l },
    bonusFeats: { levels: [5, 10, 15, 20], list: 'wizard' },
    choices: { school: { list: 'arcaneSchools', count: 1 } },
  },

  magus: {
    name: 'Magus', type: 'base', hitDie: 8, skillRanks: 2, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
    source: 'Ultimate Magic',
    classSkills: ['climb', 'craft', 'fly', 'intimidate', 'knowledge-arcana', 'knowledge-dungeoneering', 'knowledge-planes', 'profession', 'ride', 'spellcraft', 'swim', 'use-magic-device'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light'], shields: [] },
    spellcasting: { tradition: 'arcane', style: 'prepared', ability: 'int', list: 'magus', perDay: T.MAGUS_PER_DAY, spellbook: true, armorSpellFailureIgnored: ['light'], armorSpellFailureIgnoredAt: { medium: 7, heavy: 13 } },
    features: {
      1: ['arcane-pool', 'cantrips', 'spell-combat'], 2: ['spellstrike'], 3: ['magus-arcana'], 4: ['spell-recall'], 5: ['magus-bonus-feat'],
      6: ['magus-arcana'], 7: ['knowledge-pool', 'medium-armor'], 8: ['improved-spell-combat'], 9: ['magus-arcana'], 10: ['fighter-training'],
      11: ['improved-spell-recall', 'magus-bonus-feat'], 12: ['magus-arcana'], 13: ['heavy-armor'], 14: ['greater-spell-combat'], 15: ['magus-arcana'],
      16: ['counterstrike'], 17: ['magus-bonus-feat'], 18: ['magus-arcana'], 19: ['greater-spell-access'], 20: ['true-magus'],
    },
    progressions: { arcanePool: (l) => Math.max(1, Math.floor(l / 2)), arcanePoolEnhancement: (l) => Math.min(5, 1 + Math.floor((l - 1) / 4)), magusLevel: (l) => l },
    bonusFeats: { levels: [5, 11, 17], list: 'magus' },
    choices: { 'magus-arcana': { list: 'magusArcana' } },
  },
};

for (const [id, c] of Object.entries(CLASSES)) {
  c.id = id;
  c.maxLevel = 20;
  c.saveFormula = 'base';
}

module.exports = { CLASSES, KNOWLEDGE_ALL, MONK_WEAPONS };
