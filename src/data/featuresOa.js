'use strict';

const { mod } = require('../engine/modifiers');

/** Class features of the kineticist (Occult Adventures); see src/data/features.js for the format. */

const f = (name, description, extra = {}) => ({ name, description, ...extra });
const K = () => require('./kineticist');
const kl = (c) => c.prog('kineticistLevel');
const burnNow = (c) => c.resourcesUsed.burn || 0;

/** Defense talents in effect: the primary element's (2nd level) plus any taken with Expanded Defense. */
function defenses(c) {
  const { ELEMENTS, WILD_TALENTS } = K();
  const ids = [];
  if (ELEMENTS[c.choices.element]) ids.push(ELEMENTS[c.choices.element].defense);
  if (c.hasOption('wild-talent', 'expanded-defense') && ELEMENTS[c.choices.expandedDefense]) ids.push(ELEMENTS[c.choices.expandedDefense].defense);
  return ids.map((id) => WILD_TALENTS[id]);
}
const fromDefenses = (key) => (c) => defenses(c).flatMap((d) => (d[key] ? d[key](c) : []));

const FEATURES = {
  burn: f('Burn', 'Accept burn to power wild talents: each point deals 1 nonlethal damage per character level that only a night\'s rest heals. At most 1 burn per round (2 at 6th, +1 every three levels) and 3 + Con mod in total.', {
    resources: (c) => ({ burn: { max: 3 + Math.max(0, c.abilityMod('con')), per: 'day', unit: 'burn' } }),
  }),
  'elemental-focus': f('Elemental Focus', 'Choose a primary element (choices.element: air, earth, fire, water) and a simple blast of it (choices.blast); gain its class skills and basic utility talent.', { choice: 'element' }),
  'gather-power': f('Gather Power', 'Move action with both hands free: reduce the burn of a blast this round by 1; a full round reduces the next turn\'s blast by 2 (3 with a move action as well). Kinetic blast option gather: 1 | 2 | 3.'),
  'kinetic-blast': f('Kinetic Blast', 'Standard action, 30 ft.: physical blasts are ranged attacks for 1d6+1 + Con (+1d6+1 per two levels after 1st); energy blasts are ranged touch for 1d6 + 1/2 Con (+1d6 per two levels). Composite blasts double the dice and cost 2 burn. Damage is magic; counts as a weapon for Weapon Focus.', { abilities: ['kinetic-blast', 'gather-power'] }),
  infusion: f('Infusion', 'Learn a form or substance infusion to modify kinetic blasts (DC 10 + 1/2 level + Con; Dex for forms).', { choice: 'infusion' }),
  'utility-wild-talent': f('Utility Wild Talent', 'Learn a utility wild talent of your elements or a universal one.', { choice: 'wild-talent' }),
  'elemental-defense': f('Elemental Defense', 'Gain your element\'s defense wild talent (enveloping winds, flesh of stone, searing flesh or shroud of water).', {
    flags: fromDefenses('flags'), dr: fromDefenses('dr'), modifiers: fromDefenses('modifiers'),
  }),
  'elemental-overflow': f('Elemental Overflow', 'Kinetic blasts gain +1 attack and +2 damage per point of burn (maximum +1/+2 per three kineticist levels). At 6th level 3+ burn gives +2 size bonus to two physical scores (5+ burn at 11th: +4/+2/+2; 7+ at 16th: +6/+4/+2) and a 5% per burn chance to ignore critical hits and sneak attacks.', {
    modifiers: (c) => {
      const l = kl(c);
      const b = burnNow(c);
      const out = [];
      if (l >= 16 && b >= 7) out.push(mod('con', 6, 'size', 'Elemental overflow'), mod('dex', 4, 'size', 'Elemental overflow'), mod('str', 2, 'size', 'Elemental overflow'));
      else if (l >= 11 && b >= 5) out.push(mod('con', 4, 'size', 'Elemental overflow'), mod('dex', 2, 'size', 'Elemental overflow'), mod('str', 2, 'size', 'Elemental overflow'));
      else if (l >= 6 && b >= 3) out.push(mod('con', 2, 'size', 'Elemental overflow'), mod('dex', 2, 'size', 'Elemental overflow'));
      return out;
    },
    flags: (c) => (kl(c) >= 6 && burnNow(c) > 0 ? [`fortification:${5 * burnNow(c)}`] : []),
  }),
  'infusion-specialization': f('Infusion Specialization', 'The combined burn of infusions on a blast is reduced by 1 (2 at 8th, +1 every three levels).'),
  metakinesis: f('Metakinesis', 'Accept burn to empower (1 burn, 5th), maximize (2, 9th), quicken (3, 13th) or double (4, 17th) a kinetic blast. Kinetic blast option metakinesis: "empower" | "maximize" | "quicken" | "twice".'),
  'internal-buffer': f('Internal Buffer', 'Full-round action: accept 1 burn to store a point (max 1, 2 at 11th, 3 at 16th); spend a point to avoid 1 burn on a wild talent (option buffer: true).', {
    abilities: ['internal-buffer'], resources: (c) => ({ internalBuffer: { max: c.prog('internalBufferMax'), per: 'day' } }),
  }),
  'expanded-element': f('Expanded Element', 'Choose another element (or your own): gain one of its simple blasts (choices.expandedBlast), its basic talent and composite blasts you qualify for. Talents of a new element are taken as if 4 levels lower.', { choice: 'expanded-element' }),
  'expanded-element-15': f('Expanded Element', 'Choose another expanded element (your primary element again grants +1 on attack, damage, caster level and DCs of its talents).', { choice: 'expanded-element' }),
  supercharge: f('Supercharge', 'Gather power as a move action reduces burn by 2 (a full round by 3).'),
  'composite-specialization': f('Composite Specialization', 'Composite blasts cost 1 less burn.'),
  'metakinetic-master': f('Metakinetic Master', 'Choose one metakinesis: it costs 1 less burn (choices.metakineticMaster).'),
  omnikinesis: f('Omnikinesis', 'Accept 1 extra burn to use any blast you don\'t know; standard action and 1 burn: swap a wild talent for 24 hours.'),
};

module.exports = { FEATURES, defenses };
