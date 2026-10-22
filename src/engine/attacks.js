'use strict';

const dice = require('./dice');
const { defaultRng } = require('./rng');
const { SIZES } = require('../data/core');

const PHYSICAL = ['bludgeoning', 'piercing', 'slashing'];

/** Power Attack / Deadly Aim / Combat Expertise step: 1 + 1 per 4 BAB. */
function featStep(creature) {
  return 1 + Math.floor(creature.bab() / 4);
}

/** Context tags an attack carries (used by conditional modifiers). */
function attackTags(attacker, defender, profile, ctx = {}) {
  const tags = [];
  if (profile.weaponId) tags.push(`weapon:${profile.weaponId}`);
  for (const g of profile.groups || []) tags.push(`group:${g}`);
  if (profile.natural) tags.push('natural');
  if (profile.source === 'weapon') tags.push('weapon');
  if (ctx.distance !== undefined && ctx.distance <= 30) tags.push('within30');
  if (ctx.spellCombat) tags.push('spellCombat');
  if (defender) tags.push(...defender.targetTags(), `id:${defender.id}`);
  return tags;
}

/** Penalties and bonuses that depend on the situation rather than the sheet. */
function situational(attacker, defender, profile, ctx) {
  const parts = [];
  const add = (source, value) => value && parts.push({ source, value });
  if (ctx.iterativePenalty) add('Iterative attack', -ctx.iterativePenalty);
  if (ctx.twfPenalty) add('Two-weapon fighting', ctx.twfPenalty);
  if (ctx.flurryPenalty) add('Flurry of blows', ctx.flurryPenalty);
  if (ctx.rapidShot) add('Rapid Shot', -2);
  if (ctx.spellCombat) add('Spell combat', -2);
  if (ctx.charging) add('Charge', 2);
  if (ctx.flanking) add('Flanking', ctx.flankBonus || 2);
  if (ctx.higherGround) add('Higher ground', 1);
  if (profile.natural && !profile.primary) add('Secondary natural attack', attacker.hasFeat && attacker.hasFeat('multiattack') ? -2 : -5);
  if (profile.natural && profile.primary && ctx.withManufactured && !profile.printed) add('Natural attack with weapons', attacker.hasFeat && attacker.hasFeat('multiattack') ? -2 : -5);
  if (!profile.proficient) add('Nonproficient', -4);
  if (profile.melee && defender && defender.hasFlag('helpless')) add('Helpless target', 4);
  if (attacker.hasFlag('invisible') && defender && !defender.hasFlag('seeInvisible') && !defender.hasFlag('blindFight')) add('Invisible attacker', 2);
  if (ctx.powerAttack && profile.melee) add('Power Attack', -featStep(attacker));
  if (ctx.deadlyAim && profile.ranged) add('Deadly Aim', -featStep(attacker));
  if (profile.ranged && ctx.distance !== undefined && profile.rangeIncrement) {
    const inc = Math.max(0, Math.ceil(ctx.distance / profile.rangeIncrement) - 1);
    add('Range', -inc * (attacker.hasFeat && attacker.hasFeat('far-shot') ? 1 : 2));
  }
  if (profile.ranged && ctx.targetInMelee && !(attacker.hasFeat && attacker.hasFeat('precise-shot'))) add('Firing into melee', -4);
  if (ctx.smite) add('Smite evil', Math.max(0, attacker.abilityMod('cha')));
  if (ctx.arcaneAccuracy) add('Arcane accuracy', Math.max(0, attacker.abilityMod('int')));
  if (profile.ranged && attacker.hasFlag('prone') && !['light-crossbow', 'heavy-crossbow', 'hand-crossbow'].includes(profile.weaponId)) add('Prone (cannot shoot)', -99);
  if (ctx.extra) add(ctx.extra.source || 'Situational', ctx.extra.value || 0);
  return parts;
}

