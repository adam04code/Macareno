'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Selectable options for the Advanced Player's Guide classes. Option fields
 * follow src/data/classOptions.js (modifiers, flags, abilities, resources,
 * grantsFeats, minLevel, requires, progressions, onPick).
 */

const o = (name, description, extra = {}) => ({ name, description, ...extra });
const lvl = (c, cls) => c.classLevel(cls);
const half = (n) => Math.floor(n / 2);

// ------------------------------------------------------------------ Alchemist
// bomb: modifies a thrown bomb (only one * discovery per bomb). See abilitiesApg.js "bomb".
const DISCOVERIES = {
  'acid-bomb': o('Acid Bomb', 'Bombs deal acid damage; a creature hit directly takes 1d6 acid damage again the next round.', { bomb: { energy: 'acid', lingering: '1d6' } }),
  'combine-extracts': o('Combine Extracts', 'Place two extracts in one vial (uses a slot two levels higher than the higher extract).', { minLevel: 8 }),
  'concentrate-poison': o('Concentrate Poison', 'Combine two doses of the same poison: +50% frequency and +2 DC.'),
  'concussive-bomb': o('Concussive Bomb', 'Bombs deal sonic damage (d4s instead of d6s); a direct hit deafens for 1 minute (Fort negates).', { minLevel: 6, bomb: { energy: 'sonic', die: 4, condition: 'deafened', conditionRounds: 10, save: 'fort' } }),
  'confusion-bomb': o('Confusion Bomb', 'A direct hit confuses the target for 1 round per alchemist level (bomb damage reduced by 2d6).', { minLevel: 8, bomb: { reduceDice: 2, condition: 'confused', conditionRounds: (c) => lvl(c, 'alchemist'), save: 'will' } }),
  'delayed-bomb': o('Delayed Bomb', 'Place a bomb that explodes after up to 1 round per alchemist level.', { minLevel: 8 }),
  dilution: o('Dilution', 'Once per day, dilute a potion or elixir into two doses.', { minLevel: 12 }),
  'dispelling-bomb': o('Dispelling Bomb', 'A direct hit acts as a targeted dispel magic (caster level = alchemist level) instead of dealing damage.', { minLevel: 6, bomb: { dispel: true } }),
  'elixir-of-life': o('Elixir of Life', 'Once per day, create an elixir that acts as true resurrection.', { minLevel: 16 }),
  'enhance-potion': o('Enhance Potion', 'Potions you drink function at your alchemist level (Int mod times per day).'),
  'eternal-potion': o('Eternal Potion', 'One potion you drink becomes permanent.', { minLevel: 16, requires: ['extend-potion'] }),
  'explosive-bomb': o('Explosive Bomb', 'Bombs have a 10-ft. splash radius; a creature hit directly catches fire (1d6 fire per round).', { bomb: { splashRadius: 10, burning: '1d6' } }),
  'extend-potion': o('Extend Potion', 'Potions you drink last twice as long (Int mod times per day).'),
  'fast-bombs': o('Fast Bombs', 'Throw bombs as part of a full attack (one bomb per attack).', { minLevel: 8, abilities: ['bomb-barrage'] }),
  'feral-mutagen': o('Feral Mutagen', 'While under a mutagen, gain two claws (1d6) and a bite (1d8) and +2 competence on Intimidate.', { naturalAttacks: (c) => (c.hasFlag('mutagen') ? [{ name: 'Claw (feral mutagen)', damage: '1d6', type: ['slashing'], count: 2 }, { name: 'Bite (feral mutagen)', damage: '1d8', type: ['bludgeoning', 'piercing', 'slashing'] }] : []), modifiers: (c) => (c.hasFlag('mutagen') ? [mod('skill.intimidate', 2, 'competence', 'Feral mutagen')] : []) }),
  'force-bomb': o('Force Bomb', 'Bombs deal force damage (d4s instead of d6s) and knock a target hit directly prone (Reflex negates).', { minLevel: 8, bomb: { energy: 'force', die: 4, condition: 'prone', conditionRounds: 1, save: 'ref' } }),
  'frost-bomb': o('Frost Bomb', 'Bombs deal cold damage; a creature hit directly is staggered on its next turn (Fort negates).', { bomb: { energy: 'cold', condition: 'staggered', conditionRounds: 1, save: 'fort' } }),
  'grand-mutagen': o('Grand Mutagen', 'Mutagen: +8, +6 and +4 alchemical to the physical scores, +6 natural armor, -2 to all mental scores.', { minLevel: 16, requires: ['greater-mutagen'] }),
  'greater-mutagen': o('Greater Mutagen', 'Mutagen: +6 to one physical score and +4 to another, +4 natural armor, -2 to both related mental scores.', { minLevel: 12 }),
  'infuse-mutagen': o('Infuse Mutagen', 'Keep more than one mutagen at a time (takes 2 Int damage each).'),
  infusion: o('Infusion', 'Extracts can be used by others (you may target allies with extracts).', { flags: () => ['infusion'] }),
  'madness-bomb': o('Madness Bomb', 'A direct hit deals 1d4 Wisdom damage (+1d4 at 16th) in addition to damage reduced by 2d6.', { minLevel: 12, bomb: { reduceDice: 2, abilityDamage: { wis: '1d4' } } }),
  'poison-bomb': o('Poison Bomb', 'Bombs release a cloudkill effect (1 round per level) instead of dealing damage.', { minLevel: 12, requires: ['smoke-bomb'], bomb: { cloudkill: true } }),
  'precise-bombs': o('Precise Bombs', 'Exclude up to Int mod squares from your bomb splash.', { flags: () => ['preciseBombs'] }),
  'shock-bomb': o('Shock Bomb', 'Bombs deal electricity damage; a creature hit directly is dazzled for 1d4 rounds.', { bomb: { energy: 'electricity', condition: 'dazzled', conditionRounds: '1d4' } }),
  'smoke-bomb': o('Smoke Bomb', 'Bombs create a fog cloud for 1 round per alchemist level (20% concealment).', { bomb: { smoke: true } }),
  'sticky-bomb': o('Sticky Bomb', 'Creatures that take splash damage take that damage again the next round.', { minLevel: 10, bomb: { sticky: true } }),
  'stink-bomb': o('Stink Bomb', 'Bombs create a stinking cloud for 1 round: creatures in the splash are nauseated 1d4+1 rounds (Fort negates).', { requires: ['smoke-bomb'], bomb: { condition: 'nauseated', conditionRounds: '1d4+1', save: 'fort', splashCondition: true } }),
  cognatogen: o('Cognatogen', 'Brew a cognatogen instead of a mutagen: +4 to a mental score, -2 to the related physical score, +2 natural armor.', { flags: () => ['cognatogen'] }),
  'preserve-organs': o('Preserve Organs', '25% chance to ignore critical hits and sneak attacks (stacks if taken again).', { repeatable: true, flags: (c) => [`fortification:${25 * (c.choices.discovery || []).filter((x) => x === 'preserve-organs').length}`] }),
  'spontaneous-healing': o('Spontaneous Healing', 'Free action: heal 5 hp per round, up to 5 x Int mod hp per day.', { abilities: ['spontaneous-healing'] }),
  'vestigial-arm': o('Vestigial Arm', 'Grow an extra arm: draw and hold items, but no extra attacks.', { repeatable: true }),
  wings: o('Wings', 'While under a mutagen, gain wings: fly speed 60 ft. (average).', { minLevel: 6, flags: (c) => (c.hasFlag('mutagen') ? ['fly:60'] : []) }),
  'healing-touch': o('Healing Touch', 'Spontaneous healing can heal others by touch.', { minLevel: 6, requires: ['spontaneous-healing'] }),
  tentacle: o('Tentacle', 'Gain a tentacle: a secondary natural attack (1d4) that can also grapple.', { naturalAttacks: () => [{ name: 'Tentacle', damage: '1d4', type: ['bludgeoning'], primary: false }] }),
  'nauseating-flesh': o('Nauseating Flesh', 'Creatures that bite or swallow you are nauseated 1 round (Fort negates).', { minLevel: 12 }),
  mummification: o('Mummification', 'Immune to paralysis, sleep and stunning, and no longer need to breathe.', { minLevel: 10, requires: ['preserve-organs'], flags: () => ['immune:paralysis', 'immune:sleep', 'immune:stun'] }),
};

