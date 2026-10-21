'use strict';

/**
 * Wild shape / polymorph forms. Each form names the polymorph spell it
 * works as (beast shape, elemental body, plant shape), its size, natural
 * attacks (damage at that size), movement and senses. Ability and natural
 * armor adjustments come from the spell tier (Core Rulebook polymorph rules).
 */

const B = ['bludgeoning'], S = ['slashing'], P = ['piercing'], BPS = ['bludgeoning', 'piercing', 'slashing'];
const nat = (name, damage, type, extra = {}) => ({ name, damage, type, ...extra });

// Ability/natural armor adjustments by polymorph spell tier and size.
const TIERS = {
  'beast-shape-i': { small: { dex: 2, natural: 1 }, medium: { str: 2, natural: 2 } },
  'beast-shape-ii': { tiny: { dex: 4, str: -2, natural: 1 }, small: { dex: 2, natural: 1 }, medium: { str: 2, natural: 2 }, large: { str: 4, dex: -2, natural: 4 } },
  'beast-shape-iii': { diminutive: { dex: 6, str: -4, natural: 1 }, tiny: { dex: 4, str: -2, natural: 1 }, small: { dex: 2, natural: 1 }, medium: { str: 2, natural: 2 }, large: { str: 4, dex: -2, natural: 4 }, huge: { str: 6, dex: -4, natural: 6 } },
  'elemental-body-i': { small: { natural: 2 } },
  'elemental-body-ii': { small: { natural: 2 }, medium: { natural: 3 } },
  'elemental-body-iii': { small: { natural: 2 }, medium: { natural: 3 }, large: { natural: 4 } },
  'elemental-body-iv': { small: { natural: 2 }, medium: { natural: 3 }, large: { natural: 4 }, huge: { natural: 6 } },
  'plant-shape-i': { small: { con: 2, natural: 2 }, medium: { str: 2, con: 2, natural: 2 } },
  'plant-shape-ii': { small: { con: 2, natural: 2 }, medium: { str: 2, con: 2, natural: 2 }, large: { str: 4, con: 2, natural: 4 } },
  'plant-shape-iii': { small: { con: 2, natural: 2 }, medium: { str: 2, con: 2, natural: 2 }, large: { str: 4, con: 2, natural: 4 }, huge: { str: 8, dex: -2, con: 4, natural: 6 } },
};

// Elemental extras (in addition to the tier): Dex/Str/Con shifts differ by element.
const ELEMENT_ABILITIES = {
  air: { small: { dex: 2 }, medium: { dex: 4 }, large: { str: 2, dex: 4 }, huge: { str: 4, dex: 6 } },
  earth: { small: { str: 2 }, medium: { str: 4 }, large: { str: 6, dex: -2, con: 2 }, huge: { str: 8, dex: -2, con: 4 } },
  fire: { small: { dex: 2 }, medium: { dex: 4 }, large: { dex: 4, con: 2 }, huge: { dex: 6, con: 4 } },
  water: { small: { con: 2 }, medium: { con: 4 }, large: { str: 2, dex: -2, con: 6 }, huge: { str: 4, dex: -2, con: 8 } },
};

