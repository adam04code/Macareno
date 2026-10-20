'use strict';

const { resolve, mod } = require('./modifiers');
const { abilityMod } = require('./tables');
const { SIZES, shiftSize, ABILITIES, alignmentAxes, CREATURE_TYPES } = require('../data/core');
const { CONDITION_IMMUNITY_TAGS } = require('../data/conditions');
const { makeEffect, conditionEffect, effectModifiers, effectFlags, escalateFear, newId } = require('./effects');
const dice = require('./dice');

const SAVE_ABILITY = { fort: 'con', ref: 'dex', will: 'wis' };
const ARMOR_TYPES = ['armor', 'shield', 'natural', 'natural-increase', 'natural-enhancement', 'armor-enhancement', 'shield-enhancement'];
// Bonuses that also apply to CMD (Core Rulebook, "Combat Maneuver Defense").
const CMD_AC_TYPES = ['circumstance', 'deflection', 'dodge', 'insight', 'luck', 'morale', 'profane', 'sacred', 'monk'];

/**
 * Shared rules for anything that can fight: characters, monsters, summons.
 * Subclasses implement the "printed" numbers (base abilities, BAB, base saves,
 * hp) and the passive modifier sources; this class layers effects,
 * conditions, stacking, size, negative levels and hit point states on top.
 */
class Creature {
  constructor(data = {}) {
    this.id = data.id || newId();
    this.name = data.name || 'Unnamed';
    this.alignment = data.alignment || 'N';
    this.effects = data.effects || [];
    this.hp = data.hp || { current: null, temp: 0, nonlethal: 0 };
    this.negativeLevels = data.negativeLevels || { temporary: 0, permanent: 0 };
    this.abilityDamage = data.abilityDamage || {};
    this.abilityDrain = data.abilityDrain || {};
    this.resourcesUsed = data.resourcesUsed || {};
    this.toggles = data.toggles || {};
    this.status = data.status || 'alive';
    this.stable = data.stable || false;
    this.diedAt = data.diedAt || null;
    this.version = 0;
    this._cache = null;
  }

