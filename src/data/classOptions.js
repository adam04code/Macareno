'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Selectable class options. Each option may carry modifiers(c), flags(c),
 * abilities, grantsFeats, minLevel, requires (other option ids).
 */

const o = (name, description, extra = {}) => ({ name, description, ...extra });
const raging = (c) => c.hasFlag('raging');

const RAGE_POWERS = {
  'animal-fury': o('Animal Fury', 'While raging, gain a bite attack (1d4 Medium) as a secondary natural attack.', { naturalAttacks: (c) => (raging(c) ? [{ name: 'Bite (animal fury)', damage: '1d4', type: ['bludgeoning', 'piercing', 'slashing'], primary: false }] : []) }),
  'clear-mind': o('Clear Mind', 'Once per rage, reroll a failed Will save.', { minLevel: 8 }),
  'fearless-rage': o('Fearless Rage', 'While raging, immune to the shaken and frightened conditions.', { minLevel: 12, immunitiesWhile: 'raging', flags: (c) => (raging(c) ? ['immune:shaken', 'immune:frightened'] : []) }),
  'guarded-stance': o('Guarded Stance', 'While raging, +1 dodge AC vs melee (+1 per six levels) for a number of rounds = Con mod.', { modifiers: (c) => (raging(c) ? [mod('ac', 1 + Math.floor(c.classLevel('barbarian') / 6), 'dodge', 'Guarded stance', ['vsMelee'])] : []) }),
  'increased-damage-reduction': o('Increased Damage Reduction', 'DR/— increases by 1 while raging.', { minLevel: 8, dr: (c) => (raging(c) ? [{ amount: 1, bypass: '-' }] : []) }),
  'intimidating-glare': o('Intimidating Glare', 'Move action while raging: Intimidate to demoralize an adjacent foe.'),
  knockback: o('Knockback', 'Once per round while raging, make a bull rush in place of a melee attack (no AoO), dealing Str mod damage on success.'),
  'low-light-vision': o('Low-Light Vision', 'Low-light vision while raging.'),
  'mighty-swing': o('Mighty Swing', 'Once per rage, automatically confirm a critical hit.', { minLevel: 12 }),
  'moment-of-clarity': o('Moment of Clarity', 'Once per rage, lose rage benefits for 1 round to use Int/Dex/Cha skills or concentrate.'),
  'night-vision': o('Night Vision', 'Darkvision 60 ft. while raging.', { requires: ['low-light-vision'] }),
  'no-escape': o('No Escape', 'Move double speed as an immediate action when an adjacent foe withdraws.'),
  'powerful-blow': o('Powerful Blow', 'Once per rage, +1 damage on a single hit (+1 per four levels).', { abilities: ['powerful-blow'] }),
  'quick-reflexes': o('Quick Reflexes', 'While raging, one additional attack of opportunity per round.'),
  'raging-climber': o('Raging Climber', 'While raging, add barbarian level as enhancement bonus on Climb checks.', { modifiers: (c) => (raging(c) ? [mod('skill.climb', c.classLevel('barbarian'), 'enhancement', 'Raging climber')] : []) }),
  'raging-leaper': o('Raging Leaper', 'While raging, add barbarian level as enhancement bonus on Acrobatics to jump.', { modifiers: (c) => (raging(c) ? [mod('skill.acrobatics', c.classLevel('barbarian'), 'enhancement', 'Raging leaper', ['jump'])] : []) }),
  'raging-swimmer': o('Raging Swimmer', 'While raging, add barbarian level as enhancement bonus on Swim checks.', { modifiers: (c) => (raging(c) ? [mod('skill.swim', c.classLevel('barbarian'), 'enhancement', 'Raging swimmer')] : []) }),
  'renewed-vigor': o('Renewed Vigor', 'Once per day while raging, standard action: heal 1d8 + Con mod (+1d8 per four levels after 4th).', { minLevel: 4, abilities: ['renewed-vigor'] }),
  'rolling-dodge': o('Rolling Dodge', 'While raging, +1 dodge AC vs ranged attacks (+1 per six levels).', { modifiers: (c) => (raging(c) ? [mod('ac', 1 + Math.floor(c.classLevel('barbarian') / 6), 'dodge', 'Rolling dodge', ['vsRanged'])] : []) }),
  'roused-anger': o('Roused Anger', 'May enter a rage even while fatigued.'),
  scent: o('Scent', 'Gain the scent ability while raging.'),
  'strength-surge': o('Strength Surge', 'Once per rage, add barbarian level on a Strength check or combat maneuver check.', { abilities: ['strength-surge'] }),
  superstition: o('Superstition', 'While raging, +2 morale on saves vs spells, supernatural and spell-like abilities (+1 per four levels), but must save against allies\' spells too.', {
    modifiers: (c) => (raging(c) ? [mod('save', 2 + Math.floor(c.classLevel('barbarian') / 4), 'morale', 'Superstition', ['spell', 'spell-like', 'supernatural'])] : []),
  }),
  'surprise-accuracy': o('Surprise Accuracy', 'Once per rage, +1 morale on one attack roll (+1 per four levels).', { abilities: ['surprise-accuracy'] }),
  'swift-foot': o('Swift Foot', '+5 ft. enhancement to speed while raging.', { modifiers: (c) => (raging(c) ? [mod('speed', 5, 'enhancement', 'Swift foot')] : []) }),
  'terrifying-howl': o('Terrifying Howl', 'Standard action while raging: shaken enemies within 30 ft. become panicked 1d4+1 rounds (Will DC 10 + 1/2 level + Str).', { minLevel: 8, requires: ['intimidating-glare'] }),
  'unexpected-strike': o('Unexpected Strike', 'Once per rage, AoO against a foe that moves into a threatened square.', { minLevel: 8 }),
};