/** Total attack bonus for a profile, with breakdown. */
function attackBonus(attacker, defender, profile, ctx = {}) {
  const tags = attackTags(attacker, defender, profile, ctx);
  const targets = ['attack', profile.ranged ? 'attack.ranged' : 'attack.melee'];
  const parts = [];
  if (profile.printed) {
    parts.push({ source: 'Stat block', value: profile.printedBonus });
    if (ctx.iterBab !== undefined) parts.push({ source: 'Iterative', value: 0 });
    parts.push({ source: `${profile.attackAbility.toUpperCase()} change`, value: attacker.delta(profile.attackAbility) });
  } else {
    const bab = ctx.babOverride !== undefined ? ctx.babOverride : attacker.bab();
    parts.push({ source: 'Base attack bonus', value: bab });
    parts.push({ source: profile.attackAbility.toUpperCase(), value: attacker.abilityMod(profile.attackAbility) });
    parts.push({ source: 'Size', value: SIZES[attacker.size()].mod });
    if (profile.enhancement) parts.push({ source: 'Enhancement', value: profile.enhancement });
    else if (profile.masterwork) parts.push({ source: 'Masterwork', value: 1 });
  }
  const r = attacker.stat(targets, tags);
  parts.push(...r.breakdown.map((b) => ({ source: b.source, value: b.value })));
  parts.push(...situational(attacker, defender, profile, ctx));
  return { total: parts.reduce((s, p) => s + p.value, 0), parts, tags };
}

/** Threat range after keen / Improved Critical (they do not stack). */
function threatRange(attacker, profile) {
  const size = 21 - profile.critRange;
  const improved = profile.keen || (attacker.hasFeat && profile.weaponId && attacker.hasFeat('improved-critical', profile.weaponId));
  return improved ? 21 - size * 2 : profile.critRange;
}

function deniedDexTo(attacker, defender, ctx = {}) {
  if (defender.hasFlag('loseDex')) return !(defender.hasFlag('uncannyDodge') && defender.hasFlag('flat-footed') && !defender.hasFlag('helpless'));
  if (ctx.flatFooted && !defender.hasFlag('uncannyDodge')) return true;
  if (ctx.feinted) return true;
  if (attacker.hasFlag('invisible') && !defender.hasFlag('seeInvisible') && !defender.hasFlag('uncannyDodge') && !defender.hasFlag('blindFight')) return true;
  return false;
}

function missChance(attacker, defender, profile) {
  let pct = 0;
  for (const f of defender.flags()) {
    const m = /^concealment:(\d+)$/.exec(f);
    if (m) pct = Math.max(pct, Number(m[1]));
  }
  if (defender.hasFlag('invisible') && !attacker.hasFlag('seeInvisible') && !attacker.hasFlag('trueSeeing')) pct = Math.max(pct, 50);
  if (attacker.hasFlag('blind')) pct = Math.max(pct, 50);
  if (defender.hasFlag('outlined')) pct = 0;
  // Attacker-side miss chance (storm burst).
  pct = Math.max(pct, attacker.flagValue('attackMissChance') || 0);
  // Ranged-only miss chance (enveloping winds, air barrier).
  if (profile.ranged) pct = Math.max(pct, defender.flagValue('rangedMissChance') || 0);
  if (profile.ranged && attacker.hasFeat && attacker.hasFeat('improved-precise-shot') && pct < 50) pct = 0;
  return pct;
}

/** Does any DR entry stop this attack? Entries are treated as "or" alternatives. */
function drAmount(defender, packet) {
  const drs = defender.dr();
  if (!drs.length) return 0;
  const bypassed = (d) => {
    if (d.onlyRanged && !packet.ranged) return true;
    switch (d.bypass) {
      case '-': return false;
      case 'magic': return !!packet.magic;
      case 'epic': return !!packet.epic;
      case 'bludgeoning': case 'piercing': case 'slashing': return (packet.damageTypes || []).includes(d.bypass);
      case 'good': case 'evil': case 'lawful': case 'chaotic': return (packet.aligned || []).includes(d.bypass);
      case 'silver': return packet.material === 'silver' || packet.material === 'mithral';
      case 'cold iron': return packet.material === 'cold iron';
      case 'adamantine': return packet.material === 'adamantine';
      default: return false;
    }
  };
  // Group by amount: within a group, bypassing any alternative bypasses the group.
  const groups = new Map();
  for (const d of drs) {
    const amt = typeof d.amount === 'function' ? d.amount(0) : d.amount;
    if (!groups.has(amt)) groups.set(amt, []);
    groups.get(amt).push(d);
  }
  let best = 0;
  for (const [amt, list] of groups) {
    const groupBypassed = list.length > 1 ? list.some(bypassed) : bypassed(list[0]);
    if (!groupBypassed) best = Math.max(best, amt);
  }
  return best;
}

/**
 * Apply a list of damage packets to a defender after DR, resistance,
 * immunity and vulnerability. Packet: { amount, type, physical, magic,
 * material, aligned, damageTypes, nonlethal, ranged, untypedDivine }.
 */
