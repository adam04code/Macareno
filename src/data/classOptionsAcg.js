'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Selectable options for the Advanced Class Guide classes (arcanist
 * exploits, bloodrager bloodlines, shaman spirits and hexes, slayer talents,
 * warpriest blessings). Same option format as src/data/classOptions.js.
 */

const o = (name, description, extra = {}) => ({ name, description, ...extra });
const raging = (c) => c.hasFlag('raging');
const bl = (c) => c.prog('bloodragerBloodlineLevel');

// ---------------------------------------------------------------- Arcanist
const ARCANIST_EXPLOITS = {
  'acid-jet': o('Acid Jet', '1 point: ranged touch (30 ft.) for 1d6 + Cha acid (+1d6 per two levels after 1st, max 10d6); sickened 1d4 rounds (Fort negates).', { abilities: ['acid-jet'] }),
  'arcane-barrier': o('Arcane Barrier', '1 point, swift: temporary hp equal to arcanist level + Cha for 1 minute per level.', { abilities: ['arcane-barrier'] }),
  'arcane-weapon': o('Arcane Weapon', '1 point, standard: weapon gains +1 enhancement (+2 at 9th, +3 at 13th, +4 at 17th) for Cha mod minutes.', { minLevel: 5, abilities: ['arcane-weapon'] }),
  'bloodline-development': o('Bloodline Development', 'Gain a sorcerer bloodline\'s 1st-level power (arcanist level - 2 as sorcerer level).'),
  'consume-magic-items': o('Consume Magic Items', 'Move action: drain a potion, scroll, wand charge or staff charge for points equal to half its spell level.'),
  counterspell: o('Counterspell', '1 point, immediate: counter a spell by expending a slot one level higher (+5 on the dispel check).'),
  'dimensional-slide': o('Dimensional Slide', '1 point, move action: teleport up to 10 ft. per level without provoking.', { minLevel: 3, abilities: ['dimensional-slide'] }),
  'energy-shield': o('Energy Shield', '1 point, standard: resistance 10 to one energy (+5 per five levels, max 30) for 1 minute per level.', { abilities: ['energy-shield'] }),
  familiar: o('Familiar', 'Gain a familiar (arcanist level = wizard level).', { onPick: (c, choices) => { c.choices.familiar = choices.familiar || 'toad'; return []; } }),
  'flame-arc': o('Flame Arc', '1 point: 30-ft. line of fire, 1d6 + Cha (+1d6 per two levels after 1st, max 10d6), Reflex half.', { abilities: ['flame-arc'] }),
  'force-strike': o('Force Strike', '1 point: unerring force missile for 1d4 + arcanist level damage.', { abilities: ['force-strike'] }),
  'holy-water-jet': o('Holy Water Jet', '1 point: 30-ft. line of holy water, 1d8 + Cha (+1d8 per two levels) to undead and evil outsiders, Reflex half.', { abilities: ['holy-water-jet'] }),
  'ice-missile': o('Ice Missile', '1 point: ranged touch (30 ft.) for 1d6 + Cha cold (+1d6 per two levels after 1st, max 10d6); staggered 1 round (Fort negates).', { abilities: ['ice-missile'] }),
  'item-crafting': o('Item Crafting', 'Gain an item creation feat as a bonus feat.', { bonusFeat: 'item-creation' }),
  'lightning-lance': o('Lightning Lance', '1 point: ranged touch (30 ft.) for 1d6 + Cha electricity (+1d6 per two levels after 1st, max 10d6); dazzled 1 round (Fort negates).', { abilities: ['lightning-lance'] }),
  'metamagic-knowledge': o('Metamagic Knowledge', 'Gain a metamagic feat as a bonus feat.', { bonusFeat: 'metamagic' }),
  metamixing: o('Metamixing', '1 point: add a metamagic feat you know to a spell without increasing its casting time.', { flags: () => ['metamixing'] }),
  'potent-magic': o('Potent Magic', 'Reservoir points spent to boost caster level or DC grant +2 instead of +1.', { flags: () => ['potentMagic'] }),
  'quick-study': o('Quick Study', '1 point, full-round: swap a prepared spell for another spellbook spell of the same level.'),
  'school-understanding': o('School Understanding', 'Choose an arcane school; 1 point: use its 1st-level power for Cha mod rounds.'),
  'spell-disruption': o('Spell Disruption', '1 point: suppress one spell on a creature for Cha mod rounds (targeted dispel check).'),
  'spell-tinkerer': o('Spell Tinkerer', '1 point: lengthen or shorten a spell effect\'s remaining duration by 50%.'),
  'swift-consume': o('Swift Consume', 'Consume spells and consume magic items are swift actions.', { flags: () => ['swiftConsume'] }),
  'wooden-flesh': o('Wooden Flesh', '1 point: +2 natural armor and DR/slashing equal to Cha mod for 1 minute per level.', { abilities: ['wooden-flesh'] }),
  // Greater exploits (11th)
  'alter-enhancements': o('Alter Enhancements', 'Greater exploit: swap a weapon or armor special ability for another of equal cost.', { minLevel: 11, greater: true, requires: ['arcane-weapon'] }),
  'burning-flame': o('Burning Flame', 'Greater exploit: flame arc (2 points) sets creatures that fail their save on fire (3d6 per round).', { minLevel: 11, greater: true, requires: ['flame-arc'] }),
  'dancing-electricity': o('Dancing Electricity', 'Greater exploit: lightning lance (2 points) arcs to adjacent creatures for half damage.', { minLevel: 11, greater: true, requires: ['lightning-lance'] }),
  'greater-counterspell': o('Greater Counterspell', 'Greater exploit: counter with any slot of the countered spell\'s level or higher.', { minLevel: 11, greater: true, requires: ['counterspell'] }),
  'greater-metamagic-knowledge': o('Greater Metamagic Knowledge', 'Greater exploit: change the metamagic knowledge feat each day.', { minLevel: 11, greater: true, requires: ['metamagic-knowledge'] }),
  'greater-spell-disruption': o('Greater Spell Disruption', 'Greater exploit: spell disruption becomes a targeted dispel with Cha bonus.', { minLevel: 11, greater: true, requires: ['spell-disruption'] }),
  'icy-tomb': o('Icy Tomb', 'Greater exploit: ice missile (2 points) entangles the target and deals 1 Dex damage per round.', { minLevel: 11, greater: true, requires: ['ice-missile'] }),
  'lingering-acid': o('Lingering Acid', 'Greater exploit: acid jet (2 points) keeps burning for half damage each round.', { minLevel: 11, greater: true, requires: ['acid-jet'] }),
  'redirect-spell': o('Redirect Spell', 'Greater exploit: take control of another caster\'s directable spell for 1 round.', { minLevel: 11, greater: true }),
  'siphon-spell': o('Siphon Spell', 'Greater exploit: a strong spell disruption grants 1-2 reservoir points.', { minLevel: 11, greater: true, requires: ['greater-spell-disruption'] }),
  'spell-thief': o('Spell Thief', 'Greater exploit: steal a spell affecting a creature.', { minLevel: 11, greater: true }),
};