const ROGUE_TALENTS = {
  'bleeding-attack': o('Bleeding Attack', 'Sneak attacks cause bleed equal to the number of sneak attack dice.', { flags: () => ['bleedingAttack'] }),
  'combat-trick': o('Combat Trick', 'Gain a bonus combat feat.', { bonusFeat: 'combat' }),
  'fast-stealth': o('Fast Stealth', 'Move at full speed using Stealth without penalty.'),
  'finesse-rogue': o('Finesse Rogue', 'Gain Weapon Finesse as a bonus feat.', { grantsFeats: ['weapon-finesse'] }),
  'ledge-walker': o('Ledge Walker', 'Move at full speed on narrow surfaces using Acrobatics.'),
  'major-magic': o('Major Magic', 'Cast a 1st-level sorcerer/wizard spell twice per day as a spell-like ability.', { requires: ['minor-magic'], abilities: ['major-magic'] }),
  'minor-magic': o('Minor Magic', 'Cast a 0-level sorcerer/wizard spell three times per day as a spell-like ability.', { abilities: ['minor-magic'] }),
  'quick-disable': o('Quick Disable', 'Disable traps in half the normal time.'),
  resiliency: o('Resiliency', 'Once per day, gain temporary hp equal to rogue level when reduced below 0 hp.'),
  'rogue-crawl': o('Rogue Crawl', 'Crawl at half speed (5-ft. step while prone) without provoking.'),
  'slow-reactions': o('Slow Reactions', 'Opponents damaged by sneak attack cannot make attacks of opportunity for 1 round.', { flags: () => ['slowReactions'] }),
  'stand-up': o('Stand Up', 'Stand up from prone as a free action (still provokes).'),
  'snipers-eye': o("Sniper's Eye", 'Deal sneak attack with ranged attacks against targets with concealment.'),
  'surprise-attack': o('Surprise Attack', 'During the surprise round, opponents are always considered flat-footed to the rogue.'),
  'trap-spotter': o('Trap Spotter', 'Automatic Perception check when within 10 ft. of a trap.'),
  'weapon-training-rogue': o('Weapon Training', 'Gain Weapon Focus as a bonus feat.', { grantsFeats: ['weapon-focus'] }),
  'fast-getaway': o('Fast Getaway', 'After a successful sneak attack or Sleight of Hand, withdraw as a move action.'),
  'crippling-strike': o('Crippling Strike', 'Sneak attacks deal 2 points of Strength damage.', { advanced: true, flags: () => ['cripplingStrike'] }),
  'defensive-roll': o('Defensive Roll', 'Once per day, when reduced to 0 hp or less by a melee attack, Reflex save (DC = damage) to take half.', { advanced: true }),
  'improved-evasion': o('Improved Evasion', 'Half damage on a failed Reflex save.', { advanced: true, flags: () => ['improvedEvasion'] }),
  opportunist: o('Opportunist', 'Once per round, AoO against a foe just struck in melee by another character.', { advanced: true }),
  'skill-mastery': o('Skill Mastery', 'Take 10 on 3 + Int mod chosen skills even under stress.', { advanced: true }),
  'slippery-mind': o('Slippery Mind', 'Second save one round after failing vs enchantment.', { advanced: true }),
  'dispelling-attack': o('Dispelling Attack', 'Sneak attacks also act as a targeted dispel magic (caster level = rogue level) against the highest-level spell on the target.', { advanced: true, requires: ['major-magic'], flags: () => ['dispellingAttack'] }),
  'feat-talent': o('Feat', 'Gain any feat in place of a rogue talent.', { advanced: true, bonusFeat: 'any' }),
};

