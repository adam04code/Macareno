'use strict';

const dice = require('./dice');
const { defaultRng } = require('./rng');
const checks = require('./checks');
const { makeEffect, conditionEffect } = require('./effects');
const { applyDamage } = require('./attacks');
const { SIZES, ENERGY_TYPES } = require('../data/core');
const { SPELLS } = require('../data/spells');

/**
 * Resolve a spell's mechanical effect against its targets.
 *
 * resolveSpell({ caster, spell, cl, dc, targets, rng, metamagic, options, encounter, slotLevel })
 *   targets: creatures (already validated for range/area by the caller)
 *   options: { energy, condition, creature (summon), point, ... }
 * Returns { spell, results: [ per-target result ], summons, teleport, notes }.
 */

function evalDice(fnOrExpr, cl) {
  if (typeof fnOrExpr === 'function') return String(fnOrExpr(cl));
  return String(fnOrExpr);
}

/** Roll a spell's variable numbers with Empower/Maximize. */
function rollVariable(expr, metamagic, rng) {
  const mm = metamagic || [];
  const maximize = mm.includes('maximize-spell');
  const empower = mm.includes('empower-spell');
  if (maximize && empower) return dice.max(expr) + Math.floor(dice.total(expr, rng) / 2);
  if (maximize) return dice.max(expr);
  const r = dice.total(expr, rng);
  return empower ? Math.floor(r * 1.5) : r;
}

function durationRounds(spell, eff, cl, metamagic, rng) {
  let d = eff.duration;
  if (d === undefined) return null;
  if (typeof d === 'function') d = d(cl);
  else if (typeof d === 'string') d = dice.total(d, rng);
  if (d === null) return null;
  if ((metamagic || []).includes('extend-spell')) d *= 2;
  return d;
}

function spellTags(spell) {
  return ['spell', spell.school, ...(spell.subschool ? [spell.subschool] : []), ...(spell.descriptors || [])];
}

function isAlly(a, b, encounter) {
  if (a.id === b.id) return true;
  if (encounter) return encounter.sideOf(a.id) === encounter.sideOf(b.id);
  return false;
}

function typeAllowed(target, eff) {
  if (eff.typeLimit && !eff.typeLimit.includes(target.creatureType())) return false;
  if (eff.livingOnly && !target.isLiving()) return false;
  return true;
}

function matchesOnlyVs(target, list) {
  if (!list) return true;
  return list.some((t) => {
    if (t === 'undead') return target.isUndead();
    if (t === 'evil') return target.axes().evil;
    if (t === 'good') return target.axes().good;
    if (t === 'crystalline') return (target.subtypes() || []).includes('crystalline') || target.creatureType() === 'construct';
    if (t === 'evil-outsider') return target.creatureType() === 'outsider' && target.axes().evil;
    return target.creatureType() === t;
  });
}

function doSave(target, eff, dc, spell, rng, extraTags = []) {
  if (!eff.save) return null;
  const tags = [...spellTags(spell), ...extraTags];
  let circumstance = 0;
  if (eff.arcanePenalty && target.casterClasses && target.casterClasses().some((id) => require('../data/classes').CLASSES[id].spellcasting.tradition === 'arcane')) circumstance += eff.arcanePenalty;
  return checks.savingThrow(target, eff.save.type, { dc, tags, rng, circumstance });
}

function touchAttack(caster, target, kind, rng, bonusExtra = 0) {
  const ranged = kind === 'rangedTouch' || kind === 'ranged';
  const bab = caster.bab();
  const ab = ranged ? caster.abilityMod('dex') : caster.abilityMod('str');
  const sizeMod = SIZES[caster.size()].mod;
  const mods = caster.stat(['attack', ranged ? 'attack.ranged' : 'attack.melee']).total;
  const bonus = bab + ab + sizeMod + mods + bonusExtra;
  const touch = kind !== 'ranged';
  const ac = target.ac({ touch, tags: [ranged ? 'vsRanged' : 'vsMelee', ...caster.targetTags()] }).total;
  const roll = rng.die(20);
  const hit = roll === 20 || (roll !== 1 && roll + bonus >= ac);
  let crit = false;
  if (roll === 20 && !target.isImmune(['critical'])) {
    const c = rng.die(20);
    crit = c === 20 || c + bonus >= ac;
  }
  return { roll, bonus, total: roll + bonus, ac, hit, crit };
}

/** Deal spell damage to one target, handling save-for-half, evasion and energy. */
function dealSpellDamage(ctx, target, amount, energy, saveRes, eff) {
  let amt = amount;
  let note;
  if (saveRes && eff.save) {
    const evasion = eff.save.type === 'ref' && target.hasFlag('evasion');
    const improved = eff.save.type === 'ref' && target.hasFlag('improvedEvasion');
    if (saveRes.success) {
      if (eff.save.effect === 'half') amt = evasion ? 0 : Math.floor(amt / 2);
      else if (eff.save.effect === 'negates') amt = 0;
      if (evasion && eff.save.effect === 'half') note = 'evasion';
    } else if (improved && eff.save.effect === 'half') {
      amt = Math.floor(amt / 2);
      note = 'improved evasion';
    }
  }
  const packets = [];
  if (eff.halfUntyped) {
    packets.push({ amount: Math.ceil(amt / 2), type: energy });
    packets.push({ amount: Math.floor(amt / 2), type: 'untyped' });
  } else if (PHYSICAL_TYPES.includes(energy)) {
    packets.push({ amount: amt, physical: true, damageTypes: [energy], magic: true });
  } else {
    packets.push({ amount: amt, type: energy || 'untyped', nonlethal: eff.nonlethal });
  }
  const res = applyDamage(target, packets, { minHp: eff.minHp, positiveHurtsLiving: false });
  return { damage: res.total, details: res.details, state: res.state, note };
}

