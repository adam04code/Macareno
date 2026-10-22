'use strict';

const { CLASSES } = require('../data/classes');
const { SPELLS, spellLevelFor, spellList } = require('../data/spells');
const { FEATS } = require('../data/feats');
const OPTIONS = require('../data/classOptions');
const { bonusSpells, abilityMod } = require('./tables');

/**
 * Spellcasting: slots, spells known, preparation, casting, DCs.
 *
 * char.spellcasting[classId] = {
 *   known: { [level]: [spellId] },        // spontaneous casters
 *   spellbook: [spellId],                  // wizard / magus
 *   prepared: { [level]: [{ spell, metamagic: [], used: false, slot: 'normal'|'domain'|'school' }] },
 *   used: { [level]: n },                  // spontaneous slots used today
 * }
 */

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function sc(classId) {
  const def = CLASSES[classId];
  return def && def.spellcasting;
}

function state(char, classId) {
  if (!char.spellcasting[classId]) char.spellcasting[classId] = { known: {}, spellbook: [], prepared: {}, used: {} };
  const s = char.spellcasting[classId];
  s.known = s.known || {};
  s.spellbook = s.spellbook || [];
  s.prepared = s.prepared || {};
  s.used = s.used || {};
  return s;
}

function castingAbilityScore(char, classId) {
  return char.ability(sc(classId).ability);
}

/** Highest spell level with any slots, without calling grantedSpells (avoids recursion). */
function maxSpellLevelRaw(char, classId) {
  const m = maxSpellLevel(char, classId);
  return m === null ? 0 : m;
}

/** Highest spell level the class can cast (null if none). */
function maxSpellLevel(char, classId) {
  const slots = slotsPerDay(char, classId);
  let max = null;
  slots.forEach((n, l) => {
    if (n > 0) max = l;
  });
  return max;
}

/** Highest spell level castable in a tradition ('arcane'|'divine'|'any'). */
function maxSpellLevelForTradition(char, tradition) {
  let best = null;
  for (const id of char.casterClasses()) {
    const d = sc(id);
    if (tradition !== 'any' && d.tradition !== tradition) continue;
    const m = maxSpellLevel(char, id);
    if (m !== null && (best === null || m > best)) best = m;
  }
  return best;
}

/** Spells per day by level (bonus spells and domain/school slots included). */
function slotsPerDay(char, classId) {
  const d = sc(classId);
  if (!d) return [];
  const lvl = Math.min(20, char.effectiveCasterClassLevel(classId));
  if (lvl < 1) return [];
  const row = d.perDay[lvl] || [];
  const score = castingAbilityScore(char, classId);
  const am = abilityMod(score);
  const out = [];
  for (let l = 0; l < row.length; l++) {
    const base = row[l];
    if (base === null || base === undefined) {
      out.push(0);
      continue;
    }
    if (score < 10 + l) {
      out.push(0);
      continue;
    }
    let n = base === Infinity ? Infinity : base + bonusSpells(am, l);
    if (l > 0 && d.domainSlots && (typeof d.domainSlots !== 'string' || char.choices[d.domainSlots])) n += 1;
    if (l > 0 && d.schoolSlots && char.choices.school && char.choices.school !== 'universalist') n += 1;
    // Loremaster newfound arcana: bonus slots for the character's first spellcasting class.
    if (l > 0 && char.casterClasses()[0] === classId) for (const id of [].concat(char.choices.secret || [])) n += ((OPTIONS.OPTION_GROUPS.secret.table[id] || {}).bonusSlots || {})[l] || 0;
    out.push(n);
  }
  return out;
}

function knownLimit(char, classId) {
  const d = sc(classId);
  if (!d || !d.known) return null;
  const lvl = Math.min(20, char.effectiveCasterClassLevel(classId));
  return d.known[lvl] || [];
}

