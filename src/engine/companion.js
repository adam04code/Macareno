'use strict';

const { Monster } = require('./monster');
const { abilityMod } = require('./tables');
const { SIZES } = require('../data/core');
const { COMPANIONS, ADVANCEMENT, companionSpecials } = require('../data/companions');

/**
 * Animal companions: a stat block generated from the base animal and the
 * owner's effective druid level (Core Rulebook advancement table), then run
 * through the regular Monster model so combat treats it like any creature.
 *
 * char.companion = { type, name, hp, status, abilityIncreases: ['str', ...] }
 */

/** Effective druid level for companion advancement, summed from every class feature that grants one. */
function companionLevel(char) {
  return Math.min(20, char.prog('companionLevel'));
}

function buildCompanionDef(type, level, opts = {}) {
  const base = COMPANIONS[type];
  if (!base) throw Object.assign(new Error(`Unknown animal companion ${type}`), { status: 400 });
  const adv = ADVANCEMENT[Math.max(1, Math.min(20, level))];
  const sp = companionSpecials(level);
  const advanced = base.advance && level >= base.advance.level;
  const size = advanced && base.advance.size ? base.advance.size : base.size;
  const abilities = { ...base.abilities };
  if (advanced) for (const [a, v] of Object.entries(base.advance.abilities || {})) abilities[a] += v;
  abilities.str += adv.strDex;
  abilities.dex += adv.strDex;
  for (const a of (opts.abilityIncreases || []).slice(0, sp.abilityIncreases)) abilities[a] = (abilities[a] || 10) + 1;
  for (let i = (opts.abilityIncreases || []).length; i < sp.abilityIncreases; i++) abilities.str += 1;
  const m = (a) => abilityMod(abilities[a]);
  const sizeMod = SIZES[size].mod;
  const finesse = m('dex') > m('str');
  const attacks = advanced && base.advance.attacks ? base.advance.attacks : base.attacks;
  const naturalCount = attacks.reduce((n, a) => n + (a.count || 1), 0);
  const secondaryPen = sp.multiattack ? -2 : -5;
  const melee = attacks.map((a) => {
    const primary = a.primary !== false;
    const atkBonus = adv.bab + (finesse ? m('dex') : m('str')) + sizeMod + (primary ? 0 : secondaryPen);
    const strDmg = naturalCount === 1 ? Math.floor(m('str') * 1.5) : primary ? m('str') : Math.floor(m('str') / 2);
    return { ...a, bonus: atkBonus, damage: `${a.damage}${strDmg > 0 ? `+${strDmg}` : strDmg < 0 ? strDmg : ''}`, primary };
  });
  const conMod = m('con');
  const hpAvg = Math.max(adv.hd, Math.floor(adv.hd * 4.5) + conMod * adv.hd);
  const specials = [...(base.special || []), ...(advanced ? base.advance.special || [] : [])];
  const special = SIZES[size].special;
  return {
    name: opts.name || base.name, cr: '-', alignment: 'N', size, type: 'animal', subtypes: [], speed: base.speed, senses: base.senses || [],
    init: m('dex'), ac: { natural: base.natural + adv.nat }, hp: `${adv.hd}d8+${conMod * adv.hd}`, hpAverage: hpAvg, hd: adv.hd,
    saves: { fort: adv.fort + conMod, ref: adv.ref + m('dex'), will: adv.will + m('wis') + (sp.devotion ? 0 : 0) },
    melee, ranged: [], abilities, bab: adv.bab, cmb: adv.bab + m('str') + special, cmd: 10 + adv.bab + m('str') + m('dex') + special,
    feats: [...(finesse ? ['weapon-finesse'] : []), ...(sp.multiattack && naturalCount >= 3 ? ['multiattack'] : [])], skills: {}, languages: [],
    immune: [], resist: {}, dr: [], weaknesses: [], special: specials, spellLike: [], treasure: 'none',
    companion: { level, evasion: sp.evasion, improvedEvasion: sp.improvedEvasion, devotion: sp.devotion, tricks: adv.tricks, feats: adv.feats, skills: adv.skills, mount: !!base.mount },
    description: `${opts.ownerName ? `${opts.ownerName}'s ` : ''}animal companion (${base.name}, effective druid level ${level}).`,
  };
}

class Companion extends Monster {
  constructor(data, opts) {
    super(data, opts);
    this.kind = 'monster';
    this.isCompanion = true;
  }

  sourceFlags() {
    const out = super.sourceFlags();
    const c = this.def.companion || {};
    if (c.evasion) out.push('evasion');
    if (c.improvedEvasion) out.push('improvedEvasion');
    return out;
  }

  sourceModifiers() {
    const out = super.sourceModifiers();
    if ((this.def.companion || {}).devotion) out.push({ target: 'save.will', value: 4, type: 'morale', source: 'Devotion', onlyIf: ['enchantment'] });
    return out;
  }
}

/** The companion creature for a character (or null). State (hp, status) lives on char.companion. */
function companionFor(char) {
  const data = char.companion;
  const level = companionLevel(char);
  if (!data || level < 1) return null;
  const def = buildCompanionDef(data.type, level, { name: data.name, abilityIncreases: data.abilityIncreases, ownerName: char.name });
  const hpMax = def.hpAverage;
  const hp = data.hp && data.hp.current !== null && data.hp.current !== undefined ? { ...data.hp, current: Math.min(data.hp.current, hpMax) } : { current: hpMax, temp: 0, nonlethal: 0 };
  const c = new Companion({ id: data.id, templateId: `companion:${data.type}`, name: def.name, hp, hpMax, status: data.status || 'alive', ownerId: char.id, effects: data.effects || [] }, { def });
  return c;
}

/** Write the companion's state back to its owner after an encounter. */
function saveCompanion(char, comp) {
  if (!char.companion || !comp) return;
  char.companion.id = comp.id;
  char.companion.hp = { current: comp.hp.current, temp: 0, nonlethal: comp.hp.nonlethal || 0 };
  char.companion.status = comp.status === 'dead' || comp.hpState() === 'dead' ? 'dead' : 'alive';
  char.companion.effects = comp.effects.filter((e) => e.remaining === null && e.kind === 'affliction');
}

module.exports = { Companion, companionFor, saveCompanion, buildCompanionDef, companionLevel };