const GRAND_DISCOVERIES = {
  'awakened-intellect': o('Awakened Intellect', '+2 to Intelligence permanently.', { modifiers: () => [mod('int', 2, 'inherent', 'Awakened intellect')] }),
  'eternal-youth': o('Eternal Youth', 'You stop aging and no longer take aging penalties.'),
  'fast-healing': o('Fast Healing', 'Fast healing 5.', { flags: () => ['fastHealing:5'] }),
  'philosophers-stone': o("Philosopher's Stone", 'Learn to create a philosopher\'s stone (once per month).'),
  'poison-touch': o('Poison Touch', 'Touch inflicts a deadly poison at will (1d3 Con, Fort DC 10 + 1/2 level + Int).'),
  'true-mutagen': o('True Mutagen', 'Mutagen: +8 to all physical scores, +8 natural armor, -2 to all mental scores.', { requires: ['grand-mutagen'] }),
};

// ------------------------------------------------------------------- Cavalier
const order = (name, description, skills, challenge, abilities = {}) => o(name, description, { classSkills: skills, challenge, orderAbilities: abilities });
const CAVALIER_ORDERS = {
  cockatrice: order('Order of the Cockatrice', 'Self-serving glory seekers.', ['appraise', 'perform'], { damage: (c) => 1 + Math.floor(lvl(c, 'cavalier') / 4), onlyIfAlone: true }, {
    2: 'Braggart: demoralize as a standard action; +2 morale on attacks against demoralized foes.', 8: 'Steal Glory: when an ally confirms a critical against a foe you threaten, make an attack of opportunity against it.', 15: 'Moment of Triumph: once per day, automatically confirm a critical and gain +Cha on checks for 1 round.',
  }),
  dragon: order('Order of the Dragon', 'Loyal to their companions.', ['perception', 'survival'], { allyAttack: (c) => 1 + Math.floor(lvl(c, 'cavalier') / 4) }, {
    2: 'Aid Allies: aid another grants +3 (+1 per six levels).', 8: 'Strategy: standard action, allies within 30 ft. gain +2 dodge AC, +2 attack or a free move for 1 round.', 15: 'Act as One: once per combat, you and allies move and attack as a unit with +2 attack and AC.',
  }),
  lion: order('Order of the Lion', 'Sworn to a sovereign.', ['knowledge-local', 'knowledge-nobility'], { dodgeAc: (c) => 1 + Math.floor(lvl(c, 'cavalier') / 4) }, {
    2: "Lion's Call: standard action, allies within 60 ft. gain +Cha on saves vs fear and +1 attack for 1 round per level.", 8: 'For the King: once per combat, allies within 30 ft. gain +Cha on attack and damage for 1 round.', 15: 'Shield of the Liege: adjacent allies gain +2 AC; take an attack meant for an adjacent ally.',
  }),
  shield: order('Order of the Shield', 'Protectors of the common folk.', ['heal', 'knowledge-local'], { attackIfOthers: (c) => 1 + Math.floor(lvl(c, 'cavalier') / 4) }, {
    2: 'Resolute: convert 1 point of damage per two levels into nonlethal damage (heavy armor).', 8: 'Stem the Tide: Stand Still as a bonus feat; foes stopped take damage.', 15: 'Protect the Meek: immediate action, move and attack a foe that attacks an ally.',
  }),
  star: order('Order of the Star', 'Champions of a faith.', ['heal', 'knowledge-religion'], { saves: (c) => 1 + Math.floor(lvl(c, 'cavalier') / 4) }, {
    2: 'Calling: after praying, +Cha on one attack, check or save; cavalier levels stack with paladin/cleric for channel and lay on hands.', 8: 'For the Faith: once per day, +Cha morale on attacks for you and allies within 30 ft. for 1 round.', 15: 'Retribution: attacks of opportunity against foes that strike you.',
  }),
  sword: order('Order of the Sword', 'Knights devoted to chivalry.', ['knowledge-nobility', 'knowledge-religion'], { attackMounted: (c) => 1 + Math.floor(lvl(c, 'cavalier') / 4) }, {
    2: 'By My Honor: +2 on one saving throw type.', 8: 'Mounted Mastery: no AC penalty when charging mounted, add mount\'s Str to charge damage, +4 Ride.', 15: "Knight's Challenge: once per day, +Cha on attack and damage against the challenged foe.",
  }),
};

const MOUNTS = ['horse', 'dog', 'wolf', 'boar', 'big-cat'];