const PHYSICAL_TYPES = ['bludgeoning', 'piercing', 'slashing'];

const HANDLERS = {
  utility(ctx) {
    const { spell } = ctx;
    return { results: [], notes: [spell.description] };
  },

  damage(ctx, eff) {
    const { caster, targets, cl, dc, spell, rng, metamagic } = ctx;
    const results = [];
    const count = eff.count ? eff.count(cl) : 1;
    const perHit = eff.attack || eff.autoHit || eff.perMissile;
    // Missiles/rays: distribute `count` hits across targets in order (wrapping).
    const assignments = perHit ? Array.from({ length: count }, (_, i) => targets[i % targets.length]) : targets;
    const intense = caster.hasFlag && caster.hasFlag('intenseSpells') && spell.school === 'evocation' ? Math.max(1, Math.floor(caster.classLevel('wizard') / 2)) : 0;
    let intenseUsed = false;
    const srCache = new Map();
    for (const target of assignments) {
      if (!target || !target.isAlive()) continue;
      const r = { target: target.id, name: target.name };
      if (!typeAllowed(target, eff) || !matchesOnlyVs(target, eff.onlyVs)) {
        r.note = 'unaffected';
        results.push(r);
        continue;
      }
      if (target.hasFlag('blocksMagicMissile') && spell.id === 'magic-missile') {
        r.note = 'blocked by shield';
        results.push(r);
        continue;
      }
      if (spell.sr) {
        if (!srCache.has(target.id)) srCache.set(target.id, checks.spellResistance(caster, target, { rng }));
        const sr = srCache.get(target.id);
        if (sr.blocked) {
          r.spellResistance = sr;
          r.note = 'spell resistance';
          results.push(r);
          continue;
        }
      }
      let critMult = 1;
      if (eff.attack) {
        const bonusVsMetal = eff.bonusVsMetal && target.armorType && ['medium', 'heavy'].includes(target.armorType()) ? eff.bonusVsMetal : 0;
        const atk = touchAttack(caster, target, eff.attack, rng, bonusVsMetal);
        r.attack = atk;
        if (!atk.hit) {
          r.note = 'missed';
          results.push(r);
          continue;
        }
        if (atk.crit) critMult = 2;
      }
      const diceExpr = target.isUndead() && eff.vsUndead ? evalDice(eff.vsUndead, cl) : evalDice(eff.dice, cl);
      let amount = rollVariable(diceExpr, metamagic, rng) * critMult;
      if (intense && !intenseUsed) {
        amount += intense;
        if (perHit) intenseUsed = true;
      }
      if (ctx.bloodlineEnergyBonus && eff.energy === ctx.bloodlineEnergyBonus.energy) amount += ctx.bloodlineEnergyBonus.perDie * diceCount(diceExpr);
      if (ctx.surpriseSneak && target.hasFlag('loseDex')) amount += dice.total(`${ctx.surpriseSneak}d6`, rng);
      let saveRes = null;
      if (eff.save && !perHit || (eff.save && eff.attack)) saveRes = doSave(target, eff, dc, spell, rng, eff.tags || []);
      r.save = saveRes;
      if (saveRes && saveRes.success && eff.save.effect === 'partial' && eff.onSaveDice) amount = rollVariable(evalDice(eff.onSaveDice, cl), metamagic, rng);
      const dealt = dealSpellDamage(ctx, target, amount, eff.energy, eff.save && eff.save.effect === 'partial' ? null : saveRes, eff);
      Object.assign(r, dealt);
      if (eff.drain && dealt.damage > 0) {
        caster.addTempHp(dealt.damage, `spell:${spell.id}`);
        r.casterTempHp = dealt.damage;
      }
      if (eff.disintegrate && target.hp.current <= 0) {
        target.die();
        r.note = 'reduced to dust';
      }
      if (eff.abilityDamage && target.isAlive()) {
        const ad = eff.abilityDamage;
        const s = ad.save ? doSave(target, { save: ad.save }, dc, spell, rng) : null;
        if (!s || !s.success) for (const [a, v] of Object.entries(ad)) if (a !== 'save') target.abilityDamage[a] = (target.abilityDamage[a] || 0) + (typeof v === 'number' ? v : dice.total(v, rng));
        target.touch();
      }
      if (eff.abilityDrain && target.isAlive()) {
        for (const [a, v] of Object.entries(eff.abilityDrain)) target.abilityDrain[a] = (target.abilityDrain[a] || 0) + dice.total(v, rng);
        target.touch();
      }
      if (eff.applyCondition && target.isAlive()) {
        const ac = eff.applyCondition;
        let apply = true;
        if (ac.onlyOnFailedSave && saveRes && saveRes.success) apply = false;
        if (ac.save) {
          const s = doSave(target, { save: ac.save }, dc, spell, rng);
          r.conditionSave = s;
          if (s.success) apply = false;
        }
        if (apply) {
          const rounds = ac.duration === null ? null : typeof ac.duration === 'string' ? dice.total(ac.duration, rng) : ac.duration;
          if (target.addCondition(ac.condition, rounds, { id: caster.id, name: spell.name })) r.condition = ac.condition;
        }
      }
      if (eff.ongoing && target.isAlive()) {
        const rounds = eff.ongoing.rounds(cl);
        if (rounds > 0) target.addEffect(makeEffect({ key: `spell:${spell.id}:ongoing`, name: spell.name, sourceId: caster.id, remaining: rounds, ongoing: { dice: eff.ongoing.dice, type: eff.ongoing.type, rounds } }));
      }
      if (eff.ongoingSpell && target.isAlive()) {
        const rounds = eff.ongoingSpell.rounds(cl) - 1;
        if (rounds > 0) target.addEffect(makeEffect({ key: `spell:${spell.id}:ongoing`, name: spell.name, sourceId: caster.id, remaining: rounds, ongoing: { dice: evalDice(eff.dice, cl), type: eff.energy, rounds, save: eff.save ? { type: eff.save.type, dc, effect: eff.save.effect } : null } }));
      }
      results.push(r);
    }
    // Chain lightning: secondary targets take half.
    if (eff.chain && targets.length > 1) {
      for (const r of results.slice(1)) r.note = (r.note ? `${r.note}; ` : '') + 'secondary target';
    }
    return { results };
  },

  heal(ctx, eff) {
    const { caster, targets, cl, spell, rng, metamagic, dc } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      if (eff.revivesFreshlyDead && target.status === 'dead' && target.diedAt && Date.now() - target.diedAt <= 6000 * eff.revivesFreshlyDead) {
        target.status = 'alive';
        target.hp.current = 0;
        target.touch();
        r.revived = true;
      }
      if (!target.isAlive()) {
        r.note = 'dead';
        results.push(r);
        continue;
      }
      let amount = rollVariable(evalDice(eff.dice, cl), metamagic, rng);
      if (caster.hasFlag && caster.hasFlag('healersBlessing') && spell.id.startsWith('cure')) amount = Math.floor(amount * 1.5);
      if (target.isUndead() && eff.harmsUndead) {
        if (spell.sr) {
          const sr = checks.spellResistance(caster, target, { rng });
          if (sr.blocked) {
            r.note = 'spell resistance';
            results.push(r);
            continue;
          }
        }
        const s = doSave(target, eff, dc, spell, rng);
        r.save = s;
        if (s && s.success) amount = Math.floor(amount / 2);
        const res = applyDamage(target, [{ amount, type: 'positive' }], { positiveHurtsLiving: false });
        r.damage = res.total;
        r.state = res.state;
      } else if (!target.isUndead() || !eff.harmsUndead) {
        r.healed = target.heal(amount);
      }
      results.push(r);
    }
    return { results };
  },

  inflict(ctx, eff) {
    const { caster, targets, cl, spell, rng, metamagic, dc } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      let amount = rollVariable(evalDice(eff.dice, cl), metamagic, rng);
      if (target.isUndead() && eff.healsUndead) {
        r.healed = target.heal(amount);
        results.push(r);
        continue;
      }
      if (eff.attack && !isAlly(caster, target, ctx.encounter)) {
        const atk = touchAttack(caster, target, eff.attack, rng);
        r.attack = atk;
        if (!atk.hit) {
          r.note = 'missed';
          results.push(r);
          continue;
        }
        if (atk.crit) amount *= 2;
      }
      if (spell.sr) {
        const sr = checks.spellResistance(caster, target, { rng });
        if (sr.blocked) {
          r.note = 'spell resistance';
          results.push(r);
          continue;
        }
      }
      const s = doSave(target, eff, dc, spell, rng, ['death']);
      r.save = s;
      if (s && s.success) amount = Math.floor(amount / 2);
      const res = applyDamage(target, [{ amount, type: 'negative' }], { minHp: eff.minHp });
      r.damage = res.total;
      r.state = res.state;
      results.push(r);
    }
    return { results };
  },

  buff(ctx, eff) {
    const { caster, targets, cl, spell, rng, metamagic, options } = ctx;
    const results = [];
    const rounds = durationRounds(spell, eff, cl, metamagic, rng);
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      if (!typeAllowed(target, eff)) {
        r.note = 'unaffected';
        results.push(r);
        continue;
      }
      const energy = options.energy && ENERGY_TYPES.includes(options.energy) ? options.energy : eff.energy || 'fire';
      const fields = {
        key: `spell:${spell.id}`, name: spell.name, kind: 'spell', sourceId: caster.id, sourceName: caster.name, remaining: rounds,
        modifiers: eff.modifiers ? eff.modifiers(cl, caster, spell.name) : [], flags: [...(eff.flags || [])], cl, school: spell.school,
      };
      if (eff.sizeChange) fields.sizeChange = eff.sizeChange;
      if (eff.sizeChange === 1) fields.modifiers.push(...sizeAdjust(1, spell.name));
      if (eff.sizeChange === -1) fields.modifiers.push(...sizeAdjust(-1, spell.name));
      if (eff.dr) fields.dr = [{ amount: typeof eff.dr.amount === 'function' ? eff.dr.amount(cl) : eff.dr.amount, bypass: eff.dr.bypass, onlyRanged: eff.dr.onlyRanged }];
      if (eff.absorb) fields.absorb = eff.absorb(cl);
      if (eff.resist) fields.resist = { [energy]: eff.resist(cl) };
      if (eff.absorbEnergy) Object.assign(fields, { absorbEnergy: eff.absorbEnergy(cl), energy });
      if (eff.images) fields.images = dice.total(eff.images(cl), rng);
      if (eff.sr) fields.sr = eff.sr(cl);
      if (eff.reflect) fields.reflect = { dice: eff.reflect.dice(cl), type: eff.reflect.type };
      if (eff.breaksOnAttack) fields.breaksOnAttack = true;
      if (eff.dischargeOnAttack) fields.dischargeOnAttack = true;
      if (spell.id === 'sanctuary') fields.data = { dc: ctx.dc };
      const added = target.addEffect(makeEffect(fields));
      if (eff.tempHp && added) {
        const t = rollVariable(evalDice(eff.tempHp, cl), metamagic, rng);
        target.addTempHp(t, `spell:${spell.id}`);
        r.tempHp = t;
      }
      r.effect = added ? added.name : null;
      r.rounds = rounds;
      results.push(r);
    }
    return { results };
  },

  condition(ctx, eff) {
    const { caster, targets, cl, dc, spell, rng, metamagic } = ctx;
    const results = [];
    let hdPool = eff.hdPool ? dice.total(evalDice(eff.hdPool, cl), rng) : Infinity;
    // HD-limited spells (sleep, hypnotism) affect the lowest-HD creatures first.
    const ordered = eff.hdPool ? [...targets].sort((a, b) => a.hitDice() - b.hitDice()) : targets;
    for (const target of ordered) {
      const r = { target: target.id, name: target.name };
      if (!target.isAlive()) continue;
      if (!typeAllowed(target, eff)) {
        r.note = 'unaffected (creature type)';
        results.push(r);
        continue;
      }
      if (eff.hdLimit && target.hitDice() > eff.hdLimit) {
        r.note = `unaffected (more than ${eff.hdLimit} HD)`;
        results.push(r);
        continue;
      }
      if (eff.maxHdEach && target.hitDice() > eff.maxHdEach) {
        r.note = 'unaffected (too many HD)';
        results.push(r);
        continue;
      }
      if (eff.hdPool) {
        if (target.hitDice() > hdPool) {
          r.note = 'unaffected (HD pool exhausted)';
          results.push(r);
          continue;
        }
        hdPool -= target.hitDice();
      }
      const tags = [...spellTags(spell), ...(eff.tags || [])];
      if (target.isImmune(tags.filter((t) => ['mind-affecting', 'sleep', 'fear', 'paralysis', 'charm', 'compulsion', 'death', 'poison'].includes(t)))) {
        r.note = 'immune';
        results.push(r);
        continue;
      }
      if (eff.attack) {
        const atk = touchAttack(caster, target, eff.attack, rng);
        r.attack = atk;
        if (!atk.hit) {
          r.note = 'missed';
          results.push(r);
          continue;
        }
      }
      if (spell.sr && !isAlly(caster, target, ctx.encounter)) {
        const sr = checks.spellResistance(caster, target, { rng });
        if (sr.blocked) {
          r.note = 'spell resistance';
          results.push(r);
          continue;
        }
      }
      const s = doSave(target, eff, dc, spell, rng, eff.tags || []);
      r.save = s;
      let condition = eff.condition;
      let rounds = durationRounds(spell, eff, cl, metamagic, rng);
      if (s && s.success) {
        if (eff.onSave) {
          condition = eff.onSave.condition;
          rounds = eff.onSave.duration;
        } else {
          r.note = 'saved';
          results.push(r);
          continue;
        }
      }
      const fx = conditionEffect(condition, rounds, { id: caster.id, name: spell.name });
      fx.key = `spell:${spell.id}:${condition}`;
      fx.name = `${spell.name} (${condition})`;
      fx.cl = cl;
      fx.school = spell.school;
      fx.tags = [...(fx.tags || []), ...(eff.tags || [])];
      if (eff.saveEachRound && eff.save) fx.saveEachRound = { type: eff.save.type, dc };
      if (eff.wakeOnDamage) fx.wakeOnDamage = true;
      if (eff.extraConditions && !(s && s.success)) fx.conditions.push(...eff.extraConditions);
      if (eff.alsoOutline) fx.flags = [...(fx.flags || []), 'outlined'];
      if (condition === 'feebleminded') fx.modifiers = [{ target: 'int', value: -100, type: 'untyped', source: spell.name }, { target: 'cha', value: -100, type: 'untyped', source: spell.name }];
      if (condition === 'laughing') fx.flags = ['noActions', 'prone'];
      if (condition === 'charmed' || condition === 'dominated' || condition === 'suggested') fx.data = { controller: caster.id };
      if (condition === 'polymorphed-animal') fx.flags = ['noCast', 'polymorphed'];
      if (condition === 'silenced') fx.flags = ['silenced'];
      const added = target.addEffect(fx);
      r.condition = added ? condition : null;
      if (!added) r.note = 'immune';
      r.rounds = rounds;
      results.push(r);
    }
    return { results };
  },

  debuff(ctx, eff) {
    const { caster, targets, cl, dc, spell, rng, metamagic } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      if (eff.attack) {
        const atk = touchAttack(caster, target, eff.attack, rng);
        r.attack = atk;
        if (!atk.hit) {
          r.note = 'missed';
          results.push(r);
          continue;
        }
      }
      if (spell.sr) {
        const sr = checks.spellResistance(caster, target, { rng });
        if (sr.blocked) {
          r.note = 'spell resistance';
          results.push(r);
          continue;
        }
      }
      const s = doSave(target, eff, dc, spell, rng, eff.tags || []);
      r.save = s;
      if (s && s.success && eff.save.effect === 'negates') {
        r.note = 'saved';
        results.push(r);
        continue;
      }
      const rounds = durationRounds(spell, eff, cl, metamagic, rng);
      let modifiers = eff.modifiers ? eff.modifiers(cl, caster, spell.name) : [];
      if (eff.penaltyDice) {
        let p = rollVariable(evalDice(eff.penaltyDice, cl), metamagic, rng);
        if (s && s.success && eff.save.effect === 'half') p = Math.floor(p / 2);
        modifiers = [{ target: eff.penaltyTarget, value: -p, type: 'untyped', source: spell.name }];
        r.penalty = p;
      }
      const fx = makeEffect({ key: `spell:${spell.id}`, name: spell.name, sourceId: caster.id, remaining: rounds, modifiers, flags: eff.flags || [], conditions: eff.conditions || [], tags: eff.tags || [], cl, school: spell.school });
      r.effect = target.addEffect(fx) ? spell.name : null;
      r.rounds = rounds;
      results.push(r);
    }
    return { results };
  },

  remove(ctx, eff) {
    const { targets, rng } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name, removed: [] };
      if (eff.conditions) r.removed.push(...target.removeConditions(eff.conditions).map((e) => e.name));
      if (eff.exhaustedToFatigued) {
        const ex = target.effects.find((e) => (e.conditions || []).includes('exhausted'));
        if (ex) {
          ex.conditions = ['fatigued'];
          ex.name = 'Fatigued';
          target.touch();
          r.removed.push('exhausted (now fatigued)');
        }
      }
      if (eff.tags) r.removed.push(...target.removeEffectsWhere((e) => (e.tags || []).some((t) => eff.tags.includes(t)) || (e.kind === 'affliction' && eff.tags.includes(e.afflictionType))).map((e) => e.name));
      if (eff.negativeLevels === 'temporary' && target.negativeLevels.temporary) {
        r.removed.push(`${target.negativeLevels.temporary} negative levels`);
        target.negativeLevels.temporary = 0;
      }
      if (eff.abilityDamage) {
        for (const a of Object.keys(target.abilityDamage)) {
          const heal = eff.abilityDamage === 'all' ? target.abilityDamage[a] : dice.total(eff.abilityDamage, rng);
          target.abilityDamage[a] = Math.max(0, target.abilityDamage[a] - heal);
        }
      }
      if (eff.abilityDrain) for (const a of Object.keys(target.abilityDrain)) target.abilityDrain[a] = Math.max(0, target.abilityDrain[a] - eff.abilityDrain);
      target.touch();
      results.push(r);
    }
    return { results };
  },

  dispel(ctx, eff) {
    const { cl, targets, rng } = ctx;
    const results = [];
    const bonus = Math.min(cl, eff.maxBonus || 10);
    for (const target of targets) {
      const r = { target: target.id, name: target.name, dispelled: [] };
      const spells = target.effects.filter((e) => e.kind === 'spell' || (e.key || '').startsWith('spell:')).sort((a, b) => (b.cl || 0) - (a.cl || 0));
      for (const e of spells) {
        const roll = rng.die(20) + bonus;
        if (roll >= 11 + (e.cl || 1)) {
          target.removeEffect(e.id);
          r.dispelled.push(e.name);
          if (!eff.multiple) break;
        }
      }
      results.push(r);
    }
    return { results };
  },

  summon(ctx, eff) {
    const { SUMMON_TABLES } = require('../data/spells');
    const { BESTIARY } = require('../data/bestiary');
    const { Monster } = require('./monster');
    const table = SUMMON_TABLES[eff.table] || [];
    const lower = Object.entries(SUMMON_TABLES).filter(([lvl]) => Number(lvl) < eff.table).flatMap(([, ids]) => ids);
    let id = ctx.options.creature;
    let count = 1;
    if (id && !table.includes(id)) {
      if (!lower.includes(id)) throw Object.assign(new Error(`${id} cannot be summoned with this spell`), { status: 400 });
      // One list lower: 1d3 creatures; two or more lower: 1d4+1.
      const lvl = Number(Object.entries(SUMMON_TABLES).find(([, ids]) => ids.includes(id))[0]);
      count = eff.table - lvl === 1 ? dice.total('1d3', ctx.rng) : dice.total('1d4+1', ctx.rng);
    }
    if (!id) id = ctx.rng.pick(table.filter((x) => BESTIARY[x]));
    const rounds = durationRounds(ctx.spell, { duration: (cl) => cl }, ctx.cl, ctx.metamagic, ctx.rng);
    const summons = [];
    for (let i = 0; i < count; i++) {
      const m = new Monster({ templateId: id, summoned: true, ownerId: ctx.caster.id });
      if (ctx.caster.hasFeat && ctx.caster.hasFeat('augment-summoning')) m.addEffect(makeEffect({ key: 'augment-summoning', name: 'Augment Summoning', modifiers: [{ target: 'str', value: 4, type: 'enhancement', source: 'Augment Summoning' }, { target: 'con', value: 4, type: 'enhancement', source: 'Augment Summoning' }] }));
      m.summonRounds = rounds;
      summons.push(m);
    }
    return { results: [], summons, notes: [`${summons.length} ${summons[0] ? summons[0].name : id} summoned for ${rounds} rounds`] };
  },

  revive(ctx, eff) {
    const results = [];
    for (const target of ctx.targets) {
      const r = { target: target.id, name: target.name };
      if (target.status !== 'dead') {
        r.note = 'not dead';
        results.push(r);
        continue;
      }
      target.status = 'alive';
      target.diedAt = null;
      target.stable = false;
      if (eff.negativeLevels) {
        if (target.hitDice() <= 1 && eff.negativeLevels) {
          target.abilityDrain.con = (target.abilityDrain.con || 0) + 2;
          r.note = '2 Con drain (1st-level creature)';
        } else target.negativeLevels.permanent = (target.negativeLevels.permanent || 0) + eff.negativeLevels;
      }
      target.touch();
      target.hp.current = eff.fullHp ? target.maxHp() : Math.max(1, target.hitDice());
      target.hp.nonlethal = 0;
      target.touch();
      r.revived = true;
      r.negativeLevels = eff.negativeLevels;
      results.push(r);
    }
    return { results, materialCostGp: eff.materialCostGp || 0 };
  },

  slay(ctx, eff) {
    const { caster, targets, dc, spell, rng } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      if (eff.onlyDying && target.hpState() !== 'dying' && target.hpState() !== 'stable') {
        r.note = 'target must be dying';
        results.push(r);
        continue;
      }
      if (target.isImmune(eff.tags || ['death'])) {
        r.note = 'immune';
        results.push(r);
        continue;
      }
      if (spell.sr) {
        const sr = checks.spellResistance(caster, target, { rng });
        if (sr.blocked) {
          r.note = 'spell resistance';
          results.push(r);
          continue;
        }
      }
      const saves = eff.saves || (eff.save ? [eff.save] : []);
      let survived = false;
      r.saves = [];
      for (const sv of saves) {
        const s = checks.savingThrow(target, sv.type, { dc, rng, tags: spellTags(spell) });
        r.saves.push(s);
        if (s.success) {
          survived = true;
          break;
        }
      }
      if (survived) {
        // Phantasmal killer: Will save ends it; Fort save means damage instead.
        if (eff.onSave && r.saves.length === saves.length && saves.length > 1) {
          const amt = dice.total(evalDice(eff.onSave.dice, ctx.cl), rng);
          r.damage = applyDamage(target, [{ amount: amt, type: 'untyped' }]).total;
        }
        r.note = 'survived';
      } else {
        target.die();
        r.slain = true;
        if (eff.casterGain) {
          caster.addTempHp(dice.total(eff.casterGain.tempHp, rng), `spell:${spell.id}`);
          caster.addEffect(makeEffect({ key: `spell:${spell.id}`, name: spell.name, remaining: 10 * target.hitDice() * 10, modifiers: [{ target: 'str', value: eff.casterGain.str, type: 'enhancement', source: spell.name }, { target: 'cl', value: 1, type: 'untyped', source: spell.name }] }));
        }
      }
      results.push(r);
    }
    return { results };
  },

  powerWord(ctx, eff) {
    const results = [];
    for (const target of ctx.targets) {
      const r = { target: target.id, name: target.name };
      const hp = target.hp.current;
      const tier = eff.thresholds.find(([max]) => hp <= max);
      if (!tier) {
        r.note = 'too many hit points';
      } else if (eff.kill) {
        target.die();
        r.slain = true;
      } else {
        const rounds = tier[1] === null ? null : dice.total(tier[1], ctx.rng);
        target.addCondition(eff.condition, rounds, { id: ctx.caster.id, name: ctx.spell.name });
        r.condition = eff.condition;
        r.rounds = rounds;
      }
      results.push(r);
    }
    return { results };
  },

  hdKill(ctx, eff) {
    const { targets, cl, dc, spell, rng } = ctx;
    let pool = dice.total(evalDice(eff.hdPool, cl), rng);
    const results = [];
    for (const target of [...targets].sort((a, b) => a.hitDice() - b.hitDice())) {
      const r = { target: target.id, name: target.name };
      if (!matchesOnlyVs(target, eff.onlyVs) || (!eff.onlyVs && !target.isLiving())) {
        r.note = 'unaffected';
      } else if (target.hitDice() > eff.maxHdEach || target.hitDice() > pool) {
        r.note = 'unaffected (HD)';
      } else {
        pool -= target.hitDice();
        const s = checks.savingThrow(target, eff.save.type, { dc, rng, tags: spellTags(spell) });
        r.save = s;
        if (!s.success) {
          target.die();
          r.slain = true;
        }
      }
      results.push(r);
    }
    return { results };
  },

  colorSpray(ctx, eff) {
    const { targets, dc, spell, rng, caster } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      if (target.isImmune(['mind-affecting']) || target.hasFlag('blind')) {
        r.note = 'unaffected';
        results.push(r);
        continue;
      }
      const sr = checks.spellResistance(caster, target, { rng });
      if (sr.blocked) {
        r.note = 'spell resistance';
        results.push(r);
        continue;
      }
      const s = checks.savingThrow(target, 'will', { dc, rng, tags: spellTags(spell) });
      r.save = s;
      if (!s.success) {
        const hd = target.hitDice();
        const src = { id: caster.id, name: spell.name };
        if (hd <= 2) {
          target.addCondition('unconscious', dice.total('2d4', rng), src);
          target.addCondition('blinded', dice.total('2d4', rng) + 4, src);
          target.addCondition('stunned', 1, src);
          r.conditions = ['unconscious', 'blinded', 'stunned'];
        } else if (hd <= 4) {
          target.addCondition('blinded', dice.total('1d4', rng), src);
          target.addCondition('stunned', 1, src);
          r.conditions = ['blinded', 'stunned'];
        } else {
          target.addCondition('stunned', 1, src);
          r.conditions = ['stunned'];
        }
      }
      results.push(r);
    }
    return { results };
  },

  cloudkill(ctx, eff) {
    const { targets, dc, spell, rng } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      if (!target.isLiving() || target.isImmune(['poison'])) {
        r.note = 'unaffected';
      } else if (target.hitDice() <= 3) {
        target.die();
        r.slain = true;
      } else {
        const s = checks.savingThrow(target, 'fort', { dc, rng, tags: spellTags(spell) });
        r.save = s;
        if (target.hitDice() <= 6 && !s.success) {
          target.die();
          r.slain = true;
        } else {
          let con = dice.total('1d4', rng);
          if (s.success) con = Math.floor(con / 2);
          target.abilityDamage.con = (target.abilityDamage.con || 0) + con;
          target.touch();
          r.abilityDamage = { con };
        }
      }
      results.push(r);
    }
    return { results };
  },

  word(ctx, eff) {
    const { targets, cl, caster, rng } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      if (target.axes()[eff.alignmentImmune]) {
        r.note = 'unaffected (alignment)';
        results.push(r);
        continue;
      }
      const hd = target.hitDice();
      const src = { id: caster.id, name: ctx.spell.name };
      if (hd <= cl - 10) {
        target.die();
        r.slain = true;
      } else if (hd <= cl - 5) {
        target.addCondition('paralyzed', dice.total('1d10', rng) * 10, src);
        r.condition = 'paralyzed';
      } else if (hd <= cl - 1) {
        target.addCondition('blinded', dice.total('2d4', rng), src);
        r.condition = 'blinded';
      } else if (hd <= cl) {
        target.addCondition('deafened', dice.total('1d4', rng), src);
        r.condition = 'deafened';
      } else r.note = 'unaffected (HD)';
      results.push(r);
    }
    return { results };
  },

  energyDrain(ctx, eff) {
    const { caster, targets, rng } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      const atk = touchAttack(caster, target, eff.attack, rng);
      r.attack = atk;
      if (!atk.hit) {
        r.note = 'missed';
        results.push(r);
        continue;
      }
      if (target.isUndead()) {
        const t = dice.total(eff.levels, rng) * 5;
        target.addTempHp(t, `spell:${ctx.spell.id}`);
        r.tempHp = t;
      } else if (target.isImmune(['energy-drain'])) r.note = 'immune';
      else {
        const n = dice.total(eff.levels, rng);
        target.negativeLevels.temporary = (target.negativeLevels.temporary || 0) + n;
        target.touch();
        r.negativeLevels = n;
        if (target.totalNegativeLevels() >= target.hitDice()) {
          target.die();
          r.slain = true;
        }
      }
      results.push(r);
    }
    return { results };
  },

  grappleArea(ctx, eff) {
    const { targets, cl, rng, caster, spell } = ctx;
    const results = [];
    const cmb = eff.cmb(cl);
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      const roll = rng.die(20) + cmb;
      const cmd = target.cmd(['grapple']);
      r.check = { roll, cmd };
      if (roll >= cmd && !target.hasFlag('freedomOfMovement')) {
        target.addEffect(makeEffect({ key: `spell:${spell.id}`, name: spell.name, sourceId: caster.id, remaining: durationRounds(spell, eff, cl, ctx.metamagic, rng), conditions: ['grappled'], ongoing: { dice: evalDice(eff.dice, cl), type: 'bludgeoning' }, escapeDc: cmb + 10 }));
        r.condition = 'grappled';
        r.damage = applyDamage(target, [{ amount: dice.total(evalDice(eff.dice, cl), rng), physical: true, damageTypes: ['bludgeoning'], magic: true }]).total;
      } else r.note = 'escaped the tentacles';
      results.push(r);
    }
    return { results };
  },

  energyRay() {
    return { results: [] };
  },

  ongoingAttack(ctx, eff) {
    const { caster, targets, cl, rng, spell, metamagic } = ctx;
    const target = targets[0];
    const rounds = durationRounds(spell, eff, cl, metamagic, rng);
    caster.addEffect(makeEffect({ key: `spell:${spell.id}`, name: spell.name, remaining: rounds, ongoingAttack: { targetId: target ? target.id : null, dice: evalDice(eff.dice, cl), energy: eff.energy, ability: eff.attackAbility } }));
    const results = [];
    if (target) results.push(spiritualStrike(caster, target, { dice: evalDice(eff.dice, cl), energy: eff.energy, ability: eff.attackAbility }, rng));
    return { results };
  },

  poison(ctx, eff) {
    const { caster, targets, dc, rng, spell } = ctx;
    const results = [];
    for (const target of targets) {
      const r = { target: target.id, name: target.name };
      const atk = touchAttack(caster, target, eff.attack, rng);
      r.attack = atk;
      if (!atk.hit) {
        r.note = 'missed';
      } else if (target.isImmune(['poison'])) r.note = 'immune';
      else r.affliction = applyAffliction(target, { kind: 'poison', name: spell.name, save: eff.poison.save, dc, damage: eff.poison.damage, frequency: eff.poison.frequency, cure: eff.poison.cure }, rng);
      results.push(r);
    }
    return { results };
  },

  stabilize(ctx) {
    return { results: ctx.targets.map((t) => { if (t.hpState() === 'dying') { t.stable = true; t.touch(); } return { target: t.id, name: t.name, state: t.hpState() }; }) };
  },

  purgeInvisibility(ctx) {
    const results = [];
    for (const t of ctx.targets) results.push({ target: t.id, removed: t.removeEffectsWhere((e) => (e.flags || []).includes('invisible')).map((e) => e.name) });
    return { results };
  },

  teleport(ctx, eff) {
    return { results: [], teleport: { destination: ctx.options.destination, shortRange: !!eff.shortRange, planar: !!eff.planar } };
  },

  banish(ctx, eff) {
    const { targets, dc, spell, rng } = ctx;
    const results = [];
    for (const t of targets) {
      const r = { target: t.id, name: t.name };
      if (!eff.typeLimit.includes(t.creatureType()) || !(t.subtypes().includes('extraplanar') || t.summoned)) r.note = 'not extraplanar';
      else {
        const s = checks.savingThrow(t, 'will', { dc, rng, tags: spellTags(spell) });
        r.save = s;
        if (!s.success) {
          t.status = 'dead';
          t.banished = true;
          t.touch();
          r.banished = true;
        }
      }
      results.push(r);
    }
    return { results };
  },

  animateDead(ctx) {
    return { results: [], notes: ['Animate dead requires corpses in the area; use the world engine to raise undead servants from slain creatures.'], animateDead: { maxHd: ctx.cl * 4 } };
  },

  timeStop(ctx, eff) {
    return { results: [], timeStop: dice.total(eff.rounds, ctx.rng) };
  },

  multi(ctx, eff) {
    const out = { results: [], notes: [], summons: [] };
    for (const part of eff.parts) {
      const partTargets = part.targets === 'enemies' ? ctx.enemies || [] : part.targets === 'allies' ? ctx.allies || ctx.targets : ctx.targets;
      const h = HANDLERS[part.kind];
      if (!h) continue;
      const res = h({ ...ctx, targets: partTargets }, part);
      out.results.push(...(res.results || []));
      if (res.notes) out.notes.push(...res.notes);
      if (res.summons) out.summons.push(...res.summons);
    }
    return out;
  },
};