const CURE_SPELLS = ['cure-light-wounds', 'cure-moderate-wounds', 'cure-serious-wounds', 'cure-critical-wounds', 'mass-cure-light-wounds', 'mass-cure-moderate-wounds', 'mass-cure-serious-wounds', 'mass-cure-critical-wounds'];
const INFLICT_SPELLS = ['inflict-light-wounds', 'inflict-moderate-wounds', 'inflict-serious-wounds', 'inflict-critical-wounds', 'mass-inflict-light-wounds', 'mass-inflict-moderate-wounds', 'mass-inflict-serious-wounds', 'mass-inflict-critical-wounds'];

/** Bonus spells known automatically (bloodline, mystery, curse, patron and oracle cure/inflict spells). */
function grantedSpells(char, classId) {
  const out = {};
  const d = sc(classId);
  const add = (lvl, spell) => {
    if (!SPELLS[spell]) return;
    (out[lvl] = out[lvl] || []).includes(spell) || out[lvl].push(spell);
  };
  const classLvl = char.effectiveCasterClassLevel(classId);
  // Mystery spells (oracle) and patron spells (witch): one every even class level, of spell level = class level / 2.
  const table = d.mysterySpells && char.choices.mystery ? OPTIONS.MYSTERY_SPELLS(char.choices.mystery) : d.patronSpells && char.choices.patron ? OPTIONS.PATRON_SPELLS(char.choices.patron) : null;
  if (table) for (const [at, spell] of Object.entries(table)) if (classLvl >= Number(at)) add(Number(at) / 2, spell);
  if (d.oracleCures) {
    const list = char.choices.oracleCures === 'inflict' ? INFLICT_SPELLS : CURE_SPELLS;
    const max = maxSpellLevelRaw(char, classId);
    list.forEach((sp, i) => { if (i + 1 <= max) add(i + 1, sp); });
  }
  if (d.mysterySpells && char.choices.curse) {
    const curse = OPTIONS.OPTION_GROUPS.curse.table[char.choices.curse];
    const cl = char.classLevel('oracle') + Math.floor((char.hitDice() - char.classLevel('oracle')) / 2);
    for (const [at, ids] of Object.entries((curse && curse.bonusSpells) || {})) if (cl >= Number(at)) for (const sp of ids) if (SPELLS[sp]) add(spellLevelFor(SPELLS[sp], 'cleric') ?? spellLevelFor(SPELLS[sp], 'wizard') ?? 1, sp);
  }
  // Bloodrager bloodline spells at 7th, 10th, 13th and 16th level (spell levels 1-4).
  if (d.bloodragerSpells && char.choices['bloodrager-bloodline']) {
    const bl = OPTIONS.OPTION_GROUPS['bloodrager-bloodline'].table[char.choices['bloodrager-bloodline']];
    const lvl = char.prog('bloodragerBloodlineLevel');
    for (const [at, spell] of Object.entries((bl && bl.spells) || {})) if (lvl >= Number(at)) add([7, 10, 13, 16].indexOf(Number(at)) + 1, spell);
  }
  // Hunters add every summon nature's ally spell to their spells known.
  if (d.knowsSummonNaturesAlly) {
    const max = maxSpellLevelRaw(char, classId);
    ['i', 'ii', 'iii', 'iv', 'v', 'vi'].forEach((n, i) => { if (i + 1 <= max) add(i + 1, `summon-natures-ally-${n}`); });
  }
  if (d.bloodlineSpells && char.bloodline()) {
    const lvl = char.prog('sorcererBloodlineLevel');
    for (const [at, spell] of Object.entries(char.bloodline().spells)) {
      if (lvl >= Number(at) && SPELLS[spell]) {
        const sl = spellLevelFor(SPELLS[spell], 'wizard') ?? Math.max(1, Math.floor((Number(at) - 1) / 2));
        (out[sl] = out[sl] || []).push(spell);
      }
    }
  }
  return out;
}

/** Domain spells by level for a class with domain slots (cleric: choices.domains, druid: choices['druid-domain']). */
/** Level at which a granted (mystery, patron, bloodline, curse) spell is known, or null. */
function grantedLevel(char, classId, spellId) {
  const found = Object.entries(grantedSpells(char, classId)).find(([, ids]) => ids.includes(spellId));
  return found ? Number(found[0]) : null;
}

