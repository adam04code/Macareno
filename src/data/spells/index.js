'use strict';

const { SPELLS: LOW } = require('./low');
const { SPELLS: MID } = require('./mid');
const { SPELLS: HIGH } = require('./high');

const SPELLS = { ...LOW, ...MID, ...HIGH };
for (const [id, s] of Object.entries(SPELLS)) s.id = id;

// Classes that use another class's list.
const LIST_ALIASES = { sorcerer: 'wizard' };

function spellLevelFor(spell, list) {
  const key = LIST_ALIASES[list] || list;
  const lvl = spell.levels[key];
  return lvl === undefined ? null : lvl;
}

/** All spells on a list at a given level (or all levels). */
function spellList(list, level) {
  const key = LIST_ALIASES[list] || list;
  return Object.values(SPELLS).filter((s) => s.levels[key] !== undefined && (level === undefined || s.levels[key] === level));
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

module.exports = { SPELLS, spellLevelFor, spellList, SUMMON_TABLES, rangeFeet, LIST_ALIASES };
