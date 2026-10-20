'use strict';

/** Core numeric tables from the PF1 Core Rulebook. */

function abilityMod(score) {
  if (score === null || score === undefined) return 0; // nonabilities (e.g. undead Con) count as +0
  return Math.floor((score - 10) / 2);
}

// Base attack bonus progressions (per class level).
const BAB = {
  full: (lvl) => lvl,
  threeQuarter: (lvl) => Math.floor((lvl * 3) / 4),
  half: (lvl) => Math.floor(lvl / 2),
};

// Saving throw progressions. Base classes: good = 2 + L/2, poor = L/3.
// Prestige classes: good = (L+1)/2, poor = (L+1)/3.
const SAVES = {
  base: { good: (l) => 2 + Math.floor(l / 2), poor: (l) => Math.floor(l / 3) },
  prestige: { good: (l) => Math.floor((l + 1) / 2), poor: (l) => Math.floor((l + 1) / 3) },
};

/** Iterative attacks: +6/+1, +11/+6/+1, +16/+11/+6/+1. */
function iterativeAttacks(bab) {
  const out = [bab];
  for (let b = bab - 5; b >= 1 && out.length < 4; b -= 5) out.push(b);
  return out;
}

// Character advancement (XP needed to reach level N; index = level).
const XP_TRACKS = {
  slow: [0, 0, 3000, 7500, 14000, 23000, 35000, 53000, 77000, 115000, 160000, 235000, 330000, 475000, 665000, 955000, 1350000, 1900000, 2700000, 3850000, 5350000],
  medium: [0, 0, 2000, 5000, 9000, 15000, 23000, 35000, 51000, 75000, 105000, 155000, 220000, 315000, 445000, 635000, 890000, 1300000, 1800000, 2550000, 3600000],
  fast: [0, 0, 1300, 3300, 6000, 10000, 15000, 23000, 34000, 50000, 71000, 105000, 145000, 210000, 295000, 425000, 600000, 850000, 1200000, 1700000, 2400000],
};

function levelForXp(xp, track = 'medium') {
  const t = XP_TRACKS[track];
  let lvl = 1;
  for (let i = 2; i < t.length; i++) if (xp >= t[i]) lvl = i;
  return lvl;
}

// Experience point awards by Challenge Rating (Table 12-2).
const CR_XP = {
  '1/8': 50, '1/6': 65, '1/4': 100, '1/3': 135, '1/2': 200,
  1: 400, 2: 600, 3: 800, 4: 1200, 5: 1600, 6: 2400, 7: 3200, 8: 4800, 9: 6400, 10: 9600,
  11: 12800, 12: 19200, 13: 25600, 14: 38400, 15: 51200, 16: 76800, 17: 102400, 18: 153600,
  19: 204800, 20: 307200, 21: 409600, 22: 614400, 23: 819200, 24: 1228800, 25: 1638400,
};

function crToNumber(cr) {
  if (typeof cr === 'number') return cr;
  if (String(cr).includes('/')) {
    const [a, b] = String(cr).split('/').map(Number);
    return a / b;
  }
  return Number(cr);
}

function xpForCr(cr) {
  if (CR_XP[cr] !== undefined) return CR_XP[cr];
  const n = crToNumber(cr);
  if (n > 25) return CR_XP[25] * 2 ** Math.ceil((n - 25) / 2);
  return CR_XP[Math.max(1, Math.round(n))] || 0;
}

// Point buy (Table 1-2).
const POINT_BUY_COST = { 7: -4, 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17 };
const POINT_BUY_BUDGETS = { low: 10, standard: 15, high: 20, epic: 25 };

// Carrying capacity (Table 7-4): heavy load maximum by Strength.
const HEAVY_LOAD = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 115, 130, 150, 175, 200, 230, 260, 300, 350, 400, 460, 520, 600, 700, 800, 920, 1040, 1200, 1400];

function carryingCapacity(str, sizeMultiplier = 1) {
  let heavy;
  if (str <= 0) heavy = 0;
  else if (str < HEAVY_LOAD.length) heavy = HEAVY_LOAD[str];
  else {
    const over = str - 20;
    heavy = HEAVY_LOAD[20 + (over % 10)] * 4 ** Math.floor(over / 10);
  }
  heavy *= sizeMultiplier;
  return { light: Math.floor(heavy / 3), medium: Math.floor((heavy * 2) / 3), heavy };
}

// Encumbrance penalties (Table 7-5).
const LOAD_PENALTIES = {
  light: { maxDex: null, checkPenalty: 0, speedFactor: 1, runMultiplier: 4 },
  medium: { maxDex: 3, checkPenalty: -3, speedFactor: 0.75, runMultiplier: 4 },
  heavy: { maxDex: 1, checkPenalty: -6, speedFactor: 0.75, runMultiplier: 3 },
};

// Reduced speeds (Table 7-6 style): 30 -> 20, 20 -> 15, etc.
function reducedSpeed(speed) {
  return Math.floor((speed * 2) / 3 / 5) * 5 || 5;
}

// Character wealth by level (Table 12-4), in gp.
const WEALTH_BY_LEVEL = [0, 0, 1000, 3000, 6000, 10500, 16000, 23500, 33000, 46000, 62000, 82000, 108000, 140000, 185000, 240000, 315000, 410000, 530000, 685000, 880000];

// Treasure value per encounter, medium progression (Table 12-5), in gp.
const TREASURE_BY_CR = { 1: 260, 2: 550, 3: 800, 4: 1150, 5: 1550, 6: 2000, 7: 2600, 8: 3350, 9: 4250, 10: 5450, 11: 7000, 12: 9000, 13: 11600, 14: 15000, 15: 19500, 16: 25000, 17: 32000, 18: 41000, 19: 53000, 20: 67000 };

function treasureForCr(cr) {
  const n = crToNumber(cr);
  if (n < 1) return Math.round(TREASURE_BY_CR[1] * n);
  return TREASURE_BY_CR[Math.min(20, Math.round(n))];
}

// Bonus spells per day by ability modifier (Table 1-3).
function bonusSpells(abilityModifier, spellLevel) {
  if (spellLevel === 0 || abilityModifier < spellLevel) return 0;
  return 1 + Math.floor((abilityModifier - spellLevel) / 4);
}

const COIN = { cp: 1, sp: 10, gp: 100, pp: 1000 };

function toCopper(amount, unit = 'gp') {
  return Math.round(amount * COIN[unit]);
}

function formatMoney(copper) {
  const gp = Math.floor(copper / 100);
  const sp = Math.floor((copper % 100) / 10);
  const cp = copper % 10;
  const parts = [];
  if (gp) parts.push(`${gp} gp`);
  if (sp) parts.push(`${sp} sp`);
  if (cp || !parts.length) parts.push(`${cp} cp`);
  return parts.join(' ');
}

module.exports = {
  abilityMod, BAB, SAVES, iterativeAttacks, XP_TRACKS, levelForXp, CR_XP, crToNumber, xpForCr,
  POINT_BUY_COST, POINT_BUY_BUDGETS, carryingCapacity, LOAD_PENALTIES, reducedSpeed,
  WEALTH_BY_LEVEL, TREASURE_BY_CR, treasureForCr, bonusSpells, COIN, toCopper, formatMoney,
};
