'use strict';

const { mod } = require('../engine/modifiers');

/** Class features of the Advanced Class Guide classes (see src/data/features.js for the format). */

const f = (name, description, extra = {}) => ({ name, description, ...extra });
const half = (n) => Math.floor(n / 2);
const pos = (c, a) => Math.max(0, c.baseAbilityMod(a));
const focusWeapon = (c) => {
  const d = require('./classOptions').DEITIES[c.deity];
  return d ? d.favoredWeapon : null;
};

/** The shaman's chosen spirit (and, for greater/true spirit abilities, the wandering spirit too). */
function spirits(c) {
  const { SPIRITS } = require('./classOptionsAcg');
  return [c.choices.spirit, c.choices['wandering-spirit']].filter((s) => SPIRITS[s]).map((s) => SPIRITS[s]);
}

const FEATURES = {
  // ---------------------------------------------------------------- Arcanist
  'arcane-reservoir': f('Arcane Reservoir', 'A pool of arcane energy (maximum 3 + arcanist level; refills to 3 + 1/2 level each day). Spend 1 point while casting an arcanist spell for +1 caster level or +1 DC (cast option reservoir: "cl" | "dc").', {
    resources: (c) => ({ reservoir: { max: c.prog('reservoirDaily') + (c.hasFeat('extra-reservoir') ? 3 * c.featCount('extra-reservoir') : 0), per: 'day' } }),
  }),
  'consume-spells': f('Consume Spells', 'Move action: expend an unused arcanist spell slot of 1st level or higher to gain reservoir points equal to its level (once per round, not above the maximum).', { abilities: ['consume-spells'] }),
  'arcanist-exploit': f('Arcanist Exploit', 'Gain an arcanist exploit (DC 10 + 1/2 arcanist level + Cha unless noted).', { choice: 'arcanist-exploit' }),
  'greater-exploits': f('Greater Exploits', 'From 11th level, greater exploits may be chosen instead of exploits.'),
  'magical-supremacy': f('Magical Supremacy', 'Cast a spell in your spellbook without expending a slot by spending reservoir points equal to its level + 1; when you do, the DC and caster level increase by 2 (in addition to normal reservoir boosts).', { flags: () => ['magicalSupremacy'] }),

  // ---------------------------------------------------------------- Bloodrager
  'bloodrager-bloodline': f('Bloodline', 'Choose a bloodline: its powers work while bloodraging (some always), its bonus feats come at 6th and every three levels, and its bonus spells at 7th, 10th, 13th and 16th.', { choice: 'bloodrager-bloodline' }),
  bloodrage: f('Bloodrage', 'Free action: +4 morale Str and Con, +2 morale on Will saves, -2 AC for 4 + Con mod rounds per day (+2 per level after 1st). Bloodline powers activate. Fatigued afterwards.', {
    abilities: ['bloodrage', 'end-bloodrage'],
    resources: (c) => ({ bloodrage: { max: c.prog('bloodrageRounds') + pos(c, 'con') + (c.hasFeat('extra-rage') ? 6 * c.featCount('extra-rage') : 0), per: 'day', unit: 'rounds' } }),
  }),
  'uncanny-dodge-bloodrager': f('Uncanny Dodge', 'Cannot be caught flat-footed and keeps Dex bonus to AC against invisible attackers.', { flags: () => ['uncannyDodge'] }),
  'blood-sanctuary': f('Blood Sanctuary', '+2 on saves against spells cast by yourself or an ally.', { modifiers: () => [mod('save', 2, 'untyped', 'Blood sanctuary', ['allySpell'])] }),
  'blood-casting': f('Blood Casting', 'May cast bloodrager spells while bloodraging (concentration works normally for them).'),
  'damage-reduction-bloodrager': f('Damage Reduction', 'DR 1/— at 7th level, increasing by 1 every three levels.', { dr: (c) => (c.classLevel('bloodrager') >= 7 ? [{ amount: 1 + Math.floor((c.classLevel('bloodrager') - 7) / 3), bypass: '-' }] : []) }),
  'greater-bloodrage': f('Greater Bloodrage', 'Bloodrage bonuses increase to +6 Str/Con and +3 Will; cast one bloodrager spell of 1st-2nd level (3rd at higher levels) as a swift action when entering a bloodrage.'),
  'indomitable-will-bloodrager': f('Indomitable Will', '+4 on Will saves vs enchantment spells and effects while bloodraging.', { modifiers: (c) => (c.hasFlag('raging') ? [mod('save.will', 4, 'untyped', 'Indomitable will', ['enchantment'])] : []) }),
  'tireless-bloodrage': f('Tireless Bloodrage', 'No longer fatigued after bloodraging.'),
  'mighty-bloodrage': f('Mighty Bloodrage', 'Bloodrage bonuses increase to +8 Str/Con and +4 Will; the swift spell may be up to 4th level.'),

  // ---------------------------------------------------------------- Hunter
  'hunter-companion': f('Animal Companion', 'An animal companion that advances with hunter level (choices.companion).', {
    onGain: (c, choices) => require('./classOptions').grantCompanion(c, { ...choices, companion: choices.companion || 'wolf' }),
  }),
  'animal-focus': f('Animal Focus', 'Swift action: take on an animal aspect for 1 minute per level (bat, bear, bull, falcon, frog, monkey, mouse, owl, snake, stag, tiger, wolf); the companion always has one aspect. Bonuses grow at 8th and 15th level.', { abilities: ['animal-focus'] }),
  'nature-training': f('Nature Training', 'Hunter levels count as druid and ranger levels for feats, traits and options that affect animal companions.'),
  'precise-companion': f('Precise Companion', 'Gain Precise Shot or Outflank as a bonus feat (no prerequisites).'),
  'track-hunter': f('Track', 'Adds half hunter level (min 1) to Survival checks to follow tracks.', { modifiers: (c) => [mod('skill.survival', Math.max(1, half(c.classLevel('hunter'))), 'untyped', 'Track', ['tracking'])] }),
  'hunter-tactics': f('Hunter Tactics', 'Your animal companion automatically gains all of your teamwork feats.'),
  'hunter-teamwork': f('Teamwork Feat', 'Gain a bonus teamwork feat (the companion gains it too); swap the most recent one each day.'),
  'improved-empathic-link': f('Improved Empathic Link', 'Share your companion\'s senses (full-round action) to see through its eyes.'),
  'bonus-trick': f('Bonus Tricks', 'The companion learns a bonus trick.'),
  'second-animal-focus': f('Second Animal Focus', 'Apply two animal aspects to yourself at once (one when you pick a new aspect for the companion).'),
  'raise-animal-companion': f('Raise Animal Companion', 'Cast raise animal companion (raise dead on the companion) as a spell-like ability once per day; reincarnate at 20th.'),
  'speak-with-master': f('Speak with Master', 'You and your companion converse as with speak with animals.'),
  'greater-empathic-link': f('Greater Empathic Link', 'Empathic link and shared senses work at any distance on the same plane.'),
  'one-with-the-wild': f('One with the Wild', 'Animals are never hostile to you unless magically compelled; +4 on Wild Empathy.'),
  'master-hunter-acg': f('Master Hunter', 'Animal focus aspects on yourself are permanent; your companion\'s aspect may change as a swift action; track at full speed.', { flags: () => ['permanentAnimalFocus'] }),

  // ---------------------------------------------------------------- Shaman
  spirit: f('Spirit', 'Form a bond with a spirit: its spirit ability, its spirit magic spells (one per level in the spirit slot) and its hexes become available. Greater spirit at 8th, true spirit at 16th, manifestation at 20th.', { choice: 'spirit' }),
  'spirit-animal': f('Spirit Animal', 'A familiar that stores the shaman\'s link to her spirit (choices.familiar; arcanist/wizard familiar rules).', { choice: 'familiar' }),
  'spirit-magic': f('Spirit Magic', 'One extra slot per spell level that must hold a spell of your spirit (or wandering spirit).'),
  'wandering-spirit': f('Wandering Spirit', 'Each day, form a temporary bond with a second spirit: its spirit ability (greater at 12th, true at 20th) and its spirit magic spells.', { choice: 'wandering-spirit' }),
  'wandering-hex': f('Wandering Hex', 'Each day, gain one hex from your wandering spirit (two at 14th).'),
  'greater-spirit': f('Greater Spirit', 'Gain your spirit\'s greater ability.', {
    dr: (c) => spirits(c).filter((s) => s.greaterDr).map((s) => ({ amount: s.greaterDr.amount(c), bypass: s.greaterDr.bypass })),
    resistances: (c) => Object.assign({}, ...spirits(c).map((s) => s.greaterResist || {})),
  }),
  'true-spirit': f('True Spirit', 'Gain your spirit\'s true ability.'),
  manifestation: f('Manifestation', 'Become one with your spirit, gaining its manifestation.'),
  'shaman-hex': f('Hex', 'Gain a shaman hex (general or from your spirit; DC 10 + 1/2 shaman level + Wis).', { choice: 'shaman-hex' }),

  // ---------------------------------------------------------------- Skald
  'raging-song': f('Raging Song', 'Perform for 3 + Cha mod rounds per day (+2 per level after 1st). Starting is a standard action (move at 7th, swift at 13th). Allies must be willing; songs are audible.', {
    resources: (c) => ({ ragingSong: { max: c.prog('ragingSongRounds') + pos(c, 'cha') + (c.hasFeat('extra-performance') ? 6 * c.featCount('extra-performance') : 0), per: 'day', unit: 'rounds' } }),
  }),
  'inspired-rage': f('Inspired Rage', 'Allies within 60 ft. gain +2 morale Str and Con, +1 morale on Will saves and -1 AC, and may use your rage powers (+1 Will at 4th and every four levels; +4 Str/Con at 8th, +6 at 16th). They cannot use concentration or Int/Dex/Cha skills except Intimidate.', { abilities: ['inspired-rage', 'end-raging-song'] }),
  'song-of-marching': f('Song of Marching', 'Allies may hustle without fatigue and are not fatigued by a forced march (3 rounds of raging song per hour).', { abilities: ['song-of-marching'] }),
  'uncanny-dodge-skald': f('Uncanny Dodge', 'Cannot be caught flat-footed and keeps Dex bonus to AC against invisible attackers.', { flags: () => ['uncannyDodge'] }),
  'spell-kenning': f('Spell Kenning', 'Once per day (twice at 11th, three times at 17th), cast any bard, cleric or sorcerer/wizard spell of a level you can cast by expending a slot one level higher.', {
    resources: (c) => ({ spellKenning: { max: 1 + Math.floor((c.classLevel('skald') - 5) / 6), per: 'day' } }),
  }),
  'song-of-strength': f('Song of Strength', 'Allies add half your skald level to Str checks and Str-based skill checks.', { abilities: ['song-of-strength'] }),
  'damage-reduction-skald': f('Damage Reduction', 'DR 1/— at 9th (2/— at 14th, 3/— at 19th), shared with allies affected by inspired rage.', { dr: (c) => (c.classLevel('skald') >= 9 ? [{ amount: c.classLevel('skald') >= 19 ? 3 : c.classLevel('skald') >= 14 ? 2 : 1, bypass: '-' }] : []) }),
  'dirge-of-doom-skald': f('Dirge of Doom', 'Enemies within 30 ft. are shaken while they hear the song (mind-affecting fear).', { abilities: ['dirge-of-doom-skald'] }),
  'song-of-the-fallen': f('Song of the Fallen', 'Recall a dead ally\'s spirit for a few rounds of combat (10 rounds of raging song).'),
  'master-skald': f('Master Skald', 'Inspired rage no longer reduces AC and its Str/Con bonuses increase; allies may use three of your rage powers.', { flags: () => ['masterSkald'] }),

  // ---------------------------------------------------------------- Slayer
  'studied-target': f('Studied Target', 'Move action (swift at 7th): study a foe in sight; +1 on Bluff, Knowledge, Perception, Sense Motive and Survival checks against it and on weapon attack and damage rolls (+1 at 5th and every five levels). One target at a time (two at 5th, three at 10th...).', { abilities: ['studied-target'] }),
  'track-slayer': f('Track', 'Adds half slayer level (min 1) to Survival checks to follow tracks.', { modifiers: (c) => [mod('skill.survival', Math.max(1, half(c.classLevel('slayer'))), 'untyped', 'Track', ['tracking'])] }),
  'slayer-talent': f('Slayer Talent', 'Gain a slayer talent (or a rogue talent the slayer may take).', { choice: 'slayer-talent' }),
  stalker: f('Stalker', 'Add your studied target bonus on Stealth checks.', { modifiers: (c) => [mod('skill.stealth', c.prog('studiedBonus'), 'untyped', 'Stalker')] }),
  'advanced-talents-slayer': f('Advanced Talents', 'From 10th level, advanced talents may be chosen.'),
  'slayers-advance': f("Slayer's Advance", 'Move at normal speed through difficult terrain toward a studied target (twice per day at 17th...).'),
  'quarry-slayer': f('Quarry', 'Standard action: denote a quarry; +2 insight on attacks against it, take 10 on Survival to track it.', { abilities: ['quarry'] }),
  'improved-quarry-slayer': f('Improved Quarry', 'Quarry as a free action; +4 insight on attacks against it.'),
  'master-slayer': f('Master Slayer', 'Standard action: a full attack against a studied target forces a Fort save (DC 10 + 1/2 level + Int) or die/be knocked out; once per target per day.', { abilities: ['master-slayer'] }),

  // ---------------------------------------------------------------- Warpriest
  blessings: f('Blessings', 'Choose two blessings from your deity\'s domains; use minor blessings (major at 10th) 3 + 1/2 level times per day as a standard action.', {
    choice: 'blessings', choiceCount: 2, abilities: ['blessing'],
    resources: (c) => ({ blessing: { max: c.prog('blessingUses'), per: 'day' } }),
  }),
  'focus-weapon': f('Focus Weapon', 'Weapon Focus with your deity\'s favored weapon as a bonus feat (ignoring prerequisites).', {
    modifiers: (c) => (focusWeapon(c) && !c.featParams('weapon-focus').includes(focusWeapon(c)) ? [mod('attack', 1, 'untyped', `Weapon Focus (${focusWeapon(c)})`, [`weapon:${focusWeapon(c)}`])] : []),
  }),
  'sacred-weapon': f('Sacred Weapon', 'Your focus weapon deals sacred weapon damage (1d6 at 1st for Medium, up to 2d8 at 20th) if better. From 4th, swift action: give it +1 enhancement (or weapon specials) per four levels for level rounds per day.', {
    abilities: ['sacred-weapon'],
    resources: (c) => (c.classLevel('warpriest') >= 4 ? { sacredWeapon: { max: c.classLevel('warpriest'), per: 'day', unit: 'rounds' } } : {}),
  }),
  fervor: f('Fervor', 'Swift action: heal yourself 1d6 per three levels (or harm undead by touch), or cast a self-only warpriest spell as a swift action. Uses: 1/2 level + Wis mod per day.', {
    abilities: ['fervor'], resources: (c) => ({ fervor: { max: c.prog('fervorUses') + pos(c, 'wis') + (c.hasFeat('extra-fervor') ? 2 * c.featCount('extra-fervor') : 0), per: 'day' } }),
  }),
  'channel-energy-warpriest': f('Channel Energy', 'Spend two uses of fervor to channel energy as a cleric of your level, dealing the fervor dice.', { abilities: ['channel-energy-warpriest'] }),
  'sacred-armor': f('Sacred Armor', 'Swift action: armor gains +1 enhancement (or armor specials) per three levels after 4th for one minute per level per day.', {
    abilities: ['sacred-armor'], resources: (c) => ({ sacredArmor: { max: c.classLevel('warpriest'), per: 'day', unit: 'minutes' } }),
  }),
  'major-blessings': f('Major Blessings', 'Use the major powers of your blessings.'),
  'aspect-of-war': f('Aspect of War', 'Once per day, swift action for 1 minute: BAB equals your level, +10 ft. speed, DR 10/—, and you may use major blessings without expending uses.', { abilities: ['aspect-of-war'] }),
};

// Sacred weapon damage for a Medium warpriest by level.
const SACRED_WEAPON_DIE = (l) => (l >= 20 ? '2d8' : l >= 15 ? '2d6' : l >= 10 ? '1d10' : l >= 5 ? '1d8' : '1d6');

module.exports = { FEATURES, SACRED_WEAPON_DIE, spirits };