// ---------------------------------------------------------------- Bloodrager
// Bloodline powers at 1st, 4th, 8th, 12th, 16th and 20th; spells at 7th/10th/13th/16th; feats from the list at 6th + every 3.
const claws = (c, energyAt, energy = 'fire') => {
  const L = bl(c);
  return [{ name: 'Claw', damage: L >= 8 ? '1d8' : '1d6', type: ['slashing'], count: 2, magic: L >= 4, extra: energyAt && L >= energyAt ? { dice: '1d6', type: energy } : null }];
};
const BLOODRAGER_BLOODLINES = {
  aberrant: o('Aberrant', 'Staggering Strike (1st: crits stagger 1 round, Fort negates), Abnormal Reach (4th: +5 ft. reach), Aberrant Fortitude (8th: immune to sickened and nauseated), Unusual Anatomy (12th: 50% fortification), Aberrant Resistance (16th: immune to disease, exhaustion, fatigue, poison, staggered), Aberrant Form (20th: immune to crits and sneak attacks, blindsight 60 ft., +1 DR).', {
    feats: ['combat-reflexes', 'great-fortitude', 'improved-disarm', 'improved-grapple', 'improved-initiative', 'improved-unarmed-strike', 'iron-will'],
    spells: { 7: 'enlarge-person', 10: 'see-invisibility', 13: 'displacement', 16: 'black-tentacles' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [] };
      if (raging(c)) {
        if (L >= 8) out.flags.push('immune:sickened', 'immune:nauseated');
        if (L >= 12) out.flags.push('fortification:50');
        if (L >= 16) out.flags.push('immune:disease', 'immune:exhausted', 'immune:fatigued', 'immune:poison', 'immune:staggered');
      }
      if (L >= 20) out.flags.push('immuneCrit', 'immune:precision', 'blindsight:60');
      return out;
    },
  }),
  abyssal: o('Abyssal', 'Claws (1st: two 1d6 claws while raging, 1d8 at 8th, flaming at 12th), Demonic Bulk (4th: enlarge person when raging), Demon Resistances (8th: acid, cold, fire 5; 10 at 16th), Abyssal Bloodrage (12th: +2 more Str, -4 AC; +4 at 16th, +6 at 20th), Demonic Aura (16th: 2d6 + Con fire to adjacent foes), Demonic Immunities (20th: electricity and poison).', {
    feats: ['cleave', 'great-fortitude', 'improved-bull-rush', 'improved-sunder', 'intimidating-prowess', 'power-attack', 'toughness'],
    spells: { 7: 'ray-of-enfeeblement', 10: 'bulls-strength', 13: 'rage', 16: 'stoneskin' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [], resistances: {}, naturalAttacks: [] };
      if (raging(c)) {
        out.naturalAttacks.push(...claws(c, 12));
        if (L >= 8) Object.assign(out.resistances, { acid: L >= 16 ? 10 : 5, cold: L >= 16 ? 10 : 5, fire: L >= 16 ? 10 : 5 });
        if (L >= 12) out.modifiers.push(mod('str', L >= 20 ? 6 : L >= 16 ? 4 : 2, 'morale', 'Abyssal bloodrage'), mod('ac', -2, 'untyped', 'Abyssal bloodrage'));
      }
      if (L >= 20) out.flags.push('immune:poison');
      if (L >= 20) out.resistances.electricity = Infinity;
      return out;
    },
  }),
  arcane: o('Arcane', 'Disruptive Bloodrage (1st: +2 DC to cast defensively near you), Arcane Bloodrage (4th: blur, protection from arrows, resist energy or spider climb while raging), Greater Arcane Bloodrage (8th: displacement or haste), Caster\'s Scourge (12th), True Arcane Bloodrage (16th: beast shape IV, form of the dragon I or transformation), Caster\'s Bane (20th).', {
    feats: ['combat-reflexes', 'disruptive', 'improved-initiative', 'iron-will', 'power-attack', 'quick-draw', 'spellbreaker'],
    spells: { 7: 'magic-missile', 10: 'invisibility', 13: 'lightning-bolt', 16: 'dimension-door' },
    powers: (c) => ({ flags: raging(c) ? ['disruptive'] : [], modifiers: [] }),
    rageSpells: (c) => [...(bl(c) >= 4 ? ['blur', 'protection-from-arrows', 'resist-energy', 'spider-climb'] : []), ...(bl(c) >= 8 ? ['displacement', 'haste'] : []), ...(bl(c) >= 16 ? ['beast-shape-iv', 'form-of-the-dragon-i', 'transformation'] : [])],
  }),
  celestial: o('Celestial', 'Angelic Attacks (1st: melee attacks good-aligned, +1d6 vs evil outsiders), Celestial Resistances (4th: acid and cold 5; 10 at 12th), Conviction (8th: reroll once per rage), Wings of Heaven (12th: fly 60, 80 at 20th), Angelic Protection (16th: +4 deflection and resistance vs evil), Ascension (20th).', {
    feats: ['dodge', 'improved-initiative', 'iron-will', 'mobility', 'mounted-combat', 'ride-by-attack', 'weapon-focus'],
    spells: { 7: 'bless', 10: 'resist-energy', 13: 'heroism', 16: 'holy-smite' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [], resistances: {} };
      if (raging(c)) {
        out.flags.push('weaponsGood');
        if (L >= 4) Object.assign(out.resistances, { acid: L >= 12 ? 10 : 5, cold: L >= 12 ? 10 : 5 });
        if (L >= 12) out.flags.push(L >= 20 ? 'fly:80' : 'fly:60');
        if (L >= 16) out.modifiers.push(mod('ac', 4, 'deflection', 'Angelic protection', ['vsEvil']), mod('save', 4, 'resistance', 'Angelic protection', ['vsEvil']));
      }
      if (L >= 20) Object.assign(out.resistances, { acid: Infinity, cold: Infinity, electricity: 10, fire: 10 });
      return out;
    },
  }),
  destined: o('Destined', 'Destined Strike (1st: 3/day insight +1/2 level on one attack), Fated Bloodrager (4th: +1 luck AC and saves, +1 per four levels), Certain Strike (8th), Defy Death (12th), Unstoppable (16th: auto-confirm crits), Victory or Death (20th).', {
    feats: ['diehard', 'endurance', 'improved-initiative', 'intimidating-prowess', 'leadership', 'lightning-reflexes', 'weapon-focus'],
    spells: { 7: 'shield', 10: 'blur', 13: 'protection-from-energy', 16: 'freedom-of-movement' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [] };
      if (raging(c) && L >= 4) {
        const b = Math.min(5, Math.floor(L / 4));
        out.modifiers.push(mod('ac', b, 'luck', 'Fated bloodrager'), mod('save', b, 'luck', 'Fated bloodrager'));
      }
      if (raging(c) && L >= 16) out.flags.push('autoConfirmCrits');
      if (L >= 20) out.flags.push('immune:paralysis', 'immune:petrified', 'immune:stunned', 'immune:dazed', 'immune:staggered');
      return out;
    },
  }),
  draconic: o('Draconic', 'Claws (1st: two 1d6 claws while raging; magic at 4th, 1d8 at 8th, +1d6 energy at 12th), Draconic Resistance (4th: resist 5 and +1 natural armor; 10/+2 at 8th, +4 at 16th), Breath Weapon (8th: 1d6/level, 1/day; 2/day at 16th, 3/day at 20th), Dragon Wings (12th: fly 60, 80 at 16th), Dragon Form (16th), Power of Wyrms (20th).', {
    feats: ['blind-fight', 'cleave', 'great-fortitude', 'improved-initiative', 'power-attack', 'skill-focus', 'toughness'],
    spells: { 7: 'shield', 10: 'resist-energy', 13: 'fly', 16: 'fear' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [], resistances: {}, naturalAttacks: [], abilities: [] };
      if (raging(c)) {
        out.naturalAttacks.push(...claws(c, 12, c.dragonEnergy()));
        if (L >= 4) {
          out.resistances[c.dragonEnergy()] = L >= 8 ? 10 : 5;
          out.modifiers.push(mod('ac', L >= 16 ? 4 : L >= 8 ? 2 : 1, 'natural', 'Draconic resistance'));
        }
        if (L >= 12) out.flags.push(L >= 16 ? 'fly:80' : 'fly:60');
      }
      if (L >= 8) out.abilities.push('bloodrager-breath');
      if (L >= 20) { out.resistances[c.dragonEnergy()] = Infinity; out.flags.push('immune:paralysis', 'immune:sleep', 'blindsense:60'); }
      return out;
    },
  }),
  elemental: o('Elemental', 'Elemental Strikes (1st: 3/day swift, +1d6 energy on melee attacks for 1 round; 5/day at 8th), Elemental Resistance (4th: resist 10), Elemental Movement (8th), Power of the Elements (12th), Elemental Form (16th), Elemental Body (20th).', {
    feats: ['cleave', 'dodge', 'great-fortitude', 'improved-initiative', 'lightning-reflexes', 'power-attack', 'weapon-focus'],
    spells: { 7: 'burning-hands', 10: 'scorching-ray', 13: 'protection-from-energy', 16: 'elemental-body-i' },
    powers: (c) => {
      const L = bl(c);
      const energy = { air: 'electricity', earth: 'acid', fire: 'fire', water: 'cold' }[c.choices.element] || c.choices.element || 'fire';
      const out = { flags: [], modifiers: [], resistances: {}, abilities: ['elemental-strikes'] };
      if (raging(c) && L >= 4) out.resistances[energy] = 10;
      if (raging(c) && L >= 8 && c.choices.element === 'air') out.flags.push('fly:60');
      if (raging(c) && L >= 8 && c.choices.element === 'fire') out.modifiers.push(mod('speed', 30, 'untyped', 'Elemental movement'));
      if (L >= 20) { out.resistances[energy] = Infinity; out.flags.push('immuneCrit', 'immune:precision'); }
      return out;
    },
  }),
  fey: o('Fey', 'Confusing Critical (1st: crits confuse 1 round, Will negates), Leaping Charger (4th), Blurring Movement (8th: blur after moving 10 ft.), Quickling Bloodrage (12th: hasted while raging), One with Nature (16th), Fury of the Fey (20th: bane on all melee attacks vs a chosen type).', {
    feats: ['combat-reflexes', 'dodge', 'improved-initiative', 'intimidating-prowess', 'lightning-reflexes', 'mobility', 'step-up'],
    spells: { 7: 'entangle', 10: 'hideous-laughter', 13: 'haste', 16: 'confusion' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [] };
      if (raging(c) && L >= 12) {
        out.flags.push('hasted');
        out.modifiers.push(mod('attack', 1, 'untyped', 'Quickling bloodrage'), mod('ac', 1, 'dodge', 'Quickling bloodrage'), mod('save.ref', 1, 'dodge', 'Quickling bloodrage'), mod('speed', 30, 'enhancement', 'Quickling bloodrage'));
      }
      return out;
    },
  }),
  infernal: o('Infernal', 'Hellfire Strike (1st: 3/day swift, melee attacks are flaming for 1 round; 5/day and flaming burst at 12th), Infernal Resistance (4th: fire 5 and +2 vs poison; 10/+4 at 8th), Diabolical Arrogance (8th: +4 vs enchantment and fear), Dark Wings (12th: fly 60, 80 at 16th), Hellfire Charge (16th), Fiend of the Pit (20th).', {
    feats: ['blind-fight', 'combat-reflexes', 'deceitful', 'improved-disarm', 'improved-sunder', 'intimidating-prowess', 'iron-will'],
    spells: { 7: 'protection-from-good', 10: 'scorching-ray', 13: 'suggestion', 16: 'fire-shield' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [], resistances: {}, abilities: ['hellfire-strike'] };
      if (raging(c)) {
        if (L >= 4) { out.resistances.fire = L >= 8 ? 10 : 5; out.modifiers.push(mod('save', L >= 8 ? 4 : 2, 'untyped', 'Infernal resistance', ['poison'])); }
        if (L >= 8) out.modifiers.push(mod('save', 4, 'untyped', 'Diabolical arrogance', ['enchantment', 'fear']));
        if (L >= 12) out.flags.push(L >= 16 ? 'fly:80' : 'fly:60');
      }
      if (L >= 20) { Object.assign(out.resistances, { fire: Infinity, acid: 10, cold: 10 }); out.flags.push('immune:poison', 'seeInDarkness'); }
      return out;
    },
  }),
  undead: o('Undead', 'Frightful Charger (1st: charge hits shake the target), Ghost Strike (4th: ghost touch melee attacks), Death\'s Gift (8th: cold resistance 10, DR 10/— vs nonlethal), Frightful Strikes (12th), Incorporeal Bloodrager (16th), One Foot in the Grave (20th).', {
    feats: ['diehard', 'dodge', 'endurance', 'intimidating-prowess', 'iron-will', 'mobility', 'toughness'],
    spells: { 7: 'chill-touch', 10: 'false-life', 13: 'vampiric-touch', 16: 'enervation' },
    powers: (c) => {
      const L = bl(c);
      const out = { flags: [], modifiers: [], resistances: {} };
      if (raging(c) && L >= 4) out.flags.push('ghostTouchWeapons');
      if (raging(c) && L >= 8) out.resistances.cold = 10;
      if (L >= 20) { out.resistances.cold = Infinity; out.flags.push('immune:nonlethal', 'immune:paralysis', 'immune:sleep'); }
      return out;
    },
  }),
};

