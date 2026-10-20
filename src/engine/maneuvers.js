'use strict';

const { defaultRng } = require('./rng');
const checks = require('./checks');
const { makeEffect } = require('./effects');

/**
 * Combat maneuvers (Core Rulebook Chapter 8): CMB + d20 vs CMD.
 * Each returns { success, roll, cmb, cmd, margin, ...effects }.
 */

const MANEUVERS = ['bull-rush', 'disarm', 'grapple', 'overrun', 'sunder', 'trip', 'reposition', 'dirty-trick'];
const TAGS = { 'bull-rush': 'bullRush', disarm: 'disarm', grapple: 'grapple', overrun: 'overrun', sunder: 'sunder', trip: 'trip', reposition: 'reposition', 'dirty-trick': 'dirtyTrick' };
const IMPROVED_FEAT = { 'bull-rush': 'improved-bull-rush', disarm: 'improved-disarm', grapple: 'improved-grapple', overrun: 'improved-overrun', sunder: 'improved-sunder', trip: 'improved-trip' };

function provokes(attacker, type) {
  const feat = IMPROVED_FEAT[type];
  if (!feat) return true;
  if (type === 'grapple' && attacker.kind === 'monster') return false; // grab is free
  return !(attacker.hasFeat && attacker.hasFeat(feat));
}

function roll(attacker, defender, type, opts = {}) {
  const rng = opts.rng || defaultRng;
  const tag = TAGS[type];
  const cmb = attacker.cmb([tag]) + (opts.bonus || 0);
  const cmd = defender.cmd([tag]);
  const d = rng.die(20);
  const total = d + cmb;
  const success = d === 20 || (d !== 1 && total >= cmd);
  return { maneuver: type, roll: d, cmb, total, cmd, success, margin: total - cmd };
}

function perform(attacker, defender, type, opts = {}) {
  if (!MANEUVERS.includes(type)) throw Object.assign(new Error(`Unknown maneuver: ${type}`), { status: 400 });
  // Size limits: cannot bull rush/overrun/trip/grapple/reposition a creature more than one size larger.
  const { SIZES } = require('../data/core');
  const sizeGap = SIZES[defender.size()].order - SIZES[attacker.size()].order;
  if (['bull-rush', 'overrun', 'trip', 'grapple', 'reposition'].includes(type) && sizeGap > 1) return { maneuver: type, success: false, note: 'target is too large' };
  if (type === 'trip' && (defender.flySpeed() > 0 || defender.hasFlag('incorporeal'))) return { maneuver: type, success: false, note: 'cannot trip a flying or incorporeal creature' };
  if (type === 'grapple' && defender.hasFlag('freedomOfMovement')) return { maneuver: type, success: false, note: 'freedom of movement' };
  const r = roll(attacker, defender, type, opts);
  const src = { id: attacker.id, name: attacker.name };
  switch (type) {
    case 'trip':
      if (r.success) {
        defender.addCondition('prone', null, src);
        r.effect = 'prone';
      } else if (r.margin <= -10) {
        attacker.addCondition('prone', null, { name: 'Failed trip' });
        r.effect = 'attacker knocked prone';
      }
      break;
    case 'disarm':
      if (r.success) {
        r.effect = 'disarmed';
        if (defender.inventory) {
          const w = defender.equippedIn('mainHand');
          if (w) {
            w.equipped = null;
            w.dropped = true;
            defender.touch();
            r.item = w.uid;
          }
        } else defender.addEffect(makeEffect({ key: 'condition:disarmed', name: 'Disarmed', remaining: 1, modifiers: [{ target: 'attack', value: -4, type: 'untyped', source: 'Disarmed' }] }));
      } else if (r.margin <= -10) r.effect = 'attacker drops weapon';
      break;
    case 'grapple':
      if (r.success) {
        defender.addEffect(makeEffect({ key: 'condition:grappled', name: 'Grappled', kind: 'condition', conditions: ['grappled'], data: { by: attacker.id } }));
        attacker.addEffect(makeEffect({ key: 'condition:grappling', name: 'Grappling', kind: 'condition', conditions: ['grappled'], data: { target: defender.id, grappler: true } }));
        r.effect = 'grappled';
      }
      break;
    case 'bull-rush':
      if (r.success) {
        r.pushedFeet = 5 + 5 * Math.floor(r.margin / 5);
        r.effect = `pushed ${r.pushedFeet} ft.`;
      }
      break;
    case 'overrun':
      if (r.success) {
        r.effect = 'moved through';
        if (r.margin >= 5) {
          defender.addCondition('prone', null, src);
          r.effect = 'moved through and knocked prone';
        }
      }
      break;
    case 'sunder':
      if (r.success) r.effect = 'item damaged (broken)';
      break;
    case 'reposition':
      if (r.success) r.effect = `repositioned ${5 + 5 * Math.floor(r.margin / 5)} ft.`;
      break;
    case 'dirty-trick':
      if (r.success) {
        const cond = opts.condition || 'dazzled';
        const rounds = 1 + Math.floor(r.margin / 5);
        defender.addCondition(cond, rounds, src);
        r.effect = `${cond} for ${rounds} round(s)`;
      }
      break;
    default:
      break;
  }
  r.provoked = provokes(attacker, type);
  return r;
}