const DOMAINS = {
  air: o('Air', 'Lightning Arc (1st: ranged touch 30 ft., 1d6 + 1 per two cleric levels electricity, 3 + Wis/day); Electricity Resistance 10 (6th), 20 (12th), immune (20th).', {
    spells: ['obscuring-mist', 'wind-wall', 'gaseous-form', 'air-walk', 'control-winds', 'chain-lightning', 'elemental-body-iv', 'whirlwind', 'elemental-swarm'],
    abilities: ['lightning-arc'], resistances: (c) => (c.prog('domainLevel') >= 20 ? { electricity: Infinity } : c.prog('domainLevel') >= 12 ? { electricity: 20 } : c.prog('domainLevel') >= 6 ? { electricity: 10 } : {}),
  }),
  animal: o('Animal', 'Speak with animals 3 + cleric level rounds/day; animal companion at 4th (effective druid level = cleric level - 3). Knowledge (nature) is a class skill.', {
    spells: ['calm-animals', 'hold-animal', 'dominate-animal', 'summon-natures-ally-iv', 'beast-shape-iii', 'antilife-shell', 'animal-shapes', 'summon-natures-ally-viii', 'shapechange'],
    classSkills: ['knowledge-nature'], progressions: { companionLevel: (c) => (c.prog('domainLevel') >= 4 ? c.prog('domainLevel') - 3 : 0) },
    onPick: (c, choices) => grantCompanion(c, choices),
  }),
  artifice: o('Artifice', "Artificer's Touch (cast mending at will; melee touch 1d6 + 1/2 level vs objects and constructs, bypassing hardness and DR); Dancing Weapons (8th).", {
    spells: ['animate-rope', 'wood-shape', 'stone-shape', 'minor-creation', 'fabricate', 'major-creation', 'wall-of-iron', 'statue', 'prismatic-sphere'], abilities: ['artificers-touch'],
  }),
  charm: o('Charm', 'Dazing Touch (creature with HD ≤ your cleric level is dazed 1 round); Charming Smile (8th).', {
    spells: ['charm-person', 'calm-emotions', 'suggestion', 'heroism', 'charm-monster', 'geas-quest', 'insanity', 'demand', 'dominate-monster'], abilities: ['dazing-touch-domain'],
  }),
  community: o('Community', 'Calming Touch (heal 1d6 + cleric level nonlethal damage and remove fatigued, shaken, sickened); Unity (8th: once per day, allies within 30 ft. may use your saving throw instead of their own).', {
    spells: ['bless', 'shield-other', 'prayer', 'imbue-with-spell-ability', 'telepathic-bond', 'heroes-feast', 'refuge', 'mass-cure-critical-wounds', 'miracle'], abilities: ['calming-touch'],
  }),
  darkness: o('Darkness', 'Blind-Fight bonus feat; Touch of Darkness (melee touch: 20% miss chance on all attacks for 1/2 level rounds); Eyes of Darkness (8th).', {
    spells: ['obscuring-mist', 'blindness-deafness', 'deeper-darkness', 'shadow-conjuration', 'summon-monster-v', 'shadow-walk', 'power-word-blind', 'greater-shadow-evocation', 'shades'], abilities: ['touch-of-darkness'], grantsFeats: ['blind-fight'],
  }),
  liberation: o('Liberation', 'Liberation (ignore paralysis, grapple and movement impediments for 1 round/level per day); Freedom\'s Call (8th).', {
    spells: ['remove-fear', 'remove-paralysis', 'remove-curse', 'freedom-of-movement', 'break-enchantment', 'greater-dispel-magic', 'refuge', 'mind-blank', 'freedom'], abilities: ['liberation'],
  }),
  madness: o('Madness', 'Vision of Madness (touch: +1/2 level on attacks, saves or skill checks and the same penalty on another for 3 rounds); Aura of Madness (8th).', {
    spells: ['lesser-confusion', 'touch-of-idiocy', 'rage', 'confusion', 'nightmare', 'phantasmal-killer', 'insanity', 'scintillating-pattern', 'weird'], abilities: ['vision-of-madness'],
  }),
  nobility: o('Nobility', 'Inspiring Word (ally gains +2 morale on attacks, skill checks, ability checks and saves for 1/2 level rounds); Leadership (8th).', {
    spells: ['divine-favor', 'enthrall', 'magic-vestment', 'discern-lies', 'greater-command', 'geas-quest', 'repulsion', 'demand', 'storm-of-vengeance'], abilities: ['inspiring-word'],
  }),
  plant: o('Plant', 'Wooden Fist (hands become wood for 3 + Wis rounds: no AoO for unarmed, +1/2 level damage); Bramble Armor (6th: thorns deal 1d6 + 1/2 level to attackers).', {
    spells: ['entangle', 'barkskin', 'plant-growth', 'command-plants', 'wall-of-thorns', 'repel-wood', 'animate-plants', 'control-plants', 'shambler'], abilities: ['wooden-fist'],
  }),
  repose: o('Repose', 'Gentle Rest (touch: staggered 1 round, or asleep if already staggered; undead staggered for Wis rounds); Ward Against Death (8th).', {
    spells: ['deathwatch', 'gentle-repose', 'speak-with-dead', 'death-ward', 'slay-living', 'undeath-to-death', 'destruction', 'waves-of-exhaustion', 'wail-of-the-banshee'], abilities: ['gentle-rest'],
  }),
  rune: o('Rune', 'Scribe Scroll bonus feat; Blast Rune (rune deals 1d6 + 1/2 level energy damage to the first creature entering its square); Spell Rune (8th).', {
    spells: ['erase', 'secret-page', 'glyph-of-warding', 'explosive-runes', 'lesser-planar-binding', 'greater-glyph-of-warding', 'instant-summons', 'symbol-of-death', 'teleportation-circle'], abilities: ['blast-rune'], grantsFeats: ['scribe-scroll'],
  }),
  weather: o('Weather', 'Storm Burst (ranged touch 1d6 + 1/2 level nonlethal; target takes -2 on attacks for 1 round); Lightning Lord (8th).', {
    spells: ['obscuring-mist', 'fog-cloud', 'call-lightning', 'sleet-storm', 'ice-storm', 'control-winds', 'control-weather', 'whirlwind', 'storm-of-vengeance'], abilities: ['storm-burst'],
  }),
  chaos: o('Chaos', 'Touch of Chaos (target takes the worse of two d20 rolls for 1 round); Chaos Blade (8th).', { spells: ['protection-from-law', 'align-weapon', 'magic-circle-against-law', 'chaos-hammer', 'dispel-law', 'animate-objects', 'word-of-chaos', 'cloak-of-chaos', 'summon-monster-ix'], abilities: ['touch-of-chaos'] }),
  death: o('Death', "Bleeding Touch (1d6 bleed for 1/2 level rounds); Death's Embrace (8th: healed by channeled negative energy).", { spells: ['cause-fear', 'death-knell', 'animate-dead', 'death-ward', 'slay-living', 'create-undead', 'destruction', 'create-greater-undead', 'wail-of-the-banshee'], abilities: ['bleeding-touch'] }),
  destruction: o('Destruction', 'Destructive Smite (+1/2 level morale damage, 3 + Wis/day); Destructive Aura (8th).', { spells: ['true-strike', 'shatter', 'rage', 'inflict-critical-wounds', 'shout', 'harm', 'disintegrate', 'earthquake', 'implosion'], abilities: ['destructive-smite'] }),
  earth: o('Earth', 'Acid Dart (1d6 + 1 per two levels acid, ranged touch); Acid Resistance 10/20/immune.', { spells: ['magic-stone', 'soften-earth-and-stone', 'stone-shape', 'spike-stones', 'wall-of-stone', 'stoneskin', 'elemental-body-iv', 'earthquake', 'elemental-swarm'], abilities: ['acid-dart'], resistances: (c) => (c.prog('domainLevel') >= 20 ? { acid: Infinity } : c.prog('domainLevel') >= 12 ? { acid: 20 } : c.prog('domainLevel') >= 6 ? { acid: 10 } : {}) }),
  evil: o('Evil', 'Touch of Evil (target sickened, 1/2 level rounds); Scythe of Evil (8th).', { spells: ['protection-from-good', 'align-weapon', 'magic-circle-against-good', 'unholy-blight', 'dispel-good', 'create-undead', 'blasphemy', 'unholy-aura', 'summon-monster-ix'], abilities: ['touch-of-evil'] }),
  fire: o('Fire', 'Fire Bolt (1d6 + 1 per two levels fire, ranged touch); Fire Resistance 10/20/immune.', { spells: ['burning-hands', 'produce-flame', 'fireball', 'wall-of-fire', 'fire-shield', 'fire-seeds', 'elemental-body-iv', 'incendiary-cloud', 'elemental-swarm'], abilities: ['fire-bolt'], resistances: (c) => (c.prog('domainLevel') >= 20 ? { fire: Infinity } : c.prog('domainLevel') >= 12 ? { fire: 20 } : c.prog('domainLevel') >= 6 ? { fire: 10 } : {}) }),
  glory: o('Glory', 'Undead take +1d6 from channel; Touch of Glory (+level to Cha check).', { spells: ['shield-of-faith', 'bless-weapon', 'searing-light', 'holy-smite', 'righteous-might', 'undeath-to-death', 'holy-sword', 'holy-aura', 'gate'] }),
  good: o('Good', 'Touch of Good (+1/2 level sacred bonus on attacks, skills, ability checks, saves for 1 round); Holy Lance (8th).', { spells: ['protection-from-evil', 'align-weapon', 'magic-circle-against-evil', 'holy-smite', 'dispel-evil', 'blade-barrier', 'holy-word', 'holy-aura', 'summon-monster-ix'], abilities: ['touch-of-good'] }),
  healing: o('Healing', 'Healer\'s Blessing (6th: cure spells +50%); Rebuke Death (touch heals 1d4 + 1 per two levels to dying creatures).', {
    spells: ['cure-light-wounds', 'cure-moderate-wounds', 'cure-serious-wounds', 'cure-critical-wounds', 'breath-of-life', 'heal', 'regenerate', 'mass-cure-critical-wounds', 'mass-heal'],
    flags: (c) => (c.prog('domainLevel') >= 6 ? ['healersBlessing'] : []), abilities: ['rebuke-death'],
  }),
  knowledge: o('Knowledge', 'All Knowledge skills are class skills; Lore Keeper (touch: Knowledge check with Wis + level).', { spells: ['comprehend-languages', 'detect-thoughts', 'speak-with-dead', 'divination', 'true-seeing', 'find-the-path', 'legend-lore', 'discern-location', 'foresight'], classSkills: ['knowledge-arcana', 'knowledge-dungeoneering', 'knowledge-engineering', 'knowledge-geography', 'knowledge-history', 'knowledge-local', 'knowledge-nature', 'knowledge-nobility', 'knowledge-planes', 'knowledge-religion'] }),
  law: o('Law', 'Touch of Law (target treats all d20 rolls as 11 for 1 round); Staff of Order (8th).', { spells: ['protection-from-chaos', 'align-weapon', 'magic-circle-against-chaos', 'orders-wrath', 'dispel-chaos', 'hold-monster', 'dictum', 'shield-of-law', 'summon-monster-ix'], abilities: ['touch-of-law'] }),
  luck: o('Luck', 'Bit of Luck (touch: target rolls d20 twice and takes the better, 1 round); Good Fortune (6th).', { spells: ['true-strike', 'aid', 'protection-from-energy', 'freedom-of-movement', 'break-enchantment', 'mislead', 'spell-turning', 'moment-of-prescience', 'miracle'], abilities: ['bit-of-luck'] }),
  magic: o('Magic', 'Hand of the Acolyte (throw a melee weapon 30 ft. using Wis); Dispelling Touch (8th).', { spells: ['identify', 'magic-mouth', 'dispel-magic', 'imbue-with-spell-ability', 'spell-resistance', 'antimagic-field', 'spell-turning', 'protection-from-spells', 'mages-disjunction'] }),
  protection: o('Protection', '+1 resistance bonus on saves (+1 per five levels); Resistant Touch; Aura of Protection (8th).', {
    spells: ['sanctuary', 'shield-other', 'protection-from-energy', 'spell-immunity', 'spell-resistance', 'antimagic-field', 'repulsion', 'mind-blank', 'prismatic-sphere'],
    modifiers: (c) => [mod('save', 1 + Math.floor(c.prog('domainLevel') / 5), 'resistance', 'Protection domain')],
  }),
  strength: o('Strength', 'Strength Surge (touch: +1/2 level enhancement to melee attacks, CMB, Str skills, Str checks for 1 round); Might of the Gods (8th).', { spells: ['enlarge-person', 'bulls-strength', 'magic-vestment', 'spell-immunity', 'righteous-might', 'stoneskin', 'grasping-hand', 'clenched-fist', 'crushing-hand'], abilities: ['strength-surge-domain'] }),
  sun: o('Sun', 'Sun\'s Blessing (channel adds cleric level to damage vs undead, undead lose channel resistance); Nimbus of Light (8th).', { spells: ['endure-elements', 'heat-metal', 'searing-light', 'fire-shield', 'flame-strike', 'fire-seeds', 'sunbeam', 'sunburst', 'prismatic-sphere'], flags: () => ['sunsBlessing'] }),
  travel: o('Travel', '+10 ft. base speed; Agile Feet (ignore difficult terrain 1 round); Dimensional Hop (8th).', { spells: ['longstrider', 'locate-object', 'fly', 'dimension-door', 'teleport', 'find-the-path', 'greater-teleport', 'phase-door', 'astral-projection'], modifiers: () => [mod('speed', 10, 'enhancement', 'Travel domain')] }),
  trickery: o('Trickery', 'Bluff, Disguise and Stealth are class skills; Copycat (mirror image-like duplicate).', { spells: ['disguise-self', 'invisibility', 'nondetection', 'confusion', 'false-vision', 'mislead', 'screen', 'mass-invisibility', 'time-stop'], classSkills: ['bluff', 'disguise', 'stealth'], abilities: ['copycat'] }),
  war: o('War', 'Battle Rage (touch: +1/2 level damage on melee attacks for 1 round); Weapon Master (8th: bonus combat feat).', { spells: ['magic-weapon', 'spiritual-weapon', 'magic-vestment', 'divine-power', 'flame-strike', 'blade-barrier', 'power-word-blind', 'power-word-stun', 'power-word-kill'], abilities: ['battle-rage'] }),
  water: o('Water', 'Icicle (1d6 + 1 per two levels cold, ranged touch); Cold Resistance 10/20/immune.', { spells: ['obscuring-mist', 'fog-cloud', 'water-breathing', 'control-water', 'ice-storm', 'cone-of-cold', 'elemental-body-iv', 'horrid-wilting', 'elemental-swarm'], abilities: ['icicle'], resistances: (c) => (c.prog('domainLevel') >= 20 ? { cold: Infinity } : c.prog('domainLevel') >= 12 ? { cold: 20 } : c.prog('domainLevel') >= 6 ? { cold: 10 } : {}) }),
};