// Bloodlines that need a sub-choice (dragon type, element).
BLOODRAGER_BLOODLINES.draconic.onPick = (c, choices) => {
  const { DRAGON_TYPES } = require('./classOptions');
  if (!DRAGON_TYPES[choices.dragonType]) return [`Choose a dragon type (choices.dragonType: ${Object.keys(DRAGON_TYPES).join(', ')})`];
  c.choices.dragonType = choices.dragonType;
  return [];
};
BLOODRAGER_BLOODLINES.elemental.onPick = (c, choices) => {
  if (!['air', 'earth', 'fire', 'water'].includes(choices.element)) return ['Choose an element (choices.element: air, earth, fire, water)'];
  c.choices.element = choices.element;
  return [];
};

// ---------------------------------------------------------------- Hunter animal focus
const ANIMAL_ASPECTS = {
  bat: { name: 'Bat', build: (l) => ({ flags: l >= 15 ? ['darkvision:90', 'blindsense:10'] : [`darkvision:${l >= 8 ? 90 : 60}`] }) },
  bear: { name: 'Bear', build: (l) => ({ modifiers: [mod('con', l >= 15 ? 6 : l >= 8 ? 4 : 2, 'enhancement', 'Animal focus (bear)')] }) },
  bull: { name: 'Bull', build: (l) => ({ modifiers: [mod('str', l >= 15 ? 6 : l >= 8 ? 4 : 2, 'enhancement', 'Animal focus (bull)')] }) },
  falcon: { name: 'Falcon', build: (l) => ({ modifiers: [mod('skill.perception', l >= 15 ? 8 : l >= 8 ? 6 : 4, 'competence', 'Animal focus (falcon)')] }) },
  frog: { name: 'Frog', build: (l) => ({ modifiers: [mod('skill.swim', l >= 15 ? 8 : l >= 8 ? 6 : 4, 'competence', 'Animal focus (frog)'), mod('skill.acrobatics', l >= 15 ? 8 : l >= 8 ? 6 : 4, 'competence', 'Animal focus (frog)', ['jump'])] }) },
  monkey: { name: 'Monkey', build: (l) => ({ modifiers: [mod('skill.climb', l >= 15 ? 8 : l >= 8 ? 6 : 4, 'competence', 'Animal focus (monkey)')] }) },
  mouse: { name: 'Mouse', build: (l) => ({ flags: l >= 12 ? ['evasion', 'improvedEvasion'] : ['evasion'] }) },
  owl: { name: 'Owl', build: (l) => ({ modifiers: [mod('skill.stealth', l >= 15 ? 8 : l >= 8 ? 6 : 4, 'competence', 'Animal focus (owl)')] }) },
  snake: { name: 'Snake', build: (l) => { const b = l >= 15 ? 6 : l >= 8 ? 4 : 2; return { modifiers: [mod('attack', b, 'insight', 'Animal focus (snake)', ['aoo']), mod('ac', b, 'dodge', 'Animal focus (snake)', ['aooMovement'])] }; } },
  stag: { name: 'Stag', build: (l) => ({ modifiers: [mod('speed', l >= 15 ? 20 : l >= 8 ? 10 : 5, 'enhancement', 'Animal focus (stag)')] }) },
  tiger: { name: 'Tiger', build: (l) => ({ modifiers: [mod('dex', l >= 15 ? 6 : l >= 8 ? 4 : 2, 'enhancement', 'Animal focus (tiger)')] }) },
  wolf: { name: 'Wolf', build: () => ({ flags: ['scent'] }) },
};

