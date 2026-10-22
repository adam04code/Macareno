'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Kineticist (Occult Adventures) elements, kinetic blasts, infusions and
 * utility wild talents. Air, earth, fire and water elements (aether, void and
 * wood are left out). Source: the kineticist class and wild talent lists on
 * Archives of Nethys / d20pfsrd (Occult Adventures, OGL).
 *
 * Wild talents have a level (effective spell level); a kineticist can take one
 * of level N at kineticist level 2N (1st-level talents at 1st), and talents of
 * an expanded element as if 4 levels lower.
 */

const o = (name, description, extra = {}) => ({ name, description, ...extra });
const kl = (c) => c.prog('kineticistLevel');
const burnNow = (c) => c.resourcesUsed.burn || 0;

const ELEMENTS = {
  air: o('Air', 'Aerokineticist: air blast or electric blast; enveloping winds; class skills Fly and Knowledge (nature).', { classSkills: ['fly', 'knowledge-nature'], blasts: ['air-blast', 'electric-blast'], basic: 'basic-aerokinesis', defense: 'enveloping-winds' }),
  earth: o('Earth', 'Geokineticist: earth blast; flesh of stone; class skills Climb and Knowledge (dungeoneering).', { classSkills: ['climb', 'knowledge-dungeoneering'], blasts: ['earth-blast'], basic: 'basic-geokinesis', defense: 'flesh-of-stone' }),
  fire: o('Fire', 'Pyrokineticist: fire blast; searing flesh; class skills Escape Artist and Knowledge (nature).', { classSkills: ['escape-artist', 'knowledge-nature'], blasts: ['fire-blast'], basic: 'basic-pyrokinesis', defense: 'searing-flesh' }),
  water: o('Water', 'Hydrokineticist: water blast or cold blast; shroud of water; class skills Knowledge (nature) and Swim.', { classSkills: ['knowledge-nature', 'swim'], blasts: ['water-blast', 'cold-blast'], basic: 'basic-hydrokinesis', defense: 'shroud-of-water' }),
};

// Simple blasts cost 0 burn; composite blasts cost 2 (1 with composite specialization).
const B = (name, element, kind, types, extra = {}) => ({ name, element, kind, types, burn: 0, ...extra });
const BLASTS = {
  'air-blast': B('Air Blast', 'air', 'physical', ['bludgeoning']),
  'electric-blast': B('Electric Blast', 'air', 'energy', ['electricity']),
  'earth-blast': B('Earth Blast', 'earth', 'physical', ['bludgeoning', 'piercing', 'slashing'], { anyOne: true }),
  'fire-blast': B('Fire Blast', 'fire', 'energy', ['fire']),
  'water-blast': B('Water Blast', 'water', 'physical', ['bludgeoning']),
  'cold-blast': B('Cold Blast', 'water', 'energy', ['cold']),
  // Composite blasts: `requires` lists simple blasts; `primary` means the element must be primary and expanded again.
  'blizzard-blast': B('Blizzard Blast', ['air', 'water'], 'physical', ['piercing', 'cold'], { composite: true, burn: 2, requires: ['air-blast', 'cold-blast'], split: true }),
  'charged-water-blast': B('Charged Water Blast', ['air', 'water'], 'physical', ['bludgeoning', 'electricity'], { composite: true, burn: 2, requires: ['electric-blast', 'water-blast'], split: true }),
  'plasma-blast': B('Plasma Blast', ['air', 'fire'], 'physical', ['bludgeoning', 'fire'], { composite: true, burn: 2, requires: ['air-blast', 'fire-blast'], split: true }),
  'sandstorm-blast': B('Sandstorm Blast', ['air', 'earth'], 'physical', ['piercing', 'slashing'], { composite: true, burn: 2, requires: ['air-blast', 'earth-blast'] }),
  'thunderstorm-blast': B('Thunderstorm Blast', ['air'], 'physical', ['bludgeoning', 'electricity'], { composite: true, burn: 2, primary: 'air', split: true }),
  'magma-blast': B('Magma Blast', ['earth', 'fire'], 'physical', ['bludgeoning', 'fire'], { composite: true, burn: 2, requires: ['earth-blast', 'fire-blast'], split: true }),
  'metal-blast': B('Metal Blast', ['earth'], 'physical', ['bludgeoning', 'piercing', 'slashing'], { composite: true, burn: 2, primary: 'earth', anyOne: true }),
  'mud-blast': B('Mud Blast', ['earth', 'water'], 'physical', ['bludgeoning'], { composite: true, burn: 2, requires: ['earth-blast', 'water-blast'] }),
  'blue-flame-blast': B('Blue Flame Blast', ['fire'], 'energy', ['fire'], { composite: true, burn: 2, primary: 'fire' }),
  'steam-blast': B('Steam Blast', ['fire', 'water'], 'physical', ['bludgeoning', 'fire'], { composite: true, burn: 2, requires: ['fire-blast', 'water-blast'], split: true }),
  'ice-blast': B('Ice Blast', ['water'], 'physical', ['piercing', 'cold'], { composite: true, burn: 2, primary: 'water', split: true }),
};