function applyDamage(defender, packets, opts = {}) {
  const details = [];
  let physical = 0;
  let physicalMeta = null;
  const energy = [];
  for (const p of packets) {
    if (p.amount <= 0) continue;
    if (p.physical) {
      physical += p.amount;
      physicalMeta = physicalMeta || p;
    } else energy.push(p);
  }
  let total = 0;
  if (physical > 0) {
    let amt = physical;
    if (defender.hasFlag('incorporeal') && !physicalMeta.ghostTouch && !physicalMeta.force) {
      amt = physicalMeta.magic ? Math.floor(amt / 2) : 0;
      details.push({ note: physicalMeta.magic ? 'incorporeal (half damage)' : 'incorporeal (immune to nonmagical attacks)' });
    }
    const dr = drAmount(defender, physicalMeta);
    const reduced = Math.min(amt, dr);
    amt -= reduced;
    if (opts.penetrate) amt += Math.min(reduced, opts.penetrate);
    if (defender.isImmune(physicalMeta.damageTypes || [])) amt = 0;
    details.push({ type: (physicalMeta.damageTypes || ['physical']).join('/'), raw: physical, dr: reduced, dealt: amt, nonlethal: !!physicalMeta.nonlethal });
    total += amt;
    if (amt > 0) {
      const res = defender.takeDamage(amt, { nonlethal: physicalMeta.nonlethal, type: 'physical', minHp: opts.minHp });
      physicalMeta.result = res;
    }
  }
  const resist = defender.resistances();
  const vuln = defender.vulnerabilities();
  for (const p of energy) {
    let amt = p.amount;
    const type = p.type;
    if (type === 'positive' && !defender.isUndead() && !opts.positiveHurtsLiving) {
      details.push({ type, raw: amt, dealt: 0, note: 'positive energy does not harm the living' });
      continue;
    }
    if (type === 'negative' && defender.isUndead()) {
      const healed = defender.heal(amt);
      details.push({ type, raw: amt, dealt: 0, healed, note: 'negative energy heals undead' });
      continue;
    }
    if (defender.isImmune([type]) || (type === 'precision' && defender.isImmune(['critical']))) {
      details.push({ type, raw: amt, dealt: 0, note: 'immune' });
      continue;
    }
    let resisted = 0;
    if (resist[type] === 'half') resisted = Math.ceil(amt / 2);
    else if (resist[type]) resisted = Math.min(amt, Math.max(0, resist[type] - (opts.ignoreResist && type === 'fire' ? opts.ignoreResist : 0)));
    amt -= resisted;
    // Protection from energy style pools.
    const ward = defender.effects.find((e) => e.absorbEnergy && e.energy === type && e.absorbEnergy > 0);
    if (ward && amt > 0) {
      const used = Math.min(ward.absorbEnergy, amt);
      ward.absorbEnergy -= used;
      amt -= used;
      if (ward.absorbEnergy <= 0) defender.removeEffect(ward.id);
    }
    if (vuln.includes(type)) amt = Math.floor(amt * 1.5);
    if (defender.hasFlag('incorporeal') && type !== 'force' && !p.ghostTouch) amt = Math.floor(amt / 2);
    details.push({ type, raw: p.amount, resisted, dealt: amt });
    total += amt;
    if (amt > 0) defender.takeDamage(amt, { nonlethal: type === 'nonlethal' || p.nonlethal, type, minHp: opts.minHp });
  }
  // Absorbing wards (stoneskin) against physical damage are modelled as DR; deplete the pool.
  const absorbing = defender.effects.find((e) => e.absorb && e.dr);
  if (absorbing && physical > 0) {
    absorbing.absorb -= Math.min(physical, drAmount(defender, physicalMeta || {}));
    if (absorbing.absorb <= 0) defender.removeEffect(absorbing.id);
  }
  return { total, details, state: defender.hpState() };
}