const ARCANE_SCHOOLS = {
  universalist: o('Universalist', 'No opposition schools. Hand of the Apprentice (throw bonded weapon); Metamagic Mastery (8th).', { opposition: 0 }),
  abjuration: o('Abjuration', 'Resistance (energy resistance 5, 10 at 11th, immunity at 20th); Protective Ward (+1 deflection aura).', { resistances: (c) => ({ [c.choices.abjurationEnergy || 'fire']: c.prog('wizardSchoolLevel') >= 20 ? Infinity : c.prog('wizardSchoolLevel') >= 11 ? 10 : 5 }) }),
  conjuration: o('Conjuration', "Summoner's Charm (summon duration +1/2 level rounds); Acid Dart (1d6 + 1 per two levels acid, ranged touch).", { abilities: ['acid-dart'] }),
  divination: o('Divination', 'Forewarned: +1/2 wizard level (min 1) initiative and always act in the surprise round; Diviner\'s Fortune.', { modifiers: (c) => [mod('initiative', Math.max(1, Math.floor(c.prog('wizardSchoolLevel') / 2)), 'untyped', 'Forewarned')] }),
  enchantment: o('Enchantment', 'Enchanting Smile (+2 enhancement to Bluff, Diplomacy, Intimidate, +1 per five levels); Dazing Touch.', {
    modifiers: (c) => ['bluff', 'diplomacy', 'intimidate'].map((s) => mod(`skill.${s}`, 2 + Math.floor(c.prog('wizardSchoolLevel') / 5), 'enhancement', 'Enchanting smile')),
    abilities: ['dazing-touch'],
  }),
  evocation: o('Evocation', 'Intense Spells (+1/2 wizard level damage, min 1, to evocation damage spells); Force Missile (1d4 + intense, 3 + Int/day).', { flags: () => ['intenseSpells'], abilities: ['force-missile'] }),
  illusion: o('Illusion', 'Extended Illusions (+1/2 level rounds); Blinding Ray (ranged touch: blind 1 round).', { abilities: ['blinding-ray'] }),
  necromancy: o('Necromancy', 'Power over Undead (Command Undead or Turn Undead bonus feat); Grave Touch (shaken).', { grantsFeats: ['command-undead'], abilities: ['grave-touch'] }),
  transmutation: o('Transmutation', 'Physical Enhancement (+1 enhancement to one physical ability, +1 per five levels); Telekinetic Fist (1d4 + 1 per two levels bludgeoning, ranged touch).', {
    modifiers: (c) => [mod(c.choices.transmutationAbility || 'str', 1 + Math.floor(c.prog('wizardSchoolLevel') / 5), 'enhancement', 'Physical enhancement')],
    abilities: ['telekinetic-fist'],
  }),
};