function diceCount(expr) {
  return dice.parse(expr).filter((t) => t.kind === 'dice').reduce((s, t) => s + t.count, 0);
}

/** Bonus size modifiers when an effect changes size by one step. */
function sizeAdjust(step, source) {
  // Size modifiers to attack/AC are recomputed from the new size category; nothing else needed.
  return step ? [] : [{ target: 'ac', value: 0, type: 'size', source }];
}

function spiritualStrike(caster, target, data, rng) {
  const ability = data.ability || 'wis';
  const bonus = caster.bab() + caster.abilityMod(ability);
  const ac = target.ac({ tags: ['vsMelee'] }).total;
  const roll = rng.die(20);
  const r = { target: target.id, name: target.name, attack: { roll, bonus, total: roll + bonus, ac } };
  if (roll === 20 || (roll !== 1 && roll + bonus >= ac)) {
    const res = applyDamage(target, [{ amount: dice.total(data.dice, rng), type: data.energy || 'force' }]);
    r.damage = res.total;
    r.state = res.state;
  } else r.note = 'missed';
  return r;
}

/**
 * Poisons and diseases: an affliction effect that forces a save each
 * frequency step; damage on failure; cured after N consecutive saves.
 */
function applyAffliction(target, aff, rng = defaultRng) {
  const tagType = aff.kind === 'disease' ? 'disease' : 'poison';
  if (target.isImmune([tagType]) || target.hasFlag(`immune:${tagType}`)) return { immune: true };
  const s = checks.savingThrow(target, aff.save || 'fort', { dc: aff.dc, rng, tags: [tagType] });
  if (s.success) return { save: s, resisted: true };
  const result = { save: s, damage: {} };
  for (const [a, d] of Object.entries(aff.damage || {})) {
    const n = dice.total(d, rng);
    target.abilityDamage[a] = (target.abilityDamage[a] || 0) + n;
    result.damage[a] = n;
  }
  const existing = target.effects.find((e) => e.kind === 'affliction' && e.name === aff.name);
  if (existing) {
    // Multiple doses of the same poison: +2 DC, +50% duration.
    existing.data.dc += 2;
    existing.remaining = Math.ceil((existing.remaining || 0) * 1.5);
  } else if (aff.frequency && aff.frequency > 1) {
    target.addEffect(makeEffect({
      key: `affliction:${aff.name}`, name: aff.name, kind: 'affliction', afflictionType: tagType, tags: [tagType],
      remaining: tagType === 'disease' ? null : aff.frequency - 1, data: { save: aff.save || 'fort', dc: aff.dc, damage: aff.damage, cure: aff.cure || 1, consecutive: 0, perDay: tagType === 'disease' },
    }));
  }
  target.touch();
  return result;
}