// --------------------------------------------------------------- Inquisitor
// Judgments: bonus by inquisitor level; sacred (or profane for evil inquisitors).
const J = (name, description, build) => o(name, description, { build });
const JUDGMENTS = {
  destruction: J('Destruction', '+1 sacred bonus on weapon damage (+1 per three levels).', (l, t) => ({ modifiers: [mod('damage', 1 + Math.floor(l / 3), t, 'Judgment of destruction', ['weapon'])] })),
  healing: J('Healing', 'Fast healing 1 (+1 per three levels).', (l) => ({ flags: [`fastHealing:${1 + Math.floor(l / 3)}`] })),
  justice: J('Justice', '+1 sacred bonus on attack rolls (+1 per five levels; doubled on critical confirmations at 10th).', (l, t) => ({ modifiers: [mod('attack', 1 + Math.floor(l / 5), t, 'Judgment of justice'), ...(l >= 10 ? [mod('critConfirm', 1 + Math.floor(l / 5), t, 'Judgment of justice')] : [])] })),
  piercing: J('Piercing', '+1 sacred bonus on concentration checks and caster level checks to overcome SR (+1 per three levels).', (l, t) => ({ modifiers: [mod('concentration', 1 + Math.floor(l / 3), t, 'Judgment of piercing'), mod('srCheck', 1 + Math.floor(l / 3), t, 'Judgment of piercing')] })),
  protection: J('Protection', '+1 sacred bonus to AC (+1 per five levels).', (l, t) => ({ modifiers: [mod('ac', 1 + Math.floor(l / 5), t, 'Judgment of protection')] })),
  purity: J('Purity', '+1 sacred bonus on saving throws (+1 per five levels; doubled vs curses, diseases and poisons at 10th).', (l, t) => ({ modifiers: [mod('save', 1 + Math.floor(l / 5), t, 'Judgment of purity'), ...(l >= 10 ? [mod('save', 1 + Math.floor(l / 5), 'untyped', 'Judgment of purity (afflictions)', ['curse', 'disease', 'poison'])] : [])] })),
  resiliency: J('Resiliency', 'DR 1/magic (+1 per five levels).', (l) => ({ dr: [{ amount: 1 + Math.floor(l / 5), bypass: 'magic' }] })),
  resistance: J('Resistance', 'Energy resistance 2 to a chosen energy (+2 per three levels).', (l, t, energy) => ({ resist: { [energy || 'fire']: 2 + 2 * Math.floor(l / 3) } })),
  smiting: J("Smiting", 'Weapons count as magic (and aligned at 6th, adamantine at 10th) for DR.', (l) => ({ flags: ['weaponMagic', ...(l >= 10 ? ['weaponAdamantine'] : [])] })),
};

// ------------------------------------------------------------------- Oracle
const MYSTERIES = {
  battle: o('Battle', 'Mystery of war and strength of arms.', { classSkills: ['intimidate', 'knowledge-engineering', 'perception', 'ride'], spells: { 2: 'enlarge-person', 4: 'fog-cloud', 6: 'magic-vestment', 8: 'wall-of-fire', 10: 'righteous-might', 12: 'mass-bulls-strength', 14: 'control-weather', 16: 'earthquake', 18: 'storm-of-vengeance' } }),
  bones: o('Bones', 'Mystery of death and undeath.', { classSkills: ['bluff', 'disguise', 'intimidate', 'stealth'], spells: { 2: 'cause-fear', 4: 'false-life', 6: 'animate-dead', 8: 'fear', 10: 'slay-living', 12: 'circle-of-death', 14: 'control-undead', 16: 'horrid-wilting', 18: 'wail-of-the-banshee' } }),
  flame: o('Flame', 'Mystery of fire.', { classSkills: ['acrobatics', 'climb', 'intimidate', 'perform'], spells: { 2: 'burning-hands', 4: 'resist-energy', 6: 'fireball', 8: 'wall-of-fire', 10: 'summon-monster-v', 12: 'fire-seeds', 14: 'fire-storm', 16: 'incendiary-cloud', 18: 'fiery-body' } }),
  heavens: o('Heavens', 'Mystery of the stars and sky.', { classSkills: ['fly', 'knowledge-arcana', 'perception', 'survival'], spells: { 2: 'color-spray', 4: 'hypnotic-pattern', 6: 'daylight', 8: 'rainbow-pattern', 10: 'overland-flight', 12: 'chain-lightning', 14: 'prismatic-spray', 16: 'sunburst', 18: 'meteor-swarm' } }),
  life: o('Life', 'Mystery of healing and vitality.', { classSkills: ['handle-animal', 'knowledge-nature', 'survival'], spells: { 2: 'detect-undead', 4: 'lesser-restoration', 6: 'neutralize-poison', 8: 'restoration', 10: 'breath-of-life', 12: 'heal', 14: 'greater-restoration', 16: 'mass-heal', 18: 'true-resurrection' } }),
  lore: o('Lore', 'Mystery of knowledge.', { classSkills: ['appraise', 'knowledge-arcana', 'knowledge-dungeoneering', 'knowledge-engineering', 'knowledge-geography', 'knowledge-history', 'knowledge-local', 'knowledge-nature', 'knowledge-nobility', 'knowledge-planes', 'knowledge-religion'], spells: { 2: 'identify', 4: 'tongues', 6: 'locate-object', 8: 'legend-lore', 10: 'contact-other-plane', 12: 'mass-owls-wisdom', 14: 'vision', 16: 'moment-of-prescience', 18: 'time-stop' } }),
  nature: o('Nature', 'Mystery of the wild world.', { classSkills: ['climb', 'fly', 'knowledge-nature', 'ride', 'survival', 'swim'], spells: { 2: 'charm-animal', 4: 'barkskin', 6: 'speak-with-plants', 8: 'grove-of-respite', 10: 'awaken', 12: 'stone-tell', 14: 'creeping-doom', 16: 'animal-shapes', 18: 'world-wave' } }),
  stone: o('Stone', 'Mystery of earth and endurance.', { classSkills: ['appraise', 'climb', 'intimidate', 'survival'], spells: { 2: 'magic-stone', 4: 'stone-call', 6: 'meld-into-stone', 8: 'wall-of-stone', 10: 'stoneskin', 12: 'stone-tell', 14: 'statue', 16: 'repel-metal-or-stone', 18: 'clashing-rocks' } }),
  waves: o('Waves', 'Mystery of water and ice.', { classSkills: ['acrobatics', 'escape-artist', 'knowledge-nature', 'swim'], spells: { 2: 'touch-of-the-sea', 4: 'slipstream', 6: 'water-breathing', 8: 'wall-of-ice', 10: 'geyser', 12: 'fluid-form', 14: 'vortex', 16: 'seamantle', 18: 'tsunami' } }),
  wind: o('Wind', 'Mystery of air and storms.', { classSkills: ['acrobatics', 'escape-artist', 'fly', 'stealth'], spells: { 2: 'alter-winds', 4: 'gust-of-wind', 6: 'cloak-of-winds', 8: 'river-of-wind', 10: 'control-winds', 12: 'sirocco', 14: 'control-weather', 16: 'whirlwind', 18: 'winds-of-vengeance' } }),
};

const ol = (c) => c.prog('mysteryLevel');
const scaleResist = (c) => { const l = ol(c); return l >= 17 ? Infinity : l >= 11 ? 20 : l >= 5 ? 10 : 5; };
const armorRev = (name, desc, dr) => o(name, desc, { abilities: [`rev:${name.toLowerCase().replace(/\s+/g, '-')}`] });
const rev = (mystery, name, description, extra = {}) => o(name, description, { mystery, ...extra });