/**
 * Infusions. form: { range, area: { shape, size, centeredOnSelf }, melee, reach, damageMult, attacks }
 * substance: { save, condition, rounds, ongoing, note }. elements: list or 'universal'; blasts: limits.
 */
const I = (name, elements, type, level, burn, description, extra = {}) => o(name, description, { elements, type, level, burn, ...extra });
const INFUSIONS = {
  // Universal forms
  'extended-range': I('Extended Range', 'universal', 'form', 1, 1, 'Blast range becomes 120 ft.', { form: { range: 120 } }),
  'kinetic-blade': I('Kinetic Blade', 'universal', 'form', 1, 1, 'Form a melee weapon of your blast and attack with it as part of the attack action; energy blades target touch AC.', { form: { melee: true } }),
  'kinetic-fist': I('Kinetic Fist', 'universal', 'form', 1, 1, 'Until your next turn, natural attacks and unarmed strikes deal +1d6 per three blast dice of the blast\'s damage.', { form: { fist: true } }),
  'extreme-range': I('Extreme Range', 'universal', 'form', 3, 2, 'Blast range becomes 480 ft.', { form: { range: 480 }, requires: ['extended-range'] }),
  'flurry-of-blasts': I('Flurry of Blasts', 'universal', 'form', 3, 2, 'Two blasts at 1st-level damage (three at 10th, four at 16th, five at 20th).', { form: { flurry: true }, requires: ['extended-range'] }),
  'kinetic-whip': I('Kinetic Whip', 'universal', 'form', 3, 2, 'A reach whip (15 ft.) that threatens until your next turn.', { form: { melee: true, reach: 15 }, requires: ['kinetic-blade'] }),
  'mobile-blast': I('Mobile Blast', 'universal', 'form', 3, 2, 'A moving 5-ft. blast that deals 1/4 damage (1/2 for energy) each round; Reflex negates.', { form: { area: { shape: 'square', size: 5 }, damageMult: 0.25, save: 'ref', effect: 'negates' } }),
  snake: I('Snake', 'universal', 'form', 3, 2, 'The blast travels a 120-ft. path around obstacles (no soft cover).', { form: { range: 120 }, requires: ['extended-range'] }),
  wall: I('Wall', 'universal', 'form', 5, 3, 'A wall 120 ft. long (or 60 ft. by 20 ft.) for Con mod rounds: 1/4 damage on creation, 1/2 to those who cross it.', { form: { area: { shape: 'wall', size: 120 }, damageMult: 0.25 } }),
  // Element forms
  'fan-of-flames': I('Fan of Flames', ['fire'], 'form', 1, 1, '15-ft. cone, Reflex half.', { blasts: ['fire-blast', 'blue-flame-blast', 'plasma-blast', 'magma-blast', 'steam-blast'], form: { area: { shape: 'cone', size: 15 }, save: 'ref', effect: 'half' } }),
  eruption: I('Eruption', ['fire'], 'form', 3, 2, 'A 10-ft.-radius, 40-ft.-high pillar within 120 ft., Reflex half.', { form: { area: { shape: 'cylinder', size: 10 }, save: 'ref', effect: 'half' }, requires: ['extended-range'] }),
  explosion: I('Explosion', ['fire'], 'form', 7, 4, 'A burst within 120 ft. (radius 5-20 ft. as chosen), Reflex half.', { form: { area: { shape: 'burst', size: 20 }, save: 'ref', effect: 'half' }, requires: ['extended-range'] }),
  torrent: I('Torrent', ['air', 'fire', 'water'], 'form', 3, 2, '30-ft. line, Reflex half.', { form: { area: { shape: 'line', size: 30 }, save: 'ref', effect: 'half' } }),
  impale: I('Impale', ['earth', 'water'], 'form', 3, 2, 'Attack every creature in a 30-ft. line with one attack roll each.', { form: { area: { shape: 'line', size: 30 }, attackEach: true } }),
  cyclone: I('Cyclone', ['air'], 'form', 4, 3, 'Half damage to every creature in a 20-ft. burst centered on you (not you), Reflex half.', { form: { area: { shape: 'burst', size: 20, centeredOnSelf: true }, damageMult: 0.5, save: 'ref', effect: 'half' } }),
  spray: I('Spray', ['water'], 'form', 4, 3, '30-ft. cone, Reflex half.', { form: { area: { shape: 'cone', size: 30 }, save: 'ref', effect: 'half' } }),
  chain: I('Chain', ['air'], 'form', 5, 3, 'On a hit the blast arcs to further targets within 30 ft., each dealing 1d6 less.', { form: { chain: true } }),
  'deadly-earth': I('Deadly Earth', ['earth'], 'form', 6, 4, 'A 20-ft.-radius field for Con mod rounds: 1/4 damage on creation, 1/2 to creatures entering or ending their turn.', { form: { area: { shape: 'burst', size: 20 }, damageMult: 0.25 }, requires: ['extended-range'] }),
  cloud: I('Cloud', ['air', 'water'], 'form', 7, 4, 'A 20-ft.-radius cloud for Con mod rounds: 1/4 damage on creation, 1/2 to creatures entering or ending their turn.', { form: { area: { shape: 'burst', size: 20 }, damageMult: 0.25 }, requires: ['extended-range'] }),
  fragmentation: I('Fragmentation', ['earth', 'water'], 'form', 7, 4, 'Ranged attack within 120 ft.; the blast bursts for half damage within 20 ft. (Reflex half).', { form: { area: { shape: 'burst', size: 20 }, damageMult: 0.5, save: 'ref', effect: 'half' }, requires: ['extended-range'] }),
  // Substances
  draining: I('Draining', 'universal', 'substance', 1, 1, 'Only affects creatures of the blast\'s element subtype; Fort for 1/4 damage; reduce the burn of a later blast by 1.'),
  pushing: I('Pushing', ['air', 'earth', 'water'], 'substance', 1, 1, 'Bull rush each damaged target 5 ft. (Con instead of Str).', { substance: { maneuver: 'bull-rush' } }),
  burning: I('Burning', ['fire'], 'substance', 1, 1, 'Targets catch fire (1d6 fire per round until extinguished), Reflex negates.', { substance: { save: 'ref', ongoing: { dice: '1d6', type: 'fire' }, rounds: 3 } }),
  gusting: I('Gusting', ['air'], 'substance', 1, 1, 'Creates a gust of wind at the target, Fort negates.', { substance: { save: 'fort', note: 'gust of wind' } }),
  quenching: I('Quenching', ['water'], 'substance', 1, 1, 'Extinguishes nonmagical fires (dispels magical fire at 0 damage).'),
  thundering: I('Thundering', ['air'], 'substance', 1, 1, 'Targets are deafened 1 round per kineticist level, Fort negates.', { substance: { save: 'fort', condition: 'deafened', rounds: (c) => kl(c) } }),
  bowling: I('Bowling', ['earth'], 'substance', 2, 2, 'Trip each damaged target (Con instead of Str).', { substance: { maneuver: 'trip' } }),
  entangling: I('Entangling', ['earth', 'water'], 'substance', 2, 2, 'Targets are entangled for 1 minute, Reflex negates.', { substance: { save: 'ref', condition: 'entangled', rounds: () => 10 } }),
  magnetic: I('Magnetic', ['air', 'earth'], 'substance', 3, 2, 'Targets take -4 on Reflex saves and AC against metal attacks until your next turn.', { substance: { modifiers: [mod('ac', -4, 'penalty', 'Magnetic infusion', ['vsMetal'])], rounds: 1 } }),
  'rare-metal': I('Rare-Metal', ['earth'], 'substance', 3, 2, 'The blast bypasses DR as adamantine, cold iron or silver.', { blasts: ['metal-blast', 'earth-blast'] }),
  flash: I('Flash', ['fire'], 'substance', 4, 3, 'Targets are blinded 1 round, Will negates.', { substance: { save: 'will', condition: 'blinded', rounds: () => 1 } }),
  chilling: I('Chilling', ['water'], 'substance', 5, 3, 'Targets are staggered 1 round, Fort negates.', { substance: { save: 'fort', condition: 'staggered', rounds: () => 1 } }),
  grappling: I('Grappling', 'universal', 'substance', 5, 3, 'Grapple each target with CMB 2 + kineticist level + Con (cloud, deadly earth or wall).'),
  unraveling: I('Unraveling', ['fire'], 'substance', 5, 3, 'Dispel one magical effect on each target (caster level check) before dealing damage.'),
  brilliant: I('Brilliant', ['fire'], 'substance', 6, 4, 'Leaves continual flame along the blast\'s path until your next turn.', { requires: ['flash'] }),
  'pure-flame': I('Pure-Flame', ['fire'], 'substance', 7, 4, 'Fire blasts ignore spell resistance.'),
};

