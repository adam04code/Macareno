'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Feats from the Advanced Player's Guide, Ultimate Combat, Ultimate Magic,
 * the Advanced Class Guide and Occult Adventures used by the classes in this
 * engine (teamwork feats, class "extra" feats, combat maneuver and style
 * feats, metamagic). Same format as src/data/feats.js.
 */

const F = (name, types, prereq, benefit, extra = {}) => ({ name, types, prereq, benefit, ...extra });
const teamwork = (name, prereq, benefit, extra = {}) => F(name, ['combat', 'teamwork'], prereq, benefit, extra);
const metamagic = (name, levelIncrease, benefit, extra = {}) => F(name, ['metamagic'], {}, benefit, { metamagic: { levelIncrease, ...extra } });
const extraFeat = (name, classFeature, benefit, extra = {}) => F(name, ['general'], { classFeature }, benefit, { multiple: true, ...extra });

const FEATS = {
  // ------------------------------------------------------------ Teamwork (APG, UC)
  'allied-spellcaster': teamwork('Allied Spellcaster', { casterLevel: 1 }, '+2 on caster level checks to overcome SR when adjacent to an ally with this feat (+4 if the ally knows the spell).'),
  'back-to-back': teamwork('Back to Back', { skills: { perception: 3 } }, '+2 AC against flanking attacks when adjacent to an ally with this feat.'),
  'coordinated-defense': teamwork('Coordinated Defense', {}, '+2 CMD (+4 vs larger foes) when adjacent to an ally with this feat.'),
  'coordinated-maneuvers': teamwork('Coordinated Maneuvers', {}, '+2 on combat maneuver checks (+4 to escape a grapple) when adjacent to an ally with this feat.'),
  'duck-and-cover': teamwork('Duck and Cover', {}, 'Take the better of your and an adjacent ally\'s Reflex roll; gain +2 cover AC against ranged attacks.'),
  'escape-route': teamwork('Escape Route', {}, 'Moving through squares adjacent to an ally with this feat does not provoke.'),
  lookout: teamwork('Lookout', {}, 'Act in the surprise round if an adjacent ally with this feat can.'),
  outflank: teamwork('Outflank', { bab: 4 }, 'When flanking with an ally who has this feat, the flanking bonus increases to +4; your crits give the ally an attack of opportunity.'),
  'paired-opportunists': teamwork('Paired Opportunists', {}, '+4 on attacks of opportunity against foes threatened by an adjacent ally with this feat.'),
  'precise-strike': teamwork('Precise Strike', { abilities: { dex: 13 }, bab: 1 }, '+1d6 precision damage when flanking with an ally who has this feat.'),
  'seize-the-moment': teamwork('Seize the Moment', { abilities: { int: 13 }, feats: ['combat-expertise', 'improved-critical'] }, 'When an ally with this feat confirms a critical hit, make an attack of opportunity against the target.'),
  'shield-wall': teamwork('Shield Wall', { feats: ['shield-proficiency'] }, 'Shield AC +1 (+2 heavy/tower) when adjacent to an ally with this feat wielding a shield.'),
  'shielded-caster': teamwork('Shielded Caster', {}, '+4 concentration when an adjacent ally with this feat wields a shield (+2 otherwise).'),
  'swap-places': teamwork('Swap Places', {}, 'Swap places with an adjacent ally with this feat as part of a move.'),
  'tandem-trip': teamwork('Tandem Trip', {}, 'Roll trip attempts twice when an ally with this feat threatens the target.'),

  // ------------------------------------------------------------ Class "extra" feats
  'extra-bombs': extraFeat('Extra Bombs', 'bomb', 'Throw two additional bombs per day.'),
  'extra-discovery': extraFeat('Extra Discovery', 'discovery', 'Gain one additional alchemist discovery.', { grantsChoice: 'discovery' }),
  'extra-hex': extraFeat('Extra Hex', 'hex', 'Gain one additional hex.', { grantsChoice: 'hex' }),
  'extra-revelation': extraFeat('Extra Revelation', 'revelation', 'Gain one additional revelation.', { grantsChoice: 'revelation' }),
  'extra-arcanist-exploit': extraFeat('Extra Arcanist Exploit', 'arcanist-exploit', 'Gain one additional arcanist exploit.', { grantsChoice: 'arcanist-exploit' }),
  'extra-slayer-talent': extraFeat('Extra Slayer Talent', 'slayer-talent', 'Gain one additional slayer talent.', { grantsChoice: 'slayer-talent' }),
  'extra-fervor': extraFeat('Extra Fervor', 'fervor', 'Use fervor two additional times per day.'),
  'extra-wild-talent': extraFeat('Extra Wild Talent', 'kinetic-blast', 'Gain one additional utility wild talent or infusion of your level or lower.', { grantsChoice: 'wild-talent' }),
  'extra-reservoir': extraFeat('Extra Reservoir', 'arcane-reservoir', 'Arcane reservoir maximum increases by 3.'),

  // ------------------------------------------------------------ Combat
  'acrobatic-steps': F('Acrobatic Steps', ['general'], { abilities: { dex: 15 }, feats: ['nimble-moves'] }, 'Move through 15 ft. of difficult terrain each round as if normal terrain.'),
  'bashing-finish': F('Bashing Finish', ['combat'], { feats: ['improved-shield-bash', 'shield-master', 'two-weapon-fighting'], bab: 11 }, 'After a critical hit with a weapon, make a free shield bash against the same target.'),
  'bloody-assault': F('Bloody Assault', ['combat'], { abilities: { str: 13 }, feats: ['power-attack'], bab: 6 }, 'Take -5 on attacks to deal 1d4 bleed damage with your melee attacks.', { toggle: 'bloodyAssault' }),
  bodyguard: F('Bodyguard', ['combat'], { feats: ['combat-reflexes'] }, 'Use an attack of opportunity to aid another to an adjacent ally\'s AC.'),
  'in-harms-way': F("In Harm's Way", ['combat'], { feats: ['bodyguard'] }, 'Take the damage of an attack aimed at an adjacent ally you aid.'),
  'cornugon-smash': F('Cornugon Smash', ['combat'], { feats: ['power-attack'], skills: { intimidate: 6 } }, 'When you hit with Power Attack, attempt a free Intimidate check to demoralize.', { flags: () => ['cornugonSmash'] }),
  'dazing-assault': F('Dazing Assault', ['combat'], { abilities: { str: 13 }, feats: ['power-attack'], bab: 11 }, 'Take -5 on attacks; hit creatures are dazed 1 round (Fort DC 10 + BAB).', { toggle: 'dazingAssault' }),
  'stunning-assault': F('Stunning Assault', ['combat'], { abilities: { str: 13 }, feats: ['power-attack'], bab: 16 }, 'Take -5 on attacks; hit creatures are stunned 1 round (Fort DC 10 + BAB).', { toggle: 'stunningAssault' }),
  'dreadful-carnage': F('Dreadful Carnage', ['combat'], { abilities: { str: 15 }, feats: ['furious-focus', 'power-attack'], bab: 11 }, 'When you drop a foe, demoralize all enemies within 30 ft. as a free action.', { flags: () => ['dreadfulCarnage'] }),
  'furious-focus': F('Furious Focus', ['combat'], { abilities: { str: 13 }, feats: ['power-attack'], bab: 1 }, 'No Power Attack penalty on the first attack each turn with a two-handed weapon.', { flags: () => ['furiousFocus'] }),
  'improved-dirty-trick': F('Improved Dirty Trick', ['combat'], { abilities: { int: 13 }, feats: ['combat-expertise'] }, 'No AoO when attempting a dirty trick; +2 on dirty trick and +2 CMD vs it.', { modifiers: () => [mod('cmb', 2, 'untyped', 'Improved Dirty Trick', ['dirtyTrick']), mod('cmd', 2, 'untyped', 'Improved Dirty Trick', ['dirtyTrick'])] }),
  'greater-dirty-trick': F('Greater Dirty Trick', ['combat'], { abilities: { int: 13 }, feats: ['combat-expertise', 'improved-dirty-trick'], bab: 6 }, '+2 on dirty trick (stacks); the penalty lasts 1d4 rounds longer.', { modifiers: () => [mod('cmb', 2, 'untyped', 'Greater Dirty Trick', ['dirtyTrick'])] }),
  'improved-reposition': F('Improved Reposition', ['combat'], { abilities: { int: 13 }, feats: ['combat-expertise'] }, 'No AoO when repositioning; +2 on reposition and +2 CMD vs it.', { modifiers: () => [mod('cmb', 2, 'untyped', 'Improved Reposition', ['reposition']), mod('cmd', 2, 'untyped', 'Improved Reposition', ['reposition'])] }),
  'greater-reposition': F('Greater Reposition', ['combat'], { abilities: { int: 13 }, feats: ['combat-expertise', 'improved-reposition'], bab: 6 }, '+2 on reposition (stacks); moved foes provoke.', { modifiers: () => [mod('cmb', 2, 'untyped', 'Greater Reposition', ['reposition'])] }),
  'point-blank-master': F('Point-Blank Master', ['combat'], { feats: ['weapon-specialization'] }, 'Firing a chosen ranged weapon while threatened does not provoke.', { param: 'weapon' }),
  'shield-of-swings': F('Shield of Swings', ['combat'], { abilities: { str: 13 }, feats: ['power-attack'], bab: 1 }, 'Full attack with a two-handed weapon at half damage: +4 shield AC until your next turn.'),
  'following-step': F('Following Step', ['combat'], { abilities: { dex: 13 }, feats: ['step-up'] }, 'Step Up moves up to 10 ft.'),
  'step-up-and-strike': F('Step Up and Strike', ['combat'], { abilities: { dex: 13 }, feats: ['following-step', 'step-up'], bab: 6 }, 'After using Step Up, make an attack of opportunity against the foe.'),
  'two-weapon-feint': F('Two-Weapon Feint', ['combat'], { abilities: { dex: 15, int: 13 }, feats: ['combat-expertise', 'two-weapon-fighting'] }, 'Forgo your first off-hand attack to feint.'),
  'improved-two-weapon-feint': F('Improved Two-Weapon Feint', ['combat'], { abilities: { dex: 17, int: 13 }, feats: ['combat-expertise', 'improved-two-weapon-fighting', 'two-weapon-feint'], bab: 6 }, 'Your feinted foe is denied Dex for all your attacks this round.'),
  'raging-vitality': F('Raging Vitality', ['general'], { abilities: { con: 15 }, classFeature: 'rage' }, '+2 Con while raging; rage does not end when unconscious.', { modifiers: (c) => (c.hasFlag('raging') ? [mod('con', 2, 'morale', 'Raging Vitality')] : []) }),

  // ------------------------------------------------------------ Style feats (Ultimate Combat)
  'crane-style': F('Crane Style', ['combat', 'style'], { abilities: { dex: 13 }, feats: ['dodge', 'improved-unarmed-strike'], skills: { acrobatics: 2 } }, 'Fighting defensively costs only -2 on attacks and grants +1 more dodge AC.', { flags: () => ['craneStyle'] }),
  'crane-wing': F('Crane Wing', ['combat'], { feats: ['crane-style', 'dodge', 'improved-unarmed-strike'], bab: 5 }, 'Once per round while fighting defensively with a free hand, gain +4 dodge AC against one melee attack.', { modifiers: (c) => (c.hasFlag('fightingDefensively') ? [mod('ac', 4, 'dodge', 'Crane Wing', ['vsMelee'])] : []) }),
  'crane-riposte': F('Crane Riposte', ['combat'], { feats: ['crane-style', 'crane-wing', 'dodge', 'improved-unarmed-strike'], bab: 8 }, 'After Crane Wing deflects an attack, make an attack of opportunity.'),
  'dragon-style': F('Dragon Style', ['combat', 'style'], { abilities: { str: 15 }, feats: ['improved-unarmed-strike'], skills: { acrobatics: 3 } }, '+2 on saves vs sleep, paralysis and stun; first unarmed strike each round adds 1.5 x Str.', { modifiers: () => [mod('save', 2, 'untyped', 'Dragon Style', ['sleep', 'paralysis', 'stun'])] }),
  'dragon-ferocity': F('Dragon Ferocity', ['combat'], { abilities: { str: 15 }, feats: ['dragon-style', 'improved-unarmed-strike'], bab: 6 }, 'Unarmed strikes add 1.5 x Str; critical hits shake the target.'),
  'snake-style': F('Snake Style', ['combat', 'style'], { feats: ['improved-unarmed-strike'], skills: { acrobatics: 1, 'sense-motive': 3 } }, '+2 on Sense Motive; use Sense Motive in place of AC against one attack per round.', { modifiers: () => [mod('skill.sense-motive', 2, 'untyped', 'Snake Style')] }),
  'tiger-style': F('Tiger Style', ['combat', 'style'], { feats: ['improved-unarmed-strike'], skills: { acrobatics: 3 } }, '+2 CMB and CMD vs bull rush and overrun; unarmed strikes deal slashing damage.', { modifiers: () => [mod('cmb', 2, 'untyped', 'Tiger Style', ['bullRush', 'overrun']), mod('cmd', 2, 'untyped', 'Tiger Style', ['bullRush', 'overrun'])] }),

  // ------------------------------------------------------------ Metamagic (APG, UM)
  'dazing-spell': metamagic('Dazing Spell', 3, 'Creatures damaged by the spell are dazed for rounds equal to its original level (Will negates).', { dazing: true }),
  'persistent-spell': metamagic('Persistent Spell', 2, 'Creatures that succeed on a save against the spell must save again.', { persistent: true }),
  'reach-spell': metamagic('Reach Spell', 1, 'Increase the range of a spell by one category per level increase.', { reach: true }),
  'selective-spell': metamagic('Selective Spell', 1, 'Exclude up to your casting ability modifier creatures from an area spell.', { selective: true }),
  'sickening-spell': metamagic('Sickening Spell', 2, 'Creatures damaged by the spell are sickened for rounds equal to its original level (Fort negates).', { sickening: true }),
  'thundering-spell': metamagic('Thundering Spell', 2, 'Creatures damaged by the spell are deafened for 1d4 rounds (Fort negates).', { thundering: true }),
  'bouncing-spell': metamagic('Bouncing Spell', 1, 'A single-target spell that fails against its target can be redirected to another.', { bouncing: true }),
  'elemental-spell': metamagic('Elemental Spell', 1, 'Change half (or all) of an energy spell\'s damage to another energy type.', { elemental: true }),
  'piercing-spell': metamagic('Piercing Spell', 1, 'Treat the target\'s spell resistance as 5 lower.', { piercing: true }),
  'toppling-spell': metamagic('Toppling Spell', 1, 'Force spells that deal damage also attempt a trip (CMB = CL + casting modifier).', { toppling: true }),
  'focused-spell': metamagic('Focused Spell', 1, 'One target of a multi-target spell takes a +2 DC.', { focused: true }),

  // ------------------------------------------------------------ General
  'eldritch-heritage': F('Eldritch Heritage', ['general'], { abilities: { cha: 13 }, level: 3 }, 'Gain a sorcerer bloodline\'s 1st-level power (effective sorcerer level = character level - 2).'),
  'expanded-arcana': F('Expanded Arcana', ['general'], { casterLevel: 1 }, 'Add one spell to your spells known (or two of a lower level).', { multiple: true }),
  'lingering-performance': F('Lingering Performance', ['general'], { classFeature: 'bardic-performance' }, 'Bonuses from your bardic performance last 2 rounds after you stop.'),
  'quicken-blessing': F('Quicken Blessing', ['general'], { classFeature: 'blessings' }, 'Use a chosen blessing as a swift action.', { param: 'blessing', multiple: true }),
  'accursed-hex': F('Accursed Hex', ['general'], { classFeature: 'hex' }, 'Retry a hex that a creature resisted on your next turn.'),
  'split-hex': F('Split Hex', ['general'], { classFeature: 'hex', level: 10 }, 'Target two creatures with one single-target hex.'),
};


module.exports = { FEATS };