// ---------------------------------------------------------------- Shaman
const sl = (c) => c.prog('shamanHexLevel');
const SPIRITS = {
  battle: o('Battle', 'Battle Spirit (allies within 30 ft. gain +1 morale on attack and weapon damage, +2 at 8th, +3 at 16th, for 3 + Cha rounds/day); Enemies\' Bane (8th: weapon gains bane for 1 minute); Paragon of Battle (16th: enlarge person and deadly juggernaut); manifestation (20th).', {
    spells: ['enlarge-person', 'fog-cloud', 'magic-vestment', 'wall-of-fire', 'righteous-might', 'mass-bulls-strength', 'control-weather', 'earthquake', 'storm-of-vengeance'],
    abilities: ['battle-spirit'], greater: ['enemies-bane'], hexes: ['battle-master', 'battle-ward', 'curse-of-suffering', 'eyes-of-battle', 'hampering-hex'],
  }),
  bones: o('Bones', 'Touch of the Grave (melee touch 1d4 + 1 per two levels negative energy, 3 + Cha/day); Shard Soul (8th: DR 3/magic, bone burst); Shedding Form (16th: incorporeal); manifestation (20th).', {
    spells: ['cause-fear', 'false-life', 'animate-dead', 'fear', 'slay-living', 'circle-of-death', 'control-undead', 'horrid-wilting', 'wail-of-the-banshee'],
    abilities: ['touch-of-the-grave'], greater: ['shard-soul'], hexes: ['bone-lock', 'bone-ward', 'deathly-being', 'fearful-gaze', 'grave-sight'],
    greaterDr: { amount: (c) => 3 + Math.floor((c.classLevel('shaman') - 8) / 4), bypass: 'magic' },
  }),
  flame: o('Flame', 'Touch of Flames (melee touch 1d6 + 1 per two levels fire, 3 + Cha/day); Fiery Soul (8th: fire resistance 10 and a 15-ft. fire cone); Elemental Form (16th); manifestation (20th).', {
    spells: ['burning-hands', 'resist-energy', 'fireball', 'wall-of-fire', 'summon-monster-v', 'fire-seeds', 'fire-storm', 'incendiary-cloud', 'fiery-body'],
    abilities: ['touch-of-flames'], greater: ['fiery-soul'], hexes: ['cinder-dance-hex', 'fire-nimbus', 'flame-curse', 'gaze-of-flames', 'ward-of-flames'], greaterResist: { fire: 10 },
  }),
  heavens: o('Heavens', 'Stardust (a foe sheds light and takes -1 on attacks and Perception, -1 per four levels; 3 + Cha/day); Void Adaptation (8th); Phantasmagoric Display (16th); manifestation (20th).', {
    spells: ['color-spray', 'hypnotic-pattern', 'daylight', 'rainbow-pattern', 'overland-flight', 'chain-lightning', 'prismatic-spray', 'sunburst', 'meteor-swarm'],
    abilities: ['stardust'], hexes: ['enveloping-void', 'guiding-star', 'heavens-leap', 'lure-of-the-heavens', 'starburn'],
  }),
  life: o('Life', 'Channel (channel positive energy as a cleric, 1 + Cha/day); Healer\'s Touch (8th: +4 Heal, stabilize six creatures); Quick Healing (16th: swift channel or cure, Cha/day); manifestation (20th).', {
    spells: ['detect-undead', 'lesser-restoration', 'neutralize-poison', 'restoration', 'breath-of-life', 'heal', 'greater-restoration', 'mass-heal', 'true-resurrection'],
    abilities: ['channel-energy-shaman'], hexes: ['curse-of-suffering', 'deny-succor', 'enhanced-cures-hex', 'life-link', 'life-sight'],
  }),
  lore: o('Lore', 'Monstrous Insight (identify a creature with +level insight and gain +2 insight attack and AC against it for 1 minute, 3 + Cha/day); Automatic Writing (8th); Perfect Knowledge (16th); manifestation (20th).', {
    spells: ['identify', 'tongues', 'locate-object', 'legend-lore', 'contact-other-plane', 'mass-owls-wisdom', 'vision', 'moment-of-prescience', 'time-stop'],
    abilities: ['monstrous-insight'], hexes: ['arcane-enlightenment', 'benefit-of-wisdom', 'brain-drain-hex', 'confusion-curse', 'share-knowledge'],
  }),
  nature: o('Nature', 'Storm Burst (the target has a 20% miss chance on all its attacks for 1/2 level rounds, 3 + Cha/day); Spirit of Nature (8th); Companion Animal (16th); manifestation (20th).', {
    spells: ['charm-animal', 'barkskin', 'speak-with-plants', 'grove-of-respite', 'awaken', 'stone-tell', 'creeping-doom', 'animal-shapes', 'world-wave'],
    abilities: ['storm-burst-shaman'], hexes: ['entangling-curse', 'erosion-curse', 'friend-to-animals', 'speak-with-animals-hex', 'stormwalker'],
  }),
  stone: o('Stone', 'Touch of Acid (melee touch 1d6 + 1 per two levels acid, 3 + Cha/day); Body of Earth (8th: DR 2/adamantine and a stone burst); Elemental Form (16th); manifestation (20th).', {
    spells: ['magic-stone', 'stone-call', 'meld-into-stone', 'wall-of-stone', 'stoneskin', 'stone-tell', 'statue', 'repel-metal-or-stone', 'clashing-rocks'],
    abilities: ['touch-of-acid-shaman'], hexes: ['crystal-sight', 'lodestone', 'metal-curse', 'stone-stability-hex', 'ward-of-stone'],
    greaterDr: { amount: (c) => 2 + Math.floor((c.classLevel('shaman') - 8) / 4), bypass: 'adamantine' },
  }),
  waves: o('Waves', 'Wave Strike (melee touch 1d6 + 1 per two levels nonlethal and push 5 ft., 3 + Cha/day); Fluid Mastery (8th: swim speed and a cold cone); Elemental Form (16th); manifestation (20th).', {
    spells: ['touch-of-the-sea', 'slipstream', 'water-breathing', 'wall-of-ice', 'geyser', 'fluid-form', 'vortex', 'seamantle', 'tsunami'],
    abilities: ['wave-strike'], hexes: ['beckoning-chill', 'crashing-waves', 'fluid-magic', 'mists-shroud', 'water-sight'],
  }),
  wind: o('Wind', 'Shocking Touch (melee touch 1d6 + 1 per two levels electricity, 3 + Cha/day); Spark Soul (8th: electricity resistance 10 and a lightning line); Elemental Form (16th); manifestation (20th).', {
    spells: ['alter-winds', 'gust-of-wind', 'cloak-of-winds', 'river-of-wind', 'control-winds', 'sirocco', 'control-weather', 'whirlwind', 'winds-of-vengeance'],
    abilities: ['shocking-touch'], hexes: ['air-barrier-hex', 'sparking-aura', 'vortex-spells', 'wind-sight', 'wind-ward'], greaterResist: { electricity: 10 },
  }),
};