// Revelations, keyed "mystery:revelation". minLevel = oracle level.
const REVELATIONS = {
  // Battle
  'battle:battlecry': rev('battle', 'Battlecry', 'Standard action: allies within 100 ft. gain +1 morale on attacks, skill checks and saves for Cha mod rounds (+2 at 10th). 1/day +1 per five levels.', { abilities: ['battlecry'] }),
  'battle:battlefield-clarity': rev('battle', 'Battlefield Clarity', 'Once per day (more at 7th and 15th), reroll a failed save against blinded, deafened, fear, paralyzed or stunned effects with +4.'),
  'battle:combat-healer': rev('battle', 'Combat Healer', 'Spend two spell slots to cast a cure spell as a swift action (1/day at 7th, +1 per four levels).', { minLevel: 7 }),
  'battle:iron-skin': rev('battle', 'Iron Skin', 'Once per day (twice at 15th), gain stoneskin (DR 10/adamantine).', { minLevel: 11, abilities: ['iron-skin'] }),
  'battle:maneuver-mastery': rev('battle', 'Maneuver Mastery', 'Use oracle level as BAB for one combat maneuver; the Improved feat at 7th and Greater at 11th.'),
  'battle:resiliency': rev('battle', 'Resiliency', 'Not disabled at 0 hp; Diehard at 7th.', { grantsFeatsAt: { 7: ['diehard'] } }),
  'battle:skill-at-arms': rev('battle', 'Skill at Arms', 'Proficiency with all martial weapons and heavy armor.', { proficiencies: { weapons: ['martial'], armor: ['heavy'] } }),
  'battle:surprising-charge': rev('battle', 'Surprising Charge', 'Once per day (more at 7th and 15th), move up to your speed as an immediate action.'),
  'battle:war-sight': rev('battle', 'War Sight', 'Roll initiative twice and take either result (three times at 11th); always act in the surprise round at 7th.', { flags: (c) => [ol(c) >= 11 ? 'initiativeRolls:3' : 'initiativeRolls:2'] }),
  'battle:weapon-mastery': rev('battle', 'Weapon Mastery', 'Weapon Focus with a chosen weapon; Improved Critical at 8th and Greater Weapon Focus at 12th.'),
  // Bones
  'bones:armor-of-bones': rev('bones', 'Armor of Bones', '+4 armor bonus (+2 at 7th and every four levels), DR 5/bludgeoning at 13th; 1 hour per level per day.', { abilities: ['armor-of-bones'] }),
  'bones:bleeding-wounds': rev('bones', 'Bleeding Wounds', 'Creatures damaged by your negative energy spells bleed 1 (+1 at 5th and every five levels).'),
  'bones:deaths-touch': rev('bones', "Death's Touch", 'Melee touch: 1d6 + 1 per two levels negative energy (heals undead). 3 + Cha times per day.', { abilities: ['deaths-touch'] }),
  'bones:near-death': rev('bones', 'Near Death', '+2 insight on saves vs disease, mind-affecting effects and poison (also death, sleep, stun at 7th; +4 at 11th).', { modifiers: (c) => [mod('save', ol(c) >= 11 ? 4 : 2, 'insight', 'Near death', ['disease', 'mind-affecting', 'poison', ...(ol(c) >= 7 ? ['death', 'sleep', 'stun'] : [])])] }),
  'bones:raise-the-dead': rev('bones', 'Raise the Dead', 'Once per day, summon a skeleton or zombie for Cha mod rounds.'),
  'bones:resist-life': rev('bones', 'Resist Life', 'You are treated as undead for positive and negative energy; channel resistance +2 at 7th.', { flags: () => ['healedByNegative'] }),
  'bones:soul-siphon': rev('bones', 'Soul Siphon', 'Ranged touch: target gains a negative level for Cha mod minutes and you heal hp equal to your oracle level.', { minLevel: 7, abilities: ['soul-siphon'] }),
  'bones:spirit-walk': rev('bones', 'Spirit Walk', 'Become incorporeal and invisible for rounds equal to your oracle level once per day.', { minLevel: 11 }),
  'bones:undead-servitude': rev('bones', 'Undead Servitude', 'Command Undead as a bonus feat; channel negative energy 3 + Cha times per day for it.', { grantsFeats: ['command-undead'] }),
  'bones:voice-of-the-grave': rev('bones', 'Voice of the Grave', 'Speak with dead for rounds per day equal to your oracle level.'),
  // Flame
  'flame:burning-magic': rev('flame', 'Burning Magic', 'Creatures that fail a save against your fire spells catch fire (1 fire per spell level for 1d4 rounds).', { flags: () => ['burningMagic'] }),
  'flame:cinder-dance': rev('flame', 'Cinder Dance', '+10 ft. base speed; Nimble Moves at 5th and Acrobatic Steps at 10th.', { modifiers: () => [mod('speed', 10, 'untyped', 'Cinder dance')], grantsFeatsAt: { 5: ['nimble-moves'], 10: ['acrobatic-steps'] } }),
  'flame:fire-breath': rev('flame', 'Fire Breath', '15-ft. cone of fire: 1d4 per oracle level (Reflex half). 1/day +1 per five levels.', { abilities: ['fire-breath'] }),
  'flame:firestorm': rev('flame', 'Firestorm', 'Once per day, fill one 10-ft. cube per level with fire (1d6 per level, Reflex half) for Cha mod rounds.', { minLevel: 11, abilities: ['firestorm'] }),
  'flame:form-of-flame': rev('flame', 'Form of Flame', 'Once per day, become a fire elemental (Small at 7th, Medium at 9th, Large at 11th, Huge at 13th) for 1 hour per level.', { minLevel: 7, abilities: ['form-of-flame'] }),
  'flame:gaze-of-flames': rev('flame', 'Gaze of Flames', 'See through fire, fog and smoke without penalty; clairvoyance through fire at 7th.'),
  'flame:heat-aura': rev('flame', 'Heat Aura', 'Swift action: 1d4 fire per two levels to creatures within 10 ft. (Reflex half) and 20% concealment. 1/day +1 per five levels.', { abilities: ['heat-aura'] }),
  'flame:molten-skin': rev('flame', 'Molten Skin', 'Fire resistance 5 (10 at 5th, 20 at 11th, immunity at 17th).', { resistances: (c) => ({ fire: scaleResist(c) }) }),
  'flame:touch-of-flame': rev('flame', 'Touch of Flame', 'Melee touch: 1d6 + 1 per two levels fire. 3 + Cha times per day; weapons are flaming at 11th.', { abilities: ['touch-of-flame'] }),
  'flame:wings-of-fire': rev('flame', 'Wings of Fire', 'Swift action: fly 60 ft. (average) for 1 minute per level per day.', { minLevel: 7, abilities: ['wings-of-fire'] }),
  // Heavens
  'heavens:awesome-display': rev('heavens', 'Awesome Display', 'Your illusion (pattern) spells treat targets as having fewer HD (minus your Cha mod).'),
  'heavens:coat-of-many-stars': rev('heavens', 'Coat of Many Stars', '+4 armor bonus (+2 at 7th and every four levels), DR 5/slashing at 13th; 1 hour per level per day.', { abilities: ['coat-of-many-stars'] }),
  'heavens:dweller-in-darkness': rev('heavens', 'Dweller in Darkness', 'Once per day, phantasmal killer (weird at 17th).', { minLevel: 11 }),
  'heavens:guiding-star': rev('heavens', 'Guiding Star', 'Under the night sky: add Cha to Wis checks and apply a free metamagic once per night.'),
  'heavens:interstellar-void': rev('heavens', 'Interstellar Void', 'Target within 30 ft. takes 1d6 cold per level (Fort half; fatigued at 10th, exhausted and stunned at 15th). 1/day, 2/day at 10th.', { abilities: ['interstellar-void'] }),
  'heavens:lure-of-the-heavens': rev('heavens', 'Lure of the Heavens', 'Leave no tracks; hover at 5th; fly minutes per day equal to your level at 10th.', { flags: (c) => ['noTracks', ...(ol(c) >= 10 ? ['fly:60'] : [])] }),
  'heavens:mantle-of-moonlight': rev('heavens', 'Mantle of Moonlight', 'Immune to lycanthropy; touch forces a lycanthrope into humanoid form.'),
  'heavens:moonlight-bridge': rev('heavens', 'Moonlight Bridge', 'Create a bridge of moonlight 10 ft. per level long, Cha bonus times per day.'),
  'heavens:spray-of-shooting-stars': rev('heavens', 'Spray of Shooting Stars', 'Ball of fire within 60 ft. bursts for 1d4 fire per level in a 5-ft. radius (Reflex half). 1/day +1 per five levels.', { abilities: ['spray-of-shooting-stars'] }),
  'heavens:star-chart': rev('heavens', 'Star Chart', 'Once per day, gain the effects of commune.', { minLevel: 7 }),
  // Life
  'life:channel': rev('life', 'Channel', 'Channel positive energy as a cleric of your oracle level, 1 + Cha times per day.', { abilities: ['channel-energy-oracle'], resources: (c) => ({ oracleChannel: { max: 1 + Math.max(0, c.baseAbilityMod('cha')) + (c.hasFeat('extra-channel') ? 2 * c.featCount('extra-channel') : 0), per: 'day' } }) }),
  'life:combat-healer': rev('life', 'Combat Healer', 'Spend two spell slots to cast a cure spell as a swift action (1/day at 7th, +1 per four levels).', { minLevel: 7 }),
  'life:delay-affliction': rev('life', 'Delay Affliction', 'Once per day (more at 7th, 15th), ignore a failed save against disease or poison for 1 hour per level.'),
  'life:energy-body': rev('life', 'Energy Body', 'Become living energy for rounds equal to your level: undead touching you take 1d6 + level; allies passing heal 1d6 + level.'),
  'life:enhanced-cures': rev('life', 'Enhanced Cures', 'Cure spells add your full oracle level (not capped) to the healing.', { flags: () => ['enhancedCures'] }),
  'life:healing-hands': rev('life', 'Healing Hands', '+4 on Heal checks; treat two patients at once.', { modifiers: () => [mod('skill.heal', 4, 'untyped', 'Healing hands')] }),
  'life:life-link': rev('life', 'Life Link', 'Bond allies: each turn, a bonded ally 5+ below maximum heals 5 hp and you take 5 damage.'),
  'life:lifesense': rev('life', 'Lifesense', 'Notice living creatures within 30 ft. as blindsight.', { minLevel: 11, flags: () => ['blindsight:30'] }),
  'life:safe-curing': rev('life', 'Safe Curing', 'Healing spells do not provoke attacks of opportunity.', { flags: () => ['safeCuring'] }),
  'life:spirit-boost': rev('life', 'Spirit Boost', 'Excess healing becomes temporary hp (up to your oracle level) for 1 round per level.'),
  // Lore
  'lore:arcane-archivist': rev('lore', 'Arcane Archivist', 'Once per day, cast a sorcerer/wizard spell from a spellbook using a slot one level higher.', { minLevel: 11 }),
  'lore:automatic-writing': rev('lore', 'Automatic Writing', 'Once per day: augury (divination at 5th, commune at 8th).'),
  'lore:brain-drain': rev('lore', 'Brain Drain', 'Probe an enemy within 100 ft.: 1d4 per level damage (Will negates). 1/day +1 per five levels.', { abilities: ['brain-drain'] }),
  'lore:focused-trance': rev('lore', 'Focused Trance', 'Enter a trance: +level on saves vs sonic and gaze, then an Int-based skill check at +20.'),
  'lore:lore-keeper': rev('lore', 'Lore Keeper', 'Use Cha instead of Int for Knowledge checks.', { flags: () => ['knowledgeUsesCha'] }),
  'lore:mental-acuity': rev('lore', 'Mental Acuity', '+1 inherent Int, +1 more every three levels after 7th.', { minLevel: 7, modifiers: (c) => [mod('int', 1 + Math.floor((ol(c) - 7) / 3), 'inherent', 'Mental acuity')] }),
  'lore:sidestep-secret': rev('lore', 'Sidestep Secret', 'Use Cha instead of Dex for AC and Reflex saves.', { flags: () => ['dexFromCha'] }),
  'lore:spontaneous-symbology': rev('lore', 'Spontaneous Symbology', 'Cast any symbol spell using a slot of the right level.', { minLevel: 11 }),
  'lore:think-on-it': rev('lore', 'Think On It', 'Once per day, reroll a failed Knowledge check at +10.'),
  'lore:whirlwind-lesson': rev('lore', 'Whirlwind Lesson', 'Absorb a magic tome in 8 hours; share the benefit at 7th.'),
  // Nature
  'nature:bonded-mount': rev('nature', 'Bonded Mount', 'An intelligent mount that acts as an animal companion (effective druid level = oracle level).', { progressions: { companionLevel: (c) => ol(c) }, onPick: (c, choices) => require('./classOptions').grantCompanion(c, { ...choices, companion: choices.companion || 'horse' }) }),
  'nature:erosion-touch': rev('nature', 'Erosion Touch', 'Melee touch deals 1d6 per level to objects or constructs. 1/day +1 per three levels.'),
  'nature:friend-to-the-animals': rev('nature', 'Friend to the Animals', "Add all summon nature's ally spells to your spells known; animals within 30 ft. add your Cha mod to saves.", { flags: () => ['friendToAnimals'] }),
  'nature:life-leach': rev('nature', 'Life Leach', 'Drain 1d6 per two levels (max 10d6) from a living creature within 30 ft. (Fort half) and gain that many temporary hp.', { minLevel: 7, abilities: ['life-leach'] }),
  'nature:natural-divination': rev('nature', 'Natural Divination', 'Spend 10 minutes to gain +Cha insight on a save, +10 on a skill check or +4 on initiative.'),
  'nature:natures-whispers': rev('nature', "Nature's Whispers", 'Use Cha instead of Dex for AC and CMD.', { flags: () => ['dexFromCha'] }),
  'nature:speak-with-animals': rev('nature', 'Speak with Animals', 'Speak with one kind of animal (+1 kind per three levels).'),
  'nature:spirit-of-nature': rev('nature', 'Spirit of Nature', 'Automatically stabilize in natural settings; fast healing at 5th and 15th.'),
  'nature:transcendental-bond': rev('nature', 'Transcendental Bond', 'Telepathic link with Cha mod allies.'),
  'nature:undo-artifice': rev('nature', 'Undo Artifice', 'Reduce a nonliving object to raw materials.', { minLevel: 11 }),
  // Stone
  'stone:acid-skin': rev('stone', 'Acid Skin', 'Acid resistance 5 (10 at 5th, 20 at 11th, immunity at 17th).', { resistances: (c) => ({ acid: scaleResist(c) }) }),
  'stone:clobbering-strike': rev('stone', 'Clobbering Strike', 'On a critical hit with an attack-roll spell, make a free trip attempt.'),
  'stone:crystal-sight': rev('stone', 'Crystal Sight', 'See through stone and earth for rounds per day equal to your level.'),
  'stone:earth-glide': rev('stone', 'Earth Glide', 'Swim through earth for 1 minute per level per day.', { minLevel: 7 }),
  'stone:mighty-pebble': rev('stone', 'Mighty Pebble', 'Thrown pebble: 1d6 per two levels bludgeoning plus splash. 1/day +1 per five levels.', { abilities: ['mighty-pebble'] }),
  'stone:rock-throwing': rev('stone', 'Rock Throwing', 'Throw rocks for 2d4 + 1.5 x Str damage (+1 attack).'),
  'stone:shard-explosion': rev('stone', 'Shard Explosion', 'Swift action: 1d6 per two levels piercing in a 10-ft. burst (Reflex half). 1/day +1 per five levels.', { abilities: ['shard-explosion'] }),
  'stone:steelbreaker-skin': rev('stone', 'Steelbreaker Skin', 'Weapons striking you take damage equal to your level.', { minLevel: 7 }),
  'stone:stone-stability': rev('stone', 'Stone Stability', '+4 CMD vs bull rush and trip; Improved Trip at 5th, Greater Trip at 10th.', { modifiers: () => [mod('cmd', 4, 'untyped', 'Stone stability', ['bullRush', 'trip'])], grantsFeatsAt: { 5: ['improved-trip'], 10: ['greater-trip'] } }),
  'stone:touch-of-acid': rev('stone', 'Touch of Acid', 'Melee touch: 1d6 + 1 per two levels acid. 3 + Cha times per day.', { abilities: ['touch-of-acid'] }),
  // Waves
  'waves:blizzard': rev('waves', 'Blizzard', 'Once per day, fill one 10-ft. cube per level with a blizzard (1d4 cold per level, Reflex half).', { minLevel: 11, abilities: ['blizzard'] }),
  'waves:fluid-nature': rev('waves', 'Fluid Nature', '+4 CMD vs bull rush, drag, grapple, reposition and trip; -4 to foes confirming crits on you; Dodge at 5th.', { modifiers: () => [mod('cmd', 4, 'untyped', 'Fluid nature', ['bullRush', 'grapple', 'trip', 'reposition', 'drag'])], grantsFeatsAt: { 5: ['dodge'] } }),
  'waves:fluid-travel': rev('waves', 'Fluid Travel', 'Walk on liquids; swim 60 ft. and breathe water at 7th.', { flags: () => ['waterWalk'] }),
  'waves:freezing-spells': rev('waves', 'Freezing Spells', 'Creatures failing a save against your cold spells are slowed 1 round (1d4 at 11th).', { flags: () => ['freezingSpells'] }),
  'waves:ice-armor': rev('waves', 'Ice Armor', '+4 armor bonus (+2 at 7th and every four levels), DR 5/piercing at 13th; 1 hour per level per day.', { abilities: ['ice-armor'] }),
  'waves:icy-skin': rev('waves', 'Icy Skin', 'Cold resistance 5 (10 at 5th, 20 at 11th, immunity at 17th).', { resistances: (c) => ({ cold: scaleResist(c) }) }),
  'waves:punitive-transformation': rev('waves', 'Punitive Transformation', 'Baleful polymorph an opponent for 1 round per level, Cha mod times per day.', { minLevel: 7 }),
  'waves:water-form': rev('waves', 'Water Form', 'Once per day, become a water elemental for 1 hour per level.', { minLevel: 7, abilities: ['water-form'] }),
  'waves:water-sight': rev('waves', 'Water Sight', 'See through fog and mist; scry through water at 7th.'),
  'waves:wintry-touch': rev('waves', 'Wintry Touch', 'Melee touch: 1d6 + 1 per two levels cold. 3 + Cha times per day; weapons are frost at 11th.', { abilities: ['wintry-touch'] }),
  // Wind
  'wind:air-barrier': rev('wind', 'Air Barrier', '+4 armor bonus (+2 at 7th and every four levels); 50% miss chance vs ranged at 13th; 1 hour per level per day.', { abilities: ['air-barrier'] }),
  'wind:gaseous-form': rev('wind', 'Gaseous Form', 'Gaseous form for 1 minute per level per day.', { minLevel: 7 }),
  'wind:invisibility': rev('wind', 'Invisibility', 'Invisibility for 1 minute per level per day (greater invisibility at 9th).', { minLevel: 3, abilities: ['oracle-invisibility'] }),
  'wind:lightning-breath': rev('wind', 'Lightning Breath', '30-ft. line of electricity: 1d4 per level (Reflex half). 1/day +1 per five levels.', { abilities: ['lightning-breath'] }),
  'wind:spark-skin': rev('wind', 'Spark Skin', 'Electricity resistance 5 (10 at 5th, 20 at 11th, immunity at 17th).', { resistances: (c) => ({ electricity: scaleResist(c) }) }),
  'wind:thunderburst': rev('wind', 'Thunderburst', '20-ft.-radius blast within 100 ft.: 1d6 per level bludgeoning and deafened (Fort half).', { minLevel: 7, abilities: ['thunderburst'] }),
  'wind:touch-of-electricity': rev('wind', 'Touch of Electricity', 'Melee touch: 1d6 + 1 per two levels electricity. 3 + Cha times per day; weapons are shock at 11th.', { abilities: ['touch-of-electricity'] }),
  'wind:vortex-spells': rev('wind', 'Vortex Spells', 'A critical hit with an attack spell staggers the target 1 round (1d4 at 11th).'),
  'wind:wind-sight': rev('wind', 'Wind Sight', 'Ignore wind penalties to Perception; clairaudience/clairvoyance at 7th.'),
  'wind:wings-of-air': rev('wind', 'Wings of Air', 'Swift action: fly 60 ft. (good), 90 ft. at 10th, for 1 minute per level per day.', { minLevel: 7, abilities: ['wings-of-air'] }),
};
for (const r of Object.values(REVELATIONS)) r.validate = (c) => (c.choices.mystery === r.mystery ? null : `${r.name} belongs to the ${r.mystery} mystery`);