const BLOODLINES = {
  aberrant: o('Aberrant', 'Bloodline arcana: polymorph spells last 50% longer. Acidic Ray (1st: ranged touch 1d6 + 1 per two levels acid), Long Limbs (3rd: +5 ft. reach on melee touch attacks, +10 at 11th, +15 at 17th), Unusual Anatomy (9th: 25% fortification, 50% at 13th), Alien Resistance (15th: SR 10 + sorcerer level), Aberrant Form (20th: immune to critical hits and sneak attacks, blindsight 60 ft., DR 5/—).', {
    classSkill: 'knowledge-dungeoneering',
    spells: { 3: 'enlarge-person', 5: 'see-invisibility', 7: 'tongues', 9: 'black-tentacles', 11: 'feeblemind', 13: 'veil', 15: 'plane-shift', 17: 'mind-blank', 19: 'shapechange' },
    feats: ['combat-casting', 'improved-disarm', 'improved-grapple', 'improved-initiative', 'improved-unarmed-strike', 'iron-will', 'silent-spell', 'skill-focus'],
    powers: (c) => {
      const L = c.prog('sorcererBloodlineLevel');
      const out = { modifiers: [], resistances: {}, flags: [], abilities: ['acidic-ray'] };
      if (L >= 3) out.flags.push(`touchReach:${L >= 17 ? 15 : L >= 11 ? 10 : 5}`);
      if (L >= 9) out.flags.push(`fortification:${L >= 13 ? 50 : 25}`);
      if (L >= 15) out.sr = 10 + L;
      if (L >= 20) out.flags.push('immuneCrit', 'immune:precision', 'blindsight:60');
      return out;
    },
  }),
  draconic: o('Draconic', 'Bloodline arcana: spells with your energy descriptor deal +1 damage per die. Claws (1st), Dragon Resistances (3rd), Breath Weapon (9th), Wings (15th), Power of Wyrms (20th).', {
    classSkill: 'perception',
    spells: { 3: 'mage-armor', 5: 'resist-energy', 7: 'fly', 9: 'fear', 11: 'spell-resistance', 13: 'form-of-the-dragon-i', 15: 'form-of-the-dragon-ii', 17: 'form-of-the-dragon-iii', 19: 'wish' },
    feats: ['blind-fight', 'great-fortitude', 'improved-initiative', 'power-attack', 'quicken-spell', 'skill-focus', 'toughness'],
    powers: (c) => {
      const L = c.prog('sorcererBloodlineLevel');
      const out = { modifiers: [], resistances: {}, flags: [], naturalAttacks: [], abilities: [] };
      out.naturalAttacks.push(
        { name: 'Claw', damage: L >= 7 ? '1d6' : '1d4', type: ['slashing'], primary: true, magic: L >= 5, extra: L >= 11 ? { dice: '1d6', type: c.dragonEnergy() } : null, count: 2, activated: true },
      );
      if (L >= 3) {
        out.resistances[c.dragonEnergy()] = L >= 20 ? Infinity : L >= 9 ? 10 : 5;
        out.modifiers.push(mod('ac', L >= 15 ? 4 : L >= 9 ? 2 : 1, 'natural', 'Dragon resistances'));
      }
      if (L >= 9 || c.classLevel('dragon-disciple') >= 3) out.abilities.push('breath-weapon');
      if (L >= 15 || c.classLevel('dragon-disciple') >= 9) out.flags.push('fly:60');
      if (L >= 20) out.flags.push('blindsense:60');
      return out;
    },
    arcana: { energyDamagePerDie: 1 },
  }),
  arcane: o('Arcane', 'Bloodline arcana: metamagic feats raise the spell level of a spell by 1 less... (+1 DC to spells with metamagic). Arcane Bond (1st), Metamagic Adept (3rd), New Arcana (9th), School Power (15th), Arcane Apotheosis (20th).', {
    classSkill: 'knowledge-arcana',
    spells: { 3: 'identify', 5: 'invisibility', 7: 'dispel-magic', 9: 'dimension-door', 11: 'overland-flight', 13: 'true-seeing', 15: 'greater-teleport', 17: 'power-word-stun', 19: 'wish' },
    feats: ['combat-casting', 'improved-counterspell', 'improved-initiative', 'iron-will', 'scribe-scroll', 'skill-focus', 'spell-focus', 'still-spell'],
    powers: () => ({ modifiers: [], flags: ['arcaneBloodlineArcana'], abilities: ['bonded-object'] }),
  }),
  celestial: o('Celestial', 'Bloodline arcana: summoned creatures gain DR 1/2 level / evil. Heavenly Fire (1st: ranged touch 1d4 + 1 per two levels, harms evil / heals good), Celestial Resistances (3rd), Wings of Heaven (9th), Conviction (15th), Ascension (20th).', {
    classSkill: 'heal',
    spells: { 3: 'bless', 5: 'resist-energy', 7: 'magic-circle-against-evil', 9: 'remove-curse', 11: 'flame-strike', 13: 'greater-dispel-magic', 15: 'banishment', 17: 'sunburst', 19: 'gate' },
    feats: ['dodge', 'extend-spell', 'iron-will', 'mobility', 'mounted-combat', 'ride-by-attack', 'skill-focus', 'weapon-finesse'],
    powers: (c) => {
      const L = c.prog('sorcererBloodlineLevel');
      const out = { modifiers: [], resistances: {}, flags: [], abilities: ['heavenly-fire'] };
      if (L >= 3) Object.assign(out.resistances, { acid: L >= 9 ? 10 : 5, cold: L >= 9 ? 10 : 5 });
      if (L >= 9) out.flags.push('fly:60');
      return out;
    },
  }),
  infernal: o('Infernal', 'Bloodline arcana: +2 DC for charm spells. Corrupting Touch (1st: shaken 1/2 level rounds), Infernal Resistances (3rd: fire resist 5, +2 vs poison), Hellfire (9th), On Dark Wings (15th), Power of the Pit (20th).', {
    classSkill: 'diplomacy',
    spells: { 3: 'protection-from-good', 5: 'scorching-ray', 7: 'suggestion', 9: 'charm-monster', 11: 'dominate-person', 13: 'planar-binding', 15: 'greater-teleport', 17: 'power-word-stun', 19: 'meteor-swarm' },
    feats: ['blind-fight', 'combat-expertise', 'deceitful', 'extend-spell', 'improved-disarm', 'iron-will', 'skill-focus', 'spell-penetration'],
    powers: (c) => {
      const L = c.prog('sorcererBloodlineLevel');
      const out = { modifiers: [mod('spellDC.charm', 2, 'untyped', 'Infernal bloodline arcana')], resistances: {}, flags: [], abilities: ['corrupting-touch'] };
      if (L >= 3) {
        out.resistances.fire = L >= 9 ? 10 : 5;
        out.modifiers.push(mod('save', L >= 9 ? 4 : 2, 'untyped', 'Infernal resistances', ['poison']));
      }
      if (L >= 15) out.flags.push('fly:60');
      return out;
    },
  }),
  elemental: o('Elemental', 'Bloodline arcana: change energy type of spells to your element. Elemental Ray (1st: 1d6 + 1 per two levels), Elemental Resistance (3rd), Elemental Blast (9th), Elemental Movement (15th), Elemental Body (20th).', {
    classSkill: 'knowledge-planes',
    spells: { 3: 'burning-hands', 5: 'scorching-ray', 7: 'protection-from-energy', 9: 'elemental-body-i', 11: 'elemental-body-ii', 13: 'elemental-body-iii', 15: 'elemental-body-iv', 17: 'summon-monster-viii', 19: 'elemental-swarm' },
    feats: ['dodge', 'empower-spell', 'great-fortitude', 'improved-initiative', 'lightning-reflexes', 'power-attack', 'skill-focus', 'weapon-finesse'],
    powers: (c) => {
      const L = c.prog('sorcererBloodlineLevel');
      const out = { modifiers: [], resistances: {}, flags: [], abilities: ['elemental-ray'] };
      if (L >= 3) out.resistances[c.choices.element || 'fire'] = L >= 20 ? Infinity : L >= 9 ? 20 : 10;
      return out;
    },
  }),
  abyssal: o('Abyssal', 'Bloodline arcana: summoned creatures gain DR 1/2 level / good. Claws (1st), Demon Resistances (3rd), Strength of the Abyss (9th: +2 Str), Added Summonings (15th), Demonic Might (20th).', {
    classSkill: 'knowledge-planes',
    spells: { 3: 'cause-fear', 5: 'bulls-strength', 7: 'rage', 9: 'stoneskin', 11: 'dismissal', 13: 'transformation', 15: 'greater-teleport', 17: 'unholy-aura', 19: 'summon-monster-ix' },
    feats: ['augment-summoning', 'cleave', 'empower-spell', 'great-fortitude', 'improved-bull-rush', 'improved-sunder', 'power-attack', 'skill-focus'],
    powers: (c) => {
      const L = c.prog('sorcererBloodlineLevel');
      const out = { modifiers: [], resistances: {}, flags: [], naturalAttacks: [{ name: 'Claw', damage: L >= 7 ? '1d6' : '1d4', type: ['slashing'], primary: true, count: 2, activated: true, magic: L >= 5 }] };
      if (L >= 3) Object.assign(out.resistances, { electricity: L >= 9 ? 10 : 5 });
      if (L >= 3) out.modifiers.push(mod('save', L >= 9 ? 4 : 2, 'untyped', 'Demon resistances', ['poison']));
      if (L >= 9) out.modifiers.push(mod('str', L >= 17 ? 6 : L >= 13 ? 4 : 2, 'inherent', 'Strength of the abyss'));
      return out;
    },
  }),
  undead: o('Undead', 'Bloodline arcana: corporeal undead that were humanoid are affected as humanoids by mind-affecting spells. Grave Touch (1st: shaken), Death\'s Gift (3rd: cold resist 5, DR 5/- vs nonlethal), Grasp of the Dead (9th), Incorporeal Form (15th), One of Us (20th).', {
    classSkill: 'knowledge-religion',
    spells: { 3: 'chill-touch', 5: 'false-life', 7: 'vampiric-touch', 9: 'animate-dead', 11: 'waves-of-fatigue', 13: 'undeath-to-death', 15: 'finger-of-death', 17: 'horrid-wilting', 19: 'energy-drain' },
    feats: ['diehard', 'endurance', 'iron-will', 'skill-focus', 'silent-spell', 'still-spell', 'toughness', 'great-fortitude'],
    powers: (c) => {
      const L = c.prog('sorcererBloodlineLevel');
      const out = { modifiers: [], resistances: {}, flags: [], abilities: ['grave-touch'] };
      if (L >= 3) out.resistances.cold = L >= 9 ? 10 : 5;
      return out;
    },
  }),
  fey: o('Fey', 'Bloodline arcana: +2 DC for compulsion spells. Laughing Touch (1st), Woodland Stride (3rd), Fleeting Glance (9th), Fey Magic (15th), Soul of the Fey (20th).', {
    classSkill: 'knowledge-nature',
    spells: { 3: 'entangle', 5: 'hideous-laughter', 7: 'deep-slumber', 9: 'poison', 11: 'tree-stride', 13: 'mislead', 15: 'phase-door', 17: 'irresistible-dance', 19: 'shapechange' },
    feats: ['dodge', 'improved-initiative', 'lightning-reflexes', 'mobility', 'point-blank-shot', 'precise-shot', 'quicken-spell', 'skill-focus'],
    powers: () => ({ modifiers: [mod('spellDC.compulsion', 2, 'untyped', 'Fey bloodline arcana')], flags: [], abilities: ['laughing-touch'] }),
  }),
  destined: o('Destined', 'Bloodline arcana: personal-range spells grant a luck bonus on saves equal to spell level. Touch of Destiny (1st), Fated (3rd: +1 luck on saves during surprise rounds), It Was Meant To Be (9th), Within Reach (15th), Destiny Realized (20th).', {
    classSkill: 'knowledge-history',
    spells: { 3: 'alarm', 5: 'blur', 7: 'protection-from-energy', 9: 'freedom-of-movement', 11: 'break-enchantment', 13: 'mislead', 15: 'spell-turning', 17: 'moment-of-prescience', 19: 'foresight' },
    feats: ['arcane-strike', 'diehard', 'endurance', 'leadership', 'lightning-reflexes', 'maximize-spell', 'skill-focus', 'weapon-focus'],
    powers: () => ({ modifiers: [], flags: [], abilities: ['touch-of-destiny'] }),
  }),
};

