'use strict';

const express = require('express');
const { RACES } = require('../data/races');
const { CLASSES } = require('../data/classes');
const { FEATURES } = require('../data/features');
const { FEATS } = require('../data/feats');
const { SPELLS, SUMMON_TABLES } = require('../data/spells');
const { BESTIARY } = require('../data/bestiary');
const { ITEMS, WEAPON_SPECIALS, ARMOR_SPECIALS, STARTING_WEALTH, itemPrice } = require('../data/equipment');
const { SKILLS, SIZES, ALIGNMENTS, CREATURE_TYPES, LANGUAGES } = require('../data/core');
const { CONDITIONS } = require('../data/conditions');
const OPTIONS = require('../data/classOptions');
const T = require('../engine/tables');
const { Monster } = require('../engine/monster');

/** Strip functions so data serializes cleanly. */
function plain(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => (typeof v === 'function' ? undefined : v === Infinity ? 'Infinity' : v)));
}

function notFound(res, what) {
  return res.status(404).json({ error: `${what} not found` });
}

function classView(id, c) {
  const levels = {};
  for (let l = 1; l <= c.maxLevel; l++) {
    levels[l] = {
      features: (c.features[l] || []).map((k) => ({ key: k, name: FEATURES[k] ? FEATURES[k].name : k, description: FEATURES[k] ? FEATURES[k].description : '' })),
      bab: T.BAB[c.bab](l),
      saves: Object.fromEntries(Object.entries(c.saves).map(([s, q]) => [s, T.SAVES[c.saveFormula][q](l)])),
      spellsPerDay: c.spellcasting ? (c.spellcasting.perDay[l] || []).map((n) => (n === Infinity ? 'at will' : n)) : undefined,
      spellsKnown: c.spellcasting && c.spellcasting.known ? c.spellcasting.known[l] : undefined,
      advancesCasting: c.advancesCasting ? c.advancesCasting.levels.includes(l) : undefined,
    };
  }
  return {
    id, name: c.name, type: c.type, hitDie: c.hitDie, skillRanks: c.skillRanks, bab: c.bab, goodSaves: Object.keys(c.saves).filter((s) => c.saves[s] === 'good'),
    classSkills: c.classSkills, proficiencies: c.proficiencies, alignment: c.alignmentText || 'Any', requirements: c.requirements ? plain({ ...c.requirements, alignment: c.requirements.alignmentText }) : undefined,
    spellcasting: c.spellcasting ? { tradition: c.spellcasting.tradition, style: c.spellcasting.style, ability: c.spellcasting.ability, list: c.spellcasting.list } : undefined,
    advancesCasting: c.advancesCasting, bonusFeats: c.bonusFeats, maxLevel: c.maxLevel, startingWealthGp: STARTING_WEALTH[id], source: c.source, levels,
  };
}