// Shaman hexes: general hexes (any spirit) and spirit hexes (validated against the shaman's spirits).
const spiritHex = (spirit, name, description, extra = {}) => o(name, description, { spirit, ...extra });
const SHAMAN_HEXES = {
  chant: o('Chant', 'Move action: extend charm, evil eye, fortune, fury and misfortune on creatures within 30 ft. by 1 round.', { abilities: ['cackle'] }),
  'charm-shaman': o('Charm', 'Improve an animal or humanoid\'s attitude one step (two at 8th) for Wis mod rounds (Will negates).', { abilities: ['hex-charm'] }),
  'draconic-resilience': o('Draconic Resilience', 'Touched creature is immune to magical sleep (and paralysis at 7th) for rounds equal to your level.'),
  'evil-eye-shaman': o('Evil Eye', 'Target takes -2 (-4 at 8th) on AC, ability checks, attacks, saves or skill checks for 3 + Wis rounds (1 round on a Will save).', { abilities: ['evil-eye'] }),
  fetish: o('Fetish', 'Craft Wondrous Item as a bonus feat and +4 insight on Spellcraft to identify items.', { grantsFeats: ['craft-wondrous-item'] }),
  'fortune-shaman': o('Fortune', 'Ally rolls twice and takes the better result once per round for 1 round (+1 at 8th and 16th).', { abilities: ['fortune'] }),
  fury: o('Fury', 'Ally gains +2 morale on attacks and +2 resistance vs fear for Wis mod rounds (+1 at 8th and 16th).', { abilities: ['fury'] }),
  'healing-shaman': o('Healing', 'Touch: cure light wounds (cure moderate at 5th); once per day per creature.', { abilities: ['hex-healing'] }),
  'intimidating-display': o('Intimidating Display', 'Dazzling Display as a bonus feat, usable without a weapon.', { grantsFeats: ['dazzling-display'] }),
  'misfortune-shaman': o('Misfortune', 'Creature rolls twice and takes the worse result for 1 round (+1 at 8th and 16th); Will negates.', { abilities: ['misfortune'] }),
  secret: o('Secret', 'Gain a metamagic feat as a bonus feat.', { bonusFeat: 'metamagic' }),
  shapeshift: o('Shapeshift', 'Alter self for minutes per day equal to your level (beast shape I-IV at 8th, 12th, 16th, 20th).'),
  'slumber-shaman': o('Slumber', 'Creature within 30 ft. falls asleep for rounds equal to your level (Will negates).', { abilities: ['slumber'] }),
  'tongues-shaman': o('Tongues', 'Comprehend languages for minutes per day equal to your level; tongues at 5th.'),
  'ward-shaman': o('Ward', 'Ally gains +2 deflection AC and +2 resistance on saves until hit or failing a save (+1 at 8th and 16th).', { abilities: ['ward'] }),
  'wings-shaman': o('Wings', 'Grow wings for minutes per day equal to your level (fly 60 ft. from 7th).', { abilities: ['hex-flight'] }),
  // Spirit hexes
  'battle-master': spiritHex('battle', 'Battle Master', 'One extra attack of opportunity per round; Weapon Specialization at 8th and Greater Weapon Focus at 16th with a chosen weapon.'),
  'battle-ward': spiritHex('battle', 'Battle Ward', 'Touched creature gains +3 deflection AC against the next attacks (+4 at 8th, +5 at 16th), fading by 1 per attack.', { abilities: ['battle-ward'] }),
  'curse-of-suffering': spiritHex('battle', 'Curse of Suffering', 'Creature within 30 ft. takes +1 from bleed and only half healing for rounds equal to your level.'),
  'eyes-of-battle': spiritHex('battle', 'Eyes of Battle', 'Swift: +10 insight on Perception to find invisible creatures, or ignore partial cover on your next attack.'),
  'hampering-hex': spiritHex('battle', 'Hampering Hex', 'Creature within 30 ft. takes -2 AC and CMD (-4 at 8th) for rounds equal to your level (1 round on a Will save).', { abilities: ['hampering-hex'] }),
  'bone-lock': spiritHex('bones', 'Bone Lock', 'Creature within 30 ft. is staggered 1 round (Fort negates; longer at 8th and 16th).', { abilities: ['bone-lock'] }),
  'bone-ward': spiritHex('bones', 'Bone Ward', 'Touched ally gains +2 deflection AC (+3 at 8th, +4 at 16th).', { abilities: ['bone-ward'] }),
  'deathly-being': spiritHex('bones', 'Deathly Being', 'Healed by negative energy and harmed by positive energy as an undead; +4 vs death and energy drain at 8th.', { flags: () => ['negativeEnergyAffinity'] }),
  'fearful-gaze': spiritHex('bones', 'Fearful Gaze', 'Creature within 30 ft. is shaken 1 round (frightened at 8th, panicked at 16th); Will negates.', { abilities: ['fearful-gaze'] }),
  'grave-sight': spiritHex('bones', 'Grave Sight', 'See the life status of creatures within 30 ft.'),
  'cinder-dance-hex': spiritHex('flame', 'Cinder Dance', '+10 ft. speed; Nimble Moves at 5th and Acrobatic Steps at 10th.', { modifiers: () => [mod('speed', 10, 'untyped', 'Cinder dance')] }),
  'fire-nimbus': spiritHex('flame', 'Fire Nimbus', 'Target sheds light, loses concealment and takes -2 on saves vs fire for rounds equal to your level (Will negates).', { abilities: ['fire-nimbus'] }),
  'flame-curse': spiritHex('flame', 'Flame Curse', 'Target becomes vulnerable to fire until the end of your next turn.', { abilities: ['flame-curse'] }),
  'gaze-of-flames': spiritHex('flame', 'Gaze of Flames', 'See through fire, fog and smoke.'),
  'ward-of-flames': spiritHex('flame', 'Ward of Flames', 'Touched ally\'s next melee attacker takes 1d6 + 1 per two levels fire.'),
  'enveloping-void': spiritHex('heavens', 'Enveloping Void', 'Lower the light around an enemy two steps for rounds equal to your level (Will negates).'),
  'guiding-star': spiritHex('heavens', 'Guiding Star', 'Under the night sky, add Wis to Cha checks and apply a free metamagic once per night.'),
  'heavens-leap': spiritHex('heavens', "Heaven's Leap", 'Teleport yourself or an ally within 30 ft. a short distance.'),
  'lure-of-the-heavens': spiritHex('heavens', 'Lure of the Heavens', 'Leave no tracks; hover at 5th; fly at 10th.'),
  starburn: spiritHex('heavens', 'Starburn', 'Creature within 30 ft. takes 1d6 fire per two levels (Fort half) and sheds light; Cha mod times per day.', { abilities: ['starburn'] }),
  'deny-succor': spiritHex('life', 'Deny Succor', 'Target cannot benefit from cure spells for half your level in rounds (Will negates).'),
  'enhanced-cures-hex': spiritHex('life', 'Enhanced Cures', 'Cure spells add your full shaman level to the healing.', { flags: () => ['enhancedCures'] }),
  'life-link': spiritHex('life', 'Life Link', 'Bond allies: when one drops low, it heals 5 and you take 5.'),
  'life-sight': spiritHex('life', 'Life Sight', 'See the life status and conditions of creatures within 30 ft.'),
  'arcane-enlightenment': spiritHex('lore', 'Arcane Enlightenment', 'Add Cha mod sorcerer/wizard spells to your shaman list.'),
  'benefit-of-wisdom': spiritHex('lore', 'Benefit of Wisdom', 'Use Wis instead of Int for Int-based skill checks.', { flags: () => ['knowledgeUsesWis'] }),
  'brain-drain-hex': spiritHex('lore', 'Brain Drain', 'Intelligent enemy within 30 ft. takes 1d4 per two levels damage (Will negates).', { abilities: ['brain-drain'] }),
  'confusion-curse': spiritHex('lore', 'Confusion Curse', 'Intelligent creature within 30 ft. is confused for Cha mod rounds (Will negates).', { abilities: ['confusion-curse'] }),
  'share-knowledge': spiritHex('lore', 'Share Knowledge', 'An ally uses your languages and Knowledge bonuses for Cha mod minutes.'),
  'entangling-curse': spiritHex('nature', 'Entangling Curse', 'Creature within 30 ft. is entangled for Cha mod rounds (Reflex negates).', { abilities: ['entangling-curse'] }),
  'erosion-curse': spiritHex('nature', 'Erosion Curse', 'Construct or object within 30 ft. takes 1d6 per two levels, ignoring hardness and DR.'),
  'friend-to-animals': spiritHex('nature', 'Friend to Animals', "Cast summon nature's ally spontaneously; animals within 30 ft. add your Cha mod to saves."),
  'speak-with-animals-hex': spiritHex('nature', 'Speak with Animals', 'Speak with one kind of animal (+1 per three levels).'),
  stormwalker: spiritHex('nature', 'Stormwalker', 'Ignore penalties from nonmagical weather and fog.'),
  'crystal-sight': spiritHex('stone', 'Crystal Sight', 'See through stone and earth for rounds per day equal to your level.'),
  lodestone: spiritHex('stone', 'Lodestone', 'Creature within 30 ft. is weighed down (heavier load) for rounds equal to your level (Will negates).'),
  'metal-curse': spiritHex('stone', 'Metal Curse', 'Creature within 30 ft. takes -2 AC against metal weapons until your next turn.'),
  'stone-stability-hex': spiritHex('stone', 'Stone Stability', '+4 CMD vs bull rush and trip; Improved Trip at 5th and Greater Trip at 10th.', { modifiers: () => [mod('cmd', 4, 'untyped', 'Stone stability', ['bullRush', 'trip'])] }),
  'ward-of-stone': spiritHex('stone', 'Ward of Stone', 'Touched ally treats the next melee hit as DR 5/adamantine.'),
  'beckoning-chill': spiritHex('waves', 'Beckoning Chill', 'Cold damage entangles the target for 1 round for 1 minute.'),
  'crashing-waves': spiritHex('waves', 'Crashing Waves', 'Water spells at +1 caster level; damaging water spells can knock targets prone.'),
  'fluid-magic': spiritHex('waves', 'Fluid Magic', 'Prepare spirit magic spells in normal slots.'),
  'mists-shroud': spiritHex('waves', "Mist's Shroud", 'Touched ally gains concealment as blur for 1 minute or until a miss.'),
  'water-sight': spiritHex('waves', 'Water Sight', 'See through fog and mist; scry through water at 7th.'),
  'air-barrier-hex': spiritHex('wind', 'Air Barrier', '+4 armor bonus (+2 at 7th and every four levels); 50% miss vs ranged at 13th.', { abilities: ['air-barrier'] }),
  'sparking-aura': spiritHex('wind', 'Sparking Aura', 'Target glows, losing concealment; metal attackers take electricity damage.'),
  'vortex-spells': spiritHex('wind', 'Vortex Spells', 'A spell critical hit staggers the target 1 round (1d4 at 11th).'),
  'wind-sight': spiritHex('wind', 'Wind Sight', 'Ignore wind penalties on Perception; clairaudience/clairvoyance at 7th.'),
  'wind-ward': spiritHex('wind', 'Wind Ward', 'Touched ally gains a 20% miss chance against ranged attacks (50% at 16th).'),
};
for (const h of Object.values(SHAMAN_HEXES)) {
  if (h.spirit) h.validate = (c) => ([c.choices.spirit, c.choices['wandering-spirit']].includes(h.spirit) ? null : `${h.name} is a ${h.spirit} spirit hex`);
}

