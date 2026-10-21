'use strict';

/**
 * Animal companions (Core Rulebook, "Animal Companions"). Starting statistics
 * per animal, its advancement at 4th or 7th level, and the advancement table
 * by effective druid level (druid level; ranger level - 3; animal domain
 * cleric level - 3; hunter level; cavalier level for mounts).
 *
 * Attack damage is listed at the companion's size; `trip`, `grab` and similar
 * riders use the bestiary rider format.
 */

const B = ['bludgeoning'];
const P = ['piercing'];
const S = ['slashing'];
const BPS = ['bludgeoning', 'piercing', 'slashing'];
const nat = (name, damage, type, extra = {}) => ({ name, damage, type, natural: true, crit: [20, 2], ...extra });

const COMPANIONS = {
  ape: {
    name: 'Ape', size: 'medium', speed: { land: 30, climb: 30 }, natural: 1, abilities: { str: 13, dex: 17, con: 10, int: 2, wis: 12, cha: 7 },
    attacks: [nat('Bite', '1d4', BPS), nat('Claw', '1d4', S, { count: 2 })], senses: ['low-light vision', 'scent'],
    advance: { level: 4, size: 'large', abilities: { str: 8, dex: -2, con: 4 }, attacks: [nat('Bite', '1d6', BPS), nat('Claw', '1d6', S, { count: 2 })] },
  },
  bear: {
    name: 'Bear', size: 'small', speed: { land: 40 }, natural: 2, abilities: { str: 15, dex: 15, con: 13, int: 2, wis: 12, cha: 6 },
    attacks: [nat('Bite', '1d4', BPS), nat('Claw', '1d3', S, { count: 2 })], senses: ['low-light vision', 'scent'],
    advance: { level: 4, size: 'medium', abilities: { str: 4, dex: -2, con: 2 }, attacks: [nat('Bite', '1d6', BPS), nat('Claw', '1d4', S, { count: 2 })] },
  },
  bird: {
    name: 'Bird (eagle)', size: 'small', speed: { land: 10, fly: 80 }, natural: 1, abilities: { str: 10, dex: 15, con: 12, int: 2, wis: 14, cha: 6 },
    attacks: [nat('Bite', '1d4', BPS), nat('Talon', '1d4', S, { count: 2 })], senses: ['low-light vision'],
    advance: { level: 4, abilities: { str: 2, con: 2 } },
  },
  boar: {
    name: 'Boar', size: 'small', speed: { land: 40 }, natural: 6, abilities: { str: 13, dex: 12, con: 15, int: 2, wis: 13, cha: 4 },
    attacks: [nat('Gore', '1d6', S)], senses: ['low-light vision', 'scent'],
    advance: { level: 4, size: 'medium', abilities: { str: 4, dex: -2, con: 2 }, attacks: [nat('Gore', '1d8', S)], special: [{ kind: 'ferocity' }] },
  },
  'big-cat': {
    name: 'Big Cat (lion, tiger)', size: 'small', speed: { land: 40 }, natural: 1, abilities: { str: 13, dex: 17, con: 13, int: 2, wis: 15, cha: 10 },
    attacks: [nat('Bite', '1d4', BPS), nat('Claw', '1d3', S, { count: 2 })], senses: ['low-light vision', 'scent'],
    advance: { level: 7, size: 'medium', abilities: { str: 4, dex: -2, con: 2 }, attacks: [nat('Bite', '1d6', BPS, { onHit: [{ kind: 'grab' }] }), nat('Claw', '1d4', S, { count: 2 })], special: [{ kind: 'pounce' }, { kind: 'rake', dice: '1d4' }] },
  },
  'small-cat': {
    name: 'Small Cat (cheetah, leopard)', size: 'small', speed: { land: 50 }, natural: 1, abilities: { str: 12, dex: 21, con: 13, int: 2, wis: 12, cha: 6 },
    attacks: [nat('Bite', '1d4', BPS, { onHit: [{ kind: 'trip' }] }), nat('Claw', '1d2', S, { count: 2 })], senses: ['low-light vision', 'scent'],
    advance: { level: 4, size: 'medium', abilities: { str: 4, dex: -2, con: 2 }, attacks: [nat('Bite', '1d6', BPS, { onHit: [{ kind: 'trip' }] }), nat('Claw', '1d3', S, { count: 2 })] },
  },
  crocodile: {
    name: 'Crocodile', size: 'small', speed: { land: 20, swim: 30 }, natural: 4, abilities: { str: 15, dex: 14, con: 15, int: 1, wis: 12, cha: 2 },
    attacks: [nat('Bite', '1d6', BPS)], senses: ['low-light vision'],
    advance: { level: 4, size: 'medium', abilities: { str: 4, dex: -2, con: 2 }, attacks: [nat('Bite', '1d8', BPS, { onHit: [{ kind: 'grab' }] })] },
  },
  dog: {
    name: 'Dog', size: 'small', speed: { land: 40 }, natural: 2, abilities: { str: 13, dex: 17, con: 15, int: 2, wis: 12, cha: 6 },
    attacks: [nat('Bite', '1d6', BPS)], senses: ['low-light vision', 'scent'],
    advance: { level: 4, size: 'medium', abilities: { str: 4, dex: -2, con: 2 }, attacks: [nat('Bite', '1d8', BPS)] },
  },
  horse: {
    name: 'Horse', size: 'large', speed: { land: 50 }, natural: 4, abilities: { str: 16, dex: 13, con: 15, int: 2, wis: 12, cha: 6 },
    attacks: [nat('Bite', '1d4', BPS, { primary: false }), nat('Hoof', '1d6', B, { count: 2 })], senses: ['low-light vision', 'scent'], mount: true,
    advance: { level: 4, abilities: { str: 2, con: 2 } },
  },
  snake: {
    name: 'Snake (constrictor)', size: 'medium', speed: { land: 20, climb: 20, swim: 20 }, natural: 2, abilities: { str: 15, dex: 17, con: 13, int: 1, wis: 12, cha: 2 },
    attacks: [nat('Bite', '1d3', P, { onHit: [{ kind: 'grab' }] })], senses: ['low-light vision', 'scent'],
    advance: { level: 4, size: 'large', abilities: { str: 8, dex: -2, con: 4 }, attacks: [nat('Bite', '1d4', P, { onHit: [{ kind: 'grab' }] })], special: [{ kind: 'constrict', dice: '1d4' }] },
  },
  wolf: {
    name: 'Wolf', size: 'medium', speed: { land: 50 }, natural: 2, abilities: { str: 13, dex: 15, con: 15, int: 2, wis: 12, cha: 6 },
    attacks: [nat('Bite', '1d6', BPS, { onHit: [{ kind: 'trip' }] })], senses: ['low-light vision', 'scent'],
    advance: { level: 7, size: 'large', abilities: { str: 8, dex: -2, con: 4 }, attacks: [nat('Bite', '1d8', BPS, { onHit: [{ kind: 'trip' }] })] },
  },
};