const MAGUS_ARCANA = {
  'arcane-accuracy': o('Arcane Accuracy', 'Swift action, 1 arcane pool point: +Int insight bonus on attack rolls for 1 round.', { abilities: ['arcane-accuracy'] }),
  'broad-study': o('Broad Study', 'Use spell combat and spellstrike with spells from another arcane class.', { minLevel: 6 }),
  'close-range': o('Close Range', 'Deliver ranged touch attack spells through spellstrike.'),
  concentrate: o('Concentrate', 'Reroll a concentration check (immediate action, 1 point).'),
  'critical-strike': o('Critical Strike', 'On a confirmed critical, cast a spell as a swift action.', { minLevel: 15 }),
  'dispelling-strike': o('Dispelling Strike', 'Spend points to make a targeted dispel on hit.', { minLevel: 9 }),
  'empowered-magic': o('Empowered Magic', 'Once per day apply Empower Spell without increasing level.', { minLevel: 6, resources: () => ({ empoweredMagic: { max: 1, per: 'day' } }) }),
  'enduring-blade': o('Enduring Blade', 'Arcane pool enhancement lasts 1 minute per level.'),
  'hasted-assault': o('Hasted Assault', 'Swift action, 1 point: act as hasted for Int mod rounds.', { minLevel: 9, abilities: ['hasted-assault'] }),
  'maneuver-mastery': o('Maneuver Mastery', 'Use magus level as BAB for one maneuver type.'),
  'maximized-magic': o('Maximized Magic', 'Once per day apply Maximize Spell without increasing level.', { minLevel: 9 }),
  'pool-strike': o('Pool Strike', 'Standard action, 1 point: melee touch dealing 2d6 energy (+2d6 per three levels after 3rd).', { abilities: ['pool-strike'] }),
  'quickened-magic': o('Quickened Magic', 'Once per day apply Quicken Spell without increasing level.', { minLevel: 15 }),
  'spell-blending': o('Spell Blending', 'Add a wizard spell to the magus spell list.'),
  'spell-shield': o('Spell Shield', 'Immediate action, 1 point: +1/2 magus level shield bonus to AC until end of next turn.', { abilities: ['spell-shield'] }),
  'wand-mastery': o('Wand Mastery', 'Use Int for wand DCs and caster level for wand spells.', { minLevel: 6 }),
  'accurate-strike': o('Accurate Strike', 'Swift, 2 points: all attacks this round resolve against touch AC.', { minLevel: 6, abilities: ['accurate-strike'] }),
  'ghost-blade': o('Ghost Blade', 'Arcane pool enhancements also grant ghost touch.'),
  'bane-blade': o('Bane Blade', 'Arcane pool may add the bane weapon property for 1 point.', { minLevel: 12 }),
};