// ---------------------------------------------------------------- Slayer
const SLAYER_TALENTS = {
  'slowing-strike': o('Slowing Strike', 'Sneak attacks halve the target\'s speed for 1d4 rounds (Fort negates).', { flags: () => ['slowingStrike'] }),
  'deadly-range': o('Deadly Range', 'Sneak attack range +10 ft.', { minLevel: 4, repeatable: true }),
  'foil-scrutiny': o('Foil Scrutiny', '+2 on Bluff and Disguise and on Will saves vs mind-reading.', { modifiers: () => [mod('skill.bluff', 2, 'untyped', 'Foil scrutiny'), mod('skill.disguise', 2, 'untyped', 'Foil scrutiny')] }),
  'poison-use-slayer': o('Poison Use', 'Never risk poisoning yourself when applying poison.', { flags: () => ['poisonUse'] }),
  'ranger-combat-style': o('Ranger Combat Style', 'Gain a combat style feat (6th and 10th: higher-tier feats), ignoring prerequisites.', { repeatable: true, bonusFeat: 'combat-style-any', bonusFeats: ['far-shot', 'point-blank-shot', 'precise-shot', 'rapid-shot', 'double-slice', 'improved-shield-bash', 'quick-draw', 'two-weapon-fighting', 'improved-precise-shot', 'manyshot', 'improved-two-weapon-fighting', 'two-weapon-defense', 'pinpoint-targeting', 'shot-on-the-run', 'greater-two-weapon-fighting', 'two-weapon-rend'] }),
  trapfinding: o('Trapfinding', 'Disable Device is a class skill; trapfinding and trap sense using slayer level.', { classSkills: ['disable-device'], flags: () => ['trapfinding'] }),
  // Rogue talents the slayer may take
  'bleeding-attack': o('Bleeding Attack', 'Sneak attacks cause bleed equal to sneak attack dice.', { flags: () => ['bleedingAttack'] }),
  'combat-trick': o('Combat Trick', 'Gain a bonus combat feat.', { bonusFeat: 'combat', repeatable: true }),
  'fast-stealth': o('Fast Stealth', 'Move at full speed using Stealth.'),
  'finesse-rogue': o('Finesse Rogue', 'Weapon Finesse as a bonus feat.', { grantsFeats: ['weapon-finesse'] }),
  'rogue-crawl': o('Rogue Crawl', 'Crawl at half speed without provoking.'),
  'slow-reactions': o('Slow Reactions', 'Sneak-attacked foes cannot make attacks of opportunity for 1 round.', { flags: () => ['slowReactions'] }),
  'snipers-eye': o("Sniper's Eye", 'Ranged sneak attacks against targets with concealment.'),
  'surprise-attack': o('Surprise Attack', 'Opponents are flat-footed against you in the surprise round.'),
  'trap-spotter': o('Trap Spotter', 'Automatic Perception check near traps.'),
  'weapon-training-slayer': o('Weapon Training', 'Weapon Focus as a bonus feat.', { bonusFeat: 'weapon-focus-only', bonusFeats: ['weapon-focus'] }),
  // Advanced (10th)
  assassinate: o('Assassinate', 'Advanced: study a target for 1 round; a sneak attack while it is denied Dex forces a Fort save (DC 10 + 1/2 level + Int) or it dies.', { minLevel: 10, advanced: true, abilities: ['assassinate'] }),
  'slayer-camouflage': o('Slayer Camouflage', 'Advanced: use Stealth in favored terrain without cover.', { minLevel: 10, advanced: true }),
  'woodland-stride-slayer': o('Woodland Stride', 'Advanced: move through undergrowth at normal speed.', { minLevel: 10, advanced: true, flags: () => ['woodlandStride'] }),
  'improved-evasion-slayer': o('Improved Evasion', 'Advanced: half damage on a failed Reflex save (requires evasion).', { minLevel: 10, advanced: true, flags: () => ['evasion', 'improvedEvasion'] }),
  'evasion-slayer': o('Evasion', 'Advanced: evasion.', { minLevel: 10, advanced: true, flags: () => ['evasion'] }),
  'feat-slayer': o('Feat', 'Advanced: gain any feat.', { minLevel: 10, advanced: true, bonusFeat: 'any' }),
  opportunist: o('Opportunist', 'Advanced: once per round, attack of opportunity against a foe just struck by an ally.', { minLevel: 10, advanced: true }),
  'crippling-strike': o('Crippling Strike', 'Advanced: sneak attacks deal 2 Str damage.', { minLevel: 10, advanced: true, flags: () => ['cripplingStrike'] }),
};

