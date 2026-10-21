'use strict';

const { Creature } = require('./creature');
const { mod } = require('./modifiers');
const T = require('./tables');
const { SKILLS, SIZES } = require('../data/core');
const { RACES } = require('../data/races');
const { CLASSES, effectiveClass } = require('../data/classes');
const { FEATURES } = require('../data/features');
const { FEATS } = require('../data/feats');
const OPTIONS = require('../data/classOptions');
const { ITEMS, WEAPON_SPECIALS, ARMOR_SPECIALS, weaponDamageForSize } = require('../data/equipment');

// Map a class "choices" key to the option table it draws from.
const OPTION_TABLES = Object.fromEntries(Object.entries(OPTIONS.OPTION_GROUPS).map(([k, g]) => [k, g.table]));

const MONK_UNARMED = {
  medium: ['1d6', '1d6', '1d6', '1d8', '1d8', '1d8', '1d8', '1d10', '1d10', '1d10', '1d10', '2d6', '2d6', '2d6', '2d6', '2d8', '2d8', '2d8', '2d8', '2d10'],
  small: ['1d4', '1d4', '1d4', '1d6', '1d6', '1d6', '1d6', '1d8', '1d8', '1d8', '1d8', '1d10', '1d10', '1d10', '1d10', '2d6', '2d6', '2d6', '2d6', '2d8'],
  large: ['1d8', '1d8', '1d8', '2d6', '2d6', '2d6', '2d6', '2d8', '2d8', '2d8', '2d8', '3d6', '3d6', '3d6', '3d6', '3d8', '3d8', '3d8', '3d8', '4d8'],
};

/**
 * A player character built from race + class levels + feats + gear.
 * All numbers are derived live; only choices and state are stored.
 */
class Character extends Creature {
  constructor(data = {}) {
    super(data);
    this.kind = 'character';
    this.accountId = data.accountId || null;
    this.race = data.race || 'human';
    this.deity = data.deity || null;
    this.gender = data.gender || null;
    this.age = data.age || null;
    this.description = data.description || '';
    this.abilityBase = data.abilityBase || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    this.racialBonus = data.racialBonus || null;
    this.abilityIncreases = data.abilityIncreases || [];
    this.inherent = data.inherent || {};
    this.classes = data.classes || [];
    this.levelHistory = data.levelHistory || [];
    this.favoredClasses = data.favoredClasses || [];
    this.feats = data.feats || [];
    this.skillRanksMap = data.skillRanks || {};
    this.choices = data.choices || {};
    this.languages = data.languages || [];
    this.xp = data.xp || 0;
    this.xpTrack = data.xpTrack || 'medium';
    this.spellcasting = data.spellcasting || {};
    this.inventory = data.inventory || [];
    this.money = data.money ?? 0;
    this.location = data.location || null;
    this.createdAt = data.createdAt || Date.now();
    this.stats = data.stats || { kills: 0, deaths: 0 };
    this.pendingLevelUps = data.pendingLevelUps || 0;
    this.companion = data.companion || null;
    if (this.hp.current === null || this.hp.current === undefined) this.hp.current = this.maxHp();
  }

  // ------------------------------------------------------------ identity
  raceDef() { return RACES[this.race]; }
  baseSize() { return this.raceDef().size; }
  creatureType() { return this.raceDef().type; }
  subtypes() { return this.raceDef().subtypes; }

  hitDice() { return this.classes.reduce((s, c) => s + c.level, 0) || 1; }
  get characterLevel() { return this.hitDice(); }

  classLevel(id) {
    const c = this.classes.find((x) => x.id === id);
    return c ? c.level : 0;
  }

  /** Class definition for one of this character's classes, with its archetypes applied. */
  classDef(idOrEntry) {
    const entry = typeof idOrEntry === 'string' ? this.classes.find((x) => x.id === idOrEntry) || { id: idOrEntry } : idOrEntry;
    return effectiveClass(entry.id, entry.archetypes);
  }

  archetypes(classId) {
    const c = this.classes.find((x) => x.id === classId);
    return (c && c.archetypes) || [];
  }

  hasArchetype(id) {
    return this.classes.some((c) => (c.archetypes || []).includes(id));
  }

  hasOption(group, id) {
    const v = this.choices[group];
    return Array.isArray(v) ? v.includes(id) : v === id;
  }

  /**
   * Sum a named progression across every class the character has, plus
   * progressions granted by chosen options (e.g. a druid's nature bond makes
   * druid levels count for domain powers or the animal companion).
   */
  prog(name) {
    let total = 0;
    for (const c of this.classes) {
      const def = this.classDef(c);
      const fn = def.progressions && def.progressions[name];
      if (fn) total += fn(c.level);
    }
    this._progStack = this._progStack || new Set();
    if (this._progStack.has(name)) return total;
    this._progStack.add(name);
    try {
      for (const [key, group] of Object.entries(OPTIONS.OPTION_GROUPS)) {
        const v = this.choices[key];
        if (!v || (Array.isArray(v) && !v.length)) continue;
        if (group.progressions && group.progressions[name]) total += group.progressions[name](this);
        for (const id of Array.isArray(v) ? v : [v]) {
          const opt = group.table[id];
          if (opt && opt.progressions && opt.progressions[name]) total += opt.progressions[name](this);
        }
      }
    } finally {
      this._progStack.delete(name);
    }
    return total;
  }