const MERCIES = {
  fatigued: o('Fatigued', 'Lay on hands removes fatigue.', { minLevel: 3 }),
  shaken: o('Shaken', 'Lay on hands removes shaken.', { minLevel: 3 }),
  sickened: o('Sickened', 'Lay on hands removes sickened.', { minLevel: 3 }),
  dazed: o('Dazed', 'Lay on hands removes dazed.', { minLevel: 6 }),
  diseased: o('Diseased', 'Lay on hands acts as remove disease.', { minLevel: 6 }),
  staggered: o('Staggered', 'Lay on hands removes staggered.', { minLevel: 6 }),
  cursed: o('Cursed', 'Lay on hands acts as remove curse.', { minLevel: 9 }),
  exhausted: o('Exhausted', 'Lay on hands removes exhausted (requires fatigued mercy).', { minLevel: 9, requires: ['fatigued'] }),
  frightened: o('Frightened', 'Lay on hands removes frightened (requires shaken mercy).', { minLevel: 9, requires: ['shaken'] }),
  nauseated: o('Nauseated', 'Lay on hands removes nauseated (requires sickened mercy).', { minLevel: 9, requires: ['sickened'] }),
  poisoned: o('Poisoned', 'Lay on hands acts as neutralize poison.', { minLevel: 9 }),
  blinded: o('Blinded', 'Lay on hands removes blinded.', { minLevel: 12 }),
  deafened: o('Deafened', 'Lay on hands removes deafened.', { minLevel: 12 }),
  paralyzed: o('Paralyzed', 'Lay on hands removes paralysis.', { minLevel: 12 }),
  stunned: o('Stunned', 'Lay on hands removes stunned.', { minLevel: 12 }),
};

const COMBAT_STYLES = {
  archery: o('Archery', 'Ranger combat style feats (prerequisites ignored).', {
    feats: { 2: ['far-shot', 'point-blank-shot', 'precise-shot', 'rapid-shot'], 6: ['improved-precise-shot', 'manyshot'], 10: ['pinpoint-targeting', 'shot-on-the-run'] },
  }),
  'two-weapon': o('Two-Weapon Combat', 'Ranger combat style feats (prerequisites ignored).', {
    feats: { 2: ['double-slice', 'improved-shield-bash', 'quick-draw', 'two-weapon-fighting'], 6: ['improved-two-weapon-fighting', 'two-weapon-defense'], 10: ['greater-two-weapon-fighting', 'two-weapon-rend'] },
  }),
};

const WEAPON_GROUPS = ['axes', 'heavy-blades', 'light-blades', 'bows', 'close', 'crossbows', 'double', 'flails', 'hammers', 'monk', 'natural', 'polearms', 'spears', 'thrown'];
const TERRAINS = ['cold', 'desert', 'forest', 'jungle', 'mountain', 'plains', 'planes', 'swamp', 'underground', 'urban', 'water'];
const FAVORED_ENEMY_TYPES = ['aberration', 'animal', 'construct', 'dragon', 'fey', 'humanoid:dwarf', 'humanoid:elf', 'humanoid:giant', 'humanoid:gnoll', 'humanoid:gnome', 'humanoid:goblinoid', 'humanoid:halfling', 'humanoid:human', 'humanoid:orc', 'humanoid:reptilian', 'magical beast', 'monstrous humanoid', 'ooze', 'outsider:air', 'outsider:chaotic', 'outsider:earth', 'outsider:evil', 'outsider:fire', 'outsider:good', 'outsider:lawful', 'outsider:native', 'outsider:water', 'plant', 'undead', 'vermin'];

// Draconic bloodline / dragon disciple dragon types (energy type, breath shape).
const DRAGON_TYPES = {
  black: { energy: 'acid', shape: 'line' }, blue: { energy: 'electricity', shape: 'line' }, green: { energy: 'acid', shape: 'cone' },
  red: { energy: 'fire', shape: 'cone' }, white: { energy: 'cold', shape: 'cone' }, brass: { energy: 'fire', shape: 'line' },
  bronze: { energy: 'electricity', shape: 'line' }, copper: { energy: 'acid', shape: 'line' }, gold: { energy: 'fire', shape: 'cone' },
  silver: { energy: 'cold', shape: 'cone' },
};

