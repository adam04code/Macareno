'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Class features. Each entry:
 *   name, description
 *   modifiers(c)  -> passive modifiers, evaluated live against the character
 *   flags(c)      -> engine flags (e.g. 'evasion', 'uncannyDodge')
 *   abilities     -> ids of activated abilities (src/engine/classAbilities.js)
 *   resources(c)  -> { resourceId: { max, per: 'day' } }
 *   naturalAttacks(c) -> natural weapons granted
 *
 * `c` is a Character (see src/engine/character.js): c.level, c.classLevel(id),
 * c.prog(name), c.abilityMod(a), c.choices, c.armorType(), c.hasShield(),
 * c.load(), c.hasFlag(flag), c.hasFeat(id).
 */

const f = (name, description, extra = {}) => ({ name, description, ...extra });
const unarmoredMonk = (c) => c.armorType() === 'none' && !c.hasShield() && c.load() === 'light';

const FEATURES = {
  // ------------------------------------------------------------------ Shared
  'fast-movement': f('Fast Movement', '+10 ft. land speed when wearing no heavy armor and not carrying a heavy load.', {
    modifiers: (c) => (c.armorType() !== 'heavy' && c.load() !== 'heavy' ? [mod('speed', 10, 'enhancement', 'Fast movement')] : []),
  }),
  'uncanny-dodge': f('Uncanny Dodge', 'Cannot be caught flat-footed and does not lose Dex bonus to AC against invisible attackers.', { flags: () => ['uncannyDodge'] }),
  'improved-uncanny-dodge': f('Improved Uncanny Dodge', 'Cannot be flanked except by a rogue with 4+ more levels than this character has in classes granting uncanny dodge.', { flags: () => ['improvedUncannyDodge'] }),
  'trap-sense': f('Trap Sense', 'Bonus on Reflex saves and dodge bonus to AC against traps.', {
    modifiers: (c) => [mod('save.ref', c.prog('trapSense'), 'untyped', 'Trap sense', ['trap']), mod('ac', c.prog('trapSense'), 'dodge', 'Trap sense', ['trap'])],
  }),
  evasion: f('Evasion', 'On a successful Reflex save against an effect that deals half damage, takes no damage instead (light or no armor).', {
    flags: (c) => (c.armorType() === 'none' || c.armorType() === 'light' ? ['evasion'] : []),
  }),
  'improved-evasion': f('Improved Evasion', 'As evasion, and takes only half damage on a failed Reflex save.', {
    flags: (c) => (c.armorType() === 'none' || c.armorType() === 'light' ? ['evasion', 'improvedEvasion'] : []),
  }),
  'sneak-attack': f('Sneak Attack', 'Extra precision damage (1d6 per sneak attack die) when the target is denied its Dex bonus to AC or is flanked.', { flags: () => ['sneakAttack'] }),
  'hide-in-plain-sight': f('Hide in Plain Sight', 'Can use Stealth even while being observed.', { flags: () => ['hideInPlainSight'] }),
  cantrips: f('Cantrips / Orisons', 'Knows or prepares 0-level spells, which are not expended when cast.'),
  orisons: f('Orisons', 'Prepares 0-level divine spells, which are not expended when cast.'),
  'damage-reduction': f('Damage Reduction', 'DR 1/— at 7th level, increasing by 1 every three levels.', { dr: (c) => [{ amount: c.prog('drUntyped'), bypass: '-' }] }),

  // --------------------------------------------------------------- Barbarian
  rage: f('Rage', 'Free action: +4 morale Str and Con, +2 morale on Will saves, -2 AC for 4 + Con mod rounds/day (+2 per level after 1st). Cannot use concentration or Int/Dex/Cha skills (except Acrobatics, Fly, Intimidate, Ride). Fatigued afterwards.', {
    abilities: ['rage'], resources: (c) => ({ rage: { max: c.prog('rageRounds') + Math.max(0, c.baseAbilityMod('con')) + (c.hasFeat('extra-rage') ? 6 * c.featCount('extra-rage') : 0), per: 'day', unit: 'rounds' } }),
  }),
  'rage-power': f('Rage Power', 'Gain a rage power (see rage power list).'),
  'greater-rage': f('Greater Rage', 'Rage bonuses increase to +6 Str/Con and +3 Will.'),
  'indomitable-will': f('Indomitable Will', '+4 on Will saves vs enchantment spells while raging.', { modifiers: (c) => (c.hasFlag('raging') ? [mod('save.will', 4, 'untyped', 'Indomitable will', ['enchantment'])] : []) }),
  'tireless-rage': f('Tireless Rage', 'No longer fatigued after raging.'),
  'mighty-rage': f('Mighty Rage', 'Rage bonuses increase to +8 Str/Con and +4 Will.'),

  // -------------------------------------------------------------------- Bard
  'bardic-knowledge': f('Bardic Knowledge', 'Adds half class level (min 1) to all Knowledge checks and may attempt them untrained.', {
    modifiers: (c) => require('./core').KNOWLEDGE_SKILLS.map((k) => mod(`skill.${k}`, c.prog('bardicKnowledge'), 'untyped', 'Bardic knowledge')),
    flags: () => ['knowledgeUntrained'],
  }),
  'bardic-performance': f('Bardic Performance', 'Perform for a number of rounds per day equal to 4 + Cha mod (+2 per level after 1st). Starting is a standard action (move at 7th, swift at 13th).', {
    resources: (c) => ({ performance: { max: c.prog('performanceRounds') + Math.max(0, c.baseAbilityMod('cha')) + (c.hasFeat('extra-performance') ? 6 * c.featCount('extra-performance') : 0), per: 'day', unit: 'rounds' } }),
  }),
  countersong: f('Countersong', 'Allies within 30 ft. may use the bard\'s Perform check in place of saves vs sonic/language-dependent magic.', { abilities: ['countersong'] }),
  distraction: f('Distraction', 'Allies may use the bard\'s Perform check in place of saves vs illusion (pattern/figment).', { abilities: ['distraction'] }),
  fascinate: f('Fascinate', 'Fascinate creatures within 90 ft. (Will DC 10 + 1/2 bard level + Cha negates).', { abilities: ['fascinate'] }),
  'inspire-courage': f('Inspire Courage', 'Allies gain +1 morale on saves vs charm/fear and +1 competence on attack and weapon damage (+2 at 5th, +3 at 11th, +4 at 17th).', { abilities: ['inspire-courage'] }),
  'versatile-performance': f('Versatile Performance', 'May substitute Perform ranks for associated skills.'),
  'well-versed': f('Well-Versed', '+4 on saves vs bardic performance, sonic and language-dependent effects.', { modifiers: () => [mod('save', 4, 'untyped', 'Well-versed', ['sonic', 'language-dependent', 'performance'])] }),
  'inspire-competence': f('Inspire Competence', 'An ally gains +2 competence on skill checks (+1 per four levels after 3rd).', { abilities: ['inspire-competence'] }),
  'lore-master': f('Lore Master', 'May take 10 on Knowledge checks; once per day take 20 (+1/day per six levels after 5th).'),
  suggestion: f('Suggestion', 'Make a suggestion to a fascinated creature (Will negates).', { abilities: ['suggestion-performance'] }),
  'dirge-of-doom': f('Dirge of Doom', 'Enemies within 30 ft. are shaken while they can hear the performance.', { abilities: ['dirge-of-doom'] }),
  'inspire-greatness': f('Inspire Greatness', 'Ally gains 2 bonus HD (temp hp), +2 competence attack, +1 competence Fort saves.', { abilities: ['inspire-greatness'] }),
  'jack-of-all-trades': f('Jack-of-All-Trades', 'May use any skill untrained; at 16th all skills are class skills; at 19th may take 10 on any skill.', { flags: () => ['allSkillsUntrained'] }),
  'soothing-performance': f('Soothing Performance', 'Creates the effect of mass cure serious wounds (CL = bard level).', { abilities: ['soothing-performance'] }),
  'frightening-tune': f('Frightening Tune', 'Enemies within 30 ft. are frightened (Will negates).', { abilities: ['frightening-tune'] }),
  'inspire-heroics': f('Inspire Heroics', 'Ally gains +4 morale on saves and +4 dodge AC.', { abilities: ['inspire-heroics'] }),
  'mass-suggestion': f('Mass Suggestion', 'Suggestion affects any number of fascinated creatures.'),
  'deadly-performance': f('Deadly Performance', 'Target dies of joy or sorrow (Will DC 10 + 1/2 bard level + Cha); staggered 1d4 rounds on success.', { abilities: ['deadly-performance'] }),

  // ------------------------------------------------------------------ Cleric
  aura: f('Aura', 'Radiates an aura matching the deity\'s alignment.'),
  'channel-energy': f('Channel Energy', 'Release a wave of positive or negative energy (30-ft. burst) 3 + Cha mod times per day: 1d6 per two cleric levels, healing the living or harming undead (Will half, DC 10 + 1/2 level + Cha).', {
    abilities: ['channel-energy'],
    resources: (c) => ({ channel: { max: 3 + Math.max(0, c.baseAbilityMod('cha')) + (c.hasFeat('extra-channel') ? 2 * c.featCount('extra-channel') : 0), per: 'day' } }),
  }),
  domains: f('Domains', 'Choose two domains from the deity; gain their granted powers and a domain spell slot per spell level.'),
  'spontaneous-casting': f('Spontaneous Casting', 'Convert prepared spells into cure (good/positive) or inflict (evil/negative) spells of the same level.'),

  // ----------------------------------------------------------------- Fighter
  'fighter-bonus-feat': f('Bonus Feat', 'Gain a bonus combat feat.'),
  bravery: f('Bravery', '+1 on Will saves vs fear at 2nd level, +1 every four levels thereafter.', { modifiers: (c) => [mod('save.will', c.prog('bravery'), 'untyped', 'Bravery', ['fear'])] }),
  'armor-training': f('Armor Training', 'Reduce armor check penalty by 1 and increase max Dex bonus by 1 (improves every four levels; move at normal speed in medium (7th) and heavy (11th) armor).', { flags: () => ['armorTraining'] }),
  'weapon-training': f('Weapon Training', '+1 attack and damage with a chosen weapon group, improving as more groups are chosen.', {
    modifiers: (c) => {
      const groups = c.choices['weapon-training'] || [];
      return groups.map((g, i) => {
        const bonus = c.prog('weaponTraining') - i;
        return bonus > 0 ? [mod('attack', bonus, 'untyped', `Weapon training (${g})`, [`group:${g}`]), mod('damage', bonus, 'untyped', `Weapon training (${g})`, [`group:${g}`]), mod('cmb', bonus, 'untyped', `Weapon training (${g})`, [`group:${g}`])] : [];
      }).flat();
    },
  }),
  'armor-mastery': f('Armor Mastery', 'DR 5/— while wearing armor or using a shield.', { dr: (c) => (c.armorType() !== 'none' || c.hasShield() ? [{ amount: 5, bypass: '-' }] : []) }),
  'weapon-mastery': f('Weapon Mastery', 'Chosen weapon: automatically confirms critical hits, +1 crit multiplier, cannot be disarmed.', { flags: () => ['weaponMastery'] }),

  // -------------------------------------------------------------------- Monk
  'ac-bonus': f('AC Bonus', 'Adds Wis bonus (and +1 per four monk levels) to AC and CMD when unarmored and unencumbered.', {
    modifiers: (c) => {
      if (!unarmoredMonk(c)) return [];
      const v = Math.max(0, c.abilityMod('wis')) + c.prog('monkAcBonus');
      return [mod('ac', v, 'monk', 'Monk AC bonus'), mod('cmd', v, 'monk', 'Monk AC bonus')];
    },
    flags: (c) => (unarmoredMonk(c) ? ['monkAcActive'] : []),
  }),
  'flurry-of-blows': f('Flurry of Blows', 'Full attack with unarmed strikes/monk weapons as if two-weapon fighting, using monk level as BAB, -2 penalty (Improved TWF at 8th, Greater at 15th).', { flags: () => ['flurry'] }),
  'improved-unarmed-strike': f('Improved Unarmed Strike', 'Gains Improved Unarmed Strike as a bonus feat; unarmed strikes deal lethal damage and may use either hand, elbows, knees or feet.', { grantsFeats: ['improved-unarmed-strike'] }),
  'stunning-fist': f('Stunning Fist', 'Gains Stunning Fist as a bonus feat; uses per day equal to monk level.', { grantsFeats: ['stunning-fist'] }),
  'unarmed-strike-damage': f('Unarmed Damage', 'Monk unarmed strike damage: 1d6 (1st), 1d8 (4th), 1d10 (8th), 2d6 (12th), 2d8 (16th), 2d10 (20th).'),
  'monk-bonus-feat': f('Bonus Feat', 'Gain a monk bonus feat, ignoring prerequisites.'),
  'fast-movement-monk': f('Fast Movement', '+10 ft. enhancement to land speed per three monk levels when unarmored and unencumbered.', {
    modifiers: (c) => (unarmoredMonk(c) ? [mod('speed', c.prog('monkSpeed'), 'enhancement', 'Monk fast movement')] : []),
  }),
  'maneuver-training': f('Maneuver Training', 'Uses monk level instead of BAB when calculating CMB.', { flags: () => ['maneuverTraining'] }),
  'still-mind': f('Still Mind', '+2 on saves vs enchantment.', { modifiers: () => [mod('save', 2, 'untyped', 'Still mind', ['enchantment'])] }),
  'ki-pool': f('Ki Pool', 'Pool of ki points (1/2 monk level + Wis). Spend 1 for an extra flurry attack at highest BAB, +4 dodge AC for 1 round, or +20 ft. speed. Unarmed strikes count as magic (and lawful at 10th, adamantine at 16th).', {
    abilities: ['ki-extra-attack', 'ki-dodge', 'ki-speed'],
    resources: (c) => ({ ki: { max: c.prog('kiPool') + Math.max(0, c.baseAbilityMod('wis')) + (c.hasFeat('extra-ki') ? 2 * c.featCount('extra-ki') : 0), per: 'day' } }),
    flags: (c) => ['unarmedMagic', ...(c.prog('monkLevel') >= 10 ? ['unarmedLawful'] : []), ...(c.prog('monkLevel') >= 16 ? ['unarmedAdamantine'] : [])],
  }),
  'slow-fall': f('Slow Fall', 'Treat a fall as shorter (20 ft. at 4th, +10 ft. per two levels) when within arm\'s reach of a wall.'),
  'high-jump': f('High Jump', 'Adds monk level to Acrobatics checks to jump; spend 1 ki for +20.', { modifiers: (c) => [mod('skill.acrobatics', c.prog('monkLevel'), 'untyped', 'High jump', ['jump'])] }),
  'purity-of-body': f('Purity of Body', 'Immune to all diseases, including supernatural and magical diseases.', { immunities: ['disease'] }),
  'wholeness-of-body': f('Wholeness of Body', 'Standard action, 2 ki: heal hit points equal to monk level.', { abilities: ['wholeness-of-body'] }),
  'diamond-body': f('Diamond Body', 'Immune to poisons of all kinds.', { immunities: ['poison'] }),
  'abundant-step': f('Abundant Step', 'Spend 2 ki to dimension door (move action).', { abilities: ['abundant-step'] }),
  'diamond-soul': f('Diamond Soul', 'Spell resistance equal to monk level + 10.', { sr: (c) => c.prog('monkLevel') + 10 }),
  'quivering-palm': f('Quivering Palm', 'Once per day, set up vibrations in a creature that can kill it later (Fort DC 10 + 1/2 monk level + Wis).', { abilities: ['quivering-palm'], resources: () => ({ quiveringPalm: { max: 1, per: 'day' } }) }),
  'timeless-body': f('Timeless Body', 'No longer takes penalties for aging.'),
  'tongue-of-sun-and-moon': f('Tongue of the Sun and Moon', 'Can speak with any living creature.'),
  'empty-body': f('Empty Body', 'Spend 3 ki to become ethereal for 1 minute.', { abilities: ['empty-body'] }),
  'perfect-self': f('Perfect Self', 'Becomes an outsider; DR 10/chaotic.', { dr: () => [{ amount: 10, bypass: 'chaotic' }] }),

  // ----------------------------------------------------------------- Paladin
  'aura-of-good': f('Aura of Good', 'Radiates a strong aura of good.'),
  'detect-evil': f('Detect Evil', 'At will, as the spell.', { abilities: ['detect-evil'] }),
  'smite-evil': f('Smite Evil', 'Swift action: against an evil target add Cha bonus to attack, paladin level to damage (double on first hit vs evil outsiders, dragons, undead), Cha bonus as deflection AC vs that target; bypasses DR.', {
    abilities: ['smite-evil'], resources: (c) => ({ smite: { max: c.prog('smiteUses'), per: 'day' } }),
  }),
  'divine-grace': f('Divine Grace', 'Adds Cha bonus to all saving throws.', { modifiers: (c) => [mod('save', Math.max(0, c.abilityMod('cha')), 'untyped', 'Divine grace')] }),
  'lay-on-hands': f('Lay on Hands', 'Heal 1d6 per two paladin levels (standard action, swift on self) or damage undead; uses per day = 1/2 paladin level + Cha mod.', {
    abilities: ['lay-on-hands'],
    resources: (c) => ({ layOnHands: { max: c.prog('layOnHandsUses') + Math.max(0, c.baseAbilityMod('cha')) + (c.hasFeat('extra-lay-on-hands') ? 2 * c.featCount('extra-lay-on-hands') : 0), per: 'day' } }),
  }),
  'aura-of-courage': f('Aura of Courage', 'Immune to fear; allies within 10 ft. gain +4 morale vs fear.', { immunities: ['fear'], aura: { radius: 10, modifiers: () => [mod('save', 4, 'morale', 'Aura of courage', ['fear'])] } }),
  'divine-health': f('Divine Health', 'Immune to all diseases.', { immunities: ['disease'] }),
  mercy: f('Mercy', 'Lay on hands also removes a chosen condition.'),
  'channel-positive-energy': f('Channel Positive Energy', 'Spend two uses of lay on hands to channel positive energy as a cleric of the paladin\'s level.', { abilities: ['channel-energy-paladin'] }),
  'divine-bond': f('Divine Bond', 'Bond with a weapon (+1 enhancement per 3 levels after 5th as a standard action, 1 minute/level) or a celestial mount.', { abilities: ['divine-bond-weapon'], resources: (c) => ({ divineBond: { max: 1 + Math.floor((c.prog('paladinLevel') - 5) / 4), per: 'day' } }) }),
  'aura-of-resolve': f('Aura of Resolve', 'Immune to charm; allies within 10 ft. gain +4 morale vs charm.', { immunities: ['charm'], aura: { radius: 10, modifiers: () => [mod('save', 4, 'morale', 'Aura of resolve', ['charm'])] } }),
  'aura-of-justice': f('Aura of Justice', 'Spend two smite uses to grant smite evil to allies within 10 ft.'),
  'aura-of-faith': f('Aura of Faith', 'Weapons count as good-aligned for DR; allies\' attacks too.', { flags: () => ['weaponsGood'] }),
  'aura-of-righteousness': f('Aura of Righteousness', 'DR 5/evil and immune to compulsion; allies +4 vs compulsion.', { dr: () => [{ amount: 5, bypass: 'evil' }], immunities: ['compulsion'] }),
  'holy-champion': f('Holy Champion', 'DR 10/evil; lay on hands heals maximum; smite banishes evil outsiders.', { dr: () => [{ amount: 10, bypass: 'evil' }] }),

  // ------------------------------------------------------------------ Ranger
  'favored-enemy': f('Favored Enemy', '+2 bonus on Bluff, Knowledge, Perception, Sense Motive, Survival checks and weapon attack/damage rolls against a favored enemy type; one bonus increases by +2 with each new favored enemy.', {
    modifiers: (c) => {
      const out = [];
      for (const fe of c.choices['favored-enemy'] || []) {
        const tag = `vs:${fe.type}`;
        const b = fe.bonus || 2;
        out.push(mod('attack', b, 'untyped', `Favored enemy (${fe.type})`, [tag]), mod('damage', b, 'untyped', `Favored enemy (${fe.type})`, [tag]));
        for (const s of ['bluff', 'perception', 'sense-motive', 'survival']) out.push(mod(`skill.${s}`, b, 'untyped', `Favored enemy (${fe.type})`, [tag]));
      }
      return out;
    },
  }),
  track: f('Track', 'Adds half ranger level (min 1) to Survival checks to follow tracks.', { modifiers: (c) => [mod('skill.survival', c.prog('track'), 'untyped', 'Track', ['tracking'])] }),
  'wild-empathy': f('Wild Empathy', 'Improve an animal\'s attitude: 1d20 + class level + Cha mod.'),
  'combat-style': f('Combat Style Feat', 'Select a feat from the chosen combat style (archery or two-weapon), ignoring prerequisites.'),
  'endurance-ranger': f('Endurance', 'Gains Endurance as a bonus feat.', { grantsFeats: ['endurance'] }),
  'favored-terrain': f('Favored Terrain', '+2 initiative and Knowledge (geography), Perception, Stealth, Survival in a favored terrain.', {
    modifiers: (c) => (c.choices['favored-terrain'] || []).flatMap((t) => ['initiative', 'skill.perception', 'skill.stealth', 'skill.survival', 'skill.knowledge-geography'].map((k) => mod(k, t.bonus || 2, 'untyped', `Favored terrain (${t.terrain})`, [`terrain:${t.terrain}`]))),
  }),
  'hunters-bond': f("Hunter's Bond", 'Move action: grant half favored enemy bonus to allies within 30 ft. against a target for Wis mod rounds (or gain an animal companion).', { abilities: ['hunters-bond'] }),
  'woodland-stride': f('Woodland Stride', 'Move through natural undergrowth at normal speed without damage.'),
  'swift-tracker': f('Swift Tracker', 'Track at normal speed without penalty.'),
  quarry: f('Quarry', 'Standard action: denote a quarry; +2 insight on attacks against it, take 10 on Survival to track it.', { abilities: ['quarry'] }),
  camouflage: f('Camouflage', 'Use Stealth in favored terrain without cover or concealment.'),
  'improved-quarry': f('Improved Quarry', 'Quarry as a free action; insight bonus increases to +4.'),
  'master-hunter': f('Master Hunter', 'Full attack vs favored enemy: Fort save (DC 10 + 1/2 level + Wis) or die.'),

  // ------------------------------------------------------------------- Rogue
  trapfinding: f('Trapfinding', 'Adds half rogue level to Perception to locate traps and Disable Device; may disable magical traps.', {
    modifiers: (c) => [mod('skill.perception', c.prog('trapfinding'), 'untyped', 'Trapfinding', ['trap']), mod('skill.disable-device', c.prog('trapfinding'), 'untyped', 'Trapfinding')],
    flags: () => ['trapfinding'],
  }),
  'rogue-talent': f('Rogue Talent', 'Gain a rogue talent.'),
  'advanced-talents': f('Advanced Talents', 'May select advanced talents in place of rogue talents.'),
  'master-strike': f('Master Strike', 'On a sneak attack, target must save (Fort DC 10 + 1/2 level + Int) or be put to sleep, paralyzed or slain (rogue\'s choice).'),

  // ---------------------------------------------------------------- Sorcerer
  bloodline: f('Bloodline', 'Gain bloodline arcana, powers, bonus spells and bonus feats from the chosen bloodline.'),
  'eschew-materials-class': f('Eschew Materials', 'Gains Eschew Materials as a bonus feat.', { grantsFeats: ['eschew-materials'] }),

  // ------------------------------------------------------------------ Wizard
  'arcane-bond': f('Arcane Bond', 'Bonded object (cast one known spell per day without preparing it) or familiar.', { abilities: ['bonded-object'], resources: () => ({ bondedObject: { max: 1, per: 'day' } }) }),
  'arcane-school': f('Arcane School', 'Specialize in a school (two opposition schools, +1 school spell slot per level, school powers) or be a universalist.'),
  'scribe-scroll-class': f('Scribe Scroll', 'Gains Scribe Scroll as a bonus feat.', { grantsFeats: ['scribe-scroll'] }),
  'wizard-bonus-feat': f('Bonus Feat', 'Gain a metamagic, item creation feat or Spell Mastery.'),

  // ------------------------------------------------------------------- Magus
  'arcane-pool': f('Arcane Pool', 'Pool of 1/2 magus level (min 1) + Int points. Swift action, 1 point: weapon gains +1 enhancement (+1 per four levels after 1st, max +5) for 1 minute; may be spent on weapon special abilities from 5th level.', {
    abilities: ['arcane-pool-enhance'],
    resources: (c) => ({ arcanePool: { max: c.prog('arcanePool') + Math.max(0, c.baseAbilityMod('int')), per: 'day' } }),
  }),
  'spell-combat': f('Spell Combat', 'Full-round action: make all melee attacks with a one-handed/light weapon at -2 and cast a magus spell with the other hand (casting time standard or less).', { flags: () => ['spellCombat'] }),
  spellstrike: f('Spellstrike', 'Deliver touch spells through a melee weapon attack (critical threat 18-20 ×2 for the spell rider uses weapon\'s range).', { flags: () => ['spellstrike'] }),
  'magus-arcana': f('Magus Arcana', 'Gain a magus arcana.'),
  'spell-recall': f('Spell Recall', 'Swift action: spend arcane pool points equal to a spell\'s level to recall a spell already cast.', { abilities: ['spell-recall'] }),
  'magus-bonus-feat': f('Bonus Feat', 'Gain a combat, item creation or metamagic feat.'),
  'knowledge-pool': f('Knowledge Pool', 'Spend arcane pool points to prepare spells not in the spellbook.'),
  'medium-armor': f('Medium Armor', 'Proficient in medium armor; can cast in it without arcane spell failure.', { proficiencies: { armor: ['medium'] } }),
  'improved-spell-combat': f('Improved Spell Combat', '+2 circumstance bonus on concentration checks when using spell combat.', { modifiers: () => [mod('concentration', 2, 'circumstance', 'Improved spell combat', ['spellCombat'])] }),
  'fighter-training': f('Fighter Training', 'Counts 1/2 total magus level as fighter levels for feat prerequisites.', { flags: () => ['fighterTraining'] }),
  'improved-spell-recall': f('Improved Spell Recall', 'Spell recall costs half as many points; may recall any prepared spell with pool points equal to its level + 1.'),
  'heavy-armor': f('Heavy Armor', 'Proficient in heavy armor; can cast in it without arcane spell failure.', { proficiencies: { armor: ['heavy'] } }),
  'greater-spell-combat': f('Greater Spell Combat', '+4 circumstance bonus on concentration checks when using spell combat.', { modifiers: () => [mod('concentration', 4, 'circumstance', 'Greater spell combat', ['spellCombat'])] }),
  counterstrike: f('Counterstrike', 'When an enemy within reach casts a spell, the magus may make an attack of opportunity against it.'),
  'greater-spell-access': f('Greater Spell Access', 'Adds fourteen sorcerer/wizard spells to the magus spell list.'),
  'true-magus': f('True Magus', 'Spell combat and spellstrike with any spell; once per day spend arcane pool to cast without expending a slot.'),

  // -------------------------------------------------------- Arcane Trickster
  'ranged-legerdemain': f('Ranged Legerdemain', 'Use Disable Device and Sleight of Hand at a range of 30 ft. (+5 DC).'),
  'impromptu-sneak-attack': f('Impromptu Sneak Attack', 'Once per day (twice at 7th), declare one attack a sneak attack: the target is denied its Dex bonus to AC.', {
    abilities: ['impromptu-sneak-attack'], resources: (c) => ({ impromptuSneak: { max: c.prog('impromptuSneakAttack'), per: 'day' } }),
  }),
  'tricky-spells': f('Tricky Spells', 'Cast spells with Silent Spell or Still Spell without increasing level or casting time, 3/day (5th) or 5/day (9th).', {
    resources: (c) => ({ trickySpells: { max: c.prog('trickySpells'), per: 'day' } }),
  }),
  'invisible-thief': f('Invisible Thief', 'Become invisible (as greater invisibility) for arcane trickster level rounds per day.', { abilities: ['invisible-thief'] }),
  'surprise-spells': f('Surprise Spells', 'Add sneak attack damage to damaging spells against flat-footed targets.', { flags: () => ['surpriseSpells'] }),

  // ---------------------------------------------------------------- Assassin
  'death-attack': f('Death Attack', 'Study a target for 3 rounds, then a sneak attack that deals damage forces a Fort save (DC 10 + assassin level + Int mod) or the target dies (or is paralyzed for 1d6 + level rounds).', { abilities: ['study-target'] }),
  'poison-use': f('Poison Use', 'Never risks accidental self-poisoning.', { flags: () => ['poisonUse'] }),
  'poison-resistance': f('Save Bonus Against Poison', '+1 on saves vs poison at 2nd level, +1 per two levels.', { modifiers: (c) => [mod('save', c.prog('poisonSaveBonus'), 'untyped', 'Assassin poison resistance', ['poison'])] }),
  'hidden-weapons': f('Hidden Weapons', 'Adds assassin level to Sleight of Hand to conceal weapons.'),
  'true-death': f('True Death', 'Creatures slain by death attack are hard to raise (caster level check DC 15 + assassin level).'),
  'quiet-death': f('Quiet Death', 'Death attack while unobserved goes unnoticed (Stealth vs Perception).'),
  'swift-death': f('Swift Death', 'Once per day, death attack without studying the target first.', { resources: () => ({ swiftDeath: { max: 1, per: 'day' } }) }),
  'angel-of-death': f('Angel of Death', 'Once per day, a death attack target crumbles to dust.'),

  // --------------------------------------------------------- Dragon Disciple
  'blood-of-dragons': f('Blood of Dragons', 'Dragon disciple levels stack with sorcerer levels for draconic bloodline powers. Non-sorcerers gain draconic bloodline powers at the listed levels.'),
  'dd-natural-armor': f('Natural Armor Increase', 'Natural armor bonus increases by +1 (1st), +2 (4th), +3 (7th).', { modifiers: (c) => [mod('ac', c.prog('ddNaturalArmor'), 'natural-increase', 'Dragon disciple')] }),
  'dd-bonus-spell': f('Bonus Spells', 'Gain one bonus spell slot of any level the character can cast at 1st, 5th and 9th levels.'),
  'dd-ability-boost': f('Ability Boost', 'Str +2 (2nd), Str +2 (4th), Con +2 (6th), Int +2 (8th).', {
    modifiers: (c) => [mod('str', c.prog('ddStr'), 'untyped', 'Dragon disciple'), mod('con', c.prog('ddCon'), 'untyped', 'Dragon disciple'), mod('int', c.prog('ddInt'), 'untyped', 'Dragon disciple')],
  }),
  'dragon-bite': f('Dragon Bite', 'Gains a bite attack (1d6 Medium, ×1.5 Str when used alone); at 6th level it deals +1d6 energy damage of the dragon type.', {
    naturalAttacks: (c) => [{ name: 'Bite', damage: '1d6', type: ['bludgeoning', 'piercing', 'slashing'], primary: true, strMult: 1.5, extra: c.prog('ddLevel') >= 6 ? { dice: '1d6', type: c.dragonEnergy() } : null }],
  }),
  'dd-breath-weapon': f('Breath Weapon', 'Gain the draconic breath weapon (1d6 per sorcerer + dragon disciple level, Reflex DC 10 + 1/2 level + Cha half), +1 use if already draconic.', { abilities: ['breath-weapon'] }),
  'dd-blindsense': f('Blindsense', 'Blindsense 30 ft. (5th) increasing to 60 ft. (10th).', { flags: (c) => [`blindsense:${c.prog('ddLevel') >= 10 ? 60 : 30}`] }),
  'dragon-form': f('Dragon Form', 'Cast form of the dragon I once per day (7th); form of the dragon II twice per day (10th).', { abilities: ['dragon-form'], resources: (c) => ({ dragonForm: { max: c.prog('ddLevel') >= 10 ? 2 : 1, per: 'day' } }) }),
  'dd-wings': f('Wings', 'Grows wings: fly speed 60 ft. (average).', { flags: () => ['fly:60'] }),

  // ------------------------------------------------------------------ Duelist
  'canny-defense': f('Canny Defense', 'Adds Int bonus (max duelist level) as dodge AC when wearing no armor/shield and wielding a light or one-handed piercing weapon.', {
    modifiers: (c) => (c.armorType() === 'none' && !c.hasShield() && c.wieldsDuelistWeapon() ? [mod('ac', Math.min(c.classLevel('duelist'), Math.max(0, c.abilityMod('int'))), 'dodge', 'Canny defense')] : []),
  }),
  'precise-strike': f('Precise Strike', '+duelist level precision damage with a light or one-handed piercing weapon when no other hand is used for attacking.', { flags: () => ['preciseStrike'] }),
  'improved-reaction': f('Improved Reaction', '+2 initiative (2nd), +4 (8th).', { modifiers: (c) => [mod('initiative', c.prog('improvedReaction'), 'untyped', 'Improved reaction')] }),
  parry: f('Parry', 'During a full attack, forgo an attack to parry a melee attack: opposed attack roll.', { abilities: ['parry'] }),
  'enhanced-mobility': f('Enhanced Mobility', '+4 additional dodge AC vs attacks of opportunity from moving when unarmored/no shield.', { modifiers: (c) => (c.armorType() === 'none' && !c.hasShield() ? [mod('ac', 4, 'dodge', 'Enhanced mobility', ['aooMovement'])] : []) }),
  'combat-reflexes-duelist': f('Combat Reflexes', 'Gains Combat Reflexes as a bonus feat.', { grantsFeats: ['combat-reflexes'] }),
  grace: f('Grace', '+2 competence on Reflex saves when unarmored and no shield.', { modifiers: (c) => (c.armorType() === 'none' && !c.hasShield() ? [mod('save.ref', 2, 'competence', 'Grace')] : []) }),
  riposte: f('Riposte', 'After a successful parry, make an attack of opportunity against the attacker.'),
  'acrobatic-charge': f('Acrobatic Charge', 'Charge over difficult terrain.'),
  'elaborate-defense': f('Elaborate Defense', '+1 dodge AC per three duelist levels when fighting defensively or using total defense.', { modifiers: (c) => [mod('ac', c.prog('elaborateDefense'), 'dodge', 'Elaborate defense', ['fightingDefensively'])] }),
  'deflect-arrows-duelist': f('Deflect Arrows', 'Gains Deflect Arrows as a bonus feat.', { grantsFeats: ['deflect-arrows'] }),
  'no-retreat': f('No Retreat', 'Enemies who withdraw from the duelist provoke an attack of opportunity.'),
  'crippling-critical': f('Crippling Critical', 'On a confirmed critical hit, apply 1d4 Str/Dex damage, -10 ft. speed, or 2 bleed (choice).'),

  // ----------------------------------------------------------- Eldritch Knight
  'diverse-training': f('Diverse Training', 'Eldritch knight levels count as fighter levels for feat prerequisites and as arcane caster levels for arcane-casting feat prerequisites.', { flags: () => ['diverseTraining'] }),
  'ek-bonus-feat': f('Bonus Combat Feat', 'Gain a bonus combat feat.'),
  'spell-critical': f('Spell Critical', 'After confirming a critical hit, cast a spell as a swift action (casting time standard or less).', { flags: () => ['spellCritical'] }),

  // ----------------------------------------------------------- Mystic Theurge
  'combined-spells': f('Combined Spells', 'Prepare spells from one class list in slots of the other class (up to the listed spell level, slot one level higher).'),
  'spell-synthesis': f('Spell Synthesis', 'Once per day cast one arcane and one divine spell as a full-round action; +2 on caster level checks vs SR, targets -2 on saves.', { abilities: ['spell-synthesis'], resources: () => ({ spellSynthesis: { max: 1, per: 'day' } }) }),

  // ------------------------------------------------------------ Darkfire Adept
  darkfire: f('Darkfire', 'Fire spells may be cast as darkfire: half the damage is fire, half is negative energy (untyped vs undead immune to negative energy). Darkfire burns even in magical darkness.', { flags: () => ['darkfire'] }),
  'shadow-sight': f('Shadow Sight', 'Darkvision 60 ft. (1st), 90 ft. (6th); at 9th level sees normally in magical darkness.', {
    flags: (c) => [`darkvision:${c.prog('darkfireLevel') >= 6 ? 90 : 60}`, ...(c.prog('darkfireLevel') >= 9 ? ['seeInDarkness'] : [])],
  }),
  'darkfire-bolt': f('Darkfire Bolt', 'Standard action ranged touch (30 ft.): 1d6 fire + 1d6 negative per two darkfire adept levels (min 1d6 each), uses = 3 + Cha or Int mod per day.', {
    abilities: ['darkfire-bolt'], resources: (c) => ({ darkfireBolt: { max: 3 + Math.max(0, Math.max(c.baseAbilityMod('int'), c.baseAbilityMod('cha'))), per: 'day' } }),
  }),
  'umbral-flames': f('Umbral Flames', 'Fire and darkfire spells ignore 5 points of fire resistance (10 at 7th level); +1 DC for spells with the fire or darkness descriptor.', {
    modifiers: () => [mod('spellDC.fire', 1, 'untyped', 'Umbral flames'), mod('spellDC.darkness', 1, 'untyped', 'Umbral flames')],
    flags: (c) => [`ignoreFireResist:${c.prog('darkfireLevel') >= 7 ? 10 : 5}`],
  }),
  'cloak-of-cinders': f('Cloak of Cinders', 'Fire resistance 10 and 20% concealment in dim light or darkness.', { resistances: () => ({ fire: 10 }) }),
  'devouring-darkfire': f('Devouring Darkfire', 'Creatures that fail a save against a darkfire spell are also sickened for 1 round.', { flags: () => ['devouringDarkfire'] }),
  'darkfire-apotheosis': f('Darkfire Apotheosis', 'Immune to fire; negative-energy portions of darkfire heal the adept as if undead-friendly (cannot be blinded by darkness effects).', { immunities: ['fire'] }),
};

module.exports = { FEATURES };