function domainSpells(char, classId = 'cleric') {
  const out = {};
  const d = sc(classId);
  const key = d && typeof d.domainSlots === 'string' ? d.domainSlots : 'domains';
  const v = char.choices[key];
  const ids = Array.isArray(v) ? [...v] : v ? [v] : [];
  // Shamans also prepare their wandering spirit's spirit magic.
  if (key === 'spirit' && char.choices['wandering-spirit']) ids.push(char.choices['wandering-spirit']);
  const table = key === 'spirit' ? OPTIONS.OPTION_GROUPS.spirit.table : OPTIONS.DOMAINS;
  for (const dId of ids) {
    const dom = table[dId];
    if (!dom) continue;
    dom.spells.forEach((s, i) => {
      if (SPELLS[s]) (out[i + 1] = out[i + 1] || []).push(s);
    });
  }
  return out;
}

/** Every spell the class can currently cast or prepare, grouped by level. */
function availableSpells(char, classId) {
  const d = sc(classId);
  const st = state(char, classId);
  const max = maxSpellLevel(char, classId);
  const out = {};
  if (max === null) return out;
  const push = (lvl, id) => {
    if (lvl > max) return;
    out[lvl] = out[lvl] || [];
    if (!out[lvl].includes(id)) out[lvl].push(id);
  };
  if (d.knowsWholeList) {
    for (const s of spellList(d.list)) push(spellLevelFor(s, d.list), s.id);
  } else if (d.spellbook && !d.preparesKnown) {
    for (const id of st.spellbook) {
      const s = SPELLS[id];
      if (s) push(spellLevelFor(s, d.list), id);
    }
    // Cantrips are always in the spellbook (and the witch's familiar).
    for (const s of spellList(d.list, 0)) if (!isOpposition(char, classId, s)) push(0, s.id);
    for (const [lvl, ids] of Object.entries(grantedSpells(char, classId))) ids.forEach((id) => push(Number(lvl), id));
  } else {
    for (const [lvl, ids] of Object.entries(st.known)) ids.forEach((id) => push(Number(lvl), id));
    for (const [lvl, ids] of Object.entries(grantedSpells(char, classId))) ids.forEach((id) => push(Number(lvl), id));
  }
  if (d.domainSlots) for (const [lvl, ids] of Object.entries(domainSpells(char, classId))) ids.forEach((id) => push(Number(lvl), id));
  return out;
}

function isOpposition(char, classId, spell) {
  return classId === 'wizard' && (char.choices.opposition || []).includes(spell.school);
}

/** Effective spell level with metamagic applied. */
function metamagicLevel(spellLevel, metamagic = [], heightenTo) {
  let lvl = spellLevel;
  for (const m of metamagic) {
    const f = FEATS[m];
    if (!f || !f.metamagic) throw err(`Unknown metamagic feat: ${m}`);
    lvl += f.metamagic.levelIncrease;
  }
  if (heightenTo && heightenTo > lvl) lvl = heightenTo;
  return lvl;
}

/** Spontaneous casters: learn a spell (respecting spells-known limits). */
function learnSpell(char, classId, spellId) {
  const d = sc(classId);
  if (!d) throw err(`${classId} is not a spellcasting class`);
  const spell = SPELLS[spellId];
  if (!spell) throw err(`Unknown spell: ${spellId}`);
  const lvl = spellLevelFor(spell, d.list);
  if (lvl === null) throw err(`${spell.name} is not on the ${d.list} list`);
  const st = state(char, classId);
  if (d.spellbook) {
    if (st.spellbook.includes(spellId)) throw err(`${spell.name} is already in the spellbook`);
    const max = maxSpellLevel(char, classId);
    if (max === null || lvl > max) throw err(`Cannot yet cast level ${lvl} spells`);
    st.spellbook.push(spellId);
    char.touch();
    return { classId, spell: spellId, level: lvl };
  }
  if (d.style !== 'spontaneous') throw err(`${CLASSES[classId].name} does not learn spells individually`);
  const limit = knownLimit(char, classId);
  const known = st.known[lvl] || [];
  if (known.includes(spellId)) throw err(`Already know ${spell.name}`);
  if (!limit[lvl] || known.length >= limit[lvl]) throw err(`No spells known remaining at level ${lvl}`);
  st.known[lvl] = [...known, spellId];
  char.touch();
  return { classId, spell: spellId, level: lvl };
}