/** Process recurring affliction saves (poison each round, disease each day). */
function tickAfflictions(target, rng = defaultRng, unit = 'round') {
  const events = [];
  for (const e of [...target.effects]) {
    if (e.kind !== 'affliction') continue;
    if ((unit === 'round') === !!e.data.perDay) continue;
    const s = checks.savingThrow(target, e.data.save, { dc: e.data.dc, rng, tags: [e.afflictionType] });
    if (s.success) {
      e.data.consecutive += 1;
      if (e.data.consecutive >= e.data.cure) {
        target.removeEffect(e.id);
        events.push({ type: 'affliction-cured', name: e.name });
        continue;
      }
    } else {
      e.data.consecutive = 0;
      const dmg = {};
      for (const [a, d] of Object.entries(e.data.damage || {})) {
        const n = dice.total(d, rng);
        target.abilityDamage[a] = (target.abilityDamage[a] || 0) + n;
        dmg[a] = n;
      }
      target.touch();
      events.push({ type: 'affliction', name: e.name, damage: dmg });
      // Reaching 0 Con kills; 0 Str/Dex/etc. leaves the creature helpless/unconscious.
      if (target.ability('con') === 0) target.die();
    }
  }
  return events;
}

function resolveSpell(params) {
  const spell = typeof params.spell === 'string' ? SPELLS[params.spell] : params.spell;
  if (!spell) throw Object.assign(new Error('Unknown spell'), { status: 400 });
  const eff = spell.effect || { kind: 'utility' };
  const handler = HANDLERS[eff.kind] || HANDLERS.utility;
  const ctx = {
    caster: params.caster, spell, cl: params.cl, dc: params.dc, targets: params.targets || [], rng: params.rng || defaultRng,
    metamagic: params.metamagic || [], options: params.options || {}, encounter: params.encounter, allies: params.allies, enemies: params.enemies,
    bloodlineEnergyBonus: params.bloodlineEnergyBonus, surpriseSneak: params.surpriseSneak,
  };
  if (eff.targets === 'allies' && params.allies) ctx.targets = params.allies;
  if (eff.targets === 'enemies' && params.enemies) ctx.targets = params.enemies;
  const res = handler(ctx, eff);
  return { spell: spell.id, name: spell.name, cl: params.cl, dc: params.dc, ...res };
}

module.exports = { resolveSpell, applyAffliction, tickAfflictions, spiritualStrike, rollVariable, evalDice, touchAttack, HANDLERS };