// Cleric deities (Pathfinder core pantheon is Paizo product identity; these are generic OGL-safe portfolios).
const DEITIES = {
  'the-dawnflame': { name: 'The Dawnflame', alignment: 'NG', domains: ['fire', 'good', 'healing', 'sun', 'glory'], favoredWeapon: 'scimitar' },
  'the-iron-judge': { name: 'The Iron Judge', alignment: 'LN', domains: ['law', 'protection', 'strength', 'war', 'knowledge'], favoredWeapon: 'warhammer' },
  'the-wild-wanderer': { name: 'The Wild Wanderer', alignment: 'CG', domains: ['chaos', 'good', 'luck', 'travel', 'air'], favoredWeapon: 'rapier' },
  'the-shrouded-one': { name: 'The Shrouded One', alignment: 'NE', domains: ['death', 'evil', 'trickery', 'magic', 'destruction'], favoredWeapon: 'scythe' },
  'the-deep-mother': { name: 'The Deep Mother', alignment: 'N', domains: ['earth', 'water', 'protection', 'knowledge', 'healing'], favoredWeapon: 'trident' },
  'the-red-tyrant': { name: 'The Red Tyrant', alignment: 'LE', domains: ['law', 'evil', 'war', 'destruction', 'fire'], favoredWeapon: 'greatsword' },
  'the-laughing-storm': { name: 'The Laughing Storm', alignment: 'CN', domains: ['chaos', 'air', 'water', 'luck', 'destruction'], favoredWeapon: 'spear' },
  'the-shining-shield': { name: 'The Shining Shield', alignment: 'LG', domains: ['law', 'good', 'protection', 'glory', 'healing'], favoredWeapon: 'longsword' },
};

/** Animal companion granted by a choice: choices.companion names the base animal. */
function grantCompanion(c, choices) {
  const { COMPANIONS } = require('./companions');
  const type = choices.companion;
  if (!COMPANIONS[type]) return [`Choose an animal companion (choices.companion: ${Object.keys(COMPANIONS).join(', ')})`];
  if (!c.companion) c.companion = { type, name: choices.companionName || COMPANIONS[type].name, hp: null, status: 'alive' };
  return [];
}

const DRUID_DOMAINS = ['air', 'animal', 'earth', 'fire', 'plant', 'water', 'weather'];
const NATURE_BONDS = {
  'animal-companion': o('Animal Companion', 'An animal companion that advances with druid level (choices.companion).', {
    progressions: { companionLevel: (c) => c.classLevel('druid') },
    onPick: (c, choices) => grantCompanion(c, choices),
  }),
  ...Object.fromEntries(DRUID_DOMAINS.map((d) => [d, o(`Domain (${d[0].toUpperCase()}${d.slice(1)})`, `Gain the ${d} domain powers and domain spell slots (effective cleric level = druid level).`, {
    onPick: (c, choices) => {
      c.choices['druid-domain'] = d;
      return DOMAINS[d].onPick ? DOMAINS[d].onPick(c, choices) : [];
    },
  })])),
};

const HUNTERS_BONDS = {
  companions: o('Companions', 'Move action: grant half your favored enemy bonus against a target to allies within 30 ft. for Wis mod rounds.', { abilities: ['hunters-bond'] }),
  'animal-companion': o('Animal Companion', 'An animal companion with effective druid level = ranger level - 3 (choices.companion).', {
    progressions: { companionLevel: (c) => Math.max(0, c.classLevel('ranger') - 3) },
    onPick: (c, choices) => grantCompanion(c, choices),
  }),
};

/**
 * Option groups a character picks from. `single` groups store one id in
 * choices[key]; the others store a list. `levelProg` names the progression
 * used for minLevel checks (so e.g. skald rage powers count skald levels).
 * Class features declare `choice: '<group>'` to grant one pick when gained.
 */
const OPTION_GROUPS = {
  'rage-power': { table: RAGE_POWERS, label: 'rage power', levelProg: 'ragePowerLevel' },
  'rogue-talent': { table: ROGUE_TALENTS, label: 'rogue talent', levelProg: 'rogueTalentLevel', advancedAt: 10 },
  domains: { table: DOMAINS, label: 'domain' },
  'magus-arcana': { table: MAGUS_ARCANA, label: 'magus arcana', levelProg: 'magusLevel' },
  mercy: { table: MERCIES, label: 'mercy', levelProg: 'paladinLevel' },
  school: { table: ARCANE_SCHOOLS, label: 'arcane school', single: true },
  'nature-bond': { table: NATURE_BONDS, label: 'nature bond', single: true },
  'hunters-bond': { table: HUNTERS_BONDS, label: "hunter's bond", single: true },
  'druid-domain': { table: DOMAINS, label: 'druid domain', single: true, progressions: { domainLevel: (c) => c.classLevel('druid') } },
};

// Advanced Player's Guide classes.
const APG = require('./classOptionsApg');
Object.assign(OPTION_GROUPS, {
  discovery: { table: APG.DISCOVERIES, label: 'discovery', levelProg: 'discoveryLevel' },
  'grand-discovery': { table: APG.GRAND_DISCOVERIES, label: 'grand discovery', single: true },
  order: { table: APG.CAVALIER_ORDERS, label: 'cavalier order', single: true },
  'inquisitor-domain': {
    table: DOMAINS, label: 'inquisitor domain', single: true, progressions: { domainLevel: (c) => c.classLevel('inquisitor') },
    validate: (c, id) => {
      const deity = DEITIES[c.deity];
      if (deity && !deity.domains.includes(id)) return `${deity.name} does not grant the ${id} domain`;
      const ax = c.axes();
      if ((id === 'good' && !ax.good) || (id === 'evil' && !ax.evil) || (id === 'law' && !ax.lawful) || (id === 'chaos' && !ax.chaotic)) return `The ${id} domain requires a matching alignment`;
      return null;
    },
  },
  mystery: { table: APG.MYSTERIES, label: 'mystery', single: true },
  curse: { table: APG.CURSES, label: "oracle's curse", single: true },
  revelation: { table: APG.REVELATIONS, label: 'revelation', levelProg: 'mysteryLevel' },
  hex: { table: APG.HEXES, label: 'hex', levelProg: 'hexLevel' },
  patron: { table: APG.PATRONS, label: 'patron', single: true },
  familiar: { table: APG.FAMILIARS, label: 'familiar', single: true },
});

const MYSTERY_SPELLS = (id) => (APG.MYSTERIES[id] ? APG.MYSTERIES[id].spells : {});
const PATRON_SPELLS = (id) => (APG.PATRONS[id] ? Object.fromEntries(APG.PATRONS[id].spells.map((sp, i) => [2 * (i + 1), sp])) : {});

module.exports = { MYSTERY_SPELLS, PATRON_SPELLS, HUNTERS_BONDS, NATURE_BONDS, DRUID_DOMAINS, grantCompanion, RAGE_POWERS, ROGUE_TALENTS, DOMAINS, ARCANE_SCHOOLS, BLOODLINES, MAGUS_ARCANA, MERCIES, COMBAT_STYLES, WEAPON_GROUPS, TERRAINS, FAVORED_ENEMY_TYPES, DRAGON_TYPES, DEITIES, OPTION_GROUPS };