/** Maintain a grapple (+5 bonus): damage, pin, or move. */
function maintainGrapple(attacker, defender, mode = 'damage', opts = {}) {
  const r = roll(attacker, defender, 'grapple', { ...opts, bonus: 5 });
  if (!r.success) {
    endGrapple(attacker, defender);
    r.effect = 'grapple broken';
    return r;
  }
  if (mode === 'pin') {
    defender.removeEffectsWhere((e) => e.key === 'condition:grappled');
    defender.addEffect(makeEffect({ key: 'condition:pinned', name: 'Pinned', kind: 'condition', conditions: ['pinned'], data: { by: attacker.id } }));
    r.effect = 'pinned';
  } else r.effect = mode;
  return r;
}

function endGrapple(a, b) {
  a.removeEffectsWhere((e) => e.key === 'condition:grappling' || (e.key === 'condition:grappled' && e.data && e.data.by === b.id));
  b.removeEffectsWhere((e) => (e.key === 'condition:grappled' || e.key === 'condition:pinned') && e.data && e.data.by === a.id);
}

/** Escape a grapple: CMB or Escape Artist vs grappler's CMD. */
function escapeGrapple(creature, grappler, opts = {}) {
  const rng = opts.rng || defaultRng;
  const cmd = grappler.cmd(['grapple']);
  const viaSkill = creature.skill && creature.kind === 'character' ? creature.skill('escape-artist').total : -99;
  const bonus = Math.max(creature.cmb(['grapple']), viaSkill);
  const d = rng.die(20);
  const success = d === 20 || (d !== 1 && d + bonus >= cmd);
  if (success) endGrapple(grappler, creature);
  return { roll: d, bonus, total: d + bonus, cmd, success };
}

/** Feint: Bluff vs 10 + BAB + Wis (or Sense Motive if higher). */
function feint(attacker, defender, opts = {}) {
  const rng = opts.rng || defaultRng;
  const sm = defender.skill ? defender.skill('sense-motive').total : 0;
  const dc = Math.max(10 + defender.bab() + defender.abilityMod('wis'), 10 + sm);
  const typePenalty = defender.creatureType() === 'animal' ? -8 : defender.ability('int') !== null && defender.ability('int') < 3 ? -4 : 0;
  const r = checks.skillCheck(attacker, 'bluff', { dc, rng, circumstance: typePenalty });
  if (r.success) attacker.addEffect(makeEffect({ key: `feint:${defender.id}`, name: `Feinted ${defender.name}`, remaining: attacker.hasFeat && attacker.hasFeat('greater-feint') ? 2 : 1, data: { targetId: defender.id } }));
  return r;
}

/** Demoralize: Intimidate vs 10 + HD + Wis; shaken 1 round + 1 per 5 over. */
function demoralize(attacker, defender, opts = {}) {
  const rng = opts.rng || defaultRng;
  const dc = 10 + defender.hitDice() + defender.abilityMod('wis');
  const r = checks.skillCheck(attacker, 'intimidate', { dc, rng });
  if (r.success) {
    const rounds = 1 + Math.floor(r.margin / 5);
    if (defender.addCondition('shaken', rounds, { id: attacker.id, name: 'Demoralize' })) r.effect = `shaken ${rounds} round(s)`;
    else r.effect = 'immune';
  }
  return r;
}

module.exports = { perform, maintainGrapple, escapeGrapple, endGrapple, feint, demoralize, provokes, MANEUVERS };
