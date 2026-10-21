'use strict';

const { Character } = require('./character');
const T = require('./tables');
const { RACES } = require('../data/races');
const { CLASSES, BASE_CLASSES, archetypeConflicts } = require('../data/classes');
const { FEATURES } = require('../data/features');
const { FEATS, MONK_BONUS_FEATS, featList } = require('../data/feats');
const { SKILLS, ALIGNMENTS, ABILITIES, alignmentStepDistance, LANGUAGES, SPELL_SCHOOLS } = require('../data/core');
const OPTIONS = require('../data/classOptions');
const { SPELLS, spellLevelFor, spellList } = require('../data/spells');
const { ITEMS, WEAPONS, STARTING_WEALTH } = require('../data/equipment');
const prerequisites = require('./prerequisites');
const spellcasting = require('./spellcasting');
const inventory = require('./inventory');
const dice = require('./dice');
const { defaultRng } = require('./rng');

function err(message, status = 400, details) {
  return Object.assign(new Error(message), { status, details });
}

const CLASS_KITS = {
  fighter: [['longsword'], ['heavy-wooden-shield'], ['scale-mail'], ['shortbow'], ['arrows'], ['backpack'], ['bedroll'], ['trail-rations', 3]],
  barbarian: [['greataxe'], ['hide'], ['javelin', 3], ['backpack'], ['bedroll'], ['trail-rations', 3]],
  rogue: [['rapier'], ['shortbow'], ['arrows'], ['leather'], ['thieves-tools'], ['backpack'], ['dagger']],
  wizard: [['quarterstaff'], ['light-crossbow'], ['bolts'], ['spell-component-pouch'], ['spellbook'], ['backpack']],
  sorcerer: [['spear'], ['light-crossbow'], ['bolts'], ['spell-component-pouch'], ['backpack']],
  cleric: [['heavy-mace'], ['scale-mail'], ['heavy-wooden-shield'], ['holy-symbol-wooden'], ['backpack'], ['potion-cure-light-wounds']],
  bard: [['rapier'], ['leather'], ['shortbow'], ['arrows'], ['musical-instrument'], ['spell-component-pouch'], ['backpack']],
  monk: [['quarterstaff'], ['shuriken', 10], ['backpack'], ['bedroll']],
  paladin: [['longsword'], ['scale-mail'], ['heavy-steel-shield'], ['holy-symbol-wooden'], ['backpack']],
  ranger: [['longbow'], ['arrows', 40], ['short-sword'], ['leather'], ['backpack'], ['bedroll']],
  magus: [['scimitar'], ['studded-leather'], ['spell-component-pouch'], ['spellbook'], ['backpack']],
};
const KIT_EQUIP = { fighter: ['longsword', 'heavy-wooden-shield', 'scale-mail'], barbarian: ['greataxe', 'hide'], rogue: ['rapier', 'leather'], wizard: ['quarterstaff'], sorcerer: ['spear'], cleric: ['heavy-mace', 'scale-mail', 'heavy-wooden-shield'], bard: ['rapier', 'leather'], monk: [], paladin: ['longsword', 'scale-mail', 'heavy-steel-shield'], ranger: ['longbow', 'leather'], magus: ['scimitar', 'studded-leather'] };

// ---------------------------------------------------------------- abilities
function pointBuyCost(scores) {
  let total = 0;
  for (const a of ABILITIES) {
    const s = scores[a];
    if (!Number.isInteger(s) || T.POINT_BUY_COST[s] === undefined) throw err(`Point buy scores must be integers 7-18 (${a} = ${s})`);
    total += T.POINT_BUY_COST[s];
  }
  return total;
}

/** 4d6 drop lowest, six times (standard method). Returns the array; the server stores it on the account. */
function rollAbilityArray(rng = defaultRng) {
  return Array.from({ length: 6 }, () => dice.total('4d6kh3', rng)).sort((a, b) => b - a);
}

function validateAbilities(spec, opts) {
  const ab = spec.abilities || {};
  const method = ab.method || 'pointbuy';
  const scores = ab.scores;
  if (!scores) throw err('abilities.scores is required');
  if (method === 'pointbuy') {
    const budget = opts.pointBuy ?? T.POINT_BUY_BUDGETS.high;
    const cost = pointBuyCost(scores);
    if (cost > budget) throw err(`Point buy exceeds budget (${cost}/${budget})`);
    return { ...scores };
  }
  if (method === 'rolled') {
    const pool = [...(opts.rolledArray || [])].sort((a, b) => b - a);
    if (!pool.length) throw err('Roll abilities first (POST /api/characters/roll-abilities)');
    const assigned = ABILITIES.map((a) => scores[a]).sort((a, b) => b - a);
    if (JSON.stringify(pool) !== JSON.stringify(assigned)) throw err(`Assigned scores must match your rolled array ${pool.join(', ')}`);
    return { ...scores };
  }
  if (method === 'free' && opts.allowFree) return { ...scores };
  throw err(`Unknown ability method ${method}`);
}

// ---------------------------------------------------------------- choices
function featSlotsAt(char, classId, classLevel, charLevel) {
  const slots = [];
  if (charLevel % 2 === 1) slots.push({ kind: 'general' });
  if (charLevel === 1 && char.raceDef().bonusFeats) for (let i = 0; i < char.raceDef().bonusFeats; i++) slots.push({ kind: 'general', source: 'race' });
  const bf = char.classDef(classId).bonusFeats;
  if (bf && bf.levels.includes(classLevel)) slots.push({ kind: bf.list, source: classId, ...(bf.feats ? { feats: bf.feats } : {}) });
  return slots;
}