for (const [id, c] of Object.entries(COMPANIONS)) c.id = id;

// [HD, BAB, Fort, Ref, Will, skills, feats, natural armor bonus, Str/Dex bonus, tricks] by effective level (index 1-20).
const r = (hd, bab, fort, ref, will, skills, feats, nat, strDex, tricks) => ({ hd, bab, fort, ref, will, skills, feats, nat, strDex, tricks });
const ADVANCEMENT = [
  null,
  r(2, 1, 3, 3, 0, 2, 1, 0, 0, 1), r(3, 2, 3, 3, 1, 3, 2, 0, 0, 1), r(3, 2, 3, 3, 1, 3, 2, 2, 1, 2), r(4, 3, 4, 4, 1, 4, 2, 2, 1, 2),
  r(5, 3, 4, 4, 1, 5, 3, 2, 1, 2), r(6, 4, 5, 5, 2, 6, 3, 4, 2, 3), r(6, 4, 5, 5, 2, 6, 3, 4, 2, 3), r(7, 5, 5, 5, 2, 7, 4, 4, 2, 3),
  r(8, 6, 6, 6, 2, 8, 4, 6, 3, 4), r(9, 6, 6, 6, 3, 9, 5, 6, 3, 4), r(9, 6, 6, 6, 3, 9, 5, 6, 3, 4), r(10, 7, 7, 7, 3, 10, 5, 8, 4, 5),
  r(11, 8, 7, 7, 3, 11, 6, 8, 4, 5), r(12, 9, 8, 8, 4, 12, 6, 8, 4, 5), r(12, 9, 8, 8, 4, 12, 6, 10, 5, 6), r(13, 9, 8, 8, 4, 13, 7, 10, 5, 6),
  r(14, 10, 9, 9, 4, 14, 7, 10, 5, 6), r(15, 11, 9, 9, 5, 15, 8, 12, 6, 7), r(15, 11, 9, 9, 5, 15, 8, 12, 6, 7), r(16, 12, 10, 10, 5, 16, 8, 12, 6, 7),
];

/** Specials gained by effective level: link/share spells (1), evasion (3), ability increases (4, 9, 14), devotion (6), multiattack (9), improved evasion (15). */
function companionSpecials(level) {
  return {
    evasion: level >= 3, devotion: level >= 6, multiattack: level >= 9, improvedEvasion: level >= 15,
    abilityIncreases: [4, 9, 14].filter((l) => level >= l).length,
  };
}

module.exports = { COMPANIONS, ADVANCEMENT, companionSpecials };