  // ------------------------------------------------------------ hooks
  baseAbilityScores() { return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }; }
  sourceModifiers() { return []; }
  sourceFlags() { return []; }
  sourceResources() { return {}; }
  sourceDr() { return []; }
  sourceResistances() { return {}; }
  sourceImmunities() { return []; }
  sourceSr() { return 0; }
  baseSize() { return 'medium'; }
  creatureType() { return 'humanoid'; }
  subtypes() { return []; }
  bab() { return 0; }
  baseSave() { return 0; }
  baseMaxHp() { return 1; }
  hitDice() { return 1; }
  baseSpeed() { return 30; }
  maxDexBonus() { return null; }
  armorCheckPenalty() { return 0; }
  casterLevel() { return 0; }
  get level() { return this.hitDice(); }

  touch() {
    this.version++;
    this._cache = null;
  }

  // ------------------------------------------------------------ modifiers
  /** All active modifiers. Guarded so feature formulas may read ability scores. */
  modifiers() {
    if (this._cache && this._cache.mods) return this._cache.mods;
    if (this._collecting) return this._partialMods || [];
    this._collecting = true;
    try {
      const fromEffects = this.effects.flatMap(effectModifiers);
      const nl = this.totalNegativeLevels();
      const nlMods = nl ? ['attack', 'save', 'skill', 'abilityCheck', 'cmb', 'cmd', 'cl'].map((t) => mod(t, -nl, 'untyped', 'Negative levels')) : [];
      this._partialMods = [...fromEffects, ...nlMods];
      const all = [...this._partialMods, ...this.sourceModifiers()];
      this._cache = this._cache || {};
      this._cache.mods = all;
      return all;
    } finally {
      this._collecting = false;
      this._partialMods = null;
    }
  }

  stat(targets, tags = [], opts) {
    return resolve(this.modifiers(), targets, tags, opts);
  }

  // ------------------------------------------------------------ flags
  flags() {
    if (this._cache && this._cache.flags) return this._cache.flags;
    if (this._collectingFlags) return new Set(this.effects.flatMap(effectFlags));
    this._collectingFlags = true;
    try {
      return this._computeFlags();
    } finally {
      this._collectingFlags = false;
    }
  }

  _computeFlags() {
    const set = new Set();
    for (const e of this.effects) for (const f of effectFlags(e)) set.add(f);
    for (const f of this.sourceFlags()) set.add(f);
    const st = this.hpState();
    if (st === 'dead') ['dead', 'helpless', 'noActions'].forEach((f) => set.add(f));
    if (st === 'dying') ['dying', 'unconscious', 'helpless', 'noActions'].forEach((f) => set.add(f));
    if (st === 'stable') ['stable', 'unconscious', 'helpless', 'noActions'].forEach((f) => set.add(f));
    if (st === 'disabled') ['disabled', 'singleAction'].forEach((f) => set.add(f));
    if (st === 'unconscious') ['unconscious', 'helpless', 'noActions'].forEach((f) => set.add(f));
    if (st === 'staggered-nonlethal') set.add('singleAction');
    if (set.has('helpless') || set.has('flatFooted') || set.has('blind')) set.add('loseDex');
    this._cache = this._cache || {};
    this._cache.flags = set;
    return set;
  }

  hasFlag(f) {
    return this.flags().has(f);
  }

  /** Numeric flag such as 'darkvision:60' -> 60. */
  flagValue(prefix) {
    let best = null;
    for (const f of this.flags()) {
      if (f.startsWith(`${prefix}:`)) {
        const v = Number(f.split(':')[1]);
        if (best === null || v > best) best = v;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ identity
  size() {
    let shift = 0;
    for (const e of this.effects) if (e.sizeChange) shift = Math.abs(e.sizeChange) > Math.abs(shift) ? e.sizeChange : shift;
    return shiftSize(this.baseSize(), shift);
  }
  sizeMod() { return SIZES[this.size()].mod; }
  specialSizeMod() { return SIZES[this.size()].special; }
  reach() { return SIZES[this.size()].reach; }

  axes() { return alignmentAxes(this.alignment); }

  /** Context tags describing this creature as a target (favored enemy, protection from evil, hatred...). */
  targetTags() {
    const t = this.creatureType();
    const tags = [`vs:${t}`, `type:${t}`];
    for (const s of this.subtypes()) tags.push(`vs:${t}:${s}`, `subtype:${s}`);
    const ax = this.axes();
    if (ax.evil) tags.push('vsEvil', 'evil');
    if (ax.good) tags.push('vsGood', 'good');
    if (ax.lawful) tags.push('vsLawful', 'lawful');
    if (ax.chaotic) tags.push('vsChaotic', 'chaotic');
    const subs = this.subtypes();
    if (subs.includes('giant')) tags.push('vsGiant');
    if (subs.includes('orc')) tags.push('vsOrc');
    if (subs.includes('goblinoid')) tags.push('vsGoblinoid');
    if (subs.includes('reptilian')) tags.push('vsReptilian');
    return tags;
  }

  isUndead() { return this.creatureType() === 'undead'; }
  isLiving() { return !['undead', 'construct'].includes(this.creatureType()); }

  // ------------------------------------------------------------ abilities
  /** Ability score before condition overrides (paralysis, helplessness). */
  rawAbility(a) {
    const base = this.baseAbilityScores()[a];
    if (base === null || base === undefined) return null;
    const score = base + this.stat(a).total - (this.abilityDamage[a] || 0) - (this.abilityDrain[a] || 0);
    return Math.max(0, score);
  }

  ability(a) {
    const raw = this.rawAbility(a);
    if (raw === null) return null;
    if (a === 'str' || a === 'dex') {
      const f = this.flags();
      if (f.has('paralyzed') || f.has('petrified')) return 0;
      if (a === 'dex' && f.has('helpless')) return 0;
    }
    return raw;
  }

  abilityMod(a) {
    const s = this.ability(a);
    return s === null ? 0 : abilityMod(s);
  }

  /** Ability modifier ignoring temporary effects (used for daily resource counts). */
  baseAbilityMod(a) {
    const s = this.baseAbilityScores()[a];
    return s === null || s === undefined ? 0 : abilityMod(s);
  }

  abilities() {
    const out = {};
    for (const a of ABILITIES) out[a] = { score: this.ability(a), mod: this.abilityMod(a), base: this.baseAbilityScores()[a], damage: this.abilityDamage[a] || 0, drain: this.abilityDrain[a] || 0 };
    return out;
  }

  // ------------------------------------------------------------ defenses
  dexToAc() {
    let d = this.abilityMod('dex');
    const cap = this.maxDexBonus();
    if (cap !== null && cap !== undefined) d = Math.min(d, cap);
    return d;
  }

  /**
   * Armor Class. ctx: { tags, touch, flatFooted, deniedDex }.
   */
  ac(ctx = {}) {
    const tags = ctx.tags || [];
    const f = this.flags();
    const denied = ctx.deniedDex || ctx.flatFooted || f.has('loseDex');
    const exclude = [];
    if (ctx.touch) exclude.push(...ARMOR_TYPES);
    if (denied) exclude.push('dodge');
    const r = this.stat('ac', tags, { excludeTypes: exclude });
    const dex = this.dexToAc();
    const dexPart = f.has('helpless') ? -5 : denied ? Math.min(0, dex) : dex;
    return { total: 10 + this.sizeMod() + dexPart + r.total, breakdown: [{ source: 'Base', value: 10 }, { source: 'Size', value: this.sizeMod() }, { source: 'Dex', value: dexPart }, ...r.breakdown] };
  }

  acSummary(tags = []) {
    return {
      ac: this.ac({ tags }).total,
      touch: this.ac({ tags, touch: true }).total,
      flatFooted: this.ac({ tags, flatFooted: true }).total,
    };
  }

  save(type, tags = []) {
    const base = this.baseSave(type);
    const ab = this.abilityMod(this.saveAbility(type));
    const r = this.stat(['save', `save.${type}`], tags);
    return { total: base + ab + r.total, base, ability: ab, breakdown: r.breakdown };
  }

  saveAbility(type) {
    if (type === 'fort' && this.baseAbilityScores().con === null) return this.creatureType() === 'undead' ? 'cha' : 'con';
    return SAVE_ABILITY[type];
  }

  initiative() {
    return this.abilityMod('dex') + this.stat('initiative').total;
  }

  cmbBase() {
    return this.bab();
  }

  cmb(tags = []) {
    const useDex = this.hasFeat && this.hasFeat('agile-maneuvers') && this.abilityMod('dex') > this.abilityMod('str');
    const sizeSmall = SIZES[this.size()].order <= SIZES.tiny.order;
    const ab = useDex || sizeSmall ? this.abilityMod('dex') : this.abilityMod('str');
    return this.cmbBase() + ab + this.specialSizeMod() + this.stat('cmb', tags).total;
  }

  cmd(tags = []) {
    const f = this.flags();
    const denied = f.has('loseDex');
    const dex = denied ? Math.min(0, this.abilityMod('dex')) : this.abilityMod('dex');
    const exclude = denied ? ['dodge'] : [];
    const acPart = this.stat('ac', tags, { includeTypes: CMD_AC_TYPES, excludeTypes: exclude }).total;
    const acPenalties = this.modifiers().filter((m) => m.target === 'ac' && m.value < 0 && !CMD_AC_TYPES.includes(m.type) && (!m.onlyIf || m.onlyIf.some((t) => tags.includes(t)))).reduce((s, m) => s + m.value, 0);
    const babPart = this.hasFeat && this.hasFeat('defensive-combat-training') ? this.hitDice() : this.bab();
    return 10 + babPart + this.abilityMod('str') + dex + this.specialSizeMod() + acPart + acPenalties + this.stat('cmd', tags).total;
  }

  speed() {
    const f = this.flags();
    if (f.has('noMove') || f.has('noActions') || f.has('paralyzed')) return 0;
    let s = this.baseSpeed() + this.stat('speed').total;
    if (f.has('halfSpeed')) s = Math.floor(s / 2 / 5) * 5;
    return Math.max(0, s);
  }

  flySpeed() {
    return this.flagValue('fly') || 0;
  }

  dr() {
    const list = [...this.sourceDr()];
    for (const e of this.effects) if (e.dr) list.push(...(Array.isArray(e.dr) ? e.dr : [e.dr]));
    return list.filter((d) => d && d.amount > 0);
  }

  resistances() {
    const out = { ...this.sourceResistances() };
    for (const e of this.effects) {
      if (e.resist) for (const [k, v] of Object.entries(e.resist)) out[k] = v === 'half' ? v : Math.max(out[k] || 0, v);
    }
    return out;
  }

  immunities() {
    const set = new Set(this.sourceImmunities());
    const typeDef = CREATURE_TYPES[this.creatureType()];
    if (typeDef && typeDef.immunities) typeDef.immunities.forEach((i) => set.add(i));
    for (const f of this.flags()) if (f.startsWith('immune:')) set.add(f.slice(7));
    return set;
  }

  isImmune(tags) {
    const imm = this.immunities();
    return (Array.isArray(tags) ? tags : [tags]).some((t) => imm.has(t));
  }

  sr() {
    let best = this.sourceSr();
    for (const e of this.effects) if (e.sr) best = Math.max(best, e.sr);
    return best;
  }

  vulnerabilities() { return []; }

  // ------------------------------------------------------------ hit points
  maxHp() {
    return Math.max(1, this.baseMaxHp() + this.stat('hp').total - 5 * this.totalNegativeLevels());
  }

  totalNegativeLevels() {
    return (this.negativeLevels.temporary || 0) + (this.negativeLevels.permanent || 0);
  }

  diesAtZero() {
    return ['undead', 'construct'].includes(this.creatureType());
  }

  hpState() {
    if (this.status === 'dead') return 'dead';
    const cur = this.hp.current;
    if (cur === null || cur === undefined) return 'healthy';
    const con = this.rawAbility('con');
    const deathAt = con === null ? 0 : -con;
    if (this.diesAtZero() && cur <= 0) return 'dead';
    if (cur <= deathAt && !this.diesAtZero()) return 'dead';
    if (cur < 0) return this.stable ? 'stable' : 'dying';
    if (cur === 0) return 'disabled';
    if (this.hp.nonlethal > cur) return 'unconscious';
    if (this.hp.nonlethal === cur && cur > 0) return 'staggered-nonlethal';
    return 'healthy';
  }

  isAlive() {
    return this.hpState() !== 'dead';
  }

  canAct() {
    const f = this.flags();
    return !f.has('noActions') && !f.has('dead');
  }

  /** Apply already-mitigated damage. Returns { dealt, toTemp, state }. */
  takeDamage(amount, opts = {}) {
    if (this.hp.current === null) this.hp.current = this.maxHp();
    let remaining = Math.max(0, Math.floor(amount));
    if (opts.nonlethal) {
      if (this.isImmune('nonlethal')) return { dealt: 0, toTemp: 0, state: this.hpState() };
      this.hp.nonlethal += remaining;
      this.touch();
      return { dealt: remaining, toTemp: 0, nonlethal: true, state: this.hpState() };
    }
    let toTemp = 0;
    // Absorbing wards (stoneskin, protection from arrows): consume pool.
    if (opts.absorbedBy) {
      const e = this.effects.find((x) => x.id === opts.absorbedBy);
      if (e && e.absorb) {
        const used = Math.min(e.absorb, remaining);
        e.absorb -= used;
        if (e.absorb <= 0) this.removeEffect(e.id);
      }
    }
    if (this.hp.temp > 0) {
      toTemp = Math.min(this.hp.temp, remaining);
      this.hp.temp -= toTemp;
      remaining -= toTemp;
    }
    const before = this.hpState();
    this.hp.current -= remaining;
    if (this.hp.current < 0 && opts.minHp !== undefined) this.hp.current = Math.max(this.hp.current, opts.minHp);
    if (this.hp.current < 0) this.stable = false;
    if (remaining > 0) {
      // Damage wakes magically sleeping creatures.
      for (const e of [...this.effects]) if (e.wakeOnDamage) this.removeEffect(e.id);
    }
    this.touch();
    const state = this.hpState();
    if (state === 'dead' && before !== 'dead') this.die();
    return { dealt: remaining, toTemp, state };
  }

  heal(amount) {
    if (this.status === 'dead') return 0;
    if (this.hp.current === null) this.hp.current = this.maxHp();
    const max = this.maxHp();
    const before = this.hp.current;
    this.hp.current = Math.min(max, this.hp.current + Math.max(0, Math.floor(amount)));
    this.hp.nonlethal = Math.max(0, this.hp.nonlethal - Math.floor(amount));
    if (this.hp.current > 0) this.stable = false;
    this.touch();
    return this.hp.current - before;
  }

  addTempHp(amount, sourceKey) {
    // Temporary hit points from the same source do not stack: keep the higher.
    this.hp.temp = Math.max(this.hp.temp || 0, Math.floor(amount));
    this.hp.tempSource = sourceKey;
    this.touch();
  }

  die() {
    this.status = 'dead';
    this.diedAt = Date.now();
    this.effects = this.effects.filter((e) => e.kind === 'condition' && e.conditions.includes('petrified'));
    this.touch();
  }

  // ------------------------------------------------------------ effects
  addEffect(effect) {
    if (!effect) return null;
    // Condition immunities.
    for (const c of effect.conditions || []) {
      const tags = CONDITION_IMMUNITY_TAGS[c] || [];
      if (this.isImmune([c, ...tags])) return null;
    }
    if (effect.tags && effect.tags.length && this.isImmune(effect.tags)) return null;
    // Fear escalation.
    if (effect.kind === 'condition' && effect.conditions.length === 1 && ['shaken', 'frightened', 'panicked'].includes(effect.conditions[0])) {
      const existing = this.effects.find((e) => e.kind === 'condition' && ['shaken', 'frightened', 'panicked'].includes(e.conditions[0]));
      if (existing) {
        const next = escalateFear(existing.conditions[0], effect.conditions[0]);
        existing.conditions = [next];
        existing.key = `condition:${next}`;
        existing.name = next[0].toUpperCase() + next.slice(1);
        if (effect.remaining === null || (existing.remaining !== null && effect.remaining > existing.remaining)) existing.remaining = effect.remaining;
        this.touch();
        return existing;
      }
    }
    // Fatigue stacking: fatigued + fatigued => exhausted.
    if (effect.kind === 'condition' && effect.conditions[0] === 'fatigued') {
      const existing = this.effects.find((e) => e.conditions && e.conditions.includes('fatigued'));
      if (existing) {
        existing.conditions = ['exhausted'];
        existing.key = 'condition:exhausted';
        existing.name = 'Exhausted';
        this.touch();
        return existing;
      }
      if (this.effects.some((e) => e.conditions && e.conditions.includes('exhausted'))) return null;
    }
    // Same key replaces (refresh), except stacking conditions handled above.
    const dup = this.effects.findIndex((e) => e.key === effect.key && !effect.stacks);
    if (dup !== -1) this.effects.splice(dup, 1);
    this.effects.push(effect);
    this.touch();
    return effect;
  }

  addCondition(conditionId, rounds, source) {
    return this.addEffect(conditionEffect(conditionId, rounds, source));
  }

  hasCondition(id) {
    return this.effects.some((e) => (e.conditions || []).includes(id));
  }

  removeEffect(id) {
    const i = this.effects.findIndex((e) => e.id === id);
    if (i === -1) return null;
    const [e] = this.effects.splice(i, 1);
    this.touch();
    return e;
  }

  removeConditions(ids) {
    const set = new Set(ids);
    const removed = [];
    this.effects = this.effects.filter((e) => {
      if (e.kind === 'condition' && e.conditions.some((c) => set.has(c))) {
        removed.push(e);
        return false;
      }
      if (e.kind !== 'condition' && e.conditions && e.conditions.some((c) => set.has(c))) {
        e.conditions = e.conditions.filter((c) => !set.has(c));
      }
      return true;
    });
    if (removed.length) this.touch();
    return removed;
  }

  removeEffectsWhere(pred) {
    const removed = this.effects.filter(pred);
    if (removed.length) {
      this.effects = this.effects.filter((e) => !pred(e));
      this.touch();
    }
    return removed;
  }

  /**
   * Advance effect timers by `rounds`. Returns { expired, events } where
   * events describe ongoing damage etc. for the combat log.
   */
  tickEffects(rounds = 1, rng) {
    const expired = [];
    const events = [];
    for (const e of [...this.effects]) {
      if (e.ongoing && this.isAlive()) {
        const amt = dice.total(e.ongoing.dice, rng);
        const res = this.takeDamage(amt, { type: e.ongoing.type });
        events.push({ type: 'ongoing', effect: e.name, damage: res.dealt, damageType: e.ongoing.type });
        if (e.ongoing.rounds !== undefined) {
          e.ongoing.rounds -= 1;
          if (e.ongoing.rounds <= 0) delete e.ongoing;
        }
      }
      if (e.bleed && this.isAlive()) {
        const res = this.takeDamage(e.bleed, { type: 'bleed' });
        events.push({ type: 'bleed', damage: res.dealt });
      }
      if (e.remaining !== null && e.remaining !== undefined) {
        e.remaining -= rounds;
        if (e.remaining <= 0) {
          this.removeEffect(e.id);
          expired.push(e);
          for (const end of e.onEnd || []) {
            if (end.condition) this.addCondition(end.condition, end.rounds ?? null, { name: e.name });
          }
        }
      }
    }
    if (expired.length || events.length) this.touch();
    return { expired, events };
  }

  // ------------------------------------------------------------ resources
  resources() {
    const defs = this.sourceResources();
    const out = {};
    for (const [k, d] of Object.entries(defs)) out[k] = { ...d, used: this.resourcesUsed[k] || 0, remaining: Math.max(0, d.max - (this.resourcesUsed[k] || 0)) };
    return out;
  }

  resourceRemaining(id) {
    const r = this.resources()[id];
    return r ? r.remaining : 0;
  }

  spendResource(id, amount = 1) {
    const r = this.resources()[id];
    if (!r || r.remaining < amount) return false;
    this.resourcesUsed[id] = (this.resourcesUsed[id] || 0) + amount;
    this.touch();
    return true;
  }

  restoreResources() {
    this.resourcesUsed = {};
    this.touch();
  }

  // ------------------------------------------------------------ util
  rollDice(expr, rng) {
    return dice.roll(expr, rng);
  }

  summary() {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      size: this.size(),
      type: this.creatureType(),
      hp: { current: this.hp.current ?? this.maxHp(), max: this.maxHp(), temp: this.hp.temp || 0, nonlethal: this.hp.nonlethal || 0, state: this.hpState() },
      ...this.acSummary(),
      conditions: [...new Set(this.effects.flatMap((e) => e.conditions || []))],
      effects: this.effects.map((e) => ({ id: e.id, name: e.name, remaining: e.remaining, kind: e.kind })),
    };
  }
}

module.exports = { Creature, SAVE_ABILITY, ARMOR_TYPES, makeEffect };
