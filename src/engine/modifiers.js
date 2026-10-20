'use strict';

/**
 * Bonus stacking (PF1 Core Rulebook, "Bonuses").
 *
 * A modifier is { target, value, type, source, onlyIf? }.
 *  - Bonuses of the same type do not stack: only the highest applies.
 *  - Exceptions that always stack: untyped, dodge, circumstance (from
 *    different sources), racial (we treat racial as stacking because they
 *    come from distinct traits), and penalties of any type.
 *  - Two bonuses with the same source never stack, even if their type would.
 *
 * `onlyIf` is a list of context tags; the modifier only applies when the
 * check's context contains at least one of them (e.g. ['fear'] for Bravery,
 * ['vsMelee'] for the prone AC penalty).
 */

const STACKING_TYPES = new Set(['untyped', 'dodge', 'circumstance', 'racial']);

const BONUS_TYPES = [
  'alchemical', 'armor', 'circumstance', 'competence', 'deflection', 'dodge', 'enhancement',
  'inherent', 'insight', 'luck', 'morale', 'natural', 'natural-enhancement', 'profane', 'racial',
  'resistance', 'sacred', 'shield', 'shield-enhancement', 'armor-enhancement', 'size', 'trait', 'untyped',
];

function mod(target, value, type = 'untyped', source = 'unknown', onlyIf) {
  const m = { target, value, type, source };
  if (onlyIf) m.onlyIf = Array.isArray(onlyIf) ? onlyIf : [onlyIf];
  return m;
}

function applies(m, tags) {
  if (!m.onlyIf || !m.onlyIf.length) return true;
  if (!tags || !tags.length) return false;
  return m.onlyIf.some((t) => tags.includes(t));
}

function matchesTarget(m, targets) {
  return targets.includes(m.target);
}

/**
 * Sum the modifiers that apply to any of `targets` under `tags`, honouring
 * stacking rules. Returns { total, breakdown }.
 */
function resolve(modifiers, targets, tags = [], opts = {}) {
  const targetList = Array.isArray(targets) ? targets : [targets];
  const relevant = modifiers.filter((m) => matchesTarget(m, targetList) && applies(m, tags) && m.value !== 0);
  const include = opts.includeTypes ? new Set(opts.includeTypes) : null;
  const exclude = opts.excludeTypes ? new Set(opts.excludeTypes) : null;

  const bestByType = new Map(); // type -> modifier (highest bonus)
  const stacking = [];
  const penalties = [];
  const seenSources = new Map(); // "type|source" -> modifier for same-source dedupe

  for (const m of relevant) {
    const type = m.type || 'untyped';
    if (include && !include.has(type)) continue;
    if (exclude && exclude.has(type)) continue;
    if (m.value < 0) {
      // Penalties stack, except the exact same effect applied twice.
      const key = `${type}|${m.source}|${m.target}|pen`;
      if (seenSources.has(key)) {
        const prev = seenSources.get(key);
        if (m.value < prev.value) {
          penalties.splice(penalties.indexOf(prev), 1, m);
          seenSources.set(key, m);
        }
        continue;
      }
      seenSources.set(key, m);
      penalties.push(m);
      continue;
    }
    if (STACKING_TYPES.has(type)) {
      const key = `${type}|${m.source}|${m.target}`;
      if (seenSources.has(key)) {
        const prev = seenSources.get(key);
        if (m.value > prev.value) {
          stacking.splice(stacking.indexOf(prev), 1, m);
          seenSources.set(key, m);
        }
        continue;
      }
      seenSources.set(key, m);
      stacking.push(m);
      continue;
    }
    const prev = bestByType.get(type);
    if (!prev || m.value > prev.value) bestByType.set(type, m);
  }

  const applied = [...bestByType.values(), ...stacking, ...penalties];
  return {
    total: applied.reduce((s, m) => s + m.value, 0),
    breakdown: applied.map((m) => ({ source: m.source, type: m.type, value: m.value })),
  };
}

function total(modifiers, targets, tags, opts) {
  return resolve(modifiers, targets, tags, opts).total;
}

module.exports = { mod, resolve, total, applies, STACKING_TYPES, BONUS_TYPES };