const curseLevel = (c) => c.classLevel('oracle') + Math.floor((c.hitDice() - c.classLevel('oracle')) / 2);
const CURSES = {
  'clouded-vision': o('Clouded Vision', 'Cannot see beyond 30 ft. but has darkvision 30 ft. (60 ft. at 5th); blindsense 30 ft. at 10th; blindsight 15 ft. at 15th.', { flags: (c) => [`visionLimit:${curseLevel(c) >= 5 ? 60 : 30}`, `darkvision:${curseLevel(c) >= 5 ? 60 : 30}`, ...(curseLevel(c) >= 10 ? ['blindsense:30'] : []), ...(curseLevel(c) >= 15 ? ['blindsight:15'] : [])] }),
  deaf: o('Deaf', 'Deafened; casts all spells as if silent (no level increase). +3 Perception (not hearing) and -2 initiative at 5th; scent and no initiative penalty at 10th; tremorsense 30 ft. at 15th.', { flags: (c) => ['deaf', 'silentCasting', ...(curseLevel(c) >= 10 ? ['scent'] : []), ...(curseLevel(c) >= 15 ? ['tremorsense:30'] : [])], modifiers: (c) => [mod('initiative', curseLevel(c) >= 10 ? 0 : curseLevel(c) >= 5 ? -2 : -4, 'untyped', 'Deaf curse'), ...(curseLevel(c) >= 5 ? [mod('skill.perception', 3, 'competence', 'Deaf curse')] : [])] }),
  haunted: o('Haunted', 'Retrieving stored items is a standard action. Adds mage hand and ghost sound (levitate and minor image at 5th, telekinesis at 10th, reverse gravity at 15th) to spells known.', { bonusSpells: { 1: ['mage-hand', 'ghost-sound'], 5: ['levitate', 'minor-image'], 10: ['telekinesis'], 15: ['reverse-gravity'] } }),
  lame: o('Lame', 'Base speed -10 ft. (-5 if under 30); encumbrance never reduces speed. Immune to fatigue at 5th; armor never slows you at 10th; immune to exhaustion at 15th.', { modifiers: (c) => [mod('speed', c.raceDef().speed >= 30 ? -10 : -5, 'untyped', 'Lame curse')], flags: (c) => [...(curseLevel(c) >= 5 ? ['immune:fatigued'] : []), ...(curseLevel(c) >= 15 ? ['immune:exhausted'] : [])] }),
  tongues: o('Tongues', 'In combat you can only speak a chosen outsider language; a second at 5th; understand any language at 10th; speak any at 15th.'),
  wasting: o('Wasting', '-4 on Cha-based skill checks except Intimidate; +4 competence on saves vs disease. Immune to sickened at 5th, disease at 10th, nauseated at 15th.', {
    modifiers: () => ['bluff', 'diplomacy', 'disguise', 'handle-animal', 'perform', 'use-magic-device'].map((s) => mod(`skill.${s}`, -4, 'untyped', 'Wasting curse')).concat([mod('save', 4, 'competence', 'Wasting curse', ['disease'])]),
    flags: (c) => [...(curseLevel(c) >= 5 ? ['immune:sickened'] : []), ...(curseLevel(c) >= 10 ? ['immune:disease'] : []), ...(curseLevel(c) >= 15 ? ['immune:nauseated'] : [])],
  }),
};