function forgetSpell(char, classId, spellId) {
  const st = state(char, classId);
  for (const lvl of Object.keys(st.known)) st.known[lvl] = st.known[lvl].filter((s) => s !== spellId);
  char.touch();
}

/**
 * Prepare spells for the day. `list` = [{ spell, metamagic?, slot? }]. Replaces
 * all current preparations for that class.
 */
function prepareSpells(char, classId, list) {
  const d = sc(classId);
  if (!d) throw err(`${classId} is not a spellcasting class`);
  if (d.preparesKnown) return prepareKnown(char, classId, list);
  if (d.style !== 'prepared') throw err(`${CLASSES[classId].name} casts spontaneously and does not prepare spells`);
  const slots = slotsPerDay(char, classId);
  const avail = availableSpells(char, classId);
  const prepared = {};
  const counts = {};
  const domainUsed = {};
  for (const entry of list) {
    const e = typeof entry === 'string' ? { spell: entry } : entry;
    const spell = SPELLS[e.spell];
    if (!spell) throw err(`Unknown spell: ${e.spell}`);
    let base = spellLevelFor(spell, d.list);
    const isDomain = d.domainSlots && Object.entries(domainSpells(char, classId)).some(([l, ids]) => ids.includes(spell.id) && (base === null || Number(l) <= base || e.slot === 'domain'));
    if (base === null && isDomain) base = Number(Object.entries(domainSpells(char, classId)).find(([, ids]) => ids.includes(spell.id))[0]);
    if (base === null) base = grantedLevel(char, classId, spell.id);
    if (base === null) throw err(`${spell.name} is not on the ${d.list} list`);
    if (!Object.values(avail).some((ids) => ids.includes(spell.id))) throw err(`${spell.name} is not available to prepare`);
    for (const m of e.metamagic || []) if (!char.hasFeat(m)) throw err(`Missing metamagic feat ${m}`);
    const lvl = metamagicLevel(base, e.metamagic || [], e.heighten);
    if (!slots[lvl]) throw err(`No level ${lvl} slots`);
    const cost = isOpposition(char, classId, spell) ? 2 : 1;
    counts[lvl] = (counts[lvl] || 0) + cost;
    let slot = e.slot || 'normal';
    if (slot === 'domain') {
      if (!isDomain) throw err(`${spell.name} is not a domain spell`);
      if (domainUsed[lvl]) throw err(`Only one domain spell per level`);
      domainUsed[lvl] = true;
    }
    (prepared[lvl] = prepared[lvl] || []).push({ spell: spell.id, metamagic: e.metamagic || [], used: false, slot });
  }
  for (const [lvl, n] of Object.entries(counts)) {
    if (slots[lvl] !== Infinity && n > slots[lvl]) throw err(`Too many level ${lvl} spells prepared (${n}/${slots[lvl]})`);
    // The domain slot (cleric) may only hold a domain spell.
    if (d.domainSlots && (typeof d.domainSlots !== 'string' || char.choices[d.domainSlots]) && Number(lvl) > 0 && n === slots[lvl] && !domainUsed[lvl]) {
      const dom = (prepared[lvl] || []).some((p) => Object.values(domainSpells(char, classId)).some((ids) => ids.includes(p.spell)));
      if (!dom) throw err(`The last level ${lvl} slot is a domain slot and must hold a domain spell`);
    }
    if (d.schoolSlots && char.choices.school && char.choices.school !== 'universalist' && Number(lvl) > 0 && n === slots[lvl]) {
      const school = (prepared[lvl] || []).some((p) => SPELLS[p.spell].school === char.choices.school);
      if (!school) throw err(`The last level ${lvl} slot is a school slot and must hold a ${char.choices.school} spell`);
    }
  }
  state(char, classId).prepared = prepared;
  char.touch();
  return prepared;
}

