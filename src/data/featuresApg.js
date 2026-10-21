'use strict';

const { mod } = require('../engine/modifiers');

/** Class features of the Advanced Player's Guide classes (see src/data/features.js for the format). */

const f = (name, description, extra = {}) => ({ name, description, ...extra });
const half = (n) => Math.floor(n / 2);

const FEATURES = {
  // ---------------------------------------------------------------- Alchemist
  alchemy: f('Alchemy', 'Prepare extracts from the formula book (Int-based, 1 minute each, potent for 1 day). Extracts affect only the drinker (unless Infusion), need no components and are not affected by arcane spell failure; caster level = alchemist level.'),
  bomb: f('Bomb', 'Standard action: throw a bomb (ranged touch, 20-ft. increment): 1d6 fire + Int mod (+1d6 per two levels after 1st); splash = minimum damage to adjacent creatures (Reflex half, DC 10 + 1/2 level + Int). Bombs per day = level + Int mod.', {
    abilities: ['bomb'], resources: (c) => ({ bombs: { max: c.classLevel('alchemist') + Math.max(0, c.baseAbilityMod('int')) + (c.hasFeat('extra-bombs') ? 2 * c.featCount('extra-bombs') : 0), per: 'day' } }),
  }),
  'brew-potion-class': f('Brew Potion', 'Gains Brew Potion as a bonus feat (prerequisites ignored); brews potions of known formulae up to 3rd level.', { grantsFeats: ['brew-potion'] }),
  mutagen: f('Mutagen', 'Standard action: drink a mutagen for 10 minutes per level: +4 alchemical to Str, Dex or Con, +2 natural armor, -2 to the related mental score (Int, Wis or Cha). One dose at a time.', {
    abilities: ['mutagen'], resources: () => ({ mutagen: { max: 1, per: 'day' } }),
  }),
  'throw-anything-class': f('Throw Anything', 'Gains Throw Anything as a bonus feat; adds Int mod to splash weapon damage.', { grantsFeats: ['throw-anything'] }),
  discovery: f('Discovery', 'Gain an alchemist discovery.', { choice: 'discovery' }),
  'poison-resistance-alchemist': f('Poison Resistance', '+2 on saves vs poison (+4 at 5th, +6 at 8th); immune at 10th.', { modifiers: (c) => [mod('save', c.prog('alchemistPoisonSave'), 'untyped', 'Poison resistance', ['poison'])] }),
  'swift-alchemy': f('Swift Alchemy', 'Craft alchemical items in half the time; apply poison as a move action.'),
  'swift-poisoning': f('Swift Poisoning', 'Apply poison to a weapon as a swift action.'),
  'poison-immunity-alchemist': f('Poison Immunity', 'Immune to all poisons.', { immunities: ['poison'] }),
  'persistent-mutagen': f('Persistent Mutagen', 'Mutagens last 1 hour per alchemist level.', { flags: () => ['persistentMutagen'] }),
  'instant-alchemy': f('Instant Alchemy', 'Create an alchemical item as a full-round action; apply poison as an immediate action.'),
  'grand-discovery': f('Grand Discovery', 'Gain two discoveries and one grand discovery.', { choice: 'grand-discovery', onGain: () => [] }),

  // ----------------------------------------------------------------- Cavalier
  challenge: f('Challenge', 'Swift action: challenge a foe. Melee attacks against it deal +cavalier level damage; -2 AC against everyone else. Order benefits apply. Uses: 1/day +1 per three levels.', {
    abilities: ['challenge'], resources: (c) => ({ challenge: { max: c.prog('challengeUses'), per: 'day' } }),
  }),
  'cavalier-mount': f('Mount', 'A loyal mount that advances as an animal companion (effective druid level = cavalier level). No armor check penalty on Ride while mounted.', { onGain: (c, choices) => require('./classOptions').grantCompanion(c, { ...choices, companion: choices.companion || choices.mount || 'horse' }) }),
  order: f('Order', 'Pledge to an order: its class skills, challenge benefit and order abilities at 2nd, 8th and 15th level.', { choice: 'order' }),
  tactician: f('Tactician', 'A bonus teamwork feat. Standard action: allies within 30 ft. gain one of your teamwork feats for 3 rounds + 1 per two levels. Uses: 1/day +1 per five levels.', {
    abilities: ['tactician'], resources: (c) => ({ tactician: { max: c.prog('tacticianUses'), per: 'day' } }),
  }),
  'order-ability': f('Order Ability', 'Gain your order\'s ability for this level.'),
  'cavaliers-charge': f("Cavalier's Charge", '+4 on mounted charge attacks (instead of +2); no AC penalty after a mounted charge.', { flags: () => ['cavaliersCharge'] }),
  'expert-trainer': f('Expert Trainer', '+1/2 cavalier level on Handle Animal checks with mounts.', { modifiers: (c) => [mod('skill.handle-animal', half(c.classLevel('cavalier')), 'untyped', 'Expert trainer')] }),
  banner: f('Banner', 'Allies within 60 ft. who can see your banner gain +2 morale on saves vs fear and +1 morale on charge attacks (+1 at 10th, 15th, 20th).', {
    aura: { radius: 60, modifiers: (c) => [mod('save', 1 + c.prog('bannerBonus'), 'morale', 'Banner', ['fear']), mod('attack', c.prog('bannerBonus'), 'morale', 'Banner', ['charge'])] },
  }),
  'cavalier-bonus-feat': f('Bonus Feat', 'Gain a bonus combat feat.'),
  'greater-tactician': f('Greater Tactician', 'A bonus teamwork feat; tactician is a swift action.'),
  'mighty-charge': f('Mighty Charge', 'Mounted charge: double threat range and a free bull rush, disarm, sunder or trip.'),
  'demanding-challenge': f('Demanding Challenge', 'Your challenged foe takes -2 AC against attacks from others while you threaten it.'),
  'greater-banner': f('Greater Banner', 'Banner also grants +2 morale on saves vs charm and compulsion; once per day, allies may reroll a save.', {
    aura: { radius: 60, modifiers: () => [mod('save', 2, 'morale', 'Greater banner', ['charm', 'compulsion'])] },
  }),
  'master-tactician': f('Master Tactician', 'A bonus teamwork feat; tactician grants two teamwork feats.'),
  'supreme-charge': f('Supreme Charge', 'Mounted charges deal double damage (triple with a lance); critical hits stun 1d4 rounds (Will DC 10 + BAB: staggered).'),

  // --------------------------------------------------------------- Inquisitor
  'inquisitor-domain': f('Domain', 'Choose one domain from your deity; gain its powers (effective cleric level = inquisitor level), but no domain spells.', { choice: 'inquisitor-domain' }),
  judgment: f('Judgment', 'Swift action: pronounce a judgment (one at a time; two at 8th, three at 16th) that lasts until combat ends: destruction, healing, justice, piercing, protection, purity, resiliency, resistance or smiting. Uses: 1/day at 1st, +1 at 4th and every three levels.', {
    abilities: ['judgment'], resources: (c) => ({ judgment: { max: c.prog('judgmentUses') + (c.hasFeat('extra-judgment') ? c.featCount('extra-judgment') : 0), per: 'day' } }),
  }),
  'monster-lore': f('Monster Lore', 'Add Wis modifier (in addition to Int) on Knowledge checks to identify creatures.', { modifiers: (c) => require('./core').KNOWLEDGE_SKILLS.map((k) => mod(`skill.${k}`, Math.max(0, c.abilityMod('wis')), 'untyped', 'Monster lore', ['identifyCreature'])) }),
  'stern-gaze': f('Stern Gaze', 'Morale bonus on Intimidate and Sense Motive equal to 1/2 inquisitor level (min +1).', { modifiers: (c) => ['intimidate', 'sense-motive'].map((s) => mod(`skill.${s}`, Math.max(1, half(c.classLevel('inquisitor'))), 'morale', 'Stern gaze')) }),
  'cunning-initiative': f('Cunning Initiative', 'Add Wisdom modifier to initiative.', { modifiers: (c) => [mod('initiative', Math.max(0, c.abilityMod('wis')), 'untyped', 'Cunning initiative')] }),
  'detect-alignment': f('Detect Alignment', 'At will: detect chaos, evil, good or law.', { abilities: ['detect-evil'] }),
  'track-inquisitor': f('Track', 'Adds 1/2 level (min 1) to Survival checks to follow tracks.', { modifiers: (c) => [mod('skill.survival', Math.max(1, half(c.classLevel('inquisitor'))), 'untyped', 'Track', ['tracking'])] }),
  'solo-tactics': f('Solo Tactics', 'Allies count as having your teamwork feats for your benefit.', { flags: () => ['soloTactics'] }),
  'inquisitor-teamwork': f('Teamwork Feat', 'Gain a bonus teamwork feat.'),
  bane: f('Bane', 'Swift action: your weapon gains bane against a chosen creature type (+2 attack, +2d6 damage) for rounds per day equal to inquisitor level.', { abilities: ['bane'] }),
  'discern-lies-inquisitor': f('Discern Lies', 'Discern lies for rounds per day equal to inquisitor level (immediate action).'),
  'second-judgment': f('Second Judgment', 'Each judgment use grants two judgments.'),
  stalwart: f('Stalwart', 'A successful Fortitude or Will save against an effect with a reduced effect on a success negates it entirely (light/medium/no armor).', { flags: (c) => (c.armorType() !== 'heavy' ? ['stalwart'] : []) }),
  'greater-bane': f('Greater Bane', 'Bane deals +4d6 damage.'),
  'exploit-weakness': f('Exploit Weakness', 'Critical hits ignore DR; regeneration stops; +1 damage per die vs vulnerable creatures.', { flags: () => ['exploitWeakness'] }),
  'third-judgment': f('Third Judgment', 'Each judgment use grants three judgments.'),
  'slayer-judgment': f('Slayer', 'One judgment per use is treated as 5 levels higher.'),
  'true-judgment': f('True Judgment', 'Swift action during judgment: next hit forces a Fort save (DC 10 + 1/2 level + Wis) or the target dies; once per 1d4 rounds.', { abilities: ['true-judgment'] }),

  // ------------------------------------------------------------------- Oracle
  mystery: f('Mystery', 'Choose a mystery: class skills, a bonus spell known every even level, and revelations.', { choice: 'mystery' }),
  'oracles-curse': f("Oracle's Curse", 'Choose a curse with a drawback and benefits that grow at 5th, 10th and 15th level (curse level = oracle level + 1/2 other levels).', { choice: 'curse' }),
  revelation: f('Revelation', 'Gain a revelation from your mystery.', { choice: 'revelation' }),
  'final-revelation': f('Final Revelation', 'Gain your mystery\'s final revelation.'),

  // -------------------------------------------------------------------- Witch
  hex: f('Hex', 'Gain a hex (major hexes from 10th, grand hexes from 18th). Save DC 10 + 1/2 witch level + Int.', { choice: 'hex' }),
  patron: f('Patron Spells', 'Choose a patron: its spells are added to the familiar at 2nd level and every two levels thereafter.', { choice: 'patron' }),
  'witchs-familiar': f("Witch's Familiar", 'A familiar that stores your spells (all cantrips plus 3 + Int 1st-level spells at 1st, two more per level). The master gains its special ability.', { choice: 'familiar' }),
  'major-hex': f('Major Hex', 'From now on you may select major hexes.'),
  'grand-hex': f('Grand Hex', 'From now on you may select grand hexes.'),
};

module.exports = { FEATURES };
