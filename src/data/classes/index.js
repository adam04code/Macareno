'use strict';

const { CLASSES: CORE } = require('./base');
const { CLASSES: APG } = require('./apg');
const { PRESTIGE } = require('./prestige');
const { ARCHETYPES } = require('./archetypes');

const BASE = { ...CORE, ...APG };
const CLASSES = { ...BASE, ...PRESTIGE };

for (const [classId, list] of Object.entries(ARCHETYPES)) {
  for (const [id, a] of Object.entries(list)) {
    a.id = id;
    a.classId = classId;
  }
  if (CLASSES[classId]) CLASSES[classId].archetypes = list;
}

function getClass(id) {
  const c = CLASSES[id];
  if (!c) throw Object.assign(new Error(`Unknown class: ${id}`), { status: 400 });
  return c;
}

/** Feature keys gained at exactly `level` in class `id`. */
function featuresAt(id, level) {
  return getClass(id).features[level] || [];
}

/** Every feature key an archetype removes, including whole-feature replacements. */
function archetypeRemovals(a) {
  return new Set(a.replaces || []);
}

/**
 * Two archetypes can be combined only if they replace or alter disjoint
 * class features (Advanced Player's Guide, "Archetypes").
 */
function archetypeConflicts(classId, ids) {
  const def = getClass(classId);
  const seen = new Map();
  const out = [];
  for (const id of ids) {
    const a = def.archetypes && def.archetypes[id];
    if (!a) {
      out.push(`Unknown ${def.name} archetype ${id}`);
      continue;
    }
    for (const key of [...archetypeRemovals(a), ...(a.alters || [])]) {
      if (seen.has(key)) out.push(`${a.name} and ${seen.get(key)} both change ${key}`);
      else seen.set(key, a.name);
    }
  }
  return out;
}

const effectiveCache = new Map();

/**
 * Class definition with archetypes applied: replaced features are removed,
 * new ones added, and progressions/class skills/proficiencies/bonus feats
 * overridden where the archetype says so.
 */
function effectiveClass(id, archetypeIds = []) {
  const base = getClass(id);
  if (!archetypeIds || !archetypeIds.length) return base;
  const key = `${id}|${archetypeIds.join(',')}`;
  if (effectiveCache.has(key)) return effectiveCache.get(key);
  const out = { ...base, features: {}, progressions: { ...(base.progressions || {}) }, classSkills: [...base.classSkills], appliedArchetypes: archetypeIds };
  const removed = new Set();
  for (const aid of archetypeIds) {
    const a = base.archetypes && base.archetypes[aid];
    if (a) archetypeRemovals(a).forEach((k) => removed.add(k));
  }
  for (const [lvl, keys] of Object.entries(base.features)) out.features[lvl] = keys.filter((k) => !removed.has(k));
  for (const aid of archetypeIds) {
    const a = base.archetypes && base.archetypes[aid];
    if (!a) continue;
    for (const [lvl, keys] of Object.entries(a.features || {})) out.features[lvl] = [...(out.features[lvl] || []), ...keys];
    Object.assign(out.progressions, a.progressions || {});
    if (a.classSkills) {
      out.classSkills = out.classSkills.filter((s) => !(a.classSkills.remove || []).includes(s));
      for (const s of a.classSkills.add || []) if (!out.classSkills.includes(s)) out.classSkills.push(s);
    }
    if (a.proficiencies) out.proficiencies = { ...base.proficiencies, ...a.proficiencies };
    if (a.bonusFeats !== undefined) out.bonusFeats = a.bonusFeats;
    if (a.skillRanks) out.skillRanks = a.skillRanks;
    if (a.choices) out.choices = { ...(base.choices || {}), ...a.choices };
  }
  effectiveCache.set(key, out);
  return out;
}

module.exports = { CLASSES, BASE_CLASSES: BASE, PRESTIGE_CLASSES: PRESTIGE, ARCHETYPES, getClass, featuresAt, effectiveClass, archetypeConflicts };