/** Roll the weapon's damage packets for one hit. */
function rollDamage(attacker, defender, profile, ctx, crit) {
  const rng = ctx.rng || defaultRng;
  const tags = attackTags(attacker, defender, profile, ctx);
  const mult = crit ? (profile.critMult + (ctx.weaponMastery ? 1 : 0)) : 1;
  let diceExpr = profile.damageDice;
  if (ctx.vitalStrike) diceExpr = dice.scaleDiceCount(diceExpr, ctx.vitalStrike);
  let staticBonus = 0;
  const parts = [];
  if (profile.printed) {
    staticBonus += attacker.delta('str') * (profile.ranged ? 0 : 1);
  } else {
    const str = attacker.abilityMod('str');
    if (profile.damageAbilityMult > 0 || str < 0) {
      const m = str < 0 ? 1 : profile.damageAbilityMult;
      const fromStr = Math.floor(str * m);
      if (!(profile.ranged && !profile.thrown && str > 0 && profile.damageAbilityMult === 0)) staticBonus += fromStr;
      parts.push({ source: 'Str', value: fromStr });
    }
    if (ctx.dervish) staticBonus += Math.max(0, attacker.abilityMod('dex') - Math.max(0, str));
    staticBonus += profile.enhancement || 0;
  }
  const r = attacker.stat(['damage', profile.ranged ? 'damage.ranged' : 'damage.melee'], tags);
  staticBonus += r.total;
  if (ctx.powerAttack && profile.melee) {
    const step = featStep(attacker);
    const per = profile.twoHanded ? 3 : profile.offHand || (profile.natural && !profile.primary) ? 1 : 2;
    staticBonus += step * per;
    parts.push({ source: 'Power Attack', value: step * per });
  }
  if (ctx.deadlyAim && profile.ranged) staticBonus += featStep(attacker) * 2;
  if (ctx.arcaneStrike) staticBonus += 1 + Math.floor(attacker.casterLevel() / 5);
  // Base damage, rolled once per multiplier (critical hits).
  let base = 0;
  const rolls = [];
  for (let i = 0; i < mult; i++) {
    const d = dice.roll(diceExpr, rng);
    rolls.push(d);
    base += d.total + staticBonus;
  }
  base = Math.max(1, base);
  const packets = [{
    amount: base, physical: true, damageTypes: profile.damageTypes, magic: profile.magic || attacker.hasFlag('weaponMagic') || ctx.arcaneStrike || ctx.smite,
    material: profile.material, aligned: [...(profile.aligned || []), ...(attacker.hasFlag('weaponsGood') ? ['good'] : []), ...(ctx.smite ? ['good', 'evil', 'lawful', 'chaotic'] : [])],
    nonlethal: profile.nonlethal && !ctx.lethal, ranged: profile.ranged, ghostTouch: profile.ghostTouch,
  }];
  // Precision damage (not multiplied on a crit, not vs crit-immune creatures).
  let precision = 0;
  const precisionImmune = defender.isImmune(['precision', 'critical']);
  if (ctx.sneakAttackDice && !precisionImmune) precision += dice.total(`${ctx.sneakAttackDice}d6`, rng);
  if (ctx.preciseStrike && !precisionImmune) precision += ctx.preciseStrike;
  if (precision) packets[0].amount += precision;
  if (ctx.smite) packets[0].amount += ctx.smiteDamage || 0;
  // Extra energy damage (flaming, frost, energy riders, bloodline claws).
  for (const ex of profile.extraDamage || []) {
    packets.push({ amount: dice.total(ex.dice, rng), type: ex.type });
  }
  // Bonus damage dice granted by effects (bane, judgments, studied target...): weapon damage or a separate energy packet.
  for (const e of attacker.effects || []) {
    for (const b of e.bonusDamage || []) {
      if (b.melee && !profile.melee) continue;
      if (b.weaponOnly && profile.source !== 'weapon') continue;
      if (b.onlyIf && !b.onlyIf.some((t) => tags.includes(t))) continue;
      if (b.precision && precisionImmune) continue;
      const amt = dice.total(b.dice, rng) * (b.multiplies && !b.precision ? mult : 1);
      if (!b.type || b.type === 'weapon') packets[0].amount += amt;
      else packets.push({ amount: amt, type: b.type });
    }
  }
  if (ctx.teamworkPrecision && !precisionImmune) packets[0].amount += dice.total(`${ctx.teamworkPrecision}d6`, rng);
  if (crit) {
    for (const sp of profile.burst ? [profile.burst] : []) packets.push({ amount: dice.total(`${Math.max(1, mult - 1)}d10`, rng), type: sp.type });
  }
  for (const ad of profile.alignedDamage || []) {
    if (defender.axes()[ad.vs === 'chaotic' ? 'chaotic' : ad.vs === 'lawful' ? 'lawful' : ad.vs]) packets.push({ amount: dice.total(ad.dice, rng), type: 'untyped' });
  }
  return { packets, rolls, staticBonus, precision, mult };
}

