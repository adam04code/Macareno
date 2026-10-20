'use strict';

/**
 * Spells per day / spells known tables. Index = class level (1..20); each
 * row lists slots for spell levels starting at 0. `null` = no access,
 * 0 = only bonus spells from a high ability score.
 */

const r = (...xs) => xs;

// Wizard & cleric share this progression (cleric gets +1 domain slot per level 1-9).
const FULL_PREPARED = [
  null,
  r(3, 1), r(4, 2), r(4, 2, 1), r(4, 3, 2), r(4, 3, 2, 1), r(4, 3, 3, 2), r(4, 4, 3, 2, 1), r(4, 4, 3, 3, 2),
  r(4, 4, 4, 3, 2, 1), r(4, 4, 4, 3, 3, 2), r(4, 4, 4, 4, 3, 2, 1), r(4, 4, 4, 4, 3, 3, 2), r(4, 4, 4, 4, 4, 3, 2, 1),
  r(4, 4, 4, 4, 4, 3, 3, 2), r(4, 4, 4, 4, 4, 4, 3, 2, 1), r(4, 4, 4, 4, 4, 4, 3, 3, 2), r(4, 4, 4, 4, 4, 4, 4, 3, 2, 1),
  r(4, 4, 4, 4, 4, 4, 4, 3, 3, 2), r(4, 4, 4, 4, 4, 4, 4, 4, 3, 3), r(4, 4, 4, 4, 4, 4, 4, 4, 4, 4),
];

// Sorcerer spells per day (0-level spells are cantrips known, castable at will => Infinity).
const I = Infinity;
const SORCERER_PER_DAY = [
  null,
  r(I, 3), r(I, 4), r(I, 5), r(I, 6, 3), r(I, 6, 4), r(I, 6, 5, 3), r(I, 6, 6, 4), r(I, 6, 6, 5, 3), r(I, 6, 6, 6, 4),
  r(I, 6, 6, 6, 5, 3), r(I, 6, 6, 6, 6, 4), r(I, 6, 6, 6, 6, 5, 3), r(I, 6, 6, 6, 6, 6, 4), r(I, 6, 6, 6, 6, 6, 5, 3),
  r(I, 6, 6, 6, 6, 6, 6, 4), r(I, 6, 6, 6, 6, 6, 6, 5, 3), r(I, 6, 6, 6, 6, 6, 6, 6, 4), r(I, 6, 6, 6, 6, 6, 6, 6, 5, 3),
  r(I, 6, 6, 6, 6, 6, 6, 6, 6, 4), r(I, 6, 6, 6, 6, 6, 6, 6, 6, 6),
];
const SORCERER_KNOWN = [
  null,
  r(4, 2), r(5, 2), r(5, 3), r(6, 3, 1), r(6, 4, 2), r(7, 4, 2, 1), r(7, 5, 3, 2), r(8, 5, 3, 2, 1), r(8, 5, 4, 3, 2),
  r(9, 5, 4, 3, 2, 1), r(9, 5, 5, 4, 3, 2), r(9, 5, 5, 4, 3, 2, 1), r(9, 5, 5, 4, 4, 3, 2), r(9, 5, 5, 4, 4, 3, 2, 1),
  r(9, 5, 5, 4, 4, 4, 3, 2), r(9, 5, 5, 4, 4, 4, 3, 2, 1), r(9, 5, 5, 4, 4, 4, 3, 3, 2), r(9, 5, 5, 4, 4, 4, 3, 3, 2, 1),
  r(9, 5, 5, 4, 4, 4, 3, 3, 3, 2), r(9, 5, 5, 4, 4, 4, 3, 3, 3, 3),
];

const BARD_PER_DAY = [
  null,
  r(I, 1), r(I, 2), r(I, 3), r(I, 3, 1), r(I, 4, 2), r(I, 4, 3), r(I, 4, 3, 1), r(I, 4, 4, 2), r(I, 5, 4, 3), r(I, 5, 4, 3, 1),
  r(I, 5, 4, 4, 2), r(I, 5, 5, 4, 3), r(I, 5, 5, 4, 3, 1), r(I, 5, 5, 4, 4, 2), r(I, 5, 5, 5, 4, 3), r(I, 5, 5, 5, 4, 3, 1),
  r(I, 5, 5, 5, 4, 4, 2), r(I, 5, 5, 5, 5, 4, 3), r(I, 5, 5, 5, 5, 5, 4), r(I, 5, 5, 5, 5, 5, 5),
];
const BARD_KNOWN = [
  null,
  r(4, 2), r(5, 3), r(6, 4), r(6, 4, 2), r(6, 4, 3), r(6, 4, 4), r(6, 5, 4, 2), r(6, 5, 4, 3), r(6, 5, 4, 4), r(6, 5, 5, 4, 2),
  r(6, 6, 5, 4, 3), r(6, 6, 5, 4, 4), r(6, 6, 5, 5, 4, 2), r(6, 6, 6, 5, 4, 3), r(6, 6, 6, 5, 4, 4), r(6, 6, 6, 5, 5, 4, 2),
  r(6, 6, 6, 6, 5, 4, 3), r(6, 6, 6, 6, 5, 4, 4), r(6, 6, 6, 6, 5, 5, 4), r(6, 6, 6, 6, 6, 5, 5),
];

// Paladin & ranger (no 0-level spells; caster level = class level - 3).
const N = null;
const HALF_CASTER = [
  null,
  r(N), r(N), r(N), r(N, 0), r(N, 1), r(N, 1), r(N, 1, 0), r(N, 1, 1), r(N, 2, 1), r(N, 2, 1, 0),
  r(N, 2, 1, 1), r(N, 2, 2, 1), r(N, 3, 2, 1, 0), r(N, 3, 2, 1, 1), r(N, 3, 2, 2, 1), r(N, 3, 3, 2, 1),
  r(N, 4, 3, 2, 1), r(N, 4, 3, 2, 2), r(N, 4, 3, 3, 2), r(N, 4, 4, 3, 3),
];

// Magus (Ultimate Magic): prepared, 0-6th level.
const MAGUS_PER_DAY = [
  null,
  r(3, 1), r(4, 2), r(4, 3), r(4, 3, 1), r(4, 4, 2), r(5, 4, 3), r(5, 4, 3, 1), r(5, 4, 4, 2), r(5, 5, 4, 3), r(5, 5, 4, 3, 1),
  r(5, 5, 4, 4, 2), r(5, 5, 5, 4, 3), r(5, 5, 5, 4, 3, 1), r(5, 5, 5, 4, 4, 2), r(5, 5, 5, 5, 4, 3), r(5, 5, 5, 5, 4, 3, 1),
  r(5, 5, 5, 5, 4, 4, 2), r(5, 5, 5, 5, 5, 4, 3), r(5, 5, 5, 5, 5, 5, 4), r(5, 5, 5, 5, 5, 5, 5),
];

module.exports = { FULL_PREPARED, SORCERER_PER_DAY, SORCERER_KNOWN, BARD_PER_DAY, BARD_KNOWN, HALF_CASTER, MAGUS_PER_DAY };
