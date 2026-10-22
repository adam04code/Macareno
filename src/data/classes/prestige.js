'use strict';

const { KNOWLEDGE_ALL } = require('./base');

/**
 * Prestige classes (Core Rulebook, Advanced Player's Guide).
 *
 * requirements: evaluated by src/engine/prerequisites.js.
 * advancesCasting: at the listed levels the character gains spells per day
 * and caster level as if they had gained a level in a spellcasting class
 * they already had (chosen when the prestige class is first taken).
 */

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const PRESTIGE = {
  'arcane-trickster': {
    name: 'Arcane Trickster', hitDie: 6, skillRanks: 4, bab: 'half', saves: { fort: 'poor', ref: 'good', will: 'good' },
    classSkills: ['acrobatics', 'appraise', 'bluff', 'climb', 'diplomacy', 'disable-device', 'disguise', 'escape-artist', ...KNOWLEDGE_ALL, 'perception', 'sense-motive', 'sleight-of-hand', 'spellcraft', 'stealth', 'swim'],
    requirements: {
      alignment: (al) => al[0] !== 'L', alignmentText: 'Any nonlawful',
      skills: { 'disable-device': 4, 'escape-artist': 4, 'knowledge-arcana': 4 },
      castsSpell: ['mage-hand'], casting: { tradition: 'arcane', level: 2 }, progression: { sneakAttack: 2 },
    },
    advancesCasting: { levels: range(1, 10), traditions: ['arcane'] },
    features: {
      1: ['ranged-legerdemain'], 2: ['sneak-attack'], 3: ['impromptu-sneak-attack'], 4: ['sneak-attack'], 5: ['tricky-spells'],
      6: ['sneak-attack'], 7: ['impromptu-sneak-attack', 'tricky-spells'], 8: ['sneak-attack'], 9: ['invisible-thief', 'tricky-spells'], 10: ['sneak-attack', 'surprise-spells'],
    },
    progressions: { sneakAttack: (l) => Math.floor(l / 2), impromptuSneakAttack: (l) => (l >= 7 ? 2 : l >= 3 ? 1 : 0), trickySpells: (l) => (l >= 9 ? 5 : l >= 7 ? 4 : l >= 5 ? 3 : 0) },
  },

  assassin: {
    name: 'Assassin', hitDie: 8, skillRanks: 4, bab: 'threeQuarter', saves: { fort: 'poor', ref: 'good', will: 'poor' },
    classSkills: ['acrobatics', 'bluff', 'climb', 'craft', 'diplomacy', 'disable-device', 'disguise', 'escape-artist', 'intimidate', 'linguistics', 'perception', 'sense-motive', 'sleight-of-hand', 'stealth', 'swim', 'use-magic-device'],
    proficiencies: { weapons: ['simple', 'composite-shortbow', 'dagger', 'hand-crossbow', 'light-crossbow', 'heavy-crossbow', 'rapier', 'sap', 'shortbow', 'short-sword'], armor: ['light'], shields: [] },
    requirements: {
      alignment: (al) => al[1] === 'E', alignmentText: 'Any evil',
      skills: { disguise: 2, stealth: 5 },
      special: 'Must kill someone for no other reason than to join the assassins.',
    },
    features: {
      1: ['death-attack', 'poison-use', 'sneak-attack'], 2: ['poison-resistance', 'uncanny-dodge'], 3: ['sneak-attack'], 4: ['hidden-weapons', 'improved-uncanny-dodge', 'true-death'],
      5: ['sneak-attack'], 6: ['quiet-death'], 7: ['sneak-attack'], 8: ['hide-in-plain-sight'], 9: ['sneak-attack', 'swift-death'], 10: ['angel-of-death'],
    },
    progressions: {
      sneakAttack: (l) => Math.ceil(l / 2), assassinLevel: (l) => l, poisonSaveBonus: (l) => Math.floor(l / 2),
      uncannyDodge: (l) => (l >= 2 ? 1 : 0), improvedUncannyDodgeLevels: (l) => (l >= 4 ? l : 0),
    },
  },

  'dragon-disciple': {
    name: 'Dragon Disciple', hitDie: 12, skillRanks: 2, bab: 'threeQuarter', saves: { fort: 'good', ref: 'poor', will: 'good' },
    classSkills: ['diplomacy', 'escape-artist', 'fly', 'knowledge-arcana', 'knowledge-history', 'knowledge-nature', 'knowledge-nobility', 'knowledge-planes', 'knowledge-religion', 'linguistics', 'perception', 'spellcraft'],
    requirements: {
      raceNot: ['dragon'], skills: { 'knowledge-arcana': 5 }, languages: ['Draconic'],
      casting: { tradition: 'arcane', level: 1 }, spontaneousArcane: true, sorcererBloodline: 'draconic',
    },
    advancesCasting: { levels: [2, 3, 4, 6, 7, 8, 10], traditions: ['arcane'] },
    features: {
      1: ['blood-of-dragons', 'dd-natural-armor'], 2: ['dd-ability-boost', 'dd-bloodline-feat', 'dragon-bite'], 3: ['dd-breath-weapon'],
      4: ['dd-ability-boost', 'dd-natural-armor'], 5: ['dd-blindsense', 'dd-bloodline-feat'], 6: ['dd-ability-boost'], 7: ['dragon-form', 'dd-natural-armor'],
      8: ['dd-ability-boost', 'dd-bloodline-feat'], 9: ['dd-wings'], 10: ['dd-blindsense', 'dragon-form'],
    },
    progressions: {
      sorcererBloodlineLevel: (l) => l, ddNaturalArmor: (l) => (l >= 7 ? 3 : l >= 4 ? 2 : 1),
      ddStr: (l) => (l >= 4 ? 4 : l >= 2 ? 2 : 0), ddCon: (l) => (l >= 6 ? 2 : 0), ddInt: (l) => (l >= 8 ? 2 : 0),
      ddLevel: (l) => l,
    },
    bonusFeats: { levels: [2, 5, 8], list: 'bloodline' },
  },

  duelist: {
    name: 'Duelist', hitDie: 10, skillRanks: 4, bab: 'full', saves: { fort: 'poor', ref: 'good', will: 'poor' },
    classSkills: ['acrobatics', 'bluff', 'escape-artist', 'perception', 'perform', 'sense-motive'],
    proficiencies: { weapons: ['simple', 'martial'], armor: [], shields: [] },
    requirements: { bab: 6, skills: { acrobatics: 2, perform: 2 }, feats: ['dodge', 'mobility', 'weapon-finesse'] },
    features: {
      1: ['canny-defense', 'precise-strike'], 2: ['improved-reaction', 'parry'], 3: ['enhanced-mobility'], 4: ['combat-reflexes-duelist', 'grace'],
      5: ['riposte'], 6: ['acrobatic-charge'], 7: ['elaborate-defense'], 8: ['improved-reaction'], 9: ['deflect-arrows-duelist', 'no-retreat'], 10: ['crippling-critical'],
    },
    progressions: { duelistLevel: (l) => l, improvedReaction: (l) => (l >= 8 ? 4 : l >= 2 ? 2 : 0), elaborateDefense: (l) => (l >= 7 ? Math.floor(l / 3) : 0) },
  },

  'eldritch-knight': {
    name: 'Eldritch Knight', hitDie: 10, skillRanks: 2, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'poor' },
    classSkills: ['climb', 'knowledge-arcana', 'knowledge-nobility', 'linguistics', 'ride', 'sense-motive', 'spellcraft', 'swim'],
    requirements: { weaponProficiency: 'martial', casting: { tradition: 'arcane', level: 3 } },
    advancesCasting: { levels: range(2, 10), traditions: ['arcane'] },
    features: { 1: ['diverse-training', 'ek-bonus-feat'], 5: ['ek-bonus-feat'], 9: ['ek-bonus-feat'], 10: ['spell-critical'] },
    progressions: { ekLevel: (l) => l },
    bonusFeats: { levels: [1, 5, 9], list: 'combat' },
  },

  'mystic-theurge': {
    name: 'Mystic Theurge', hitDie: 6, skillRanks: 2, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['knowledge-arcana', 'knowledge-religion', 'sense-motive', 'spellcraft'],
    requirements: {
      skills: { 'knowledge-arcana': 3, 'knowledge-religion': 3 },
      casting: [{ tradition: 'arcane', level: 2 }, { tradition: 'divine', level: 2 }],
    },
    advancesCasting: { levels: range(1, 10), traditions: ['arcane', 'divine'], both: true },
    features: { 1: ['combined-spells'], 3: ['combined-spells'], 5: ['combined-spells'], 7: ['combined-spells'], 9: ['combined-spells'], 10: ['spell-synthesis'] },
    progressions: { combinedSpellsLevel: (l) => Math.min(5, Math.ceil(l / 2)) },
  },

  loremaster: {
    name: 'Loremaster', hitDie: 6, skillRanks: 4, bab: 'half', saves: { fort: 'poor', ref: 'poor', will: 'good' },
    classSkills: ['appraise', 'diplomacy', 'handle-animal', 'heal', ...KNOWLEDGE_ALL, 'linguistics', 'perform', 'spellcraft', 'use-magic-device'],
    requirements: {
      custom: (c) => {
        const out = [];
        if (KNOWLEDGE_ALL.filter((k) => c.skillRanks(k) >= 7).length < 2) out.push('7 ranks in two Knowledge skills');
        if (!c.featParams('skill-focus').some((p) => KNOWLEDGE_ALL.includes(p))) out.push('Skill Focus (a Knowledge skill)');
        const { FEATS } = require('../feats');
        if (c.allFeats().filter((f) => FEATS[f.id] && FEATS[f.id].types.some((t) => t === 'metamagic' || t === 'item-creation')).length < 3) out.push('Three metamagic or item creation feats');
        const sc = require('../../engine/spellcasting');
        const { SPELLS } = require('../spells');
        const div = new Set();
        let high = false;
        for (const id of c.casterClasses()) {
          for (const [lvl, ids] of Object.entries(sc.availableSpells(c, id))) {
            for (const s of ids) if (SPELLS[s] && SPELLS[s].school === 'divination') { div.add(s); if (Number(lvl) >= 3) high = true; }
          }
        }
        if (div.size < 7 || !high) out.push('Able to cast seven divination spells, one of 3rd level or higher');
        return out;
      },
    },
    advancesCasting: { levels: range(1, 10), traditions: ['arcane', 'divine'] },
    features: { 1: ['loremaster-secret'], 2: ['lore'], 3: ['loremaster-secret'], 4: ['bonus-language-loremaster'], 5: ['loremaster-secret'], 6: ['greater-lore'], 7: ['loremaster-secret'], 8: ['bonus-language-loremaster'], 9: ['loremaster-secret'], 10: ['true-lore'] },
    progressions: { loremasterLevel: (l) => l },
  },

  'stalwart-defender': {
    name: 'Stalwart Defender', source: "Advanced Player's Guide", hitDie: 12, skillRanks: 2, bab: 'full', saves: { fort: 'good', ref: 'poor', will: 'good' },
    classSkills: ['acrobatics', 'climb', 'intimidate', 'perception', 'sense-motive'],
    proficiencies: { weapons: [], armor: [], shields: [] },
    requirements: { bab: 7, feats: ['dodge', 'endurance', 'toughness'], custom: (c) => (['light', 'medium'].every((a) => c.isArmorProficient ? c.isArmorProficient(a) : true) ? [] : ['Proficient with light and medium armor']) },
    features: {
      1: ['ac-bonus-stalwart', 'defensive-stance'], 2: ['defensive-power'], 3: ['uncanny-dodge-stalwart'], 4: ['defensive-power-4'], 5: ['damage-reduction-stalwart'], 6: ['defensive-power-6'],
      7: ['improved-uncanny-dodge'], 8: ['defensive-power-8'], 9: ['mobile-defense'], 10: ['defensive-power-10', 'last-word'],
    },
    progressions: {
      stalwartLevel: (l) => l, stanceRounds: (l) => 4 + 2 * (l - 1), stalwartAc: (l) => (l >= 10 ? 4 : l >= 7 ? 3 : l >= 4 ? 2 : 1),
      improvedUncannyDodgeLevels: (l) => (l >= 7 ? l : 0),
    },
  },
};

for (const [id, c] of Object.entries(PRESTIGE)) {
  c.id = id;
  c.type = 'prestige';
  c.maxLevel = 10;
  c.saveFormula = 'prestige';
  c.proficiencies = c.proficiencies || { weapons: [], armor: [], shields: [] };
}

module.exports = { PRESTIGE };