/** Feat slots granted by options picked this level (Combat Trick, Feat talent, bonus-feat discoveries...). */
function optionFeatSlots(choices) {
  const out = [];
  for (const [key, group] of Object.entries(OPTIONS.OPTION_GROUPS)) {
    for (const id of asList(choices[key])) {
      const opt = group.table[id];
      if (opt && opt.bonusFeat) out.push({ kind: opt.bonusFeat === 'any' ? 'general' : opt.bonusFeat, source: key, ...(opt.bonusFeats ? { feats: opt.bonusFeats } : {}) });
    }
  }
  return out;
}

function allowedForSlot(featId, slot, char, classLevel) {
  const f = FEATS[featId];
  if (!f) return false;
  if (f.types.includes('monster')) return false;
  if (slot.feats) return slot.feats.includes(featId);
  if (slot.kind === 'general') return true;
  if (slot.kind === 'teamwork' || slot.kind === 'critical' || slot.kind === 'metamagic' || slot.kind === 'item-creation' || slot.kind === 'style') return f.types.includes(slot.kind);
  if (slot.kind === 'combat') return f.types.includes('combat');
  if (slot.kind === 'wizard') return f.types.includes('metamagic') || f.types.includes('item-creation') || featId === 'spell-mastery';
  if (slot.kind === 'magus') return f.types.some((t) => ['combat', 'metamagic', 'item-creation'].includes(t));
  if (slot.kind === 'bloodline') {
    const bl = OPTIONS.BLOODLINES[char.choices.bloodline] || OPTIONS.BLOODLINES.draconic;
    return (bl.feats || []).includes(featId);
  }
  if (slot.kind === 'monk') {
    const allowed = Object.entries(MONK_BONUS_FEATS).filter(([lvl]) => classLevel >= Number(lvl)).flatMap(([, ids]) => ids);
    return allowed.includes(featId);
  }
  return false;
}

/**
 * Apply the feat picks for this level. picks: [{ id, param }]. Slots are filled in order;
 * class bonus feats are matched first to the most restrictive slot that accepts them.
 */
function applyFeats(char, picks, slots, classLevel) {
  const remaining = [...slots];
  const errors = [];
  for (const p of picks || []) {
    const pick = typeof p === 'string' ? { id: p } : p;
    const def = FEATS[pick.id];
    if (!def) {
      errors.push(`Unknown feat ${pick.id}`);
      continue;
    }
    // Prefer restrictive bonus slots.
    const order = [...remaining].sort((a, b) => (a.kind === 'general') - (b.kind === 'general'));
    const slot = order.find((s) => allowedForSlot(pick.id, s, char, classLevel));
    if (!slot) {
      errors.push(`No feat slot available for ${def.name}`);
      continue;
    }
    const ignorePrereqs = slot.kind === 'monk' || slot.ignorePrereqs;
    const pre = prerequisites.featPrereqs(char, pick.id, pick.param);
    const fatal = pre.failures.filter((f) => !ignorePrereqs || f.startsWith('Already') || f.startsWith('Requires a choice'));
    if (fatal.length) {
      errors.push(`${def.name}: ${fatal.join('; ')}`);
      continue;
    }
    validateFeatParam(pick, def, errors);
    remaining.splice(remaining.indexOf(slot), 1);
    char.feats.push({ id: pick.id, ...(pick.param !== undefined ? { param: pick.param } : {}), source: slot.source || 'level', level: char.hitDice() });
    char.touch();
  }
  if (remaining.length) errors.push(`Unspent feat slots: ${remaining.map((s) => s.kind).join(', ')}`);
  return errors;
}

function validateFeatParam(pick, def, errors) {
  if (!def.param) return;
  const p = pick.param;
  switch (def.param) {
    case 'weapon':
    case 'exotic-weapon':
    case 'martial-weapon': {
      const w = WEAPONS[p];
      if (!w && !(def.param === 'weapon' && ['ray', 'grapple', 'unarmed-strike'].includes(p))) errors.push(`${def.name}: unknown weapon ${p}`);
      if (w && def.param === 'exotic-weapon' && w.category !== 'exotic') errors.push(`${def.name}: ${p} is not exotic`);
      if (w && def.param === 'martial-weapon' && w.category !== 'martial') errors.push(`${def.name}: ${p} is not martial`);
      break;
    }
    case 'skill':
      if (!SKILLS[p]) errors.push(`${def.name}: unknown skill ${p}`);
      break;
    case 'school':
      if (!SPELL_SCHOOLS.includes(p)) errors.push(`${def.name}: unknown school ${p}`);
      break;
    case 'spell':
      if (!SPELLS[p]) errors.push(`${def.name}: unknown spell ${p}`);
      break;
    default:
      break;
  }
}

function applySkills(char, ranks, budget) {
  const errors = [];
  let spent = 0;
  for (const [skill, n] of Object.entries(ranks || {})) {
    if (!SKILLS[skill]) {
      errors.push(`Unknown skill ${skill}`);
      continue;
    }
    if (!Number.isInteger(n) || n < 0) {
      errors.push(`Invalid ranks for ${skill}`);
      continue;
    }
    const total = char.skillRanks(skill) + n;
    if (total > char.maxRanks()) errors.push(`${SKILLS[skill].name}: ranks cannot exceed character level (${char.maxRanks()})`);
    char.skillRanksMap[skill] = total;
    spent += n;
  }
  if (spent > budget) errors.push(`Too many skill ranks spent (${spent}/${budget})`);
  char.touch();
  return { errors, spent };
}

