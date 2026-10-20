'use strict';

const { FEATS } = require('../data/feats');
const { CLASSES } = require('../data/classes');
const { SPELLS } = require('../data/spells');

/**
 * Evaluate a prerequisite/requirements spec against a character.
 * Returns { ok, failures: [string] }.
 */
function check(char, req = {}, ctx = {}) {
  const failures = [];
  const fail = (m) => failures.push(m);
  const spellcasting = require('./spellcasting');

  if (req.abilities) {
    for (const [a, min] of Object.entries(req.abilities)) {
      const score = char.baseAbilityScores()[a];
      if (score < min) fail(`${a.toUpperCase()} ${min}`);
    }
  }
  if (req.bab !== undefined && char.bab() < req.bab) fail(`Base attack bonus +${req.bab}`);
  if (req.level !== undefined && char.hitDice() < req.level) fail(`Character level ${req.level}`);
  if (req.fighterLevel !== undefined && (char.fighterLevel ? char.fighterLevel() : 0) < req.fighterLevel) fail(`Fighter level ${req.fighterLevel}`);
  if (req.casterLevel !== undefined && char.casterLevel() < req.casterLevel) fail(`Caster level ${req.casterLevel}`);
  if (req.classLevel) for (const [cls, n] of Object.entries(req.classLevel)) if (char.classLevel(cls) < n) fail(`${CLASSES[cls]?.name || cls} level ${n}`);
  if (req.feats) {
    for (const f of req.feats) {
      const param = req.featParams && req.featParams[f];
      if (!char.hasFeat(f, param)) fail(`Feat: ${FEATS[f] ? FEATS[f].name : f}${param ? ` (${param})` : ''}`);
    }
  }
  if (req.featParamFrom && ctx.param !== undefined && !char.hasFeat(req.featParamFrom, ctx.param)) fail(`${FEATS[req.featParamFrom].name} (${ctx.param})`);
  if (req.skills) for (const [s, n] of Object.entries(req.skills)) if (char.skillRanks(s) < n) fail(`${n} ranks in ${s}`);
  if (req.classFeature && !char.hasFeature(req.classFeature)) fail(`Class feature: ${req.classFeature}`);
  if (req.spellcaster) {
    const ok = char.casterClasses().some((id) => req.spellcaster === 'any' || CLASSES[id].spellcasting.tradition === req.spellcaster);
    if (!ok) fail(`Ability to cast ${req.spellcaster} spells`);
  }
  if (req.race && char.race !== req.race) fail(`Race: ${req.race}`);
  if (req.raceNot && req.raceNot.includes(char.creatureType())) fail(`Race may not be ${req.raceNot.join('/')}`);
  if (req.alignment && !req.alignment(char.alignment)) fail(`Alignment: ${req.alignmentText}`);
  if (req.languages) for (const l of req.languages) if (!char.languages.includes(l)) fail(`Language: ${l}`);
  if (req.proficient && !char.isWeaponProficient(req.proficient)) {
    if (!(req.proficient === 'crossbow' && ['light-crossbow', 'heavy-crossbow', 'hand-crossbow'].some((w) => char.isWeaponProficient(w)))) fail(`Proficiency: ${req.proficient}`);
  }
  if (req.weaponProficiency === 'martial') {
    const { WEAPONS } = require('../data/equipment');
    const all = Object.entries(WEAPONS).filter(([, w]) => w.category === 'martial').every(([id]) => char.isWeaponProficient(id));
    if (!all) fail('Proficient with all martial weapons');
  }
  if (req.casting) {
    for (const c of Array.isArray(req.casting) ? req.casting : [req.casting]) {
      const lvl = spellcasting.maxSpellLevelForTradition(char, c.tradition);
      if (lvl === null || lvl < c.level) fail(`Able to cast ${c.level}${c.level === 1 ? 'st' : c.level === 2 ? 'nd' : c.level === 3 ? 'rd' : 'th'}-level ${c.tradition} spells`);
    }
  }
  if (req.castsSpell) {
    for (const s of req.castsSpell) {
      const ok = char.casterClasses().some((id) => Object.values(spellcasting.availableSpells(char, id)).some((ids) => ids.includes(s)));
      if (!ok) fail(`Able to cast ${SPELLS[s] ? SPELLS[s].name : s}`);
    }
  }
  if (req.castsDescriptor) {
    const ok = char.casterClasses().some((id) => Object.values(spellcasting.availableSpells(char, id)).flat().some((sid) => SPELLS[sid] && (SPELLS[sid].descriptors || []).some((d) => req.castsDescriptor.includes(d))));
    if (!ok) fail(`Able to cast a spell with the ${req.castsDescriptor.join(' or ')} descriptor`);
  }
  if (req.spontaneousArcane) {
    const ok = char.casterClasses().some((id) => CLASSES[id].spellcasting.tradition === 'arcane' && CLASSES[id].spellcasting.style === 'spontaneous');
    if (!ok) fail('Ability to cast arcane spells without preparation');
  }
  if (req.sorcererBloodline && char.classLevel('sorcerer') > 0 && char.choices.bloodline !== req.sorcererBloodline) fail(`Sorcerers must have the ${req.sorcererBloodline} bloodline`);
  if (req.progression) for (const [p, n] of Object.entries(req.progression)) if (char.prog(p) < n) fail(`${p} ${n}`);
  if (req.special && !(char.choices.specialRequirements || []).includes(ctx.classId)) fail(`Special: ${req.special}`);
  if (req.naturalAttacks && char.naturalAttacks && char.naturalAttacks().length < req.naturalAttacks) fail(`${req.naturalAttacks} natural attacks`);
  if (req.flySpeed && !char.flySpeed()) fail('Fly speed');
  return { ok: failures.length === 0, failures };
}

function featPrereqs(char, featId, param) {
  const f = FEATS[featId];
  if (!f) return { ok: false, failures: [`Unknown feat ${featId}`] };
  const res = check(char, f.prereq, { param });
  if (!f.multiple && char.hasFeat(featId)) res.failures.push('Already has this feat'), (res.ok = false);
  if (f.multiple && param !== undefined && char.hasFeat(featId, param)) res.failures.push('Already has this feat with that choice'), (res.ok = false);
  if (f.param && (param === undefined || param === null || param === '')) res.failures.push(`Requires a choice (${f.param})`), (res.ok = false);
  return res;
}

function classRequirements(char, classId) {
  const def = CLASSES[classId];
  if (!def) return { ok: false, failures: [`Unknown class ${classId}`] };
  const res = check(char, def.requirements || {}, { classId });
  if (def.alignment && !def.alignment(char.alignment)) res.failures.push(`Alignment: ${def.alignmentText}`), (res.ok = false);
  if (char.classLevel(classId) >= def.maxLevel) res.failures.push(`Already at maximum level in ${def.name}`), (res.ok = false);
  return res;
}

module.exports = { check, featPrereqs, classRequirements };
