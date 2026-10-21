'use strict';

const { Creature } = require('./creature');
const { mod } = require('./modifiers');
const { abilityMod, xpForCr, crToNumber } = require('./tables');
const { SIZES } = require('../data/core');
const { BESTIARY } = require('../data/bestiary');
const dice = require('./dice');

/**
 * A creature instantiated from a bestiary stat block. Printed numbers are the
 * baseline; live changes to ability scores (spells, ability damage) shift
 * attacks, saves, AC and CMB/CMD by the difference in modifier.
 */
class Monster extends Creature {
  constructor(data = {}, opts = {}) {
    const def = opts.def || BESTIARY[data.templateId];
    if (!def) throw Object.assign(new Error(`Unknown creature: ${data.templateId}`), { status: 400 });
    super({ name: def.name, alignment: def.alignment, ...data });
    this.kind = 'monster';
    this.templateId = data.templateId;
    this.def = def;
    this.summoned = data.summoned || false;
    this.ownerId = data.ownerId || null;
    this.cooldowns = data.cooldowns || {};
    this.slaUses = data.slaUses || {};
    if (this.hp.current === null || this.hp.current === undefined) {
      const hp = opts.rollHp ? Math.max(1, dice.total(def.hp, opts.rng)) : Math.max(1, Math.floor(dice.average(def.hp)));
      this.hpMax = data.hpMax || hp;
      this.hp = { current: this.hpMax, temp: 0, nonlethal: 0 };
    } else {
      this.hpMax = data.hpMax || Math.floor(dice.average(def.hp));
    }
  }

  baseAbilityScores() { return this.def.abilities; }
  baseSize() { return this.def.size; }
  creatureType() { return this.def.type; }
  subtypes() { return this.def.subtypes || []; }
  hitDice() { return this.def.hd; }
  bab() { return this.def.bab; }
  cr() { return this.def.cr; }
  xpValue() { return xpForCr(this.def.cr); }
  crNumber() { return crToNumber(this.def.cr); }

  /** Difference between current and printed ability modifier. */
  delta(a) {
    const printed = this.def.abilities[a];
    if (printed === null || printed === undefined) return 0;
    return this.abilityMod(a) - abilityMod(printed);
  }

  baseSave(type) {
    const printedAbility = this.def.abilities[this.saveAbility(type)];
    return this.def.saves[type] - (printedAbility === null || printedAbility === undefined ? 0 : abilityMod(printedAbility));
  }

  baseMaxHp() {
    const conDelta = this.def.abilities.con === null ? 0 : this.delta('con') * this.hitDice();
    return this.hpMax + conDelta;
  }

  baseSpeed() { return this.def.speed.land || 0; }
  flySpeed() { return this.def.speed.fly || this.flagValue('fly') || 0; }
  reach() { return this.def.reach || SIZES[this.size()].reach; }

  sourceModifiers() {
    const out = [];
    const ac = this.def.ac || {};
    for (const [type, v] of Object.entries(ac)) if (v) out.push(mod('ac', v, type, `${this.def.name} ${type}`));
    return out;
  }

  sourceFlags() {
    const out = [];
    for (const s of this.def.senses || []) {
      const m = /^(darkvision|blindsense|blindsight|tremorsense) (\d+)/.exec(s);
      if (m) out.push(`${m[1]}:${m[2]}`);
    }
    if (this.def.incorporeal) out.push('incorporeal');
    if (this.def.speed.fly) out.push(`fly:${this.def.speed.fly}`);
    for (const s of this.def.special || []) if (s.kind === 'staggered') out.push('singleAction');
    if (this.def.immune && this.def.immune.includes('critical')) out.push('immuneCrit');
    return out;
  }

  sourceDr() { return this.def.dr || []; }
  sourceResistances() { return this.def.resist || {}; }
  sourceImmunities() { return this.def.immune || []; }
  sourceSr() { return this.def.sr || 0; }
  vulnerabilities() { return this.def.vulnerable || []; }

  hasFeat(id) { return (this.def.feats || []).includes(id); }

  cmb(tags = []) {
    return this.def.cmb + this.delta('str') + this.stat('cmb', tags).total;
  }

  cmd(tags = []) {
    const vs = this.def.cmdVs || {};
    let base = this.def.cmd;
    for (const [k, v] of Object.entries(vs)) if (tags.includes(k)) base = Math.max(base, v);
    const f = this.flags();
    let dexAdj = this.delta('dex');
    if (f.has('loseDex')) dexAdj -= Math.max(0, abilityMod(this.def.abilities.dex || 10));
    return base + this.delta('str') + dexAdj + this.stat(['cmd'], tags).total + this.stat('ac', tags, { includeTypes: ['circumstance', 'deflection', 'dodge', 'insight', 'luck', 'morale', 'profane', 'sacred'] }).total;
  }

  initiative() {
    return this.def.init + this.delta('dex') + this.stat('initiative').total;
  }

  skill(id, tags = []) {
    const printed = (this.def.skills || {})[id];
    const { SKILLS } = require('../data/core');
    const ab = SKILLS[id] ? SKILLS[id].ability : 'wis';
    const base = printed !== undefined ? printed - (this.def.abilities[ab] === null ? 0 : abilityMod(this.def.abilities[ab] ?? 10)) : 0;
    const r = this.stat(['skill', `skill.${id}`], tags);
    return { total: base + this.abilityMod(ab) + r.total, ranks: printed !== undefined ? printed : 0, breakdown: r.breakdown };
  }