const asList = (v) => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);

/** Option ids a character could legally pick from `group` right now (used by validation and auto-leveling). */
function optionAllowed(char, groupKey, id, classLevel, classId) {
  const group = OPTIONS.OPTION_GROUPS[groupKey];
  const opt = group && group.table[id];
  if (!opt) return `Unknown ${group ? group.label : groupKey}: ${id}`;
  const lvl = group.levelProg ? Math.max(char.prog(group.levelProg), classLevel) : classLevel;
  if (opt.minLevel && lvl < opt.minLevel) return `${opt.name} requires level ${opt.minLevel}`;
  if (opt.advanced && group.advancedAt && lvl < group.advancedAt) return `${opt.name} is an advanced option (level ${group.advancedAt})`;
  if (opt.classes && classId && !opt.classes.includes(classId)) return `${opt.name} is not available to ${CLASSES[classId].name}s`;
  if (!opt.repeatable && char.hasOption(groupKey, id)) return `Already have ${opt.name}`;
  for (const r of opt.requires || []) if (!char.hasOption(groupKey, r)) return `${opt.name} requires ${group.table[r] ? group.table[r].name : r}`;
  if (opt.prereq) {
    const res = prerequisites.check(char, opt.prereq);
    if (!res.ok) return `${opt.name}: ${res.failures.join('; ')}`;
  }
  if (opt.validate) {
    const msg = opt.validate(char, classLevel);
    if (msg) return msg;
  }
  return null;
}

/** Number of picks from each option group granted by this level's features and extra-pick feats. */
function picksNeeded(char, classId, classLevel, featPicks = []) {
  const need = {};
  for (const key of char.classDef(classId).features[classLevel] || []) {
    const f = FEATURES[key];
    if (f && f.choice) need[f.choice] = (need[f.choice] || 0) + (f.choiceCount || 1);
  }
  for (const p of featPicks) {
    const def = FEATS[typeof p === 'string' ? p : p.id];
    if (def && def.grantsChoice) need[def.grantsChoice] = (need[def.grantsChoice] || 0) + 1;
  }
  return need;
}