// --------------------------------------------------------------------- Witch
const HEXES = {
  cackle: o('Cackle', 'Move action: extend agony, charm, evil eye, fortune and misfortune on creatures within 30 ft. by 1 round.', { abilities: ['cackle'] }),
  cauldron: o('Cauldron', 'Brew Potion as a bonus feat; +4 insight on Craft (alchemy).', { grantsFeats: ['brew-potion'], modifiers: () => [mod('skill.craft', 4, 'insight', 'Cauldron hex', ['alchemy'])] }),
  charm: o('Charm', 'An animal or humanoid within 30 ft. improves its attitude by one step (two at 8th) for Int mod rounds (Will negates).', { abilities: ['hex-charm'] }),
  coven: o('Coven', 'Count as a hag for coven purposes; aid another grants +1 caster level to another coven witch.'),
  disguise: o('Disguise', 'Disguise self for 1 hour per witch level per day.'),
  'evil-eye': o('Evil Eye', 'Target within 30 ft. takes -2 (-4 at 8th) on AC, ability checks, attacks, saves or skill checks for 3 + Int rounds (1 round on a Will save).', { abilities: ['evil-eye'] }),
  flight: o('Flight', 'Feather fall at will and +4 Swim; levitate 1/day at 3rd; fly for 1 minute per level per day at 5th.', { modifiers: () => [mod('skill.swim', 4, 'untyped', 'Flight hex')], abilities: ['hex-flight'] }),
  fortune: o('Fortune', 'An ally within 30 ft. rolls twice and takes the better result once per round for 1 round (+1 at 8th and 16th); once per day per creature.', { abilities: ['fortune'] }),
  healing: o('Healing', 'Touch: cure light wounds (cure moderate at 5th); once per day per creature.', { abilities: ['hex-healing'] }),
  misfortune: o('Misfortune', 'Creature within 30 ft. rolls twice and takes the worse result for 1 round (+1 at 8th and 16th); Will negates; once per day per creature.', { abilities: ['misfortune'] }),
  slumber: o('Slumber', 'Creature within 30 ft. falls asleep for rounds equal to your level (Will negates; damage wakes it); once per day per creature.', { abilities: ['slumber'] }),
  tongues: o('Tongues', 'Understand any language for minutes per day equal to your level; speak any language at 5th.'),
  ward: o('Ward', 'An ally gains +2 deflection AC and +2 resistance on saves (+3 at 8th, +4 at 16th) until hit or failing a save; one ward at a time.', { abilities: ['ward'] }),
  // Major hexes (10th)
  agony: o('Agony', 'Major hex: creature within 60 ft. is nauseated for rounds equal to your level (Fort negates; new save each round); once per day per creature.', { minLevel: 10, major: true, abilities: ['agony'] }),
  'hags-eye': o("Hag's Eye", 'Major hex: create an arcane eye for minutes per day equal to your level.', { minLevel: 10, major: true }),
  'major-healing': o('Major Healing', 'Major hex: touch acts as cure serious wounds (cure critical at 15th); once per day per creature.', { minLevel: 10, major: true, abilities: ['major-healing'] }),
  nightmares: o('Nightmares', 'Major hex: the target suffers a nightmare whenever it rests (Will negates).', { minLevel: 10, major: true }),
  retribution: o('Retribution', 'Major hex: a creature within 60 ft. takes half the melee damage it deals for Int mod rounds (Will negates).', { minLevel: 10, major: true, abilities: ['retribution'] }),
  vision: o('Vision', 'Major hex: grant a glimpse of the future to a touched creature.', { minLevel: 10, major: true }),
  'waxen-image': o('Waxen Image', 'Major hex: control a creature within 30 ft. for Int mod standard actions (Will negates each use).', { minLevel: 10, major: true, abilities: ['waxen-image'] }),
  'weather-control': o('Weather Control', 'Major hex: control weather once per day (1 hour of chanting).', { minLevel: 10, major: true }),
  // Grand hexes (18th)
  'animal-servant': o('Animal Servant', 'Grand hex: turn a humanoid into an animal (beast shape II) under your control (Will negates).', { minLevel: 18, grand: true }),
  'death-curse': o('Death Curse', 'Grand hex: creature within 30 ft. becomes fatigued, then exhausted, then dies on the third round unless it makes a Fort save (Will negates the curse).', { minLevel: 18, grand: true, abilities: ['death-curse'] }),
  'eternal-slumber': o('Eternal Slumber', 'Grand hex: touch puts a creature into permanent sleep (Will negates).', { minLevel: 18, grand: true, abilities: ['eternal-slumber'] }),
  'forced-reincarnation': o('Forced Reincarnation', 'Grand hex: creature within 30 ft. dies and is reincarnated (Will negates).', { minLevel: 18, grand: true }),
  'life-giver': o('Life Giver', 'Grand hex: once per day, resurrection without a material component.', { minLevel: 18, grand: true, abilities: ['life-giver'] }),
  'natural-disaster': o('Natural Disaster', 'Grand hex: once per day, storm of vengeance plus an earthquake.', { minLevel: 18, grand: true }),
};