  hasFeat(id, param) {
    return this.allFeats().some((f) => f.id === id && (param === undefined || f.param === param));
  }

  featCount(id) {
    return this.allFeats().filter((f) => f.id === id).length;
  }

  featParams(id) {
    return this.allFeats().filter((f) => f.id === id).map((f) => f.param);
  }

  /** Chosen feats plus feats granted by class features and options. */
  allFeats() {
    if (this._cache && this._cache.feats) return this._cache.feats;
    const out = [...this.feats];
    const add = (id, source) => {
      if (!out.some((f) => f.id === id && !f.param)) out.push({ id, source });
    };
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.grantsFeats) def.grantsFeats.forEach((id) => add(id, `class:${f.key}`));
    }
    for (const opt of this.selectedOptions()) {
      if (opt.def.grantsFeats) opt.def.grantsFeats.forEach((id) => add(id, `option:${opt.id}`));
      if (opt.def.grantsFeatsAt) {
        const g = OPTIONS.OPTION_GROUPS[opt.group];
        const lvl = g && g.levelProg ? this.prog(g.levelProg) : this.hitDice();
        for (const [at, ids] of Object.entries(opt.def.grantsFeatsAt)) if (lvl >= Number(at)) ids.forEach((id) => add(id, `option:${opt.id}`));
      }
    }
    this._cache = this._cache || {};
    this._cache.feats = out;
    return out;
  }

  /** Class features as [{ key, classId, level }], deduplicated by key. */
  features() {
    if (this._cache && this._cache.features) return this._cache.features;
    const seen = new Map();
    for (const c of this.classes) {
      const def = this.classDef(c);
      for (let l = 1; l <= c.level; l++) {
        for (const key of def.features[l] || []) {
          if (!seen.has(key)) seen.set(key, { key, classId: c.id, level: l });
        }
      }
    }
    const out = [...seen.values()];
    this._cache = this._cache || {};
    this._cache.features = out;
    return out;
  }

  hasFeature(key) {
    return this.features().some((f) => f.key === key);
  }

  /** Every selected class option (rage powers, talents, domains...) with its definition. */
  selectedOptions() {
    if (this._cache && this._cache.options) return this._cache.options;
    const out = [];
    for (const [key, group] of Object.entries(OPTIONS.OPTION_GROUPS)) {
      const v = this.choices[key];
      const ids = Array.isArray(v) ? v : v ? [v] : [];
      for (const id of ids) if (group.table[id]) out.push({ group: key, id, def: group.table[id] });
    }
    this._cache = this._cache || {};
    this._cache.options = out;
    return out;
  }

  bloodline() {
    return this.choices.bloodline ? OPTIONS.BLOODLINES[this.choices.bloodline] : null;
  }

  /** Bloodline powers in effect: the sorcerer bloodline and the bloodrager bloodline, merged. */
  bloodlinePowers() {
    const parts = [];
    const bl = this.bloodline();
    const ddLevel = this.classLevel('dragon-disciple');
    if (bl && bl.powers && (this.classLevel('sorcerer') > 0 || ddLevel > 0)) parts.push(bl.powers(this));
    else if (!bl && ddLevel > 0) parts.push(OPTIONS.BLOODLINES.draconic.powers(this));
    const rb = OPTIONS.OPTION_GROUPS['bloodrager-bloodline'].table[this.choices['bloodrager-bloodline']];
    if (rb && this.classLevel('bloodrager') > 0) parts.push(rb.powers(this));
    if (parts.length < 2) return parts[0] || null;
    const out = { flags: [], modifiers: [], resistances: {}, naturalAttacks: [], abilities: [], sr: 0 };
    for (const p of parts) {
      out.flags.push(...(p.flags || []));
      out.modifiers.push(...(p.modifiers || []));
      out.naturalAttacks.push(...(p.naturalAttacks || []));
      out.abilities.push(...(p.abilities || []));
      for (const [k, v] of Object.entries(p.resistances || {})) out.resistances[k] = Math.max(out.resistances[k] || 0, v);
      out.sr = Math.max(out.sr, p.sr || 0);
    }
    return out;
  }

  dragonEnergy() {
    const t = OPTIONS.DRAGON_TYPES[this.choices.dragonType || 'red'];
    return t ? t.energy : 'fire';
  }

  // ------------------------------------------------------------ abilities
  baseAbilityScores() {
    const r = this.raceDef();
    const out = {};
    for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      let s = this.abilityBase[a] + (r.abilityMods[a] || 0) + (this.inherent[a] || 0);
      if (r.anyBonus && this.racialBonus === a) s += 2;
      s += this.abilityIncreases.filter((x) => x === a).length;
      out[a] = s;
    }
    return out;
  }

  // ------------------------------------------------------------ sources
  sourceModifiers() {
    const out = [];
    const r = this.raceDef();
    out.push(...r.modifiers(r.name));
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.modifiers) out.push(...def.modifiers(this));
    }
    for (const opt of this.selectedOptions()) if (opt.def.modifiers) out.push(...opt.def.modifiers(this));
    const bp = this.bloodlinePowers();
    if (bp && bp.modifiers) out.push(...bp.modifiers);
    for (const f of this.allFeats()) {
      const def = FEATS[f.id];
      if (def && def.modifiers) out.push(...def.modifiers(this, f.param));
    }
    out.push(...this.itemModifiers());
    // Combat toggles that are always-on while set.
    if (this.toggles.combatExpertise && this.hasFeat('combat-expertise')) {
      const step = 1 + Math.floor(this.bab() / 4);
      out.push(mod('attack', -step, 'untyped', 'Combat Expertise'), mod('ac', step, 'dodge', 'Combat Expertise'));
    }
    if (this.toggles.fightingDefensively) {
      const acro = this.skillRanks('acrobatics') >= 3;
      out.push(mod('attack', -4, 'untyped', 'Fighting defensively'), mod('ac', acro ? 3 : 2, 'dodge', 'Fighting defensively'));
    }
    return out;
  }

  sourceFlags() {
    const out = [...(this.raceDef().flags || [])];
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.flags) out.push(...def.flags(this));
    }
    for (const opt of this.selectedOptions()) if (opt.def.flags) out.push(...opt.def.flags(this));
    const bp = this.bloodlinePowers();
    if (bp && bp.flags) out.push(...bp.flags);
    if (this.toggles.fightingDefensively) out.push('fightingDefensively');
    return out;
  }

  sourceResources() {
    const out = {};
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.resources) Object.assign(out, def.resources(this));
    }
    for (const opt of this.selectedOptions()) if (opt.def.resources) Object.assign(out, opt.def.resources(this));
    if (this.hasFeat('stunning-fist')) {
      const monk = this.classLevel('monk');
      out.stunningFist = { max: monk ? monk + Math.floor((this.hitDice() - monk) / 4) : Math.floor(this.hitDice() / 4), per: 'day' };
    }
    if (this.hasFeat('extra-arcane-pool') && out.arcanePool) out.arcanePool.max += 2 * this.featCount('extra-arcane-pool');
    for (const sla of this.raceDef().spellLikeAbilities || []) {
      if (sla.minCha && this.ability('cha') < sla.minCha) continue;
      out[`sla:${sla.spell}`] = { max: sla.perDay, per: 'day' };
    }
    // Powers usable a number of times per day (domain, school, bloodline, hexes...).
    const { ABILITIES } = require('./classAbilities');
    for (const a of this.activatedAbilities()) {
      const ab = ABILITIES[a];
      if (ab && ab.perDay && !out[`power:${a}`]) out[`power:${a}`] = { max: ab.perDay(this), per: 'day' };
    }
    return out;
  }

  /** Ids of every activated ability available (see classAbilities.js). */
  activatedAbilities() {
    const set = new Set();
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.abilities) def.abilities.forEach((a) => set.add(a));
    }
    for (const opt of this.selectedOptions()) if (opt.def.abilities) opt.def.abilities.forEach((a) => set.add(a));
    const bp = this.bloodlinePowers();
    if (bp && bp.abilities) bp.abilities.forEach((a) => set.add(a));
    if (this.hasFeat('stunning-fist')) set.add('stunning-fist');
    if (this.hasFeat('arcane-strike')) set.add('arcane-strike');
    for (const sla of this.raceDef().spellLikeAbilities || []) set.add(`sla:${sla.spell}`);
    return [...set];
  }

  sourceDr() {
    const out = [];
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.dr) out.push(...def.dr(this));
    }
    for (const opt of this.selectedOptions()) if (opt.def.dr) out.push(...opt.def.dr(this));
    return out;
  }

  sourceResistances() {
    const out = { ...(this.raceDef().resistances || {}) };
    const merge = (r) => {
      for (const [k, v] of Object.entries(r || {})) out[k] = Math.max(out[k] || 0, v);
    };
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.resistances) merge(def.resistances(this));
    }
    for (const opt of this.selectedOptions()) if (opt.def.resistances) merge(opt.def.resistances(this));
    const bp = this.bloodlinePowers();
    if (bp) merge(bp.resistances);
    for (const it of this.equipped()) {
      const def = ITEMS[it.itemId];
      for (const sp of it.special || []) if (ARMOR_SPECIALS[sp] && ARMOR_SPECIALS[sp].resist && def) merge(ARMOR_SPECIALS[sp].resist);
    }
    return out;
  }

  sourceImmunities() {
    const out = [...(this.raceDef().immunities || [])];
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.immunities) out.push(...def.immunities);
    }
    return out;
  }

  sourceSr() {
    let sr = 0;
    const r = this.raceDef();
    if (r.srBase) sr = r.srBase + this.hitDice();
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.sr) sr = Math.max(sr, def.sr(this));
    }
    for (const it of this.equipped()) for (const sp of it.special || []) if (ARMOR_SPECIALS[sp] && ARMOR_SPECIALS[sp].sr) sr = Math.max(sr, ARMOR_SPECIALS[sp].sr);
    const bp = this.bloodlinePowers();
    if (bp && bp.sr) sr = Math.max(sr, bp.sr);
    for (const opt of this.selectedOptions()) if (opt.def.sr) sr = Math.max(sr, opt.def.sr(this));
    return sr;
  }

  fortification() {
    let best = 0;
    for (const it of this.equipped()) for (const sp of it.special || []) if (ARMOR_SPECIALS[sp] && ARMOR_SPECIALS[sp].fortification) best = Math.max(best, ARMOR_SPECIALS[sp].fortification);
    return Math.max(best, this.flagValue('fortification') || 0);
  }

  /** Start-of-turn fast healing from class features and options (judgment of healing, grand discoveries). */
  naturalHealing() {
    const fh = this.flagValue('fastHealing');
    if (!fh || !this.isAlive() || this.hp.current >= this.maxHp()) return [];
    return [{ type: 'fast-healing', healed: this.heal(fh) }];
  }

  // ------------------------------------------------------------ class math
  bab() {
    if (this.hasFlag('babEqualsLevel')) return this.hitDice();
    return this.classes.reduce((s, c) => s + T.BAB[this.classDef(c).bab](c.level), 0);
  }

  baseSave(type) {
    return this.classes.reduce((s, c) => {
      const def = this.classDef(c);
      return s + T.SAVES[def.saveFormula][def.saves[type]](c.level);
    }, 0);
  }

  cmbBase() {
    if (this.hasFeature('maneuver-training')) {
      const monk = this.classLevel('monk');
      return monk + this.classes.filter((c) => c.id !== 'monk').reduce((s, c) => s + T.BAB[this.classDef(c).bab](c.level), 0);
    }
    return this.bab();
  }

  /** Effective fighter level for feat prerequisites (eldritch knight, magus fighter training). */
  fighterLevel() {
    let lvl = this.classLevel('fighter');
    if (this.hasFeature('diverse-training')) lvl += this.classLevel('eldritch-knight');
    if (this.hasFeature('fighter-training')) lvl += Math.floor(this.classLevel('magus') / 2);
    return lvl;
  }

  baseMaxHp() {
    const conMod = this.abilityMod('con');
    const hd = this.hitDice();
    const rolled = this.levelHistory.reduce((s, h) => s + (h.hp || 0) + (h.favoredBonus === 'hp' ? 1 : 0), 0);
    return rolled + conMod * hd;
  }

  // ------------------------------------------------------------ skills
  skillRanks(id) {
    return this.skillRanksMap[id] || 0;
  }

  classSkills() {
    const set = new Set();
    for (const c of this.classes) this.classDef(c).classSkills.forEach((s) => set.add(s));
    for (const opt of this.selectedOptions()) if (opt.def.classSkills) opt.def.classSkills.forEach((s) => set.add(s));
    const bl = this.bloodline();
    if (bl && bl.classSkill) set.add(bl.classSkill);
    if (this.classLevel('bard') >= 16) Object.keys(SKILLS).forEach((s) => set.add(s));
    return set;
  }

  isClassSkill(id) {
    return this.classSkills().has(id);
  }

  skillPointsPerLevel(classId) {
    const def = this.classDef(classId);
    return Math.max(1, def.skillRanks + this.baseAbilityMod('int')) + (this.raceDef().skillRanksPerLevel || 0);
  }

  maxRanks() {
    return this.hitDice();
  }

  canUseSkill(id) {
    const def = SKILLS[id];
    if (!def) return false;
    if (!def.trained || this.skillRanks(id) > 0) return true;
    if (def.knowledge && this.hasFlag('knowledgeUntrained')) return true;
    return this.hasFlag('allSkillsUntrained');
  }

  skill(id, tags = []) {
    const def = SKILLS[id];
    if (!def) throw Object.assign(new Error(`Unknown skill: ${id}`), { status: 400 });
    const ranks = this.skillRanks(id);
    const classBonus = ranks > 0 && this.isClassSkill(id) ? 3 : 0;
    const ab = def.knowledge && this.hasFlag('knowledgeUsesCha') ? Math.max(this.abilityMod('int'), this.abilityMod('cha')) : this.abilityMod(def.ability);
    let acp = 0;
    if (def.acp) acp = this.armorCheckPenalty();
    const sizeMod = id === 'stealth' ? SIZES[this.size()].stealth : id === 'fly' ? SIZES[this.size()].fly : 0;
    const r = this.stat(['skill', `skill.${id}`], tags);
    // Raging restricts Int/Dex/Cha skills except a few.
    const blocked = this.hasFlag('raging') && ['int', 'dex', 'cha'].includes(def.ability) && !['acrobatics', 'fly', 'intimidate', 'ride'].includes(id);
    return { total: ranks + classBonus + ab + acp + sizeMod + r.total, ranks, classSkill: this.isClassSkill(id), ability: ab, armorCheckPenalty: acp, size: sizeMod, untrainedAllowed: this.canUseSkill(id), blocked, breakdown: r.breakdown };
  }

  // ------------------------------------------------------------ equipment
  equipped() {
    return this.inventory.filter((i) => i.equipped);
  }

  equippedIn(slot) {
    return this.inventory.find((i) => i.equipped === slot) || null;
  }

  armorItem() { return this.equippedIn('armor'); }
  shieldItem() { return this.equippedIn('shield'); }

  armorType() {
    const it = this.armorItem();
    if (!it) return 'none';
    return ITEMS[it.itemId].armorType;
  }

  hasShield() {
    return !!this.shieldItem();
  }

  itemModifiers() {
    const out = [];
    if (this.effects.some((e) => (e.flags || []).includes('wildShape'))) return out;
    const armor = this.armorItem();
    if (armor) {
      const def = ITEMS[armor.itemId];
      out.push(mod('ac', def.bonus, 'armor', def.name));
      if (armor.enhancement) out.push(mod('ac', armor.enhancement, 'armor-enhancement', `${def.name} enhancement`));
      if (def.armorType !== 'light' && !this.isArmorProficient(def.armorType)) out.push(mod('attack', this.armorCheckPenalty(), 'untyped', 'Nonproficient armor'));
    }
    const shield = this.shieldItem();
    if (shield) {
      const def = ITEMS[shield.itemId];
      out.push(mod('ac', def.bonus, 'shield', def.name));
      if (shield.enhancement) out.push(mod('ac', shield.enhancement, 'shield-enhancement', `${def.name} enhancement`));
      if (def.shieldType === 'tower') out.push(mod('attack', -2, 'untyped', 'Tower shield'));
    }
    for (const it of this.equipped()) {
      const def = ITEMS[it.itemId];
      if (!def) continue;
      if (def.kind === 'wondrous' && def.modifiers) out.push(...def.modifiers(def.name));
      for (const sp of it.special || []) {
        const as = ARMOR_SPECIALS[sp];
        if (as && as.skill) for (const [k, v] of Object.entries(as.skill)) out.push(mod(`skill.${k}`, v, 'competence', as.name));
      }
    }
    return out;
  }

  isArmorProficient(type) {
    const prof = this.proficiencies();
    return prof.armor.has(type);
  }

  proficiencies() {
    if (this._cache && this._cache.prof) return this._cache.prof;
    const weapons = new Set();
    const armor = new Set();
    const shields = new Set();
    for (const c of this.classes) {
      const p = this.classDef(c).proficiencies || {};
      // Prestige classes only grant proficiencies; base classes grant at 1st level.
      (p.weapons || []).forEach((w) => weapons.add(w));
      (p.armor || []).forEach((a) => armor.add(a));
      (p.shields || []).forEach((s) => shields.add(s));
    }
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.proficiencies) (def.proficiencies.armor || []).forEach((a) => armor.add(a));
    }
    for (const opt of this.selectedOptions()) {
      const p = opt.def.proficiencies;
      if (!p) continue;
      (p.weapons || []).forEach((w) => weapons.add(w));
      (p.armor || []).forEach((a) => armor.add(a));
      (p.shields || []).forEach((x) => shields.add(x));
    }
    if (this.hasFeat('armor-proficiency-light')) armor.add('light');
    if (this.hasFeat('armor-proficiency-medium')) armor.add('medium');
    if (this.hasFeat('armor-proficiency-heavy')) armor.add('heavy');
    if (this.hasFeat('shield-proficiency')) shields.add('shield');
    if (this.hasFeat('tower-shield-proficiency')) shields.add('tower');
    if (this.hasFeat('simple-weapon-proficiency')) weapons.add('simple');
    for (const p of this.featParams('martial-weapon-proficiency')) weapons.add(p);
    for (const p of this.featParams('exotic-weapon-proficiency')) weapons.add(p);
    for (const w of this.raceDef().weaponFamiliarity || []) weapons.add(w);
    if (this.hasFlag && this.effects.some((e) => (e.flags || []).includes('babEqualsLevel'))) {
      weapons.add('simple');
      weapons.add('martial');
    }
    if (this.deity && weapons.has('deity-favored') && OPTIONS.DEITIES[this.deity]) weapons.add(OPTIONS.DEITIES[this.deity].favoredWeapon);
    const out = { weapons, armor, shields };
    this._cache = this._cache || {};
    this._cache.prof = out;
    return out;
  }

  isWeaponProficient(weaponId) {
    const def = ITEMS[weaponId];
    if (!def || def.kind !== 'weapon') return true;
    if (weaponId === 'unarmed-strike') return true;
    const p = this.proficiencies().weapons;
    if (p.has(weaponId)) return true;
    if (def.category === 'simple' && p.has('simple')) return true;
    if (def.category === 'martial' && p.has('martial')) return true;
    // Racial familiarity makes "racial" exotic weapons martial.
    if (def.category === 'exotic' && p.has(weaponId)) return true;
    return false;
  }

  carriedWeight() {
    return this.inventory.reduce((s, i) => {
      const def = ITEMS[i.itemId];
      if (!def) return s;
      const per = def.qtyPer ? def.weight / def.qtyPer : def.weight;
      return s + per * (i.qty || 1) * (this.size() === 'small' && ['weapon', 'armor', 'shield'].includes(def.kind) ? 0.5 : 1);
    }, 0) + Math.floor(this.money / 100) / 50;
  }

  capacity() {
    return T.carryingCapacity(this.ability('str'), SIZES[this.size()].carry);
  }

  load() {
    if (this._cache && this._cache.load) return this._cache.load;
    const w = this.carriedWeight();
    const cap = T.carryingCapacity(this.rawAbility('str'), SIZES[this.baseSize()].carry);
    const out = w <= cap.light ? 'light' : w <= cap.medium ? 'medium' : 'heavy';
    this._cache = this._cache || {};
    this._cache.load = out;
    return out;
  }

  armorTrainingLevel() {
    return this.hasFeature('armor-training') ? this.prog('armorTraining') : 0;
  }

  maxDexBonus() {
    let cap = null;
    const armor = this.armorItem();
    if (armor) {
      const def = ITEMS[armor.itemId];
      cap = def.maxDex + this.armorTrainingLevel();
    }
    const shield = this.shieldItem();
    if (shield && ITEMS[shield.itemId].maxDex !== null) cap = cap === null ? ITEMS[shield.itemId].maxDex : Math.min(cap, ITEMS[shield.itemId].maxDex);
    const loadCap = T.LOAD_PENALTIES[this.load()].maxDex;
    if (loadCap !== null) cap = cap === null ? loadCap : Math.min(cap, loadCap);
    return cap;
  }

  armorCheckPenalty() {
    let pen = 0;
    for (const it of [this.armorItem(), this.shieldItem()]) {
      if (!it) continue;
      const def = ITEMS[it.itemId];
      let p = def.acp;
      if (it.masterwork || it.enhancement) p = Math.min(0, p + 1);
      pen += p;
    }
    if (this.armorItem()) pen = Math.min(0, pen + this.armorTrainingLevel());
    const loadPen = T.LOAD_PENALTIES[this.load()].checkPenalty;
    return Math.min(pen, loadPen);
  }

  baseSpeed() {
    const r = this.raceDef();
    const ws = this.effects.find((e) => e.key === 'ability:wild-shape');
    const wsSpeed = ws && (ws.flags || []).find((f) => f.startsWith('landSpeed:'));
    if (wsSpeed) return Number(wsSpeed.split(':')[1]);
    let s = r.speed;
    const heavyish = (this.armorType() === 'medium' && this.armorTrainingLevel() < 1) || (this.armorType() === 'heavy' && this.armorTrainingLevel() < 2) || this.load() !== 'light';
    if (heavyish && !r.speedNeverReduced) s = T.reducedSpeed(s);
    return s;
  }

  arcaneSpellFailure() {
    let asf = 0;
    const armor = this.armorItem();
    const shield = this.shieldItem();
    const ignored = new Set();
    for (const c of this.classes) {
      const sc = CLASSES[c.id].spellcasting;
      if (!sc) continue;
      (sc.armorSpellFailureIgnored || []).forEach((t) => ignored.add(t));
      for (const [t, lvl] of Object.entries(sc.armorSpellFailureIgnoredAt || {})) if (c.level >= lvl) ignored.add(t);
    }
    if (armor && !ignored.has(ITEMS[armor.itemId].armorType)) asf += ITEMS[armor.itemId].asf;
    if (shield && !(ignored.has('light') && ITEMS[shield.itemId].shieldType === 'buckler')) asf += ITEMS[shield.itemId].asf;
    return asf;
  }

  wieldsTwoWeapons() {
    const main = this.equippedIn('mainHand');
    const off = this.equippedIn('offHand');
    return !!(main && off && ITEMS[off.itemId] && ITEMS[off.itemId].kind === 'weapon');
  }

  wieldsDuelistWeapon() {
    const main = this.equippedIn('mainHand');
    if (!main) return false;
    const def = ITEMS[main.itemId];
    return def && def.kind === 'weapon' && ['light', 'one-handed'].includes(def.use) && def.damageTypes.includes('piercing') && !this.wieldsTwoWeapons();
  }

  // ------------------------------------------------------------ attacks
  /** Static profiles for every way this character can attack. */
  attackProfiles() {
    const out = [];
    // Polymorphed (wild shape): gear melds into the new form; only its natural attacks remain.
    if (this.effects.some((e) => (e.flags || []).includes('wildShape'))) return this.naturalAttacks();
    const main = this.equippedIn('mainHand');
    const off = this.equippedIn('offHand');
    const twoWeapons = this.wieldsTwoWeapons();
    if (main) out.push(this.weaponProfile(main, 'mainHand', twoWeapons));
    if (off && ITEMS[off.itemId].kind === 'weapon') out.push(this.weaponProfile(off, 'offHand', true));
    // Unarmed strike is always available.
    out.push(this.unarmedProfile());
    for (const n of this.naturalAttacks()) out.push(n);
    return out;
  }

  weaponProfile(inst, hand, twoWeaponFighting) {
    const def = ITEMS[inst.itemId];
    const ranged = def.use === 'ranged';
    const finesse = this.hasFeat('weapon-finesse') && (def.use === 'light' || def.special.includes('finesse') || def.id === 'unarmed-strike');
    const twoHanded = def.use === 'two-handed' || (inst.twoHanded && def.use === 'one-handed');
    let damageAbilityMult = 1;
    if (twoHanded && !ranged) damageAbilityMult = 1.5;
    if (hand === 'offHand') damageAbilityMult = this.hasFeat('double-slice') ? 1 : 0.5;
    if (ranged && !def.special.includes('thrown') && !def.special.includes('strDamage') && !def.special.includes('composite')) damageAbilityMult = 0;
    const specials = (inst.special || []).map((s) => WEAPON_SPECIALS[s]).filter(Boolean);
    const dmg = weaponDamageForSize(def.damage, this.size());
    return {
      id: hand, name: inst.name || def.name, source: 'weapon', weaponId: def.id, uid: inst.uid, hand,
      melee: !ranged, ranged, thrown: def.special.includes('thrown'), light: def.use === 'light', twoHanded,
      attackAbility: ranged ? 'dex' : finesse ? 'dex' : 'str', finesse,
      damageAbilityMult, damageDice: dmg, damageTypes: def.damageTypes,
      critRange: def.critRange, critMult: def.critMult,
      keen: specials.some((s) => s.doublesThreat) || this.effects.some((e) => (e.flags || []).includes('keenWeapon') && hand === 'mainHand'),
      enhancement: inst.enhancement || 0, masterwork: !!(inst.masterwork || inst.enhancement),
      magic: !!(inst.enhancement || specials.length), material: inst.material || 'steel',
      extraDamage: specials.filter((s) => s.extraDamage).map((s) => s.extraDamage),
      alignedDamage: specials.filter((s) => s.alignedDamage).map((s) => s.alignedDamage),
      aligned: specials.filter((s) => s.alignment).map((s) => s.alignment),
      bleed: specials.reduce((n, s) => n + (s.bleed || 0), 0), vorpal: specials.some((s) => s.vorpal), speed: specials.some((s) => s.extraAttack),
      proficient: this.isWeaponProficient(def.id), groups: def.groups, rangeIncrement: def.range,
      reach: this.reach() * (def.special.includes('reach') ? 2 : 1), reachWeapon: def.special.includes('reach'),
      twoWeaponFighting, offHand: hand === 'offHand', monk: def.special.includes('monk'), special: def.special,
    };
  }

  unarmedProfile() {
    const monk = this.classLevel('monk');
    const size = this.size();
    const dmg = monk ? (MONK_UNARMED[size] || MONK_UNARMED.medium)[Math.min(19, monk - 1)] : weaponDamageForSize('1d3', size);
    const lethal = this.hasFeat('improved-unarmed-strike');
    return {
      id: 'unarmed', name: 'Unarmed strike', source: 'unarmed', weaponId: 'unarmed-strike', hand: 'mainHand',
      melee: true, ranged: false, light: true, attackAbility: this.hasFeat('weapon-finesse') ? 'dex' : 'str', damageAbilityMult: 1,
      damageDice: dmg, damageTypes: ['bludgeoning'], critRange: 20, critMult: 2, enhancement: 0, masterwork: false,
      magic: this.hasFlag('unarmedMagic'), material: this.hasFlag('unarmedAdamantine') ? 'adamantine' : 'none', aligned: this.hasFlag('unarmedLawful') ? ['lawful'] : [],
      extraDamage: [], alignedDamage: [], proficient: true, groups: ['close', 'monk', 'natural'], reach: this.reach(),
      nonlethal: !lethal, provokes: !lethal, monk: true, special: ['monk', 'unarmed'],
    };
  }

  naturalAttacks() {
    const out = [];
    const add = (n) => {
      for (let i = 0; i < (n.count || 1); i++) {
        out.push({
          id: `natural:${n.name.toLowerCase().replace(/\s+/g, '-')}${n.count > 1 ? `-${i + 1}` : ''}`, name: n.name, source: 'natural', natural: true, primary: n.primary !== false,
          melee: true, ranged: false, attackAbility: this.hasFeat('weapon-finesse') ? 'dex' : 'str', damageAbilityMult: n.strMult || (n.primary === false ? 0.5 : 1),
          damageDice: n.fixedSize ? n.damage : weaponDamageForSize(n.damage, this.size()), damageTypes: n.type || ['bludgeoning', 'piercing', 'slashing'], critRange: 20, critMult: 2,
          enhancement: 0, masterwork: false, magic: !!n.magic, material: 'none', extraDamage: n.extra ? [n.extra] : [], alignedDamage: [], aligned: [],
          proficient: true, groups: ['natural'], reach: this.reach(), special: ['natural'], onHit: (n.onHit || []).map((k) => (typeof k === 'string' ? { kind: k } : k)),
        });
      }
    };
    for (const f of this.features()) {
      const def = FEATURES[f.key];
      if (def && def.naturalAttacks) def.naturalAttacks(this).forEach(add);
    }
    for (const opt of this.selectedOptions()) if (opt.def.naturalAttacks) opt.def.naturalAttacks(this).forEach(add);
    const bp = this.bloodlinePowers();
    // Bloodline claws are usable a limited number of rounds; exposed as always-available for simplicity.
    if (bp && bp.naturalAttacks) bp.naturalAttacks.forEach(add);
    for (const e of this.effects) for (const n of e.naturalAttacks || []) add(n);
    return out;
  }

  // ------------------------------------------------------------ casting
  casterClasses() {
    return this.classes.filter((c) => CLASSES[c.id].spellcasting).map((c) => c.id);
  }

  /** Effective class level for spells per day (base class level + prestige advancement). */
  effectiveCasterClassLevel(classId) {
    let lvl = this.classLevel(classId);
    if (!lvl) return 0;
    for (const c of this.classes) {
      const def = CLASSES[c.id];
      if (!def.advancesCasting) continue;
      const target = c.spellProgression;
      const targets = typeof target === 'object' && target ? Object.values(target) : [target];
      if (!targets.includes(classId)) continue;
      lvl += def.advancesCasting.levels.filter((l) => l <= c.level).length;
    }
    return lvl;
  }

  casterLevel(classId) {
    const ids = classId ? [classId] : this.casterClasses();
    let best = 0;
    for (const id of ids) {
      const sc = CLASSES[id].spellcasting;
      if (!sc) continue;
      const lvl = this.effectiveCasterClassLevel(id) + (sc.casterLevelOffset || 0);
      best = Math.max(best, lvl);
    }
    return Math.max(0, best + this.stat('cl').total);
  }

  // ------------------------------------------------------------ xp
  levelForXp() {
    return T.levelForXp(this.xp, this.xpTrack);
  }

  xpForNextLevel() {
    const t = T.XP_TRACKS[this.xpTrack];
    const next = this.hitDice() + 1;
    return next < t.length ? t[next] : null;
  }

  canLevelUp() {
    return this.levelForXp() > this.hitDice() && this.hitDice() < 20;
  }

  // ------------------------------------------------------------ output
  toJSON() {
    return {
      id: this.id, accountId: this.accountId, name: this.name, race: this.race, alignment: this.alignment, deity: this.deity,
      gender: this.gender, age: this.age, description: this.description,
      abilityBase: this.abilityBase, racialBonus: this.racialBonus, abilityIncreases: this.abilityIncreases, inherent: this.inherent,
      classes: this.classes, levelHistory: this.levelHistory, favoredClasses: this.favoredClasses, feats: this.feats, skillRanks: this.skillRanksMap,
      choices: this.choices, languages: this.languages, xp: this.xp, xpTrack: this.xpTrack, spellcasting: this.spellcasting,
      inventory: this.inventory, money: this.money, location: this.location, createdAt: this.createdAt, stats: this.stats,
      hp: this.hp, effects: this.effects, negativeLevels: this.negativeLevels, abilityDamage: this.abilityDamage, abilityDrain: this.abilityDrain,
      resourcesUsed: this.resourcesUsed, toggles: this.toggles, status: this.status, stable: this.stable, diedAt: this.diedAt,
      companion: this.companion,
    };
  }
}

module.exports = { Character, OPTION_TABLES, MONK_UNARMED };
