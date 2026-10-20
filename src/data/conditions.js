'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Conditions (PF1 Core Rulebook Appendix 2). Each condition contributes
 * modifiers and behavioural flags the combat engine reads.
 *
 * Flags used by the engine:
 *   loseDex      - denied Dexterity bonus to AC (and dodge bonuses)
 *   flatFooted   - flat-footed (also loseDex, cannot make AoO)
 *   helpless     - melee attackers get +4, coup de grace allowed, Dex treated as 0
 *   noActions    - cannot take actions
 *   singleAction - only a move OR standard action per turn (staggered, disabled)
 *   moveOnly     - only a single move action (nauseated)
 *   noMove       - cannot move (grappled, pinned, entangled is half speed instead)
 *   noAoO        - cannot make attacks of opportunity
 *   noCast       - cannot cast spells with somatic/verbal components normally
 *   flee         - must flee (frightened / panicked)
 *   blind, deaf, invisible, prone, grappled, pinned, dying, dead, unconscious
 */

const fearTags = ['fear'];
const allD20 = (v, source) => [
  mod('attack', v, 'untyped', source),
  mod('save', v, 'untyped', source),
  mod('skill', v, 'untyped', source),
  mod('abilityCheck', v, 'untyped', source),
];

const CONDITIONS = {
  bleed: { name: 'Bleed', description: 'Takes the listed damage at the start of each turn until healed or stopped with a DC 15 Heal check.', modifiers: [], flags: [] },
  blinded: {
    name: 'Blinded',
    description: 'Cannot see. -2 AC, loses Dex bonus to AC, -4 on most Str/Dex skill checks and opposed Perception checks; all opponents have total concealment (50% miss chance).',
    modifiers: (s = 'Blinded') => [mod('ac', -2, 'untyped', s), ...['acrobatics', 'climb', 'disable-device', 'escape-artist', 'fly', 'ride', 'sleight-of-hand', 'stealth', 'swim'].map((k) => mod(`skill.${k}`, -4, 'untyped', s))],
    flags: ['loseDex', 'blind'],
  },
  confused: { name: 'Confused', description: 'Acts randomly each round (d% table): act normally, babble, harm self, or attack nearest creature.', modifiers: [], flags: ['confused', 'noAoO'] },
  cowering: { name: 'Cowering', description: 'Frozen in fear; takes no actions, -2 AC, loses Dex bonus to AC.', modifiers: (s = 'Cowering') => [mod('ac', -2, 'untyped', s)], flags: ['loseDex', 'noActions'] },
  dazed: { name: 'Dazed', description: 'Can take no actions, but has no penalty to AC.', modifiers: [], flags: ['noActions'] },
  dazzled: { name: 'Dazzled', description: '-1 on attack rolls and sight-based Perception checks.', modifiers: (s = 'Dazzled') => [mod('attack', -1, 'untyped', s), mod('skill.perception', -1, 'untyped', s)], flags: [] },
  deafened: { name: 'Deafened', description: '-4 initiative, automatically fails sound-based Perception, 20% spell failure for verbal spells.', modifiers: (s = 'Deafened') => [mod('initiative', -4, 'untyped', s)], flags: ['deaf'] },
  disabled: { name: 'Disabled', description: 'At exactly 0 hp. Only a single move or standard action per turn; a standard action deals 1 damage afterwards.', modifiers: [], flags: ['singleAction', 'disabled'] },
  dying: { name: 'Dying', description: 'Negative hp; unconscious, loses 1 hp per round unless a DC 10 Constitution check (penalty = negative hp) stabilizes.', modifiers: [], flags: ['noActions', 'helpless', 'unconscious', 'dying'] },
  dead: { name: 'Dead', description: 'Hit points at or below negative Constitution score. Soul departs the body.', modifiers: [], flags: ['noActions', 'helpless', 'dead'] },
  entangled: {
    name: 'Entangled',
    description: 'Moves at half speed, cannot run or charge, -2 attack, -4 Dex. Concentration check (DC 15 + spell level) to cast.',
    modifiers: (s = 'Entangled') => [mod('attack', -2, 'untyped', s), mod('dex', -4, 'untyped', s)],
    flags: ['entangled', 'halfSpeed'],
  },
  exhausted: { name: 'Exhausted', description: 'Moves at half speed, cannot run or charge, -6 Str and Dex. After 1 hour of rest becomes fatigued.', modifiers: (s = 'Exhausted') => [mod('str', -6, 'untyped', s), mod('dex', -6, 'untyped', s)], flags: ['halfSpeed', 'noCharge'] },
  fascinated: { name: 'Fascinated', description: 'Stands quietly, taking no actions other than paying attention; -4 on skill checks made as reactions.', modifiers: (s = 'Fascinated') => [mod('skill.perception', -4, 'untyped', s)], flags: ['noActions'] },
  fatigued: { name: 'Fatigued', description: 'Cannot run or charge; -2 Str and Dex. Becomes exhausted if fatigued again.', modifiers: (s = 'Fatigued') => [mod('str', -2, 'untyped', s), mod('dex', -2, 'untyped', s)], flags: ['noCharge'] },
  'flat-footed': { name: 'Flat-Footed', description: 'Has not yet acted in combat: loses Dex bonus to AC and cannot make attacks of opportunity.', modifiers: [], flags: ['loseDex', 'noAoO'] },
  frightened: { name: 'Frightened', description: 'Flees from the source of fear; -2 on attacks, saves, skill and ability checks.', modifiers: (s = 'Frightened') => allD20(-2, s), flags: ['flee', 'fear'] },
  grappled: {
    name: 'Grappled',
    description: 'Cannot move or take actions requiring two hands; -4 Dex, -2 attack and CMB (except to grapple/escape). Casting requires concentration (DC 10 + grappler CMB + spell level).',
    modifiers: (s = 'Grappled') => [mod('dex', -4, 'untyped', s), mod('attack', -2, 'untyped', s), mod('cmb', -2, 'untyped', s, ['notGrapple'])],
    flags: ['grappled', 'noMove', 'noAoO'],
  },
  helpless: { name: 'Helpless', description: 'Paralyzed, held, bound, sleeping or unconscious. Dex treated as 0 (-5); melee attackers get +4; subject to coup de grace.', modifiers: [], flags: ['helpless', 'loseDex', 'noActions'] },
  incorporeal: { name: 'Incorporeal', description: 'No physical body; immune to nonmagical attacks, 50% miss chance from magical weapons, spells and effects (except force).', modifiers: [], flags: ['incorporeal'] },
  invisible: { name: 'Invisible', description: 'Visually undetectable. +2 attack vs sighted foes and they lose Dex bonus to AC; 50% miss chance against it.', modifiers: [], flags: ['invisible'] },
  nauseated: { name: 'Nauseated', description: 'Cannot attack, cast spells, concentrate or do anything requiring attention. Only a single move action per turn.', modifiers: [], flags: ['moveOnly', 'noCast', 'noAoO'] },
  panicked: { name: 'Panicked', description: 'Drops anything held and flees at top speed; -2 on saves, skills and ability checks; cowers if cornered.', modifiers: (s = 'Panicked') => allD20(-2, s), flags: ['flee', 'fear', 'noAoO'] },
  paralyzed: { name: 'Paralyzed', description: 'Frozen in place, unable to move or act. Effective Str and Dex of 0; helpless.', modifiers: [], flags: ['helpless', 'noActions', 'loseDex', 'paralyzed'] },
  petrified: { name: 'Petrified', description: 'Turned to stone; unconscious and helpless.', modifiers: [], flags: ['helpless', 'noActions', 'unconscious', 'petrified'] },
  pinned: { name: 'Pinned', description: 'Tightly bound: flat-footed, -4 AC, can only attempt to escape (or cast without somatic components).', modifiers: (s = 'Pinned') => [mod('ac', -4, 'untyped', s)], flags: ['pinned', 'grappled', 'loseDex', 'noMove', 'noAoO'] },
  prone: {
    name: 'Prone',
    description: 'Lying on the ground: -4 melee attack, cannot use most ranged weapons; +4 AC vs ranged, -4 AC vs melee. Standing is a move action that provokes.',
    modifiers: (s = 'Prone') => [mod('attack.melee', -4, 'untyped', s), mod('ac', -4, 'untyped', s, ['vsMelee']), mod('ac', 4, 'untyped', s, ['vsRanged'])],
    flags: ['prone'],
  },
  shaken: { name: 'Shaken', description: '-2 on attack rolls, saving throws, skill checks and ability checks.', modifiers: (s = 'Shaken') => allD20(-2, s), flags: ['fear'] },
  sickened: {
    name: 'Sickened',
    description: '-2 on attack rolls, weapon damage, saves, skill checks and ability checks.',
    modifiers: (s = 'Sickened') => [...allD20(-2, s), mod('damage', -2, 'untyped', s)],
    flags: [],
  },
  stable: { name: 'Stable', description: 'Negative hit points but no longer losing hit points; unconscious.', modifiers: [], flags: ['helpless', 'noActions', 'unconscious', 'stable'] },
  staggered: { name: 'Staggered', description: 'May take only a single move action or standard action each round (plus swift/immediate/free).', modifiers: [], flags: ['singleAction'] },
  stunned: { name: 'Stunned', description: 'Drops everything held, cannot act, -2 AC, loses Dex bonus to AC.', modifiers: (s = 'Stunned') => [mod('ac', -2, 'untyped', s)], flags: ['noActions', 'loseDex', 'stunned'] },
  unconscious: { name: 'Unconscious', description: 'Knocked out and helpless.', modifiers: [], flags: ['helpless', 'noActions', 'unconscious'] },
  // Engine-level helper conditions.
  'fighting-defensively': { name: 'Fighting Defensively', description: '-4 attack, +2 dodge AC (+3 with 3 ranks Acrobatics).', modifiers: [], flags: [] },
  'total-defense': { name: 'Total Defense', description: '+4 dodge AC (+6 with 3 ranks Acrobatics); cannot make AoO.', modifiers: [], flags: ['noAoO'] },
  charging: { name: 'Charging', description: '-2 AC until start of next turn.', modifiers: (s = 'Charging') => [mod('ac', -2, 'untyped', s)], flags: [] },
};

// Fear escalation: shaken + shaken -> frightened; frightened + shaken/frightened -> panicked.
const FEAR_ORDER = ['shaken', 'frightened', 'panicked'];

// Conditions that a creature immune to X ignores.
const CONDITION_IMMUNITY_TAGS = {
  shaken: ['fear', 'mind-affecting'], frightened: ['fear', 'mind-affecting'], panicked: ['fear', 'mind-affecting'], cowering: ['fear', 'mind-affecting'],
  confused: ['mind-affecting'], fascinated: ['mind-affecting'], dazed: ['mind-affecting'],
  paralyzed: ['paralysis'], stunned: ['stun'], fatigued: ['fatigue'], exhausted: ['exhaustion', 'fatigue'],
  sickened: [], nauseated: [], unconscious: ['sleep-if-magical'], bleed: ['bleed'],
};

function conditionModifiers(id, source) {
  const c = CONDITIONS[id];
  if (!c) return [];
  return typeof c.modifiers === 'function' ? c.modifiers(source || c.name) : c.modifiers;
}

module.exports = { CONDITIONS, FEAR_ORDER, CONDITION_IMMUNITY_TAGS, conditionModifiers, fearTags };