/**
 * Arcanists prepare a limited number of spellbook spells each day (their
 * "spells known" for the day) and cast them with spontaneous slots.
 */
function prepareKnown(char, classId, list) {
  const d = sc(classId);
  const st = state(char, classId);
  const limit = knownLimit(char, classId);
  const known = {};
  for (const entry of list) {
    const id = typeof entry === 'string' ? entry : entry.spell;
    const spell = SPELLS[id];
    if (!spell) throw err(`Unknown spell: ${id}`);
    const lvl = spellLevelFor(spell, d.list);
    if (lvl === null) throw err(`${spell.name} is not on the ${d.list} list`);
    if (lvl > 0 && !st.spellbook.includes(id)) throw err(`${spell.name} is not in your spellbook`);
    if ((known[lvl] || []).includes(id)) continue;
    known[lvl] = [...(known[lvl] || []), id];
    if (!limit[lvl] || known[lvl].length > limit[lvl]) throw err(`Too many level ${lvl} spells prepared (limit ${limit[lvl] || 0})`);
  }
  st.known = known;
  char.touch();
  return known;
}

/** Fill any free daily preparations from the spellbook (arcanist defaults). */
function autoPrepareKnown(char, classId) {
  const d = sc(classId);
  const st = state(char, classId);
  const limit = knownLimit(char, classId) || [];
  for (let l = 0; l < limit.length; l++) {
    const have = st.known[l] || [];
    const pool = l === 0 ? spellList(d.list, 0).map((s) => s.id) : st.spellbook.filter((id) => SPELLS[id] && spellLevelFor(SPELLS[id], d.list) === l);
    for (const id of pool) if (have.length < (limit[l] || 0) && !have.includes(id)) have.push(id);
    if (have.length) st.known[l] = have;
  }
  char.touch();
}

/** Find what casting `spellId` would consume. Throws if impossible. */
function planCast(char, classId, spellId, opts = {}) {
  const d = sc(classId);
  if (!d) throw err(`${classId} is not a spellcasting class`);
  const spell = SPELLS[spellId];
  if (!spell) throw err(`Unknown spell: ${spellId}`);
  const st = state(char, classId);
  const metamagic = opts.metamagic || [];
  let base = spellLevelFor(spell, d.list);
  if (base === null) base = grantedLevel(char, classId, spellId);
  if (base === null && d.domainSlots) {
    const found = Object.entries(domainSpells(char, classId)).find(([, ids]) => ids.includes(spellId));
    if (found) base = Number(found[0]);
  }
  if (base === null) throw err(`${spell.name} is not on the ${d.list} list`);
  if (d.style === 'prepared') {
    // Spontaneous cure/inflict conversion for clerics.
    if (opts.convertFrom && d.spontaneous) {
      const ok = d.spontaneous === 'summon-natures-ally' ? spellId.startsWith('summon-natures-ally') : spellId.startsWith('cure-') || spellId.startsWith('inflict-');
      if (!ok) throw err(d.spontaneous === 'summon-natures-ally' ? "Only summon nature's ally spells can be cast spontaneously" : 'Only cure or inflict spells can be cast spontaneously');
      const lvl = base;
      const entry = (st.prepared[lvl] || []).find((p) => !p.used && p.spell === opts.convertFrom && p.slot !== 'domain');
      if (!entry) throw err(`No unused prepared ${opts.convertFrom} at level ${lvl} to convert`);
      return { classId, spell, baseLevel: base, level: lvl, entry, metamagic: [] };
    }
    const lvl = metamagicLevel(base, metamagic, opts.heighten);
    const entry = (st.prepared[lvl] || []).find((p) => p.spell === spellId && (p.metamagic || []).join() === metamagic.join() && (!p.used || lvl === 0));
    if (!entry) throw err(`${spell.name}${metamagic.length ? ` (${metamagic.join(', ')})` : ''} is not prepared or already cast`);
    return { classId, spell, baseLevel: base, level: lvl, entry, metamagic };
  }
  // Spontaneous.
  const avail = availableSpells(char, classId);
  if (!(avail[base] || []).includes(spellId)) throw err(`${spell.name} is not known`);
  for (const m of metamagic) if (!char.hasFeat(m)) throw err(`Missing metamagic feat ${m}`);
  const lvl = metamagicLevel(base, metamagic, opts.heighten);
  const slots = slotsPerDay(char, classId);
  if (lvl > 0 && (st.used[lvl] || 0) >= (slots[lvl] || 0)) throw err(`No level ${lvl} spell slots remaining`);
  return { classId, spell, baseLevel: base, level: lvl, entry: null, metamagic, spontaneousMetamagic: metamagic.length > 0 };
}

