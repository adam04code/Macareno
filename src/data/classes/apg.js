'use strict';

const T = require('./spellTables');

/**
 * Advanced Player's Guide base classes: alchemist, cavalier, inquisitor,
 * oracle and witch. Feature keys refer to src/data/featuresApg.js; option
 * groups (discoveries, orders, judgments, mysteries, revelations, curses,
 * hexes, patrons) to src/data/classOptionsApg.js.
 */

const every = (start, step) => (l) => (l < start ? 0 : 1 + Math.floor((l - start) / step));
const evens = (from, to) => Object.fromEntries(Array.from({ length: Math.floor((to - from) / 2) + 1 }, (_, i) => [from + 2 * i, []]));

function features(base, extra) {
  const out = { ...base };
  for (const [lvl, keys] of Object.entries(extra)) out[lvl] = [...(out[lvl] || []), ...keys];
  return out;
}

const CLASSES = {
  alchemist: {
    name: 'Alchemist', type: 'base', source: "Advanced Player's Guide", hitDie: 8, skillRanks: 4, bab: 'threeQuarter', saves: { fort: 'good', ref: 'good', will: 'poor' },
    classSkills: ['appraise', 'craft', 'disable-device', 'fly', 'heal', 'knowledge-arcana', 'knowledge-nature', 'perception', 'profession', 'sleight-of-hand', 'spellcraft', 'survival', 'use-magic-device'],
    proficiencies: { weapons: ['simple', 'bomb'], armor: ['light'], shields: [] },
    spellcasting: {
      tradition: 'alchemy', style: 'prepared', ability: 'int', list: 'alchemist', perDay: T.SIX_LEVEL_NO_CANTRIPS, spellbook: true, bookName: 'formula book',
      selfOnly: true, noComponents: true, startingSpellbook: (c) => 2 + Math.max(0, c.baseAbilityMod('int')), learnPerLevel: 1,
    },
    features: features(evens(2, 18), {
      1: ['alchemy', 'bomb', 'brew-potion-class', 'mutagen', 'throw-anything-class'], 2: ['discovery', 'poison-resistance-alchemist', 'poison-use'], 3: ['swift-alchemy'],
      4: ['discovery'], 6: ['discovery', 'swift-poisoning'], 8: ['discovery'], 10: ['discovery', 'poison-immunity-alchemist'], 12: ['discovery'],
      14: ['discovery', 'persistent-mutagen'], 16: ['discovery'], 18: ['discovery', 'instant-alchemy'], 20: ['grand-discovery', 'discovery', 'discovery'],
    }),
    progressions: {
      alchemistLevel: (l) => l, bombDice: (l) => Math.ceil(l / 2), discoveryLevel: (l) => l,
      alchemistPoisonSave: (l) => (l >= 8 ? 6 : l >= 5 ? 4 : l >= 2 ? 2 : 0),
    },
    startingWealth: 105,
  },

  cavalier: {
    name: 'Cavalier', type: 'base', source: "Advanced Player's Guide", hitDie: 10, skillRanks: 4, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'poor' },
    classSkills: ['bluff', 'climb', 'craft', 'diplomacy', 'handle-animal', 'intimidate', 'profession', 'ride', 'sense-motive', 'swim'],
    proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy'], shields: ['shield'] },
    features: {
      1: ['challenge', 'cavalier-mount', 'order', 'tactician'], 2: ['order-ability'], 3: ['cavaliers-charge'], 4: ['expert-trainer'], 5: ['banner'],
      6: ['cavalier-bonus-feat'], 8: ['order-ability'], 9: ['greater-tactician'], 11: ['mighty-charge'], 12: ['cavalier-bonus-feat', 'demanding-challenge'],
      14: ['greater-banner'], 15: ['order-ability'], 17: ['master-tactician'], 18: ['cavalier-bonus-feat'], 20: ['supreme-charge'],
    },
    progressions: {
      cavalierLevel: (l) => l, challengeUses: every(1, 3), tacticianUses: (l) => 1 + Math.floor(l / 5), companionLevel: (l) => l,
      bannerBonus: (l) => (l >= 5 ? 1 + Math.floor(l / 5) : 0), orderLevel: (l) => l,
    },
    bonusFeats: { levels: [6, 12, 18], list: 'combat' },
    extraFeatSlots: { 1: ['teamwork'], 9: ['teamwork'], 17: ['teamwork'] },
    startingWealth: 175,
  },

  inquisitor: {
    name: 'Inquisitor', type: 'base', source: "Advanced Player's Guide", hitDie: 8, skillRanks: 6, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
    alignmentText: "Within one step of the deity's alignment", requiresDeity: true,
    classSkills: ['bluff', 'climb', 'craft', 'diplomacy', 'disguise', 'heal', 'intimidate', 'knowledge-arcana', 'knowledge-dungeoneering', 'knowledge-nature', 'knowledge-planes', 'knowledge-religion', 'perception', 'profession', 'ride', 'sense-motive', 'spellcraft', 'stealth', 'survival', 'swim'],
    proficiencies: { weapons: ['simple', 'hand-crossbow', 'longbow', 'repeating-crossbow', 'shortbow', 'deity-favored'], armor: ['light', 'medium'], shields: ['shield'] },
    spellcasting: { tradition: 'divine', style: 'spontaneous', ability: 'wis', list: 'inquisitor', perDay: T.BARD_PER_DAY, known: T.BARD_KNOWN },
    features: {
      1: ['inquisitor-domain', 'judgment', 'monster-lore', 'orisons', 'stern-gaze'], 2: ['cunning-initiative', 'detect-alignment', 'track-inquisitor'],
      3: ['solo-tactics', 'inquisitor-teamwork'], 5: ['bane', 'discern-lies-inquisitor'], 6: ['inquisitor-teamwork'], 8: ['second-judgment'], 9: ['inquisitor-teamwork'],
      11: ['stalwart'], 12: ['greater-bane', 'inquisitor-teamwork'], 14: ['exploit-weakness'], 15: ['inquisitor-teamwork'], 16: ['third-judgment'], 17: ['slayer-judgment'],
      18: ['inquisitor-teamwork'], 20: ['true-judgment'],
    },
    progressions: { inquisitorLevel: (l) => l, judgmentUses: (l) => 1 + Math.floor((l - 1) / 3), judgmentCount: (l) => (l >= 16 ? 3 : l >= 8 ? 2 : 1), track: (l) => Math.max(1, Math.floor(l / 2)) },
    bonusFeats: { levels: [3, 6, 9, 12, 15, 18], list: 'teamwork' },
    startingWealth: 140,
  },

  oracle: {
    name: 'Oracle', type: 'base', source: "Advanced Player's Guide", hitDie: 8, skillRanks: 4, bab: 'threeQuarter', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['craft', 'diplomacy', 'heal', 'knowledge-history', 'knowledge-planes', 'knowledge-religion', 'profession', 'sense-motive', 'spellcraft'],
    proficiencies: { weapons: ['simple'], armor: ['light', 'medium'], shields: ['shield'] },
    spellcasting: { tradition: 'divine', style: 'spontaneous', ability: 'cha', list: 'oracle', perDay: T.SORCERER_PER_DAY, known: T.SORCERER_KNOWN, mysterySpells: true, oracleCures: true },
    features: {
      1: ['mystery', 'oracles-curse', 'orisons', 'revelation'], 3: ['revelation'], 7: ['revelation'], 11: ['revelation'], 15: ['revelation'], 19: ['revelation'], 20: ['final-revelation'],
    },
    progressions: { oracleLevel: (l) => l, mysteryLevel: (l) => l },
    startingWealth: 105,
  },

  witch: {
    name: 'Witch', type: 'base', source: "Advanced Player's Guide", hitDie: 6, skillRanks: 2, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['craft', 'fly', 'heal', 'intimidate', 'knowledge-arcana', 'knowledge-history', 'knowledge-nature', 'knowledge-planes', 'profession', 'spellcraft', 'use-magic-device'],
    proficiencies: { weapons: ['simple'], armor: [], shields: [] },
    spellcasting: { tradition: 'arcane', style: 'prepared', ability: 'int', list: 'witch', perDay: T.FULL_PREPARED, spellbook: true, bookName: 'familiar', patronSpells: true, startingSpellbook: (c) => 3 + Math.max(0, c.baseAbilityMod('int')) },
    features: features({ 1: ['cantrips', 'hex', 'patron', 'witchs-familiar'], 2: ['hex'] }, Object.fromEntries([4, 6, 8, 10, 12, 14, 16, 18, 20].map((l) => [l, ['hex', ...(l === 10 ? ['major-hex'] : []), ...(l === 18 ? ['grand-hex'] : [])]]))),
    progressions: { witchLevel: (l) => l, hexLevel: (l) => l },
    startingWealth: 105,
  },
};

for (const [id, c] of Object.entries(CLASSES)) {
  c.id = id;
  c.maxLevel = 20;
  c.saveFormula = 'base';
}

module.exports = { CLASSES };