const FORMS = {
  // Beast shape I
  wolf: { name: 'Wolf', tier: 'beast-shape-i', size: 'medium', speed: 50, attacks: [nat('Bite', '1d6', BPS, { onHit: ['trip'] })], flags: ['scent', 'lowlight'] },
  leopard: { name: 'Leopard', tier: 'beast-shape-i', size: 'medium', speed: 30, climb: 20, attacks: [nat('Bite', '1d6', BPS), nat('Claw', '1d3', S, { count: 2 })], flags: ['scent', 'lowlight'] },
  hawk: { name: 'Hawk', tier: 'beast-shape-i', size: 'small', speed: 10, fly: 30, attacks: [nat('Talon', '1d4', S, { count: 2 })], flags: ['lowlight'] },
  // Beast shape II
  bear: { name: 'Grizzly Bear', tier: 'beast-shape-ii', size: 'large', speed: 40, attacks: [nat('Claw', '1d6', S, { count: 2, onHit: ['grab'] }), nat('Bite', '1d6', BPS)], flags: ['scent', 'lowlight'] },
  tiger: { name: 'Tiger', tier: 'beast-shape-ii', size: 'large', speed: 40, attacks: [nat('Claw', '1d8', S, { count: 2, onHit: ['grab'] }), nat('Bite', '2d6', BPS, { onHit: ['grab'] })], flags: ['scent', 'lowlight', 'pounce'] },
  eagle: { name: 'Giant Eagle', tier: 'beast-shape-ii', size: 'large', speed: 10, fly: 30, attacks: [nat('Talon', '1d6', S, { count: 2 }), nat('Bite', '1d8', BPS)], flags: ['lowlight'] },
  // Beast shape III
  'dire-tiger': { name: 'Dire Tiger (Huge-scale)', tier: 'beast-shape-iii', size: 'huge', speed: 40, attacks: [nat('Claw', '2d6', S, { count: 2, onHit: ['grab'] }), nat('Bite', '3d6', BPS, { onHit: ['grab'] })], flags: ['scent', 'lowlight', 'pounce', 'rake:2d6'] },
  mastodon: { name: 'Mastodon', tier: 'beast-shape-iii', size: 'huge', speed: 40, attacks: [nat('Gore', '2d8', P), nat('Slam', '2d6', B)], flags: ['scent', 'lowlight', 'trample'] },
  // Elemental body
  'air-elemental': { name: 'Air Elemental', tier: 'elemental', element: 'air', speed: 30, fly: 100, attacks: [nat('Slam', '1d6', B)], flags: ['darkvision:60', 'airMastery'] },
  'earth-elemental': { name: 'Earth Elemental', tier: 'elemental', element: 'earth', speed: 20, attacks: [nat('Slam', '1d8', B)], flags: ['darkvision:60', 'earthMastery'] },
  'fire-elemental': { name: 'Fire Elemental', tier: 'elemental', element: 'fire', speed: 50, attacks: [nat('Slam', '1d6', B, { onHit: [{ kind: 'energy', dice: '1d4', type: 'fire' }] })], flags: ['darkvision:60'], resist: { fire: 20 }, vulnerable: ['cold'] },
  'water-elemental': { name: 'Water Elemental', tier: 'elemental', element: 'water', speed: 20, swim: 90, attacks: [nat('Slam', '1d8', B)], flags: ['darkvision:60'], resist: { fire: 20 } },
  // Plant shape
  'shambling-mound': { name: 'Shambling Mound', tier: 'plant', size: 'large', speed: 20, attacks: [nat('Slam', '2d6', B, { count: 2, onHit: ['grab'] })], flags: ['darkvision:60', 'lowlight'], resist: { fire: 10 } },
  treant: { name: 'Treant', tier: 'plant', size: 'huge', speed: 30, attacks: [nat('Slam', '2d6', B, { count: 2 })], flags: ['lowlight'], vulnerable: ['fire'] },
};

for (const [id, f] of Object.entries(FORMS)) f.id = id;

/** Highest polymorph tiers available to a druid of `level` for wild shape. */
function wildShapeTiers(level) {
  const out = [];
  if (level >= 4) out.push('beast-shape-i');
  if (level >= 6) out.push('beast-shape-ii', 'elemental-body-i');
  if (level >= 8) out.push('beast-shape-iii', 'elemental-body-ii', 'plant-shape-i');
  if (level >= 10) out.push('elemental-body-iii', 'plant-shape-ii');
  if (level >= 12) out.push('elemental-body-iv', 'plant-shape-iii');
  return out;
}

const ELEMENT_SIZE_BY_TIER = { 'elemental-body-i': 'small', 'elemental-body-ii': 'medium', 'elemental-body-iii': 'large', 'elemental-body-iv': 'huge' };
const PLANT_SIZES = { 'plant-shape-i': ['small', 'medium'], 'plant-shape-ii': ['small', 'medium', 'large'], 'plant-shape-iii': ['small', 'medium', 'large', 'huge'] };

/**
 * Resolve a form for a wild shaper: the tier spell used, final size and
 * ability/natural armor adjustments. Returns null if the form is not available.
 */
function resolveForm(formId, level) {
  const f = FORMS[formId];
  if (!f) return null;
  const tiers = wildShapeTiers(level);
  if (f.tier === 'elemental') {
    const tier = ['elemental-body-iv', 'elemental-body-iii', 'elemental-body-ii', 'elemental-body-i'].find((t) => tiers.includes(t));
    if (!tier) return null;
    const size = ELEMENT_SIZE_BY_TIER[tier];
    const adj = { ...TIERS[tier][size] };
    for (const [a, v] of Object.entries(ELEMENT_ABILITIES[f.element][size])) adj[a] = (adj[a] || 0) + v;
    return { form: f, tier, size, adj };
  }
  if (f.tier === 'plant') {
    const tier = ['plant-shape-iii', 'plant-shape-ii', 'plant-shape-i'].find((t) => tiers.includes(t) && PLANT_SIZES[t].includes(f.size));
    return tier ? { form: f, tier, size: f.size, adj: TIERS[tier][f.size] } : null;
  }
  const order = ['beast-shape-i', 'beast-shape-ii', 'beast-shape-iii'];
  const needed = order.indexOf(f.tier);
  const tier = order.slice(needed).reverse().find((t) => tiers.includes(t) && TIERS[t][f.size]);
  return tier ? { form: f, tier, size: f.size, adj: TIERS[tier][f.size] } : null;
}

module.exports = { FORMS, TIERS, wildShapeTiers, resolveForm };