/**
 * Resolve one attack roll end-to-end.
 * ctx: { rng, iterativePenalty, babOverride, twfPenalty, flurryPenalty, powerAttack, deadlyAim, flanking, charging,
 *        distance, targetInMelee, sneakAttackDice, preciseStrike, smite, touch, flatFooted, vitalStrike, rapidShot }
 */
function resolveAttack(attacker, defender, profile, ctx = {}) {
  const rng = ctx.rng || defaultRng;
  const ab = attackBonus(attacker, defender, profile, ctx);
  const denied = deniedDexTo(attacker, defender, ctx);
  const touch = ctx.touch || profile.touch || attacker.hasFlag('attacksVsTouch');
  const acTags = [profile.ranged ? 'vsRanged' : 'vsMelee', ...attacker.targetTags(), `attacker:${attacker.id}`];
  if (ctx.aooMovement) acTags.push('aooMovement');
  if (ctx.trap) acTags.push('trap');
  const ac = defender.ac({ tags: acTags, touch, deniedDex: denied, flatFooted: ctx.flatFooted }).total;
  const out = { attacker: attacker.id, defender: defender.id, attack: profile.name, bonus: ab.total, ac, touch: !!touch };
  // Sanctuary: attacker must make a Will save or lose the attack.
  const sanct = defender.effects.find((e) => (e.flags || []).includes('sanctuary'));
  if (sanct && sanct.data && sanct.data.dc) {
    const s = require('./checks').savingThrow(attacker, 'will', { dc: sanct.data.dc, rng });
    if (!s.success) return { ...out, hit: false, note: 'Sanctuary', save: s };
  }
  const roll = require('./checks').creatureD20(attacker, rng);
  const total = roll + ab.total;
  out.roll = roll;
  out.total = total;
  let hit = roll === 20 || (roll !== 1 && total >= ac);
  if (ctx.autoHit) hit = true;
  out.hit = hit;
  if (!hit) return out;
  // Concealment / invisibility miss chance.
  const mc = missChance(attacker, defender, profile);
  if (mc) {
    let pct = rng.die(100);
    if (pct <= mc && attacker.hasFeat && attacker.hasFeat('blind-fight') && profile.melee) pct = rng.die(100);
    out.missChance = { percent: mc, roll: pct };
    if (pct <= mc) {
      out.hit = false;
      out.note = 'miss (concealment)';
      return out;
    }
  }
  // Mirror image.
  const mi = defender.effects.find((e) => e.images > 0);
  if (mi) {
    const pick = rng.die(mi.images + 1);
    if (pick <= mi.images) {
      mi.images -= 1;
      if (mi.images <= 0) defender.removeEffect(mi.id);
      out.hit = false;
      out.note = 'struck a mirror image';
      return out;
    }
  }
  // Critical threat & confirmation.
  const tr = threatRange(attacker, profile);
  let crit = false;
  if (roll >= tr && !defender.isImmune(['critical']) && !defender.hasFlag('immuneCrit')) {
    const confirmBonus = ab.total + attacker.stat('critConfirm').total;
    const croll = rng.die(20);
    const confirmed = ctx.autoConfirm || croll === 20 || (croll !== 1 && croll + confirmBonus >= ac);
    out.threat = { roll: croll, total: croll + confirmBonus, confirmed };
    if (confirmed) {
      const fort = defender.fortification ? defender.fortification() : 0;
      if (fort && rng.die(100) <= fort) out.threat.fortified = true;
      else crit = true;
    }
  }
  out.critical = crit;
  const dmg = rollDamage(attacker, defender, profile, ctx, crit);
  if (ctx.sneakAttackDice && defender.fortification && defender.fortification() && rng.die(100) <= defender.fortification()) {
    dmg.packets[0].amount -= dmg.precision;
    out.note = 'fortification negated precision damage';
  }
  const applied = applyDamage(defender, dmg.packets);
  out.damage = applied.total;
  out.damageDetails = applied.details;
  out.sneakAttack = dmg.precision || 0;
  out.targetState = applied.state;
  return out;
}

module.exports = { resolveAttack, attackBonus, applyDamage, rollDamage, threatRange, deniedDexTo, missChance, drAmount, featStep, attackTags, PHYSICAL };