// ---------------------------------------------------------------- Warpriest blessings
const b = (minor, major) => o(minor.name, `${minor.text} Major (10th): ${major.name}: ${major.text}`, { minor, major });
const BLESSINGS = {
  air: b({ name: "Zephyr's Gift", text: 'Ranged attacks ignore range penalties and do not provoke for 1 minute.', fx: () => ({ flags: ['noRangePenalty'] }) }, { name: 'Soaring Assault', text: 'Ally flies 60 ft. for 1 minute; charges deal +level electricity.', fx: () => ({ flags: ['fly:60'] }) }),
  animal: b({ name: 'Animal Fury', text: 'Ally gains two claws (1d6) and a bite (1d8) for 1 minute.', fx: () => ({ naturalAttacks: [{ name: 'Claw (animal fury)', damage: '1d6', type: ['slashing'], count: 2 }, { name: 'Bite (animal fury)', damage: '1d8', type: ['bludgeoning', 'piercing', 'slashing'] }] }) }, { name: 'Battle Companion', text: "Summon an animal as summon nature's ally V for 1 minute.", summon: 'summon-natures-ally-v' }),
  chaos: b({ name: 'Anarchic Strike', text: 'Weapon deals +1d6 vs lawful creatures and is chaotic for DR for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d6', onlyIf: ['lawful'], type: 'untyped' }], flags: ['weaponsChaotic'] }) }, { name: 'Battle Companion', text: 'Summon a chaotic outsider as summon monster IV for 1 minute.', summon: 'summon-monster-iv' }),
  death: b({ name: 'From the Grave', text: '+4 Disguise and Intimidate, +2 profane on saves vs disease, mind-affecting, paralysis, poison and stun for 1 minute.', fx: () => ({ modifiers: [mod('skill.intimidate', 4, 'untyped', 'From the grave'), mod('save', 2, 'profane', 'From the grave', ['disease', 'mind-affecting', 'paralysis', 'poison', 'stun'])] }) }, { name: "Death's Touch", text: 'Melee touch: 1 temporary negative level.' }),
  destruction: b({ name: 'Destructive Attacks', text: 'Ally gains a morale bonus on weapon damage equal to 1/2 level (min 1) for 1 minute.', fx: (l) => ({ modifiers: [mod('damage', Math.max(1, Math.floor(l / 2)), 'morale', 'Destructive attacks', ['weapon'])] }) }, { name: 'Heart of Carnage', text: '+4 insight on critical confirmations and 50% fortification for 1 minute.', fx: () => ({ modifiers: [mod('critConfirm', 4, 'insight', 'Heart of carnage')], flags: ['fortification:50'] }) }),
  earth: b({ name: 'Acid Strike', text: 'Weapon deals +1d4 acid for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d4', type: 'acid' }] }) }, { name: 'Armor of Earth', text: 'Ally gains DR 1/— (+1 per two levels after 10th) for 1 minute.', fx: (l) => ({ dr: [{ amount: Math.min(5, 1 + Math.floor((l - 10) / 2)), bypass: '-' }] }) }),
  evil: b({ name: 'Unholy Strike', text: 'Weapon deals +1d6 vs good creatures and is evil for DR for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d6', onlyIf: ['good'], type: 'untyped' }], flags: ['weaponsEvil'] }) }, { name: 'Battle Companion', text: 'Summon an evil outsider as summon monster IV for 1 minute.', summon: 'summon-monster-iv' }),
  fire: b({ name: 'Fire Strike', text: 'Weapon deals +1d4 fire for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d4', type: 'fire' }] }) }, { name: 'Armor of Flame', text: 'Ally is wreathed in a warm fire shield for 1 minute.', fx: (l) => ({ reflect: { dice: `1d6+${Math.min(15, l)}`, type: 'fire' } }) }),
  glory: b({ name: 'Glorious Presence', text: 'Ally is protected as by sanctuary for 1 minute (ends against a foe it attacks).', fx: () => ({ flags: ['sanctuary'] }) }, { name: 'Demoralizing Glory', text: 'After damaging a foe, swift action to demoralize it.' }),
  good: b({ name: 'Holy Strike', text: 'Weapon deals +1d6 vs evil creatures and is good for DR for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d6', onlyIf: ['evil'], type: 'untyped' }], flags: ['weaponsGood'] }) }, { name: 'Battle Companion', text: 'Summon a good outsider as summon monster IV for 1 minute.', summon: 'summon-monster-iv' }),
  healing: b({ name: 'Powerful Healer', text: 'Swift: your next cure spell is empowered.', fx: () => ({ flags: ['empowerNextCure'] }) }, { name: 'Fast Healing', text: 'Ally gains fast healing 3 for 1 minute.', fx: () => ({ flags: ['fastHealing:3'] }) }),
  knowledge: b({ name: 'Lore Keeper', text: 'Touch: learn about a creature as a Knowledge check of 15 + level + Wis.' }, { name: 'Monster Lore', text: '+2 insight on attacks, saves, checks and AC against an identified creature for 1 minute.', fx: () => ({ modifiers: [mod('attack', 2, 'insight', 'Monster lore'), mod('ac', 2, 'insight', 'Monster lore')] }) }),
  law: b({ name: 'Axiomatic Strike', text: 'Weapon deals +1d6 vs chaotic creatures and is lawful for DR for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d6', onlyIf: ['chaotic'], type: 'untyped' }], flags: ['weaponsLawful'] }) }, { name: 'Battle Companion', text: 'Summon a lawful outsider as summon monster IV for 1 minute.', summon: 'summon-monster-iv' }),
  luck: b({ name: 'Lucky Presence', text: 'Ally rolls its next check or save twice and takes the better result.', fx: () => ({ flags: ['rollTwiceBetter'], dischargeOnAttack: true }) }, { name: 'Unlucky Enemy', text: 'Immediate: an adjacent foe rerolls and takes the lower result.' }),
  magic: b({ name: 'Hand of the Acolyte', text: 'Make a melee weapon attack from 30 ft. using Wis.' }, { name: 'Blessed Magic', text: 'Cast a damaging warpriest spell without expending its slot.' }),
  protection: b({ name: 'Increased Defense', text: '+1 sacred bonus on saves and AC for 1 minute (+2 at 10th, +3 at 20th).', fx: (l) => { const v = l >= 20 ? 3 : l >= 10 ? 2 : 1; return { modifiers: [mod('save', v, 'sacred', 'Increased defense'), mod('ac', v, 'sacred', 'Increased defense')] }; } }, { name: 'Aura of Protection', text: 'Allies within 30 ft. gain resistance 10 (20 at 15th) to all energy for 1 minute.', fx: (l) => ({ resist: Object.fromEntries(['acid', 'cold', 'electricity', 'fire', 'sonic'].map((e) => [e, l >= 15 ? 20 : 10])) }) }),
  strength: b({ name: 'Strength Surge', text: 'Swift: +1/2 level enhancement on melee attacks, Str checks and CMB for 1 round.', fx: (l) => ({ modifiers: [mod('attack.melee', Math.max(1, Math.floor(l / 2)), 'enhancement', 'Strength surge'), mod('cmb', Math.max(1, Math.floor(l / 2)), 'enhancement', 'Strength surge')], rounds: 1 }) }, { name: 'Strength of Will', text: 'Ignore armor and load movement penalties and add Str to saves vs entangle, stagger and paralysis for 1 minute.' }),
  sun: b({ name: 'Blinding Strike', text: 'On hit, the target is blinded 1 round (dazzled on a Reflex save).' }, { name: 'Cleansing Fire', text: 'Weapon gains flaming or undead bane for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d6', type: 'fire' }] }) }),
  travel: b({ name: 'Agile Feet', text: 'Swift: ignore difficult terrain for 1 round.', fx: () => ({ flags: ['ignoreDifficultTerrain'], rounds: 1 }) }, { name: 'Dimensional Hop', text: 'Move action: teleport 20 ft.' }),
  trickery: b({ name: 'Double', text: 'Move action: one mirror image for rounds equal to your level.', fx: () => ({ images: 1 }) }, { name: 'Greater Invisibility', text: 'Swift: greater invisibility for 1 round.', fx: () => ({ flags: ['invisible'], rounds: 1 }) }),
  war: b({ name: 'War Mind', text: 'For 1 minute, each turn choose +10 ft. speed, +1 dodge AC, +1 insight attack or +1 luck on saves.', fx: () => ({ modifiers: [mod('attack', 1, 'insight', 'War mind'), mod('ac', 1, 'dodge', 'War mind')] }) }, { name: 'Battle Lust', text: 'Melee attacks are vicious and gain +4 on critical confirmations for 1 minute.', fx: () => ({ modifiers: [mod('critConfirm', 4, 'insight', 'Battle lust')], bonusDamage: [{ dice: '2d6', type: 'weapon', melee: true }] }) }),
  water: b({ name: 'Ice Strike', text: 'Weapon deals +1d4 cold for 1 minute.', fx: () => ({ bonusDamage: [{ dice: '1d4', type: 'cold' }] }) }, { name: 'Armor of Ice', text: 'Ally is wrapped in a chill fire shield for 1 minute.', fx: (l) => ({ reflect: { dice: `1d6+${Math.min(15, l)}`, type: 'cold' } }) }),
};

module.exports = { ARCANIST_EXPLOITS, BLOODRAGER_BLOODLINES, ANIMAL_ASPECTS, SPIRITS, SHAMAN_HEXES, SLAYER_TALENTS, BLESSINGS };