function consume(char, plan) {
  if (plan.level === 0) return;
  if (plan.entry) plan.entry.used = true;
  else {
    const st = state(char, plan.classId);
    st.used[plan.level] = (st.used[plan.level] || 0) + 1;
  }
  char.touch();
}

/** Restore a consumed slot (spell recall, pearl of power). */
function recall(char, classId, level, spellId) {
  const st = state(char, classId);
  if (sc(classId).style === 'prepared') {
    const entry = (st.prepared[level] || []).find((p) => p.used && (!spellId || p.spell === spellId));
    if (!entry) throw err('No expended spell of that level to recall');
    entry.used = false;
  } else {
    if (!st.used[level]) throw err('No expended slot of that level');
    st.used[level] -= 1;
  }
  char.touch();
}

function restoreSlots(char) {
  for (const classId of Object.keys(char.spellcasting)) {
    const st = state(char, classId);
    st.used = {};
    for (const lvl of Object.keys(st.prepared)) st.prepared[lvl].forEach((p) => (p.used = false));
  }
  char.touch();
}

function spellDC(caster, spell, level, abilityKey) {
  const ab = abilityKey ? caster.abilityMod(abilityKey) : caster.abilityMod('cha');
  const tags = [spell.school, ...(spell.subschool ? [spell.subschool] : []), ...(spell.descriptors || [])];
  const extra = caster.stat(['spellDC', ...tags.map((t) => `spellDC.${t}`)]).total;
  return 10 + level + ab + extra;
}

function concentrationBonus(caster, classId) {
  const ab = classId && sc(classId) ? caster.abilityMod(sc(classId).ability) : caster.abilityMod('cha');
  return caster.casterLevel(classId) + ab;
}

/** Summary for character sheets / clients. */
function summary(char) {
  const out = {};
  for (const classId of char.casterClasses()) {
    const d = sc(classId);
    const st = state(char, classId);
    const slots = slotsPerDay(char, classId);
    out[classId] = {
      tradition: d.tradition, style: d.style, ability: d.ability, casterLevel: char.casterLevel(classId),
      concentration: concentrationBonus(char, classId),
      slots: slots.map((n, lvl) => ({ level: lvl, perDay: n === Infinity ? 'at will' : n, used: d.style === 'spontaneous' ? st.used[lvl] || 0 : (st.prepared[lvl] || []).filter((p) => p.used).length })),
      known: d.style === 'spontaneous' ? st.known : undefined,
      knownLimit: d.style === 'spontaneous' ? knownLimit(char, classId) : undefined,
      spellbook: d.spellbook ? st.spellbook : undefined,
      prepared: d.style === 'prepared' ? st.prepared : undefined,
      available: availableSpells(char, classId),
      dcBase: 10 + char.abilityMod(d.ability),
      arcaneSpellFailure: d.tradition === 'arcane' ? char.arcaneSpellFailure() : 0,
    };
  }
  return out;
}

module.exports = {
  slotsPerDay, maxSpellLevel, maxSpellLevelForTradition, knownLimit, availableSpells, learnSpell, forgetSpell, prepareSpells,
  prepareKnown, autoPrepareKnown, planCast, consume, recall, restoreSlots, spellDC, concentrationBonus, metamagicLevel, summary, state, domainSpells, grantedSpells, isOpposition,
};