/** Utility wild talents (basic and defense talents are granted by the element). */
const W = (name, elements, level, burn, description, extra = {}) => o(name, description, { elements, level, burn, ...extra });
const WILD_TALENTS = {
  // Basic utility (free with the element)
  'basic-aerokinesis': W('Basic Aerokinesis', ['air'], 1, 0, 'Create breezes; mask scents.', { basic: true }),
  'basic-geokinesis': W('Basic Geokinesis', ['earth'], 1, 0, 'Move 5 lb. of earth per level 15 ft.; sift dirt.', { basic: true }),
  'basic-pyrokinesis': W('Basic Pyrokinesis', ['fire'], 1, 0, 'Flare, light or spark at will.', { basic: true }),
  'basic-hydrokinesis': W('Basic Hydrokinesis', ['water'], 1, 0, 'Create or purify water, dry creatures.', { basic: true }),
  // Defense talents
  'enveloping-winds': W('Enveloping Winds', ['air'], 1, 0, 'Ranged physical attacks against you have a 20% miss chance (+5% per five levels beyond 2nd; +5% per burn accepted for it, max 75%).', {
    defense: true, flags: (c) => [`rangedMissChance:${Math.min(75, 20 + 5 * Math.floor(Math.max(0, kl(c) - 2) / 5) + 5 * Math.min(burnNow(c), 7))}`],
  }),
  'flesh-of-stone': W('Flesh of Stone', ['earth'], 1, 0, 'DR 1/adamantine, +1 per two levels beyond 2nd (+1 per burn, max = kineticist level).', {
    defense: true, dr: (c) => [{ amount: Math.min(kl(c), 1 + Math.floor(Math.max(0, kl(c) - 2) / 2) + burnNow(c)), bypass: 'adamantine' }],
  }),
  'searing-flesh': W('Searing Flesh', ['fire'], 1, 0, 'Creatures hitting you with natural attacks or unarmed strikes take 1 fire per four levels (min 1); grapplers take double.', {
    defense: true, flags: (c) => [`searingFlesh:${Math.max(1, Math.floor(kl(c) / 4)) * (1 + Math.min(burnNow(c), 7))}`],
  }),
  'shroud-of-water': W('Shroud of Water', ['water'], 1, 0, '+4 armor bonus (or +2 shield bonus), +1 per four levels beyond 2nd; +1 per burn (up to +50%).', {
    defense: true, modifiers: (c) => { const b = 4 + Math.floor(Math.max(0, kl(c) - 2) / 4); return [mod('ac', b + Math.min(burnNow(c), Math.floor(b / 2)), 'armor', 'Shroud of water')]; },
  }),
  // Universal
  'skilled-kineticist': W('Skilled Kineticist', 'universal', 1, 0, '+1/2 kineticist level on two element-associated skills (Acrobatics and Perception here).', { modifiers: (c) => [mod('skill.acrobatics', Math.floor(kl(c) / 2), 'untyped', 'Skilled kineticist'), mod('skill.perception', Math.floor(kl(c) / 2), 'untyped', 'Skilled kineticist')] }),
  'elemental-grip': W('Elemental Grip', 'universal', 3, 0, 'Hold monster against creatures of your element subtype.'),
  'expanded-defense': W('Expanded Defense', 'universal', 4, 0, 'Gain the defense wild talent of an expanded element (choices.expandedDefense).'),
  'kinetic-form': W('Kinetic Form', 'universal', 5, 1, 'Become Large (Huge at 16th) for 1 round per level.', { abilities: ['kinetic-form'] }),
  'spark-of-life': W('Spark of Life', 'universal', 5, 0, 'Animate an elemental of your element as a construct companion.'),
  'ride-the-blast': W('Ride the Blast', 'universal', 6, 0, 'Travel along your blast to its endpoint.'),
  // Air
  'air-cushion': W('Air Cushion', ['air'], 1, 0, 'Constant feather fall.', { flags: () => ['featherFall'] }),
  'aerial-adaptation': W('Aerial Adaptation', ['air'], 1, 0, 'Immune to altitude sickness; electricity resistance = 2x burn.', { resistances: (c) => ({ electricity: 2 * burnNow(c) }) }),
  'airs-leap': W("Air's Leap", ['air'], 1, 0, '+kineticist level on jump checks; always a running start.', { modifiers: (c) => [mod('skill.acrobatics', kl(c), 'untyped', "Air's leap", ['jump'])] }),
  'voice-of-the-wind': W('Voice of the Wind', ['air'], 1, 0, 'Whispering wind / message at will.'),
  celerity: W('Celerity', ['air'], 3, 0, 'Haste yourself for 1 round (1 round per level for 1 burn).', { abilities: ['celerity'] }),
  'aerial-evasion': W('Aerial Evasion', ['air'], 3, 1, 'Evasion while you have accepted burn.', { flags: (c) => (burnNow(c) > 0 ? ['evasion'] : []), needs: ['enveloping-winds'] }),
  'wings-of-air': W('Wings of Air', ['air'], 3, 0, 'Fly speed 60 ft. (good) for 10 minutes per level.', { flags: () => ['fly:60'] }),
  windsight: W('Windsight', ['air'], 3, 0, 'See through fog and mist; ignore concealment from wind.'),
  'engulfing-winds': W('Engulfing Winds', ['air'], 3, 0, 'Create a wind wall.'),
  'wind-manipulator': W('Wind Manipulator', ['air'], 6, 0, 'Control winds.'),
  'weather-master': W('Weather Master', ['air'], 8, 0, 'Control weather.'),
  // Earth
  'earth-walk': W('Earth Walk', ['earth'], 1, 0, 'Ignore difficult terrain of earth, rock or mud; add elemental overflow to CMD vs bull rush/trip.', { flags: () => ['ignoreDifficultTerrain:earth'] }),
  'kinetic-cover': W('Kinetic Cover', ['earth', 'water'], 1, 0, 'Create a 5-ft. wall (total cover, AC 5, 2 hp per level).'),
  'earth-climb': W('Earth Climb', ['earth'], 2, 0, 'Climb speed equal to land speed on stone and earth.', { flags: () => ['climbSpeed:30'] }),
  tremorsense: W('Tremorsense', ['earth'], 3, 0, 'Tremorsense 30 ft.', { flags: () => ['tremorsense:30'] }),
  'jagged-flesh': W('Jagged Flesh', ['earth'], 3, 1, 'Creatures hitting you with natural or unarmed attacks take 1d6 piercing.', { needs: ['flesh-of-stone'] }),
  'shift-earth': W('Shift Earth', ['earth'], 4, 0, 'Move a 5-ft. cube of earth.', { needs: ['kinetic-cover'] }),
  'earth-glide': W('Earth Glide', ['earth'], 5, 0, 'Burrow through earth and stone at land speed.', { flags: () => ['burrowSpeed:30'], needs: ['earth-climb'] }),
  'stone-sculptor': W('Stone Sculptor', ['earth'], 5, 0, 'Stone shape at will.'),
  'seismic-master': W('Seismic Master', ['earth'], 9, 0, 'Earthquake.'),
  // Fire
  'heat-adaptation': W('Heat Adaptation', ['fire', 'water'], 1, 0, 'Endure elements (heat); fire resistance = 2x burn.', { resistances: (c) => ({ fire: 2 * burnNow(c) }) }),
  'cold-adaptation': W('Cold Adaptation', ['fire', 'water'], 1, 0, 'Endure elements (cold); cold resistance = 2x burn.', { resistances: (c) => ({ cold: 2 * burnNow(c) }) }),
  'fire-sculptor': W('Fire Sculptor', ['fire'], 1, 0, 'Move fires one 5-ft. square per level.'),
  'fires-fury': W("Fire's Fury", ['fire'], 1, 0, 'Add elemental overflow to fire blast damage again.', { flags: () => ['firesFury'] }),
  firesight: W('Firesight', ['fire'], 3, 0, 'See through fire, fog and smoke.'),
  'flame-jet': W('Flame Jet', ['fire'], 3, 0, 'Propel yourself up to 60 ft. in a straight line.'),
  'heat-wave': W('Heat Wave', ['fire'], 3, 1, 'An aura of heat gives a 20% miss chance to adjacent attackers.', { flags: (c) => (burnNow(c) > 0 ? ['concealment:20'] : []), needs: ['heat-adaptation', 'searing-flesh'] }),
  'smoke-storm': W('Smoke Storm', ['fire'], 3, 0, 'Pyrotechnics (smoke cloud).'),
  'flame-shield': W('Flame Shield', ['fire'], 5, 1, 'Fire shield (warm) while you have accepted burn.', { needs: ['searing-flesh'] }),
  'trail-of-flames': W('Trail of Flames', ['fire'], 5, 0, 'Leave a trail of fire as you move.'),
  'from-the-ashes': W('From the Ashes', ['fire'], 9, 2, 'When killed, burst into ash and reform 1 hour later.'),
  // Water
  slick: W('Slick', ['water'], 1, 0, 'Grease at will.'),
  icewalker: W('Icewalker', ['water'], 1, 0, 'Ignore slippery surfaces; immune to seasickness.'),
  'kinetic-healer': W('Kinetic Healer', ['water'], 1, 1, 'Touch: heal a willing creature as much as your simple blast\'s damage dice (you accept the burn).', { abilities: ['kinetic-healer'] }),
  'veil-of-mists': W('Veil of Mists', ['water'], 2, 0, 'Fog cloud / obscuring mist.'),
  'cold-snap': W('Cold Snap', ['water'], 3, 1, 'An aura of cold that slows nearby foes.', { needs: ['cold-adaptation', 'shroud-of-water'] }),
  'water-manipulator': W('Water Manipulator', ['water'], 3, 0, 'Control water.'),
  waterdancer: W('Waterdancer', ['water'], 3, 0, 'Swim speed equal to land speed.', { flags: () => ['swimSpeed:30'] }),
  watersense: W('Watersense', ['water'], 4, 0, 'Blindsense 30 ft. underwater.'),
  'ice-sculptor': W('Ice Sculptor', ['water'], 4, 0, 'Stone shape on ice and snow.'),
  'shimmering-mirage': W('Shimmering Mirage', ['water'], 5, 1, '20% concealment while you have accepted burn.', { flags: (c) => (burnNow(c) > 0 ? ['concealment:20'] : []), needs: ['shroud-of-water'] }),
  'ice-path': W('Ice Path', ['water'], 6, 0, 'Walk on air on a path of ice.', { needs: ['icewalker'] }),
  'tidal-wave': W('Tidal Wave', ['water'], 9, 1, 'A huge wave dealing blast damage in a line.'),
};

/** Minimum kineticist level for a wild talent or infusion of effective level n. */
const minLevelFor = (n) => (n <= 1 ? 1 : 2 * n);

/** Blasts a character knows: chosen simple blasts plus composites whose prerequisites are met. */
function knownBlasts(c) {
  const simple = [].concat(c.choices.blasts || []);
  const primary = c.choices.element;
  const expanded = [].concat(c.choices['expanded-element'] || []);
  const out = new Set(simple);
  for (const [id, b] of Object.entries(BLASTS)) {
    if (!b.composite) continue;
    if (b.primary ? primary === b.primary && expanded.includes(b.primary) : b.requires.every((r) => simple.includes(r))) out.add(id);
  }
  return [...out];
}

/** Elements the character can use (primary and expanded). */
function elementsOf(c) {
  return [c.choices.element, ...[].concat(c.choices['expanded-element'] || [])].filter(Boolean);
}

module.exports = { ELEMENTS, BLASTS, INFUSIONS, WILD_TALENTS, knownBlasts, elementsOf, minLevelFor };