  /** Attack profiles derived from the printed melee/ranged lines. */
  attackProfiles() {
    const out = [];
    const build = (a, i, ranged) => {
      for (let n = 0; n < (a.count || 1); n++) {
        out.push({
          id: `${ranged ? 'ranged' : 'melee'}:${i}${a.count > 1 ? `-${n + 1}` : ''}`, name: a.name, source: a.natural ? 'natural' : 'weapon', natural: a.natural,
          printed: true, printedBonus: a.bonus, primary: a.primary !== false, melee: !ranged, ranged, touch: !!a.touch,
          attackAbility: ranged ? 'dex' : 'str', damageDice: a.damage, damageTypes: a.damageType ? [a.damageType] : a.type, critRange: a.crit[0], critMult: a.crit[1],
          onHit: a.onHit || [], enhancement: 0, magic: (this.def.dr || []).some((d) => d.bypass === 'magic') || this.def.type === 'outsider', material: 'none',
          aligned: this.alignedNaturalWeapons(), extraDamage: [], alignedDamage: [], proficient: true, reach: ranged ? 0 : this.reach(), rangeIncrement: a.range || 0,
          special: [],
        });
      }
    };
    this.def.melee.forEach((a, i) => build(a, i, false));
    (this.def.ranged || []).forEach((a, i) => build(a, i, true));
    return out;
  }

  /** Outsiders with alignment subtypes overcome DR of that alignment. */
  alignedNaturalWeapons() {
    const subs = this.subtypes();
    return ['good', 'evil', 'lawful', 'chaotic'].filter((a) => subs.includes(a));
  }

  specials() { return this.def.special || []; }

  spellLikeAbilities() {
    return (this.def.spellLike || []).map((s) => ({ ...s, used: this.slaUses[s.spell] || 0, remaining: s.perDay === Infinity ? Infinity : s.perDay - (this.slaUses[s.spell] || 0) }));
  }

  casterLevel() {
    const sla = this.def.spellLike || [];
    return sla.length ? Math.max(...sla.map((s) => s.cl || this.hitDice())) : this.hitDice();
  }

  /** Regenerating creatures cannot die unless damaged by a bypass type since their last turn. */
  takeDamage(amount, opts = {}) {
    const regen = this.def.regeneration;
    if (regen && regen.bypass.includes(opts.type)) this.regenSuppressed = true;
    return super.takeDamage(amount, opts);
  }

  hpState() {
    const st = super.hpState();
    const regen = this.def.regeneration;
    if (regen && st === 'dead' && this.status !== 'dead' && !this.regenSuppressed) return this.hp.current < 0 ? 'dying' : 'disabled';
    return st;
  }

  /** Start-of-turn healing: regeneration and fast healing. */
  naturalHealing() {
    const out = [];
    const regen = this.def.regeneration;
    if (regen && this.status !== 'dead') {
      if (!this.regenSuppressed) out.push({ type: 'regeneration', healed: this.heal(regen.amount) });
      this.regenSuppressed = false;
    }
    if (this.def.fastHealing && this.isAlive()) out.push({ type: 'fast-healing', healed: this.heal(this.def.fastHealing) });
    return out;
  }

  diesAtZero() {
    if (this.def.regeneration) return false;
    // Monsters other than those with ferocity are treated as slain at 0 hp
    // unless the world enables full dying rules for them.
    if (Monster.useDyingRules) return super.diesAtZero();
    return !this.specials().some((s) => s.kind === 'ferocity');
  }

  restoreResources() {
    super.restoreResources();
    this.slaUses = {};
    this.cooldowns = {};
  }

  toJSON() {
    return { id: this.id, templateId: this.templateId, name: this.name, hp: this.hp, hpMax: this.hpMax, effects: this.effects, negativeLevels: this.negativeLevels, abilityDamage: this.abilityDamage, abilityDrain: this.abilityDrain, status: this.status, summoned: this.summoned, ownerId: this.ownerId, cooldowns: this.cooldowns, slaUses: this.slaUses };
  }

  statBlock() {
    const d = this.def;
    return {
      id: this.id, templateId: this.templateId, name: this.name, cr: d.cr, xp: this.xpValue(), alignment: d.alignment, size: this.size(), type: d.type, subtypes: d.subtypes,
      init: this.initiative(), senses: d.senses, hp: { current: this.hp.current, max: this.maxHp() }, ...this.acSummary(),
      saves: { fort: this.save('fort').total, ref: this.save('ref').total, will: this.save('will').total },
      speed: d.speed, melee: d.melee, ranged: d.ranged, space: SIZES[this.size()].space, reach: this.reach(),
      abilities: Object.fromEntries(Object.keys(d.abilities).map((a) => [a, this.ability(a)])), bab: d.bab, cmb: this.cmb(), cmd: this.cmd(),
      feats: d.feats, skills: d.skills, languages: d.languages, dr: d.dr, resist: d.resist, immune: d.immune, sr: d.sr || 0,
      special: d.special, spellLike: d.spellLike, description: d.description,
    };
  }
}

Monster.useDyingRules = false;

module.exports = { Monster };