function compendiumRouter() {
  const r = express.Router();

  r.get('/', (req, res) => res.json({
    sections: ['races', 'classes', 'feats', 'spells', 'monsters', 'items', 'skills', 'conditions', 'sizes', 'alignments', 'creature-types', 'languages', 'deities', 'domains', 'schools', 'bloodlines', 'rage-powers', 'rogue-talents', 'magus-arcana', 'mercies', 'combat-styles', 'weapon-specials', 'armor-specials', 'tables'],
    counts: { races: Object.keys(RACES).length, classes: Object.keys(CLASSES).length, feats: Object.keys(FEATS).length, spells: Object.keys(SPELLS).length, monsters: Object.keys(BESTIARY).length, items: Object.keys(ITEMS).length },
  }));

  r.get('/races', (req, res) => res.json(Object.entries(RACES).map(([id, x]) => ({ id, ...plain(x) }))));
  r.get('/races/:id', (req, res) => (RACES[req.params.id] ? res.json({ id: req.params.id, ...plain(RACES[req.params.id]) }) : notFound(res, 'Race')));

  r.get('/classes', (req, res) => res.json(Object.entries(CLASSES).map(([id, c]) => ({ id, name: c.name, type: c.type, hitDie: c.hitDie, bab: c.bab, skillRanks: c.skillRanks, spellcasting: !!c.spellcasting || !!c.advancesCasting, alignment: c.alignmentText || 'Any' }))));
  r.get('/classes/:id', (req, res) => (CLASSES[req.params.id] ? res.json(classView(req.params.id, CLASSES[req.params.id])) : notFound(res, 'Class')));

  r.get('/feats', (req, res) => {
    let list = Object.values(FEATS);
    if (req.query.type) list = list.filter((f) => f.types.includes(req.query.type));
    if (req.query.q) list = list.filter((f) => f.name.toLowerCase().includes(String(req.query.q).toLowerCase()));
    res.json(list.map((f) => plain({ id: f.id, name: f.name, types: f.types, prerequisites: f.prereq, benefit: f.benefit, param: f.param, multiple: f.multiple, metamagic: f.metamagic })));
  });
  r.get('/feats/:id', (req, res) => {
    const f = FEATS[req.params.id];
    return f ? res.json(plain({ ...f, prerequisites: f.prereq })) : notFound(res, 'Feat');
  });

  r.get('/spells', (req, res) => {
    let list = Object.values(SPELLS);
    const { list: cls, level, school, q, descriptor } = req.query;
    if (cls) list = list.filter((s) => s.levels[cls === 'sorcerer' ? 'wizard' : cls] !== undefined);
    if (level !== undefined && cls) list = list.filter((s) => s.levels[cls === 'sorcerer' ? 'wizard' : cls] === Number(level));
    else if (level !== undefined) list = list.filter((s) => Object.values(s.levels).includes(Number(level)));
    if (school) list = list.filter((s) => s.school === school);
    if (descriptor) list = list.filter((s) => (s.descriptors || []).includes(descriptor));
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(String(q).toLowerCase()));
    res.json(list.map((s) => ({ id: s.id, name: s.name, school: s.school, levels: s.levels, range: s.range, save: s.save, sr: s.sr, description: s.description, effect: s.effect.kind })));
  });
  r.get('/spells/:id', (req, res) => (SPELLS[req.params.id] ? res.json(plain(SPELLS[req.params.id])) : notFound(res, 'Spell')));
  r.get('/summon-tables', (req, res) => res.json(SUMMON_TABLES));

  r.get('/monsters', (req, res) => {
    let list = Object.values(BESTIARY);
    if (req.query.type) list = list.filter((m) => m.type === req.query.type);
    if (req.query.cr) list = list.filter((m) => String(m.cr) === String(req.query.cr));
    if (req.query.q) list = list.filter((m) => m.name.toLowerCase().includes(String(req.query.q).toLowerCase()));
    res.json(list.map((m) => ({ id: m.id, name: m.name, cr: m.cr, xp: T.xpForCr(m.cr), type: m.type, subtypes: m.subtypes, size: m.size, alignment: m.alignment })));
  });
  r.get('/monsters/:id', (req, res) => {
    if (!BESTIARY[req.params.id]) return notFound(res, 'Monster');
    return res.json(plain(new Monster({ templateId: req.params.id }).statBlock()));
  });

  r.get('/items', (req, res) => {
    let list = Object.values(ITEMS);
    if (req.query.kind) list = list.filter((i) => i.kind === req.query.kind);
    if (req.query.q) list = list.filter((i) => i.name.toLowerCase().includes(String(req.query.q).toLowerCase()));
    res.json(list.map((i) => plain({ ...i, price: itemPrice(i) })));
  });
  r.get('/items/:id', (req, res) => (ITEMS[req.params.id] ? res.json(plain(ITEMS[req.params.id])) : notFound(res, 'Item')));
  r.get('/weapon-specials', (req, res) => res.json(WEAPON_SPECIALS));
  r.get('/armor-specials', (req, res) => res.json(ARMOR_SPECIALS));

  r.get('/skills', (req, res) => res.json(Object.entries(SKILLS).map(([id, s]) => ({ id, ...s }))));
  r.get('/conditions', (req, res) => res.json(Object.entries(CONDITIONS).map(([id, c]) => ({ id, name: c.name, description: c.description, flags: c.flags }))));
  r.get('/sizes', (req, res) => res.json(SIZES));
  r.get('/alignments', (req, res) => res.json(ALIGNMENTS));
  r.get('/creature-types', (req, res) => res.json(CREATURE_TYPES));
  r.get('/languages', (req, res) => res.json(LANGUAGES));
  r.get('/deities', (req, res) => res.json(OPTIONS.DEITIES));
  r.get('/domains', (req, res) => res.json(plain(OPTIONS.DOMAINS)));
  r.get('/schools', (req, res) => res.json(plain(OPTIONS.ARCANE_SCHOOLS)));
  r.get('/bloodlines', (req, res) => res.json(plain(OPTIONS.BLOODLINES)));
  r.get('/dragon-types', (req, res) => res.json(OPTIONS.DRAGON_TYPES));
  r.get('/rage-powers', (req, res) => res.json(plain(OPTIONS.RAGE_POWERS)));
  r.get('/rogue-talents', (req, res) => res.json(plain(OPTIONS.ROGUE_TALENTS)));
  r.get('/magus-arcana', (req, res) => res.json(plain(OPTIONS.MAGUS_ARCANA)));
  r.get('/mercies', (req, res) => res.json(plain(OPTIONS.MERCIES)));
  r.get('/combat-styles', (req, res) => res.json(plain(OPTIONS.COMBAT_STYLES)));
  r.get('/favored-enemies', (req, res) => res.json(OPTIONS.FAVORED_ENEMY_TYPES));
  r.get('/terrains', (req, res) => res.json(OPTIONS.TERRAINS));
  r.get('/weapon-groups', (req, res) => res.json(OPTIONS.WEAPON_GROUPS));
  r.get('/tables', (req, res) => res.json({
    xp: T.XP_TRACKS, crXp: T.CR_XP, pointBuy: T.POINT_BUY_COST, pointBuyBudgets: T.POINT_BUY_BUDGETS, wealthByLevel: T.WEALTH_BY_LEVEL, treasureByCr: T.TREASURE_BY_CR,
    carryingCapacity: Array.from({ length: 30 }, (_, i) => ({ str: i, ...T.carryingCapacity(i) })),
  }));
  return r;
}

module.exports = { compendiumRouter, plain };