/** Class-feature choices gained at this class level. */
function applyClassChoices(char, classId, classLevel, choices = {}, featPicks = []) {
  const errors = [];
  const def = char.classDef(classId);
  const gained = def.features[classLevel] || [];
  // Generic option groups (rage powers, talents, hexes, discoveries, revelations...).
  for (const [groupKey, n] of Object.entries(picksNeeded(char, classId, classLevel, featPicks))) {
    const group = OPTIONS.OPTION_GROUPS[groupKey];
    const picks = asList(choices[groupKey]);
    if (picks.length !== n) {
      errors.push(`Choose ${n} ${group.label}${n > 1 ? 's' : ''} (choices.${groupKey}${n > 1 ? ' as a list' : ''})`);
      continue;
    }
    for (const id of picks) {
      const why = optionAllowed(char, groupKey, id, classLevel, classId);
      if (why) {
        errors.push(why);
        continue;
      }
      if (group.single) char.choices[groupKey] = id;
      else char.choices[groupKey] = [...asList(char.choices[groupKey]), id];
      const opt = group.table[id];
      if (opt.onPick) errors.push(...(opt.onPick(char, choices) || []));
      char.touch();
    }
  }
  for (const feature of gained) {
    switch (feature) {
      case 'weapon-training': {
        const g = choices['weapon-training'];
        if (!OPTIONS.WEAPON_GROUPS.includes(g)) errors.push(`Choose a weapon group for weapon training (one of ${OPTIONS.WEAPON_GROUPS.join(', ')})`);
        else if ((char.choices['weapon-training'] || []).includes(g)) errors.push('Weapon group already chosen');
        else char.choices['weapon-training'] = [...(char.choices['weapon-training'] || []), g];
        break;
      }
      case 'favored-enemy': {
        const t = choices['favored-enemy'];
        if (!OPTIONS.FAVORED_ENEMY_TYPES.includes(t)) errors.push(`Choose a favored enemy type (choices.favored-enemy)`);
        else if ((char.choices['favored-enemy'] || []).some((x) => x.type === t)) errors.push('Favored enemy already chosen');
        else {
          const list = char.choices['favored-enemy'] || [];
          // Each new favored enemy after the first raises one existing bonus by +2.
          if (list.length) {
            const inc = choices['favored-enemy-increase'] || list[0].type;
            const e = list.find((x) => x.type === inc);
            if (!e) errors.push('favored-enemy-increase must name an existing favored enemy');
            else e.bonus += 2;
          }
          char.choices['favored-enemy'] = [...list, { type: t, bonus: 2 }];
        }
        break;
      }
      case 'favored-terrain': {
        const t = choices['favored-terrain'];
        if (!OPTIONS.TERRAINS.includes(t)) errors.push('Choose a favored terrain (choices.favored-terrain)');
        else {
          const list = char.choices['favored-terrain'] || [];
          if (list.length) {
            const e = list.find((x) => x.terrain === (choices['favored-terrain-increase'] || list[0].terrain));
            if (e) e.bonus += 2;
          }
          char.choices['favored-terrain'] = [...list, { terrain: t, bonus: 2 }];
        }
        break;
      }
      case 'combat-style': {
        if (!char.choices['combat-style-name']) {
          const st = choices['combat-style'];
          if (!OPTIONS.COMBAT_STYLES[st]) {
            errors.push(`Choose a combat style (${Object.keys(OPTIONS.COMBAT_STYLES).join(', ')})`);
            break;
          }
          char.choices['combat-style-name'] = st;
        }
        const style = OPTIONS.COMBAT_STYLES[char.choices['combat-style-name']];
        const feat = choices['combat-style-feat'];
        const allowed = Object.entries(style.feats).filter(([lvl]) => classLevel >= Number(lvl)).flatMap(([, ids]) => ids);
        if (!allowed.includes(feat)) errors.push(`Choose a combat style feat: ${allowed.join(', ')}`);
        else if (char.hasFeat(feat)) errors.push('Already have that feat');
        else char.feats.push({ id: feat, source: 'combat-style', level: char.hitDice() });
        break;
      }
      case 'domains': {
        const d = choices.domains;
        const deity = OPTIONS.DEITIES[char.deity];
        if (!deity) errors.push(`Clerics must choose a deity (${Object.keys(OPTIONS.DEITIES).join(', ')})`);
        else if (alignmentStepDistance(deity.alignment, char.alignment) > 1) errors.push(`Alignment must be within one step of ${deity.name} (${deity.alignment})`);
        if (!Array.isArray(d) || d.length !== 2 || new Set(d).size !== 2) errors.push('Choose two different domains (choices.domains)');
        else {
          for (const x of d) {
            if (!OPTIONS.DOMAINS[x]) errors.push(`Unknown domain ${x}`);
            else if (deity && !deity.domains.includes(x)) errors.push(`${deity.name} does not grant the ${x} domain`);
          }
          errors.push(...alignmentDomainErrors(char, d));
          char.choices.domains = d;
        }
        break;
      }
      case 'arcane-school': {
        const school = choices.school || 'universalist';
        if (!OPTIONS.ARCANE_SCHOOLS[school]) errors.push(`Unknown arcane school ${school}`);
        char.choices.school = school;
        if (school !== 'universalist') {
          const opp = choices.opposition || [];
          if (opp.length !== 2 || new Set(opp).size !== 2) errors.push('Specialist wizards choose two opposition schools (choices.opposition)');
          for (const o of opp) if (!SPELL_SCHOOLS.includes(o) || o === 'universal' || o === school) errors.push(`Invalid opposition school ${o}`);
          char.choices.opposition = opp;
        } else char.choices.opposition = [];
        if (school === 'transmutation') char.choices.transmutationAbility = ['str', 'dex', 'con'].includes(choices.transmutationAbility) ? choices.transmutationAbility : 'str';
        if (school === 'abjuration') char.choices.abjurationEnergy = choices.abjurationEnergy || 'fire';
        break;
      }
      case 'bloodline': {
        const b = choices.bloodline;
        if (!OPTIONS.BLOODLINES[b]) errors.push(`Choose a bloodline (${Object.keys(OPTIONS.BLOODLINES).join(', ')})`);
        char.choices.bloodline = b;
        if (b === 'draconic') {
          if (!OPTIONS.DRAGON_TYPES[choices.dragonType]) errors.push(`Draconic sorcerers choose a dragon type (${Object.keys(OPTIONS.DRAGON_TYPES).join(', ')})`);
          char.choices.dragonType = choices.dragonType;
        }
        if (b === 'elemental') char.choices.element = ['fire', 'cold', 'electricity', 'acid'].includes(choices.element) ? choices.element : 'fire';
        break;
      }
      case 'blood-of-dragons':
        if (!char.choices.dragonType) {
          if (!OPTIONS.DRAGON_TYPES[choices.dragonType]) errors.push('Choose a dragon type (choices.dragonType)');
          char.choices.dragonType = choices.dragonType;
        }
        break;
      case 'arcane-bond':
        char.choices.arcaneBond = choices.arcaneBond === 'familiar' ? 'familiar' : 'object';
        break;
      default: {
        const f = FEATURES[feature];
        if (f && f.onGain) errors.push(...(f.onGain(char, choices, classLevel) || []));
        break;
      }
    }
  }
  return errors;
}

/** The good/evil/law/chaos domains (and blessings, inquisitions) require a matching alignment. */
function alignmentDomainErrors(char, ids) {
  const ax = char.axes();
  const out = [];
  for (const x of ids) if ((x === 'good' && !ax.good) || (x === 'evil' && !ax.evil) || (x === 'law' && !ax.lawful) || (x === 'chaos' && !ax.chaotic)) out.push(`The ${x} domain requires a matching alignment`);
  return out;
}

/** Validate and record archetypes when a class is first taken. */
function applyArchetypes(char, classId, ids) {
  const list = asList(ids);
  if (!list.length) return [];
  const errors = archetypeConflicts(classId, list);
  const def = CLASSES[classId];
  for (const id of list) {
    const a = def.archetypes && def.archetypes[id];
    if (!a) continue;
    if (a.alignment && !a.alignment(char.alignment)) errors.push(`${a.name}: alignment must be ${a.alignmentText}`);
    if (a.race && !asList(a.race).includes(char.race)) errors.push(`${a.name} is restricted to ${asList(a.race).join('/')}`);
  }
  const entry = char.classes.find((c) => c.id === classId);
  if (!errors.length) {
    entry.archetypes = list;
    char.touch();
  }
  return errors;
}