const PATRONS = {
  agility: o('Agility', 'Patron of grace and speed.', { spells: ['jump', 'cats-grace', 'haste', 'freedom-of-movement', 'polymorph', 'mass-cats-grace', 'ethereal-jaunt', 'animal-shapes', 'shapechange'] }),
  animals: o('Animals', 'Patron of beasts.', { spells: ['charm-animal', 'speak-with-animals', 'dominate-animal', 'summon-natures-ally-iv', 'animal-growth', 'antilife-shell', 'beast-shape-iv', 'animal-shapes', 'summon-natures-ally-ix'] }),
  deception: o('Deception', 'Patron of lies and illusion.', { spells: ['ventriloquism', 'invisibility', 'blink', 'confusion', 'passwall', 'programmed-image', 'mass-invisibility', 'scintillating-pattern', 'time-stop'] }),
  elements: o('Elements', 'Patron of fire, ice and storm.', { spells: ['shocking-grasp', 'flaming-sphere', 'fireball', 'wall-of-ice', 'flame-strike', 'freezing-sphere', 'vortex', 'fire-storm', 'meteor-swarm'] }),
  endurance: o('Endurance', 'Patron of resilience.', { spells: ['endure-elements', 'bears-endurance', 'protection-from-energy', 'spell-immunity', 'spell-resistance', 'mass-bears-endurance', 'greater-restoration', 'iron-body', 'miracle'] }),
  plague: o('Plague', 'Patron of disease and undeath.', { spells: ['detect-undead', 'command-undead', 'contagion', 'animate-dead', 'giant-vermin', 'create-undead', 'control-undead', 'create-greater-undead', 'energy-drain'] }),
  shadow: o('Shadow', 'Patron of darkness and shades.', { spells: ['silent-image', 'darkness', 'deeper-darkness', 'shadow-conjuration', 'shadow-evocation', 'shadow-walk', 'greater-shadow-conjuration', 'greater-shadow-evocation', 'shades'] }),
  strength: o('Strength', 'Patron of might.', { spells: ['divine-favor', 'bulls-strength', 'greater-magic-weapon', 'divine-power', 'righteous-might', 'mass-bulls-strength', 'giant-form-i', 'giant-form-ii', 'shapechange'] }),
  transformation: o('Transformation', 'Patron of change.', { spells: ['jump', 'bears-endurance', 'beast-shape-i', 'beast-shape-ii', 'beast-shape-iii', 'form-of-the-dragon-i', 'form-of-the-dragon-ii', 'form-of-the-dragon-iii', 'shapechange'] }),
  trickery: o('Trickery', 'Patron of mischief.', { spells: ['animate-rope', 'mirror-image', 'major-image', 'hallucinatory-terrain', 'mirage-arcana', 'mislead', 'reverse-gravity', 'screen', 'time-stop'] }),
  water: o('Water', 'Patron of seas and rivers.', { spells: ['curse-water', 'slipstream', 'water-breathing', 'control-water', 'geyser', 'elemental-body-iii', 'elemental-body-iv', 'seamantle', 'tsunami'] }),
  wisdom: o('Wisdom', 'Patron of insight and warding.', { spells: ['shield-of-faith', 'owls-wisdom', 'magic-vestment', 'lesser-globe-of-invulnerability', 'dream', 'globe-of-invulnerability', 'spell-turning', 'protection-from-spells', 'mages-disjunction'] }),
};

