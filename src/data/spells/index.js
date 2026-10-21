'use strict';

const { SPELLS: LOW } = require('./low');
const { SPELLS: MID } = require('./mid');
const { SPELLS: HIGH } = require('./high');
const { SPELLS: CORE_LOW } = require('./coreLow');
const { SPELLS: CORE_HIGH } = require('./coreHigh');
const { SPELLS: EXPANDED } = require('./expanded');
const { CLASS_LISTS } = require('./classLists');

const SPELLS = {};
for (const group of [LOW, MID, HIGH, CORE_LOW, CORE_HIGH, EXPANDED]) {
  for (const [id, s] of Object.entries(group)) {
    if (SPELLS[id]) throw new Error(`Duplicate spell id ${id}`);
    SPELLS[id] = s;
  }
}
for (const [id, s] of Object.entries(SPELLS)) s.id = id;

// Class spell lists kept as separate tables (druid, witch, inquisitor...): merge into spell.levels.
for (const [list, byLevel] of Object.entries(CLASS_LISTS)) {
  for (const [lvl, ids] of Object.entries(byLevel)) {
    for (const id of ids) {
      if (!SPELLS[id]) throw new Error(`Spell list ${list} references unknown spell ${id}`);
      SPELLS[id].levels[list] = Number(lvl);
    }
  }
}

// Classes that use another class's list. An object { lists, max } means "the lowest level among
// these lists, capped at max" (hunter: druid or ranger; warpriest: the cleric list up to 6th).
const LIST_ALIASES = {
  sorcerer: 'wizard', arcanist: 'wizard', oracle: 'cleric', skald: 'bard',
  hunter: { lists: ['druid', 'ranger'], max: 6 }, warpriest: { lists: ['cleric'], max: 6 },
};

function spellLevelFor(spell, list) {
  const key = LIST_ALIASES[list] || list;
  if (typeof key === 'object') {
    const lvls = key.lists.map((k) => spell.levels[k]).filter((l) => l !== undefined && l <= key.max);
    return lvls.length ? Math.min(...lvls) : null;
  }
  const lvl = spell.levels[key];
  return lvl === undefined ? null : lvl;
}

/** All spells on a list at a given level (or all levels). */
function spellList(list, level) {
  return Object.values(SPELLS).filter((s) => {
    const l = spellLevelFor(s, list);
    return l !== null && (level === undefined || l === level);
  });
}

// Summon monster tables (Core Rulebook). Entries reference bestiary ids.
const SUMMON_TABLES = {
  1: ['dire-rat', 'eagle', 'giant-fire-beetle', 'poisonous-frog', 'viper', 'pony'],
  2: ['giant-centipede', 'giant-frog', 'giant-spider', 'wolf', 'small-fire-elemental', 'small-earth-elemental', 'small-air-elemental', 'small-water-elemental', 'lemure', 'horse'],
  3: ['ape', 'boar', 'crocodile', 'dire-bat', 'leopard', 'shark', 'wolverine', 'dretch', 'lantern-archon'],
  4: ['dire-wolf', 'giant-scorpion', 'grizzly-bear', 'hell-hound', 'lion', 'medium-fire-elemental', 'medium-earth-elemental', 'medium-air-elemental', 'medium-water-elemental', 'dire-boar'],
  5: ['dire-lion', 'large-fire-elemental', 'large-earth-elemental', 'large-air-elemental', 'large-water-elemental', 'bearded-devil', 'babau', 'salamander', 'owlbear'],
  6: ['huge-fire-elemental', 'huge-earth-elemental', 'huge-air-elemental', 'huge-water-elemental', 'chimera', 'erinyes', 'dire-tiger'],
  7: ['greater-fire-elemental', 'greater-earth-elemental', 'bone-devil', 'vrock'],
  8: ['elder-fire-elemental', 'elder-earth-elemental', 'young-red-dragon'],
  9: ['elder-fire-elemental', 'elder-earth-elemental', 'adult-red-dragon'],
};

// Summon nature's ally tables (Core Rulebook); creatures missing from the bestiary are skipped.
const NATURE_SUMMON_TABLES = {
  1: ['dire-rat', 'eagle', 'giant-centipede', 'giant-fire-beetle', 'poisonous-frog', 'pony', 'viper', 'dolphin', 'stirge'],
  2: ['giant-frog', 'giant-spider', 'horse', 'wolf', 'hyena', 'octopus', 'small-fire-elemental', 'small-earth-elemental', 'small-air-elemental', 'small-water-elemental'],
  3: ['ape', 'boar', 'crocodile', 'dire-bat', 'leopard', 'shark', 'wolverine', 'cheetah', 'constrictor-snake', 'monitor-lizard', 'aurochs'],
  4: ['dire-wolf', 'giant-scorpion', 'grizzly-bear', 'lion', 'griffon', 'medium-fire-elemental', 'medium-earth-elemental', 'medium-air-elemental', 'medium-water-elemental', 'rhinoceros', 'giant-wasp'],
  5: ['dire-boar', 'dire-lion', 'large-fire-elemental', 'large-earth-elemental', 'large-air-elemental', 'large-water-elemental', 'tiger', 'dire-ape', 'orca', 'satyr'],
  6: ['dire-tiger', 'huge-fire-elemental', 'huge-earth-elemental', 'huge-air-elemental', 'huge-water-elemental', 'dire-bear', 'elephant', 'girallon'],
  7: ['greater-fire-elemental', 'greater-earth-elemental', 'roc', 'dire-crocodile', 'mastodon'],
  8: ['elder-fire-elemental', 'elder-earth-elemental', 'dire-shark', 'tyrannosaurus'],
  9: ['elder-fire-elemental', 'elder-earth-elemental', 'pixie', 'unicorn'],
};

// Ranges in feet.
function rangeFeet(range, cl) {
  switch (range) {
    case 'personal': return 0;
    case 'touch': return 5;
    case 'close': return 25 + 5 * Math.floor(cl / 2);
    case 'medium': return 100 + 10 * cl;
    case 'long': return 400 + 40 * cl;
    case 'unlimited': return Infinity;
    default: {
      const m = /^(\d+)\s*ft/.exec(range || '');
      return m ? Number(m[1]) : 5;
    }
  }
}

module.exports = { SPELLS, spellLevelFor, spellList, SUMMON_TABLES, NATURE_SUMMON_TABLES, rangeFeet, LIST_ALIASES };