function initialSpells(char, classId, spells = {}) {
  const errors = [];
  const d = CLASSES[classId].spellcasting;
  if (!d) return errors;
  const st = spellcasting.state(char, classId);
  if (d.spellbook) {
    const list = spells.spellbook || [];
    const allowed = 3 + Math.max(0, char.baseAbilityMod('int')) + (classId === 'wizard' && char.choices.school && char.choices.school !== 'universalist' ? 1 : 0);
    const first = list.filter((id) => SPELLS[id] && spellLevelFor(SPELLS[id], d.list) === 1);
    if (list.some((id) => !SPELLS[id] || spellLevelFor(SPELLS[id], d.list) === null)) errors.push(`Spellbook contains spells not on the ${d.list} list`);
    if (list.some((id) => SPELLS[id] && spellLevelFor(SPELLS[id], d.list) > 1)) errors.push('Starting spellbooks may only hold 0- and 1st-level spells');
    if (first.length > allowed) errors.push(`Too many 1st-level spells in spellbook (${first.length}/${allowed})`);
    st.spellbook = [...new Set(list.filter((id) => SPELLS[id] && spellLevelFor(SPELLS[id], d.list) === 1))];
  }
  if (d.style === 'spontaneous') {
    const limit = spellcasting.knownLimit(char, classId);
    st.known = {};
    for (const id of spells.known || []) {
      try {
        spellcasting.learnSpell(char, classId, id);
      } catch (e) {
        errors.push(e.message);
      }
    }
    for (let l = 0; l < limit.length; l++) {
      const missing = Math.min(limit[l] - (st.known[l] || []).length, spellList(d.list, l).filter((sp) => !(st.known[l] || []).includes(sp.id)).length);
      if (missing > 0) errors.push(`Choose ${missing} more level ${l} spells known (spells.known)`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------- creation
/**
 * Create a level 1 character. spec fields: name, race, alignment, deity, class,
 * abilities {method, scores}, racialBonus, skills {}, feats [{id,param}], choices {},
 * spells {known|spellbook}, languages [], favoredClass, favoredBonus ('hp'|'skill'),
 * adaptabilitySkill (half-elf), kit (bool), gender, age, description.
 * opts: { pointBuy, rolledArray, allowFree, startingGold }
 */
function createCharacter(spec, opts = {}) {
  const errors = [];
  if (!spec || typeof spec !== 'object') throw err('Character spec required');
  const name = String(spec.name || '').trim();
  if (!/^[A-Za-z][A-Za-z' -]{1,23}$/.test(name)) errors.push('Name must be 2-24 letters (spaces, apostrophes and hyphens allowed)');
  const race = RACES[spec.race];
  if (!race) errors.push(`Unknown race ${spec.race}. Options: ${Object.keys(RACES).join(', ')}`);
  if (!ALIGNMENTS[spec.alignment]) errors.push(`Alignment must be one of ${Object.keys(ALIGNMENTS).join(', ')}`);
  const classId = spec.class;
  if (!BASE_CLASSES[classId]) errors.push(`Starting class must be a base class: ${Object.keys(BASE_CLASSES).join(', ')}`);
  if (errors.length) throw err('Invalid character', 400, errors);
  let abilityBase;
  try {
    abilityBase = validateAbilities(spec, opts);
  } catch (e) {
    throw err('Invalid character', 400, [e.message]);
  }
  if (race.anyBonus && !ABILITIES.includes(spec.racialBonus)) throw err('Invalid character', 400, [`${race.name}s choose one ability for their +2 racial bonus (racialBonus)`]);
  const char = new Character({
    name, race: spec.race, alignment: spec.alignment, deity: spec.deity || null, gender: spec.gender, age: spec.age, description: spec.description,
    abilityBase, racialBonus: race.anyBonus ? spec.racialBonus : null, classes: [], favoredClasses: [], hp: { current: null, temp: 0, nonlethal: 0 },
    accountId: opts.accountId,
  });
  const cdef = CLASSES[classId];
  if (cdef.alignment && !cdef.alignment(char.alignment)) errors.push(`${cdef.name}s must be ${cdef.alignmentText}`);
  if (cdef.requiresDeity && !OPTIONS.DEITIES[spec.deity]) errors.push(`${cdef.name}s must choose a deity (${Object.keys(OPTIONS.DEITIES).join(', ')})`);
  // Favored class(es).
  const favored = spec.favoredClasses || [spec.favoredClass || classId];
  if (favored.length > (race.favoredClasses || 1)) errors.push(`${race.name}s may have ${race.favoredClasses || 1} favored class(es)`);
  for (const f of favored) if (!BASE_CLASSES[f]) errors.push(`Favored class must be a base class (${f})`);
  char.favoredClasses = favored;
  // First level.
  char.classes.push({ id: classId, level: 1 });
  const favoredBonus = favored.includes(classId) ? (spec.favoredBonus === 'skill' ? 'skill' : 'hp') : null;
  char.levelHistory.push({ level: 1, classId, hp: cdef.hitDie, favoredBonus });
  char.touch();
  errors.push(...applyArchetypes(char, classId, spec.archetypes));
  errors.push(...applyClassChoices(char, classId, 1, spec.choices || {}, spec.feats || []));
  // Languages: racial + Int bonus.
  const bonusCount = Math.max(0, char.baseAbilityMod('int'));
  const extraLangs = (spec.languages || []).filter((l) => !race.languages.includes(l));
  const pool = race.bonusLanguages === 'any' ? LANGUAGES.filter((l) => l !== 'Druidic') : race.bonusLanguages;
  if (extraLangs.length > bonusCount) errors.push(`Too many bonus languages (${extraLangs.length}/${bonusCount})`);
  for (const l of extraLangs) if (!pool.includes(l)) errors.push(`${l} is not an available bonus language`);
  char.languages = [...race.languages, ...extraLangs];
  if (classId === 'cleric' || classId === 'wizard') {
    // Clerics may learn Abyssal/Celestial/Infernal; wizards Draconic as bonus languages.
  }
  // Feats.
  const slots = featSlotsAt(char, classId, 1, 1);
  if (spec.race === 'half-elf') {
    if (!SKILLS[spec.adaptabilitySkill]) errors.push('Half-elves choose a Skill Focus skill (adaptabilitySkill)');
    else char.feats.push({ id: 'skill-focus', param: spec.adaptabilitySkill, source: 'race' });
  }
  errors.push(...applyFeats(char, spec.feats, slots, 1));
  // Skills.
  const budget = char.skillPointsPerLevel(classId) + (favoredBonus === 'skill' ? 1 : 0);
  errors.push(...applySkills(char, spec.skills, budget).errors);
  errors.push(...initialSpells(char, classId, spec.spells || {}));
  if (errors.length) throw err('Invalid character', 400, errors);
  // Equipment & money.
  const gold = opts.startingGold ?? STARTING_WEALTH[classId] ?? 100;
  char.money = T.toCopper(gold);
  if (spec.kit !== false && CLASS_KITS[classId]) {
    for (const [itemId, qty] of CLASS_KITS[classId]) {
      try {
        inventory.buy(char, itemId, qty ? { qty } : {});
      } catch (e) {
        // ran out of money: skip remaining kit items
      }
    }
    for (const itemId of KIT_EQUIP[classId] || []) {
      try {
        inventory.equip(char, itemId);
      } catch (e) {
        // ignore
      }
    }
  }
  char.hp = { current: null, temp: 0, nonlethal: 0 };
  char.touch();
  char.hp.current = char.maxHp();
  return char;
}

// ---------------------------------------------------------------- level up
function averageHp(hitDie) {
  return hitDie / 2 + 1;
}

/**
 * Advance a character one level. spec: { class, spellProgression, favoredBonus,
 * skills {}, feats [], abilityIncrease, choices {}, spells { learn: [] , spellbook: [] }, hpMethod: 'average'|'roll' }.
 * Works on a clone and only commits if every rule validates.
 */
function levelUp(char, spec, opts = {}) {
  const errors = [];
  if (!opts.force && !char.canLevelUp()) throw err(`Not enough XP to level up (${char.xp}/${char.xpForNextLevel()})`, 409);
  if (char.hitDice() >= 20) throw err('Already at maximum level (20)', 409);
  const classId = spec.class;
  const cdef = CLASSES[classId];
  if (!cdef) throw err(`Unknown class ${classId}`);
  const clone = new Character(JSON.parse(JSON.stringify(char.toJSON())));
  // Requirements (prestige classes, alignment, max level).
  const req = prerequisites.classRequirements(clone, classId);
  if (!req.ok) throw err(`Cannot take a level of ${cdef.name}`, 400, req.failures);
  // Ex-class restrictions: monks/paladins with a non-lawful/non-LG alignment cannot advance.
  const existing = clone.classes.find((c) => c.id === classId);
  if (existing) existing.level += 1;
  else {
    const entry = { id: classId, level: 1 };
    if (cdef.advancesCasting) {
      const trads = cdef.advancesCasting.traditions;
      if (cdef.advancesCasting.both) {
        const arcane = spec.spellProgression && spec.spellProgression.arcane;
        const divine = spec.spellProgression && spec.spellProgression.divine;
        if (!arcane || !clone.casterClasses().includes(arcane) || CLASSES[arcane].spellcasting.tradition !== 'arcane') errors.push('Choose spellProgression.arcane (an arcane class you have)');
        if (!divine || !clone.casterClasses().includes(divine) || CLASSES[divine].spellcasting.tradition !== 'divine') errors.push('Choose spellProgression.divine (a divine class you have)');
        entry.spellProgression = { arcane, divine };
      } else {
        const candidates = clone.casterClasses().filter((id) => trads.includes(CLASSES[id].spellcasting.tradition) && (!cdef.requirements.spontaneousArcane || CLASSES[id].spellcasting.style === 'spontaneous'));
        const pick = spec.spellProgression || candidates[0];
        if (!candidates.includes(pick)) errors.push(`spellProgression must be one of: ${candidates.join(', ') || '(none)'}`);
        entry.spellProgression = pick;
      }
    }
    clone.classes.push(entry);
    errors.push(...applyArchetypes(clone, classId, spec.archetypes));
  }
  const classLevel = clone.classLevel(classId);
  const charLevel = clone.hitDice();
  // Hit points.
  const hpMethod = spec.hpMethod || opts.hpMethod || 'average';
  const hp = hpMethod === 'roll' ? dice.total(`1d${cdef.hitDie}`, opts.rng || defaultRng) : Math.ceil(averageHp(cdef.hitDie));
  const favored = clone.favoredClasses.includes(classId);
  const favoredBonus = favored ? (spec.favoredBonus === 'skill' ? 'skill' : 'hp') : null;
  clone.levelHistory.push({ level: charLevel, classId, hp, favoredBonus });
  // Ability increase every 4 levels.
  if (charLevel % 4 === 0) {
    if (!ABILITIES.includes(spec.abilityIncrease)) errors.push('Choose an ability score to increase (abilityIncrease)');
    else clone.abilityIncreases.push(spec.abilityIncrease);
  }
  clone.touch();
  errors.push(...applyClassChoices(clone, classId, classLevel, spec.choices || {}, spec.feats || []));
  // Feats (options such as Combat Trick or a Feat talent add a slot).
  const slots = featSlotsAt(clone, classId, classLevel, charLevel);
  slots.push(...optionFeatSlots(spec.choices || {}));
  errors.push(...applyFeats(clone, spec.feats, slots, classLevel));
  // Skills.
  const budget = clone.skillPointsPerLevel(classId) + (favoredBonus === 'skill' ? 1 : 0);
  errors.push(...applySkills(clone, spec.skills, budget).errors);
  // Spells.
  const casterIds = clone.casterClasses();
  for (const cid of casterIds) {
    const d = CLASSES[cid].spellcasting;
    const entry = clone.classes.find((c) => c.id === classId);
    const progressionTargets = entry.spellProgression ? (typeof entry.spellProgression === 'object' ? Object.values(entry.spellProgression) : [entry.spellProgression]) : [];
    const advanced = cid === classId || (cdef.advancesCasting && progressionTargets.includes(cid) && cdef.advancesCasting.levels.includes(classLevel));
    const learns = spec.spells && Array.isArray(spec.spells[cid]) ? spec.spells[cid] : spec.spells && Array.isArray(spec.spells.learn) ? spec.spells.learn : [];
    if (!advanced) continue;
    if (d.spellbook) {
      if (learns.length > 2) errors.push(`${CLASSES[cid].name}: add at most 2 spells to the spellbook per level`);
      for (const id of learns) {
        try {
          spellcasting.learnSpell(clone, cid, id);
        } catch (e) {
          errors.push(e.message);
        }
      }
    } else if (d.style === 'spontaneous') {
      for (const id of learns) {
        try {
          spellcasting.learnSpell(clone, cid, id);
        } catch (e) {
          errors.push(e.message);
        }
      }
      const limit = spellcasting.knownLimit(clone, cid);
      const st = spellcasting.state(clone, cid);
      for (let l = 0; l < limit.length; l++) {
        // Only demand as many as the spell list can supply.
        const missing = Math.min(limit[l] - (st.known[l] || []).length, spellList(d.list, l).filter((sp) => !(st.known[l] || []).includes(sp.id)).length);
        if (missing > 0) errors.push(`${CLASSES[cid].name}: choose ${missing} more level ${l} spells known`);
      }
    }
  }
  if (errors.length) throw err('Level up failed validation', 400, errors);
  // Commit: copy clone state back into the live character, keeping current damage.
  const damageTaken = char.maxHp() - char.hp.current;
  const data = clone.toJSON();
  for (const k of ['classes', 'levelHistory', 'abilityIncreases', 'feats', 'skillRanks', 'choices', 'spellcasting']) {
    if (k === 'skillRanks') char.skillRanksMap = data.skillRanks;
    else char[k] = data[k];
  }
  char.touch();
  char.hp.current = char.maxHp() - damageTaken;
  return { level: char.hitDice(), class: classId, classLevel, hpGained: hp + (favoredBonus === 'hp' ? 1 : 0), featuresGained: char.classDef(classId).features[classLevel] || [] };
}

/** What a level up in `classId` would require the player to choose. */
function levelUpPreview(char, classId) {
  const cdef = CLASSES[classId];
  if (!cdef) throw err(`Unknown class ${classId}`);
  const req = prerequisites.classRequirements(char, classId);
  const classLevel = char.classLevel(classId) + 1;
  const charLevel = char.hitDice() + 1;
  const slots = featSlotsAt(char, classId, classLevel, charLevel);
  return {
    class: classId, eligible: req.ok, failures: req.failures, newClassLevel: classLevel, newCharacterLevel: charLevel,
    features: (char.classDef(classId).features[classLevel] || []).map((k) => ({ key: k, ...(require('../data/features').FEATURES[k] ? { name: require('../data/features').FEATURES[k].name, description: require('../data/features').FEATURES[k].description } : {}) })),
    featSlots: slots, abilityIncrease: charLevel % 4 === 0, skillRanks: char.skillPointsPerLevel(classId),
    hitDie: cdef.hitDie, averageHp: Math.ceil(averageHp(cdef.hitDie)), favoredClass: char.favoredClasses.includes(classId),
    needsSpellProgression: !!cdef.advancesCasting && !char.classLevel(classId),
  };
}

/** Classes this character could advance in right now. */
function eligibleClasses(char) {
  return Object.keys(CLASSES).map((id) => ({ id, name: CLASSES[id].name, type: CLASSES[id].type, ...prerequisites.classRequirements(char, id) }));
}

/**
 * Build a valid level-up spec automatically (NPC generation, "quick level" clients, tests).
 * prefs: { feats: [ids in priority order], skills: [ids], abilityIncrease, choices: {}, spellProgression, spells: [] }
 */
function autoLevelSpec(char, classId, prefs = {}) {
  const cdef = CLASSES[classId];
  const preview = levelUpPreview(char, classId);
  const spec = { class: classId, choices: { ...(prefs.choices || {}) }, feats: [], skills: {}, spells: {}, favoredBonus: prefs.favoredBonus || 'hp' };
  if (preview.abilityIncrease) spec.abilityIncrease = prefs.abilityIncrease || (cdef.spellcasting ? cdef.spellcasting.ability : 'str');
  if (preview.needsSpellProgression) spec.spellProgression = prefs.spellProgression;
  // Class choices: first legal option for each feature gained.
  const clone = () => new Character(JSON.parse(JSON.stringify(char.toJSON())));
  // Generic option groups: first legal options in table order.
  const probeLevel = clone();
  const pe = probeLevel.classes.find((x) => x.id === classId);
  if (pe) pe.level += 1;
  else probeLevel.classes.push({ id: classId, level: 1, archetypes: asList(prefs.archetypes) });
  probeLevel.touch();
  if (!pe && prefs.archetypes) spec.archetypes = asList(prefs.archetypes);
  for (const [groupKey, n] of Object.entries(picksNeeded(probeLevel, classId, preview.newClassLevel))) {
    if (spec.choices[groupKey]) continue;
    const picks = [];
    for (const [id, o] of Object.entries(OPTIONS.OPTION_GROUPS[groupKey].table)) {
      if (picks.length >= n) break;
      if (o.bonusFeat || o.autoSkip) continue;
      if (!optionAllowed(char, groupKey, id, preview.newClassLevel, classId)) picks.push(id);
    }
    spec.choices[groupKey] = n === 1 ? picks[0] : picks;
  }
  for (const f of preview.features) {
    const lvl = preview.newClassLevel;
    if (f.key === 'weapon-training' && !spec.choices['weapon-training']) spec.choices['weapon-training'] = OPTIONS.WEAPON_GROUPS.find((g) => !(char.choices['weapon-training'] || []).includes(g));
    if (f.key === 'favored-enemy' && !spec.choices['favored-enemy']) spec.choices['favored-enemy'] = OPTIONS.FAVORED_ENEMY_TYPES.find((t) => !(char.choices['favored-enemy'] || []).some((x) => x.type === t));
    if (f.key === 'favored-terrain' && !spec.choices['favored-terrain']) spec.choices['favored-terrain'] = OPTIONS.TERRAINS.find((t) => !(char.choices['favored-terrain'] || []).some((x) => x.terrain === t));
    if (f.key === 'combat-style') {
      spec.choices['combat-style'] = spec.choices['combat-style'] || char.choices['combat-style-name'] || 'archery';
      const style = OPTIONS.COMBAT_STYLES[spec.choices['combat-style']];
      const allowed = Object.entries(style.feats).filter(([l]) => lvl >= Number(l)).flatMap(([, ids]) => ids);
      spec.choices['combat-style-feat'] = spec.choices['combat-style-feat'] || allowed.find((id) => !char.hasFeat(id));
    }
    if (f.key === 'blood-of-dragons' && !char.choices.dragonType) spec.choices.dragonType = spec.choices.dragonType || 'red';
  }
  // Feats: preferred list first, then anything legal for each slot.
  const probe = clone();
  for (const slot of preview.featSlots) {
    const candidates = [...(prefs.feats || []), ...Object.keys(FEATS)];
    const pick = candidates.find((id) => {
      const f = FEATS[id];
      if (!f || f.param || f.grantsChoice || spec.feats.some((x) => x.id === id)) return false;
      if (!allowedForSlot(id, slot, probe, preview.newClassLevel)) return false;
      return prerequisites.featPrereqs(probe, id).ok || (slot.kind === 'monk' && !probe.hasFeat(id));
    });
    if (pick) {
      spec.feats.push({ id: pick });
      probe.feats.push({ id: pick });
      probe.touch();
    }
  }
  // Skills: spend every rank on preferred skills, then class skills.
  const budget = char.skillPointsPerLevel(classId) + (spec.favoredBonus === 'skill' && preview.favoredClass ? 1 : 0);
  const order = [...new Set([...(prefs.skills || []), ...cdef.classSkills, ...Object.keys(SKILLS)])];
  let left = budget;
  for (const sk of order) {
    if (left <= 0) break;
    if (char.skillRanks(sk) + (spec.skills[sk] || 0) < preview.newCharacterLevel) {
      spec.skills[sk] = (spec.skills[sk] || 0) + 1;
      left--;
    }
  }
  // Spells for spontaneous casters / spellbooks that advance this level.
  if (prefs.spells) spec.spells.learn = prefs.spells;
  else {
    const c2 = clone();
    const existing = c2.classes.find((x) => x.id === classId);
    if (existing) existing.level += 1;
    else c2.classes.push({ id: classId, level: 1, spellProgression: spec.spellProgression });
    c2.touch();
    for (const cid of c2.casterClasses()) {
      const d = CLASSES[cid].spellcasting;
      const prog = c2.classes.find((x) => x.id === classId).spellProgression;
      const targets = prog ? (typeof prog === 'object' ? Object.values(prog) : [prog]) : [];
      const advanced = cid === classId || (cdef.advancesCasting && targets.includes(cid) && cdef.advancesCasting.levels.includes(preview.newClassLevel));
      if (!advanced) continue;
      const max = spellcasting.maxSpellLevel(c2, cid);
      const st = spellcasting.state(c2, cid);
      const picks = [];
      if (d.spellbook) {
        for (let l = max; l >= 1 && picks.length < 2; l--) for (const sp of spellList(d.list, l)) if (picks.length < 2 && !st.spellbook.includes(sp.id) && !spellcasting.isOpposition(c2, cid, sp)) picks.push(sp.id);
      } else if (d.style === 'spontaneous') {
        const limit = spellcasting.knownLimit(c2, cid);
        for (let l = 0; l < limit.length; l++) {
          const need = limit[l] - (st.known[l] || []).length;
          const pool = spellList(d.list, l).filter((sp) => !(st.known[l] || []).includes(sp.id));
          for (let i = 0; i < need && i < pool.length; i++) picks.push(pool[i].id);
        }
      }
      spec.spells[cid] = picks;
    }
  }
  return spec;
}

module.exports = { createCharacter, levelUp, autoLevelSpec, levelUpPreview, eligibleClasses, rollAbilityArray, pointBuyCost, featSlotsAt, optionAllowed, picksNeeded, CLASS_KITS };