// Familiars (Core Rulebook): the special ability the master gains.
const FAMILIARS = {
  bat: o('Bat', 'Master gains +3 on Fly checks.', { modifiers: () => [mod('skill.fly', 3, 'untyped', 'Bat familiar')] }),
  cat: o('Cat', 'Master gains +3 on Stealth checks.', { modifiers: () => [mod('skill.stealth', 3, 'untyped', 'Cat familiar')] }),
  hawk: o('Hawk', 'Master gains +3 on sight-based Perception checks in bright light.', { modifiers: () => [mod('skill.perception', 3, 'untyped', 'Hawk familiar', ['brightLight'])] }),
  lizard: o('Lizard', 'Master gains +3 on Climb checks.', { modifiers: () => [mod('skill.climb', 3, 'untyped', 'Lizard familiar')] }),
  monkey: o('Monkey', 'Master gains +3 on Acrobatics checks.', { modifiers: () => [mod('skill.acrobatics', 3, 'untyped', 'Monkey familiar')] }),
  owl: o('Owl', 'Master gains +3 on sight-based Perception checks in shadows.', { modifiers: () => [mod('skill.perception', 3, 'untyped', 'Owl familiar', ['dimLight'])] }),
  rat: o('Rat', 'Master gains +2 on Fortitude saves.', { modifiers: () => [mod('save.fort', 2, 'untyped', 'Rat familiar')] }),
  raven: o('Raven', 'Master gains +3 on Appraise checks.', { modifiers: () => [mod('skill.appraise', 3, 'untyped', 'Raven familiar')] }),
  toad: o('Toad', 'Master gains +3 hit points.', { modifiers: () => [mod('hp', 3, 'untyped', 'Toad familiar')] }),
  viper: o('Viper', 'Master gains +3 on Bluff checks.', { modifiers: () => [mod('skill.bluff', 3, 'untyped', 'Viper familiar')] }),
  weasel: o('Weasel', 'Master gains +2 on Reflex saves.', { modifiers: () => [mod('save.ref', 2, 'untyped', 'Weasel familiar')] }),
};

module.exports = { DISCOVERIES, GRAND_DISCOVERIES, CAVALIER_ORDERS, MOUNTS, JUDGMENTS, MYSTERIES, REVELATIONS, CURSES, HEXES, PATRONS, FAMILIARS, curseLevel, half, armorRev };
