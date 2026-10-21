'use strict';

const dice = require('./dice');
const checks = require('./checks');
const { mod } = require('./modifiers');
const { makeEffect } = require('./effects');
const { applyDamage } = require('./attacks');
const { touchAttack, resolveSpell } = require('./spellEffects');
const { SPELLS } = require('../data/spells');
const { MERCIES, DRAGON_TYPES } = require('../data/classOptions');

/**
 * Activated class abilities. Each:
 *   name, action ('free'|'swift'|'move'|'standard'|'full'|'immediate'),
 *   resource / cost, target: 'self'|'ally'|'enemy'|'allies'|'enemies'|'area'|'none',
 *   use(ctx) -> result object for the log.
 * ctx = { user, target, targets, encounter, rng, options, allies, enemies }
 */

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const half = (n) => Math.floor(n / 2);
// Level that domain, school and bloodline powers scale with.
const domainLvl = (u) => u.prog('domainLevel');
const schoolLvl = (u) => u.prog('wizardSchoolLevel');
const bloodLvl = (u) => u.prog('sorcererBloodlineLevel');
/** "3 + ability modifier times per day" (domain, school and bloodline powers). */
const usesPerDay = (ability) => (u) => 3 + Math.max(0, u.baseAbilityMod(typeof ability === 'function' ? ability(u) : ability));

function spend(user, resource, cost = 1) {
  if (!user.spendResource(resource, cost)) throw err(`Not enough ${resource} remaining`);
}

function rangedTouchPower(name, { diceFn, energy, attack = 'rangedTouch', after, ability = 'wis' }) {
  return {
    name, action: 'standard', target: 'enemy', perDay: usesPerDay(ability),
    resource: (u, id) => `power:${id}`,
    use(ctx) {
      const { user, target, rng } = ctx;
      const atk = touchAttack(user, target, attack, rng);
      const r = { target: target.id, attack: atk };
      if (!atk.hit) return { ...r, note: 'missed' };
      let amt = dice.total(diceFn(user), rng);
      if (atk.crit) amt *= 2;
      const res = applyDamage(target, [{ amount: amt, type: energy, physical: energy === 'bludgeoning', damageTypes: [energy], magic: true }]);
      Object.assign(r, { damage: res.total, state: res.state });
      if (after) after(ctx, r);
      return r;
    },
  };
}

function touchCondition(name, { condition, rounds, save, attack = 'meleeTouch', hdCheck, ability = 'wis' }) {
  return {
    name, action: 'standard', target: 'enemy', perDay: usesPerDay(ability),
    resource: (u, id) => `power:${id}`,
    use(ctx) {
      const { user, target, rng } = ctx;
      const atk = touchAttack(user, target, attack, rng);
      if (!atk.hit) return { target: target.id, attack: atk, note: 'missed' };
      if (hdCheck && !hdCheck(user, target)) return { target: target.id, attack: atk, note: 'target has too many HD' };
      if (save) {
        const s = checks.savingThrow(target, save.type, { dc: save.dc(user), rng });
        if (s.success) return { target: target.id, attack: atk, save: s, note: 'saved' };
      }
      const r = typeof rounds === 'function' ? rounds(user) : rounds;
      const added = target.addCondition(condition, r, { id: user.id, name });
      return { target: target.id, attack: atk, condition: added ? condition : null, rounds: r };
    },
  };
}

function touchBuff(name, { modifiers, rounds = 1, flags = [], ability = 'wis' }) {
  return {
    name, action: 'standard', target: 'ally', perDay: usesPerDay(ability),
    resource: (u, id) => `power:${id}`,
    use(ctx) {
      const { user, target } = ctx;
      const t = target || user;
      t.addEffect(makeEffect({ key: `power:${name}`, name, sourceId: user.id, remaining: rounds, modifiers: modifiers(user, name), flags }));
      return { target: t.id, effect: name };
    },
  };
}

/** Bardic performance helper: spend rounds and apply an effect to allies or enemies. */
function performance(name, { minLevel = 1, side = 'allies', build, save }) {
  return {
    name, action: 'standard', target: side,
    use(ctx) {
      const { user, rng } = ctx;
      if (user.hasFlag('deaf') && false) throw err('Cannot perform while deafened');
      const rounds = Math.min(ctx.options.rounds || 1, user.resourceRemaining('performance'));
      if (rounds < 1) throw err('No bardic performance rounds remaining');
      spend(user, 'performance', rounds);
      const targets = side === 'allies' ? ctx.allies || [user] : ctx.enemies || (ctx.target ? [ctx.target] : []);
      const results = [];
      const dc = 10 + half(user.classLevel('bard')) + user.abilityMod('cha');
      for (const t of targets) {
        if (save && t.id !== user.id) {
          const s = checks.savingThrow(t, save, { dc, rng, tags: ['mind-affecting', 'performance'] });
          if (s.success) {
            results.push({ target: t.id, save: s, note: 'saved' });
            continue;
          }
        }
        const fx = build(user, rounds, t, ctx);
        if (fx) t.addEffect(makeEffect({ key: `performance:${name}`, name, kind: 'ability', sourceId: user.id, remaining: rounds, ...fx }));
        results.push({ target: t.id, effect: name, rounds });
      }
      return { rounds, results };
    },
  };
}

function rageBonuses(user) {
  const lvl = user.classLevel('barbarian');
  if (lvl >= 20) return { abil: 8, will: 4 };
  if (lvl >= 11) return { abil: 6, will: 3 };
  return { abil: 4, will: 2 };
}

const ABILITIES = {
  // ------------------------------------------------------------ Barbarian
  rage: {
    name: 'Rage', action: 'free', target: 'self',
    use({ user, options }) {
      if (user.hasFlag('raging')) throw err('Already raging');
      if (user.hasCondition('fatigued') && !user.choices['rage-power']?.includes('roused-anger')) throw err('Cannot rage while fatigued');
      const rounds = Math.min(options.rounds || user.resourceRemaining('rage'), user.resourceRemaining('rage'));
      if (rounds < 1) throw err('No rage rounds remaining');
      spend(user, 'rage', rounds);
      const b = rageBonuses(user);
      const tireless = user.hasFeature('tireless-rage');
      user.addEffect(makeEffect({
        key: 'ability:rage', name: 'Rage', kind: 'ability', remaining: rounds, flags: ['raging', 'noConcentration'],
        modifiers: [mod('str', b.abil, 'morale', 'Rage'), mod('con', b.abil, 'morale', 'Rage'), mod('save.will', b.will, 'morale', 'Rage'), mod('ac', -2, 'untyped', 'Rage')],
        onEnd: tireless ? [] : [{ condition: 'fatigued', rounds: rounds * 2 }], data: { rounds },
      }));
      return { rounds, bonus: b };
    },
  },
  'end-rage': {
    name: 'End Rage', action: 'free', target: 'self',
    use({ user }) {
      const e = user.effects.find((x) => x.key === 'ability:rage');
      if (!e) throw err('Not raging');
      const unused = Math.max(0, e.remaining || 0);
      user.resourcesUsed.rage = Math.max(0, (user.resourcesUsed.rage || 0) - unused);
      const used = (e.data.rounds || 0) - unused;
      user.removeEffect(e.id);
      if (!user.hasFeature('tireless-rage')) user.addCondition('fatigued', Math.max(1, used * 2), { name: 'Rage' });
      return { refunded: unused };
    },
  },
  'powerful-blow': {
    name: 'Powerful Blow', action: 'free', target: 'self',
    use({ user }) {
      if (!user.hasFlag('raging')) throw err('Must be raging');
      const b = 1 + Math.floor(user.classLevel('barbarian') / 4);
      user.addEffect(makeEffect({ key: 'ability:powerful-blow', name: 'Powerful Blow', remaining: 1, modifiers: [mod('damage', b, 'untyped', 'Powerful blow')], dischargeOnHit: true }));
      return { bonus: b };
    },
  },
  'surprise-accuracy': {
    name: 'Surprise Accuracy', action: 'swift', target: 'self',
    use({ user }) {
      if (!user.hasFlag('raging')) throw err('Must be raging');
      const b = 1 + Math.floor(user.classLevel('barbarian') / 4);
      user.addEffect(makeEffect({ key: 'ability:surprise-accuracy', name: 'Surprise Accuracy', remaining: 1, modifiers: [mod('attack', b, 'morale', 'Surprise accuracy')], dischargeOnAttack: true }));
      return { bonus: b };
    },
  },
  'renewed-vigor': {
    name: 'Renewed Vigor', action: 'standard', target: 'self',
    use({ user, rng }) {
      if (!user.hasFlag('raging')) throw err('Must be raging');
      const n = 1 + Math.floor(Math.max(0, user.classLevel('barbarian') - 4) / 4);
      return { healed: user.heal(dice.total(`${n}d8`, rng) + user.abilityMod('con')) };
    },
  },
  'strength-surge': {
    name: 'Strength Surge', action: 'free', target: 'self',
    use({ user }) {
      user.addEffect(makeEffect({ key: 'ability:strength-surge', name: 'Strength Surge', remaining: 1, modifiers: [mod('cmb', user.classLevel('barbarian'), 'untyped', 'Strength surge'), mod('abilityCheck.str', user.classLevel('barbarian'), 'untyped', 'Strength surge')] }));
      return { bonus: user.classLevel('barbarian') };
    },
  },

  // ------------------------------------------------------------ Paladin
  'smite-evil': {
    name: 'Smite Evil', action: 'swift', target: 'enemy',
    use({ user, target }) {
      spend(user, 'smite');
      if (!target.axes().evil) return { target: target.id, note: 'target is not evil; smite wasted' };
      const cha = Math.max(0, user.abilityMod('cha'));
      const lvl = user.classLevel('paladin');
      const big = ['outsider', 'dragon', 'undead'].includes(target.creatureType()) && target.axes().evil;
      user.addEffect(makeEffect({ key: 'ability:smite', name: `Smite Evil (${target.name})`, kind: 'ability', remaining: null, data: { targetId: target.id, damage: lvl, firstHitDouble: big, hits: 0 }, modifiers: [mod('ac', cha, 'deflection', 'Smite evil', [`attacker:${target.id}`])] }));
      return { target: target.id, attackBonus: cha, damageBonus: lvl };
    },
  },
  'lay-on-hands': {
    name: 'Lay on Hands', action: 'standard', target: 'ally',
    use({ user, target, rng, options }) {
      const t = target || user;
      spend(user, 'layOnHands');
      const lvl = user.classLevel('paladin');
      const n = Math.max(1, half(lvl));
      const max = user.hasFeature('holy-champion');
      const amt = max ? n * 6 : dice.total(`${n}d6`, rng);
      if (t.isUndead()) {
        const atk = t.id === user.id ? { hit: true } : touchAttack(user, t, 'meleeTouch', rng);
        if (!atk.hit) return { target: t.id, note: 'missed' };
        const s = checks.savingThrow(t, 'will', { dc: 10 + half(lvl) + user.abilityMod('cha'), rng });
        const res = applyDamage(t, [{ amount: s.success ? half(amt) : amt, type: 'positive' }]);
        return { target: t.id, damage: res.total, save: s };
      }
      const healed = t.heal(amt);
      const removed = [];
      for (const m of user.choices.mercy || []) {
        const map = { fatigued: ['fatigued'], shaken: ['shaken'], sickened: ['sickened'], dazed: ['dazed'], staggered: ['staggered'], exhausted: ['exhausted'], frightened: ['frightened'], nauseated: ['nauseated'], blinded: ['blinded'], deafened: ['deafened'], paralyzed: ['paralyzed'], stunned: ['stunned'] };
        if (map[m] && MERCIES[m]) removed.push(...t.removeConditions(map[m]).map((e) => e.name));
        if (m === 'poisoned') removed.push(...t.removeEffectsWhere((e) => e.afflictionType === 'poison').map((e) => e.name));
        if (m === 'diseased') removed.push(...t.removeEffectsWhere((e) => e.afflictionType === 'disease').map((e) => e.name));
        if (m === 'cursed') removed.push(...t.removeEffectsWhere((e) => (e.tags || []).includes('curse')).map((e) => e.name));
      }
      return { target: t.id, healed, mercies: removed, swift: t.id === user.id };
    },
  },
  'channel-energy-paladin': {
    name: 'Channel Positive Energy', action: 'standard', target: 'area',
    use(ctx) {
      spend(ctx.user, 'layOnHands', 2);
      return channel(ctx, Math.max(1, half(ctx.user.classLevel('paladin'))), 10 + half(ctx.user.classLevel('paladin')) + ctx.user.abilityMod('cha'), 'positive');
    },
  },
  'divine-bond-weapon': {
    name: 'Divine Bond (weapon)', action: 'standard', target: 'self',
    use({ user }) {
      spend(user, 'divineBond');
      const lvl = user.classLevel('paladin');
      const b = Math.min(6, 1 + Math.floor((lvl - 5) / 3));
      user.addEffect(makeEffect({ key: 'ability:divine-bond', name: 'Divine Bond', remaining: lvl * 10, flags: ['weaponMagic', 'weaponsGood'], modifiers: [mod('attack', b, 'enhancement', 'Divine bond', ['weapon']), mod('damage', b, 'enhancement', 'Divine bond', ['weapon'])] }));
      return { bonus: b, rounds: lvl * 10 };
    },
  },
  'detect-evil': {
    name: 'Detect Evil', action: 'move', target: 'none',
    use({ user, encounter, options }) {
      const pool = encounter ? encounter.creatures() : options.nearby || [];
      return { evil: pool.filter((c) => c.id !== user.id && c.axes().evil && c.isAlive()).map((c) => ({ id: c.id, name: c.name, strength: c.hitDice() >= 11 ? 'overwhelming' : c.hitDice() >= 5 ? 'strong' : c.hitDice() >= 2 ? 'moderate' : 'faint' })) };
    },
  },

  // ------------------------------------------------------------ Cleric
  'channel-energy': {
    name: 'Channel Energy', action: 'standard', target: 'area',
    use(ctx) {
      spend(ctx.user, 'channel');
      const lvl = ctx.user.classLevel('cleric');
      const dc = 10 + half(lvl) + ctx.user.abilityMod('cha') + (ctx.user.hasFeat('improved-channel') ? 2 : 0);
      const energy = ctx.options.energy || (ctx.user.alignment[1] === 'E' ? 'negative' : 'positive');
      return channel(ctx, ctx.user.prog('channelDice'), dc, energy);
    },
  },

  // ------------------------------------------------------------ Bard
  'inspire-courage': performance('Inspire Courage', {
    build: (u) => {
      const b = u.prog('inspireCourage');
      return { modifiers: [mod('save', b, 'morale', 'Inspire courage', ['charm', 'fear']), mod('attack', b, 'competence', 'Inspire courage'), mod('damage', b, 'competence', 'Inspire courage', ['weapon'])] };
    },
  }),
  'inspire-competence': performance('Inspire Competence', { build: (u) => ({ modifiers: [mod('skill', u.prog('inspireCompetence'), 'competence', 'Inspire competence')] }) }),
  'inspire-greatness': performance('Inspire Greatness', {
    build: (u, rounds, t, ctx) => {
      t.addTempHp(dice.total('2d10', ctx.rng), 'inspire-greatness');
      return { modifiers: [mod('attack', 2, 'competence', 'Inspire greatness'), mod('save.fort', 1, 'competence', 'Inspire greatness')] };
    },
  }),
  'inspire-heroics': performance('Inspire Heroics', { build: () => ({ modifiers: [mod('save', 4, 'morale', 'Inspire heroics'), mod('ac', 4, 'dodge', 'Inspire heroics')] }) }),
  countersong: performance('Countersong', { build: () => ({ flags: ['countersong'], modifiers: [mod('save', 0, 'untyped', 'Countersong')] }) }),
  distraction: performance('Distraction', { build: () => ({ flags: ['distraction'] }) }),
  fascinate: performance('Fascinate', { side: 'enemies', save: 'will', build: () => ({ conditions: ['fascinated'] }) }),
  'dirge-of-doom': performance('Dirge of Doom', { side: 'enemies', build: () => ({ conditions: ['shaken'], tags: ['fear', 'mind-affecting'] }) }),
  'frightening-tune': performance('Frightening Tune', { side: 'enemies', save: 'will', build: () => ({ conditions: ['frightened'], tags: ['fear', 'mind-affecting'] }) }),
  'suggestion-performance': performance('Suggestion', { side: 'enemies', save: 'will', build: (u) => ({ conditions: ['suggested'], data: { controller: u.id } }) }),
  'soothing-performance': {
    name: 'Soothing Performance', action: 'full', target: 'allies',
    use(ctx) {
      spend(ctx.user, 'performance', 4);
      return resolveSpell({ caster: ctx.user, spell: SPELLS['cure-serious-wounds'], cl: ctx.user.classLevel('bard'), dc: 0, targets: ctx.allies || [ctx.user], rng: ctx.rng });
    },
  },
  'deadly-performance': {
    name: 'Deadly Performance', action: 'full', target: 'enemy',
    use({ user, target, rng }) {
      spend(user, 'performance', 1);
      const s = checks.savingThrow(target, 'will', { dc: 10 + half(user.classLevel('bard')) + user.abilityMod('cha'), rng, tags: ['mind-affecting', 'death'] });
      if (s.success) {
        target.addCondition('staggered', dice.total('1d4', rng), { name: 'Deadly performance' });
        return { target: target.id, save: s, condition: 'staggered' };
      }
      target.die();
      return { target: target.id, save: s, slain: true };
    },
  },

  // ------------------------------------------------------------ Monk
  'stunning-fist': {
    name: 'Stunning Fist', action: 'free', target: 'self',
    use({ user }) {
      spend(user, 'stunningFist');
      const dc = 10 + half(user.hitDice()) + user.abilityMod('wis');
      user.addEffect(makeEffect({ key: 'ability:stunning-fist', name: 'Stunning Fist (primed)', remaining: 1, data: { dc }, dischargeOnHit: true, onHit: { save: 'fort', dc, condition: 'stunned', rounds: 1 } }));
      return { dc };
    },
  },
  'ki-extra-attack': {
    name: 'Ki: Extra Attack', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'ki');
      user.addEffect(makeEffect({ key: 'ability:ki-extra-attack', name: 'Ki Extra Attack', remaining: 1, flags: ['kiExtraAttack'] }));
      return {};
    },
  },
  'ki-dodge': {
    name: 'Ki: Dodge', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'ki');
      user.addEffect(makeEffect({ key: 'ability:ki-dodge', name: 'Ki Dodge', remaining: 1, modifiers: [mod('ac', 4, 'dodge', 'Ki')] }));
      return { ac: 4 };
    },
  },
  'ki-speed': {
    name: 'Ki: Speed', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'ki');
      user.addEffect(makeEffect({ key: 'ability:ki-speed', name: 'Ki Speed', remaining: 1, modifiers: [mod('speed', 20, 'enhancement', 'Ki')] }));
      return { speed: 20 };
    },
  },
  'wholeness-of-body': {
    name: 'Wholeness of Body', action: 'standard', target: 'self',
    use({ user }) {
      spend(user, 'ki', 2);
      return { healed: user.heal(user.classLevel('monk')) };
    },
  },
  'abundant-step': { name: 'Abundant Step', action: 'move', target: 'none', use({ user }) { spend(user, 'ki', 2); return { teleport: { shortRange: true } }; } },
  'empty-body': {
    name: 'Empty Body', action: 'move', target: 'self',
    use({ user }) {
      spend(user, 'ki', 3);
      user.addEffect(makeEffect({ key: 'ability:empty-body', name: 'Empty Body (ethereal)', remaining: 10, flags: ['incorporeal', 'ethereal'] }));
      return { rounds: 10 };
    },
  },
  'quivering-palm': {
    name: 'Quivering Palm', action: 'free', target: 'self',
    use({ user }) {
      spend(user, 'quiveringPalm');
      const dc = 10 + half(user.classLevel('monk')) + user.abilityMod('wis');
      user.addEffect(makeEffect({ key: 'ability:quivering-palm', name: 'Quivering Palm (primed)', remaining: 1, dischargeOnHit: true, onHit: { save: 'fort', dc, slay: true } }));
      return { dc };
    },
  },

  // ------------------------------------------------------------ Magus
  'arcane-pool-enhance': {
    name: 'Arcane Pool: Enhance Weapon', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'arcanePool');
      const b = user.prog('arcanePoolEnhancement');
      const rounds = user.choices['magus-arcana']?.includes('enduring-blade') ? user.classLevel('magus') * 10 : 10;
      user.addEffect(makeEffect({ key: 'ability:arcane-pool', name: `Arcane Pool (+${b})`, remaining: rounds, flags: ['weaponMagic'], modifiers: [mod('attack', b, 'enhancement', 'Arcane pool', ['weapon']), mod('damage', b, 'enhancement', 'Arcane pool', ['weapon'])] }));
      return { bonus: b, rounds };
    },
  },
  'spell-recall': {
    name: 'Spell Recall', action: 'swift', target: 'none',
    use({ user, options }) {
      const spellcasting = require('./spellcasting');
      const lvl = options.level;
      if (!lvl) throw err('Specify the spell level to recall');
      const cost = user.hasFeature('improved-spell-recall') ? Math.max(1, Math.ceil(lvl / 2)) : lvl;
      spend(user, 'arcanePool', cost);
      spellcasting.recall(user, 'magus', lvl, options.spell);
      return { level: lvl, cost };
    },
  },
  'arcane-accuracy': {
    name: 'Arcane Accuracy', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'arcanePool');
      const b = Math.max(0, user.abilityMod('int'));
      user.addEffect(makeEffect({ key: 'ability:arcane-accuracy', name: 'Arcane Accuracy', remaining: 1, modifiers: [mod('attack', b, 'insight', 'Arcane accuracy')] }));
      return { bonus: b };
    },
  },
  'spell-shield': {
    name: 'Spell Shield', action: 'immediate', target: 'self',
    use({ user }) {
      spend(user, 'arcanePool');
      const b = Math.max(1, half(user.classLevel('magus')));
      user.addEffect(makeEffect({ key: 'ability:spell-shield', name: 'Spell Shield', remaining: 1, modifiers: [mod('ac', b, 'shield', 'Spell shield')] }));
      return { bonus: b };
    },
  },
  'hasted-assault': {
    name: 'Hasted Assault', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'arcanePool');
      const rounds = Math.max(1, user.abilityMod('int'));
      user.addEffect(makeEffect({ key: 'spell:haste', name: 'Hasted Assault', remaining: rounds, flags: ['hasted'], modifiers: [mod('attack', 1, 'untyped', 'Haste'), mod('ac', 1, 'dodge', 'Haste'), mod('save.ref', 1, 'dodge', 'Haste'), mod('speed', 30, 'enhancement', 'Haste')] }));
      return { rounds };
    },
  },
  'accurate-strike': {
    name: 'Accurate Strike', action: 'swift', target: 'self',
    use({ user }) {
      spend(user, 'arcanePool', 2);
      user.addEffect(makeEffect({ key: 'ability:accurate-strike', name: 'Accurate Strike', remaining: 1, flags: ['attacksVsTouch'] }));
      return {};
    },
  },
  'pool-strike': rangedTouchPower('Pool Strike', { diceFn: (u) => `${2 + 2 * Math.floor(Math.max(0, u.classLevel('magus') - 3) / 3)}d6`, energy: 'fire', attack: 'meleeTouch' }),

  // ------------------------------------------------------------ Sorcerer / Dragon disciple
  'breath-weapon': {
    name: 'Breath Weapon', action: 'standard', target: 'area',
    use(ctx) {
      const { user, rng } = ctx;
      const uses = (user.prog('sorcererBloodlineLevel') >= 20 ? 3 : user.prog('sorcererBloodlineLevel') >= 17 ? 2 : 1) + (user.classLevel('dragon-disciple') >= 3 && user.classLevel('sorcerer') >= 9 ? 1 : 0);
      if ((user.resourcesUsed.breath || 0) >= uses) throw err('No breath weapon uses remaining');
      user.resourcesUsed.breath = (user.resourcesUsed.breath || 0) + 1;
      const lvl = user.prog('sorcererBloodlineLevel');
      const dt = DRAGON_TYPES[user.choices.dragonType || 'red'];
      const dc = 10 + half(lvl) + user.abilityMod('cha');
      const amt = dice.total(`${lvl}d6`, rng);
      const results = (ctx.targets || []).map((t) => {
        const s = checks.savingThrow(t, 'ref', { dc, rng, tags: [dt.energy] });
        let d = s.success ? half(amt) : amt;
        if (s.success && t.hasFlag('evasion')) d = 0;
        const res = applyDamage(t, [{ amount: d, type: dt.energy }]);
        return { target: t.id, save: s, damage: res.total, state: res.state };
      });
      return { shape: dt.shape, energy: dt.energy, dc, rolled: amt, results };
    },
  },
  'dragon-form': {
    name: 'Dragon Form', action: 'standard', target: 'self',
    use({ user }) {
      spend(user, 'dragonForm');
      const ii = user.classLevel('dragon-disciple') >= 10;
      const cl = user.casterLevel();
      user.addEffect(makeEffect({
        key: 'ability:dragon-form', name: ii ? 'Form of the Dragon II' : 'Form of the Dragon I', remaining: cl * 10, sizeChange: ii ? 2 : 1, flags: ['fly:100', 'polymorphed'],
        modifiers: [mod('str', ii ? 6 : 4, 'size', 'Dragon form'), mod('con', ii ? 4 : 2, 'size', 'Dragon form'), mod('ac', ii ? 6 : 4, 'natural', 'Dragon form')],
        resist: { [user.dragonEnergy()]: Infinity },
      }));
      return { rounds: cl * 10 };
    },
  },
  'heavenly-fire': rangedTouchPower('Heavenly Fire', { diceFn: (u) => `1d4+${half(bloodLvl(u))}`, energy: 'untyped', ability: 'cha' }),
  'corrupting-touch': touchCondition('Corrupting Touch', { condition: 'shaken', rounds: (u) => Math.max(1, half(bloodLvl(u))), ability: 'cha' }),
  'elemental-ray': rangedTouchPower('Elemental Ray', { diceFn: (u) => `1d6+${half(bloodLvl(u))}`, energy: 'fire', ability: 'cha' }),
  'laughing-touch': touchCondition('Laughing Touch', { condition: 'dazed', rounds: 1, ability: 'cha' }),
  'touch-of-destiny': touchBuff('Touch of Destiny', { ability: 'cha', modifiers: (u, n) => { const b = Math.max(1, half(bloodLvl(u))); return [mod('attack', b, 'insight', n), mod('skill', b, 'insight', n), mod('abilityCheck', b, 'insight', n), mod('save', b, 'insight', n)]; } }),
  'bonded-object': {
    name: 'Bonded Object', action: 'standard', target: 'none',
    use({ user }) {
      spend(user, 'bondedObject');
      user.addEffect(makeEffect({ key: 'ability:bonded-object', name: 'Bonded Object (cast any spellbook spell)', remaining: 600, flags: ['bondedObjectReady'] }));
      return {};
    },
  },

  // ------------------------------------------------------------ Domain & school powers
  'lightning-arc': rangedTouchPower('Lightning Arc', { diceFn: (u) => `1d6+${half(domainLvl(u))}`, energy: 'electricity' }),
  'acid-dart': rangedTouchPower('Acid Dart', { diceFn: (u) => `1d6+${half(Math.max(domainLvl(u), schoolLvl(u)))}`, energy: 'acid', ability: (u) => (schoolLvl(u) > domainLvl(u) ? 'int' : 'wis') }),
  'fire-bolt': rangedTouchPower('Fire Bolt', { diceFn: (u) => `1d6+${half(domainLvl(u))}`, energy: 'fire' }),
  icicle: rangedTouchPower('Icicle', { diceFn: (u) => `1d6+${half(domainLvl(u))}`, energy: 'cold' }),
  'telekinetic-fist': rangedTouchPower('Telekinetic Fist', { diceFn: (u) => `1d4+${half(schoolLvl(u))}`, energy: 'bludgeoning', ability: 'int' }),
  'force-missile': {
    name: 'Force Missile', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: usesPerDay('int'),
    use({ user, target, rng }) {
      const intense = Math.max(1, half(schoolLvl(user)));
      const res = applyDamage(target, [{ amount: dice.total('1d4', rng) + intense, type: 'force' }]);
      return { target: target.id, damage: res.total, state: res.state };
    },
  },
  'blinding-ray': rangedTouchPower('Blinding Ray', {
    diceFn: () => '0', energy: 'untyped', ability: 'int',
    after: (ctx, r) => {
      const blind = ctx.target.hitDice() <= schoolLvl(ctx.user);
      ctx.target.addCondition(blind ? 'blinded' : 'dazzled', 1, { name: 'Blinding ray' });
      r.condition = blind ? 'blinded' : 'dazzled';
    },
  }),
  'dazing-touch': touchCondition('Dazing Touch', { condition: 'dazed', rounds: 1, ability: 'int', hdCheck: (u, t) => t.hitDice() < schoolLvl(u) || t.hitDice() <= 1 }),
  'grave-touch': touchCondition('Grave Touch', { condition: 'shaken', rounds: (u) => Math.max(1, half(Math.max(schoolLvl(u), bloodLvl(u)))), ability: (u) => (schoolLvl(u) >= bloodLvl(u) ? 'int' : 'cha') }),
  'touch-of-evil': touchCondition('Touch of Evil', { condition: 'sickened', rounds: (u) => Math.max(1, half(domainLvl(u))) }),
  'bleeding-touch': {
    name: 'Bleeding Touch', action: 'standard', target: 'enemy', resource: (u, id) => `power:${id}`, perDay: usesPerDay('wis'),
    use({ user, target, rng }) {
      const atk = touchAttack(user, target, 'meleeTouch', rng);
      if (!atk.hit) return { target: target.id, attack: atk, note: 'missed' };
      target.addEffect(makeEffect({ key: 'power:bleeding-touch', name: 'Bleeding Touch', remaining: Math.max(1, half(domainLvl(user))), ongoing: { dice: '1d6', type: 'bleed' } }));
      return { target: target.id, attack: atk };
    },
  },
  'touch-of-good': touchBuff('Touch of Good', { modifiers: (u, n) => { const b = Math.max(1, half(domainLvl(u))); return [mod('attack', b, 'sacred', n), mod('skill', b, 'sacred', n), mod('abilityCheck', b, 'sacred', n), mod('save', b, 'sacred', n)]; } }),
  'touch-of-law': touchBuff('Touch of Law', { modifiers: () => [], flags: ['take11'] }),
  'touch-of-chaos': touchCondition('Touch of Chaos', { condition: 'chaos-touched', rounds: 1 }),
  'bit-of-luck': touchBuff('Bit of Luck', { modifiers: () => [], flags: ['rollTwiceBetter'] }),
  'strength-surge-domain': touchBuff('Strength Surge', { modifiers: (u, n) => { const b = Math.max(1, half(domainLvl(u))); return [mod('attack.melee', b, 'enhancement', n), mod('cmb', b, 'enhancement', n), mod('abilityCheck.str', b, 'enhancement', n)]; } }),
  'battle-rage': touchBuff('Battle Rage', { modifiers: (u, n) => [mod('damage.melee', Math.max(1, half(domainLvl(u))), 'untyped', n)] }),
  'destructive-smite': {
    name: 'Destructive Smite', action: 'free', target: 'self', resource: (u, id) => `power:${id}`, perDay: usesPerDay('wis'),
    use({ user }) {
      const b = Math.max(1, half(domainLvl(user)));
      user.addEffect(makeEffect({ key: 'power:destructive-smite', name: 'Destructive Smite', remaining: 1, modifiers: [mod('damage.melee', b, 'morale', 'Destructive smite')], dischargeOnHit: true }));
      return { bonus: b };
    },
  },
  'rebuke-death': {
    name: 'Rebuke Death', action: 'standard', target: 'ally', resource: (u, id) => `power:${id}`, perDay: usesPerDay('wis'),
    use({ user, target, rng }) {
      if (!target || target.hp.current >= 0) throw err('Target must be below 0 hit points');
      return { target: target.id, healed: target.heal(dice.total(`1d4+${half(domainLvl(user))}`, rng)) };
    },
  },
  copycat: {
    name: 'Copycat', action: 'move', target: 'self', resource: (u, id) => `power:${id}`, perDay: usesPerDay('wis'),
    use({ user }) {
      user.addEffect(makeEffect({ key: 'power:copycat', name: 'Copycat', remaining: domainLvl(user), images: 1 }));
      return { images: 1 };
    },
  },

  // ------------------------------------------------------------ Ranger
  quarry: {
    name: 'Quarry', action: 'standard', target: 'enemy',
    use({ user, target }) {
      const b = user.hasFeature('improved-quarry') ? 4 : 2;
      user.removeEffectsWhere((e) => e.key === 'ability:quarry');
      user.addEffect(makeEffect({ key: 'ability:quarry', name: `Quarry (${target.name})`, data: { targetId: target.id }, modifiers: [mod('attack', b, 'insight', 'Quarry', [`id:${target.id}`])] }));
      return { target: target.id, bonus: b };
    },
  },
  'hunters-bond': {
    name: "Hunter's Bond", action: 'move', target: 'allies',
    use({ user, allies }) {
      const fe = (user.choices['favored-enemy'] || [])[0];
      if (!fe) throw err('No favored enemy chosen');
      const b = Math.floor((fe.bonus || 2) / 2);
      const rounds = Math.max(1, user.abilityMod('wis'));
      for (const a of allies || []) if (a.id !== user.id) a.addEffect(makeEffect({ key: 'ability:hunters-bond', name: "Hunter's Bond", remaining: rounds, modifiers: [mod('attack', b, 'untyped', "Hunter's bond", [`vs:${fe.type}`]), mod('damage', b, 'untyped', "Hunter's bond", [`vs:${fe.type}`])] }));
      return { bonus: b, rounds };
    },
  },

  // ------------------------------------------------------------ Rogue / Arcane trickster / Assassin
  'impromptu-sneak-attack': {
    name: 'Impromptu Sneak Attack', action: 'free', target: 'self',
    use({ user }) {
      spend(user, 'impromptuSneak');
      user.addEffect(makeEffect({ key: 'ability:impromptu-sneak', name: 'Impromptu Sneak Attack', remaining: 1, flags: ['impromptuSneak'], dischargeOnAttack: true }));
      return {};
    },
  },
  'invisible-thief': {
    name: 'Invisible Thief', action: 'free', target: 'self',
    use({ user, options }) {
      const max = user.classLevel('arcane-trickster');
      const rounds = Math.min(options.rounds || max, max - (user.resourcesUsed.invisibleThief || 0));
      if (rounds < 1) throw err('No invisible thief rounds remaining');
      user.resourcesUsed.invisibleThief = (user.resourcesUsed.invisibleThief || 0) + rounds;
      user.addEffect(makeEffect({ key: 'spell:greater-invisibility', name: 'Invisible Thief', remaining: rounds, flags: ['invisible'] }));
      return { rounds };
    },
  },
  'study-target': {
    name: 'Study Target (death attack)', action: 'standard', target: 'enemy',
    use({ user, target }) {
      const e = user.effects.find((x) => x.key === 'ability:study' && x.data.targetId === target.id);
      if (e) {
        e.data.rounds += 1;
        e.remaining = 3;
        user.touch();
        return { target: target.id, roundsStudied: e.data.rounds, ready: e.data.rounds >= 3 };
      }
      user.removeEffectsWhere((x) => x.key === 'ability:study');
      user.addEffect(makeEffect({ key: 'ability:study', name: `Studying ${target.name}`, remaining: 3, data: { targetId: target.id, rounds: 1 } }));
      return { target: target.id, roundsStudied: 1, ready: false };
    },
  },
  'minor-magic': { name: 'Minor Magic', action: 'standard', target: 'enemy', use(ctx) { return spellLike(ctx, ctx.options.spell || 'ray-of-frost', 0, ctx.user.classLevel('rogue'), 'minorMagic', 3); } },
  'major-magic': { name: 'Major Magic', action: 'standard', target: 'enemy', use(ctx) { return spellLike(ctx, ctx.options.spell || 'magic-missile', 1, ctx.user.classLevel('rogue'), 'majorMagic', 2); } },

  // ------------------------------------------------------------ Duelist / Mystic theurge
  parry: {
    name: 'Parry', action: 'free', target: 'self',
    use({ user }) {
      user.addEffect(makeEffect({ key: 'ability:parry', name: 'Parry (ready)', remaining: 1, flags: ['parryReady'] }));
      return {};
    },
  },
  'spell-synthesis': {
    name: 'Spell Synthesis', action: 'full', target: 'self',
    use({ user }) {
      spend(user, 'spellSynthesis');
      user.addEffect(makeEffect({ key: 'ability:spell-synthesis', name: 'Spell Synthesis', remaining: 1, flags: ['spellSynthesis'], modifiers: [mod('srCheck', 2, 'untyped', 'Spell synthesis')] }));
      return {};
    },
  },

  // ------------------------------------------------------------ Feats
  'arcane-strike': {
    name: 'Arcane Strike', action: 'swift', target: 'self',
    use({ user }) {
      const b = 1 + Math.floor(user.casterLevel() / 5);
      user.addEffect(makeEffect({ key: 'feat:arcane-strike', name: 'Arcane Strike', remaining: 1, flags: ['weaponMagic'], modifiers: [mod('damage', b, 'untyped', 'Arcane Strike', ['weapon'])] }));
      return { bonus: b };
    },
  },
};

/** Channel energy burst (30 ft.). Positive heals living / harms undead; negative the reverse. */
function channel(ctx, diceCount, dc, energy) {
  const { user, rng, options } = ctx;
  const amt = dice.total(`${Math.max(1, diceCount)}d6`, rng);
  const mode = options.mode || 'heal';
  const pool = ctx.encounter ? ctx.encounter.within(user, 30) : options.nearby || [user, ...(ctx.allies || []), ...(ctx.enemies || [])];
  const exclude = new Set(options.exclude || []);
  const results = [];
  for (const t of pool) {
    if (exclude.has(t.id)) continue;
    const living = t.isLiving();
    const healsThis = (energy === 'positive' && living) || (energy === 'negative' && t.isUndead());
    if (mode === 'heal' && healsThis) results.push({ target: t.id, healed: t.heal(amt) });
    if (mode === 'harm' && !healsThis && (energy === 'positive' ? t.isUndead() : living)) {
      const s = checks.savingThrow(t, 'will', { dc, rng, tags: ['channel'], circumstance: t.def && t.def.channelResistance ? t.def.channelResistance : 0 });
      const res = applyDamage(t, [{ amount: s.success ? half(amt) : amt, type: energy }], { positiveHurtsLiving: false });
      results.push({ target: t.id, save: s, damage: res.total, state: res.state });
    }
  }
  return { energy, mode, rolled: amt, dc, results };
}

function spellLike(ctx, spellId, maxLevel, cl, resourceKey, perDay) {
  const spell = SPELLS[spellId];
  if (!spell || (spell.levels.wizard ?? 99) > maxLevel) throw err(`Spell must be a level ${maxLevel} sorcerer/wizard spell`);
  const used = ctx.user.resourcesUsed[resourceKey] || 0;
  if (used >= perDay) throw err('No uses remaining');
  ctx.user.resourcesUsed[resourceKey] = used + 1;
  const dc = 10 + (spell.levels.wizard || 0) + ctx.user.abilityMod('int');
  return resolveSpell({ caster: ctx.user, spell, cl, dc, targets: ctx.targets || (ctx.target ? [ctx.target] : []), rng: ctx.rng });
}

/** Racial spell-like abilities ("sla:darkness"). */
function racialSla(ctx, id) {
  const spellId = id.slice(4);
  const spell = SPELLS[spellId];
  if (!spell) throw err(`Unknown spell-like ability ${spellId}`);
  spend(ctx.user, id);
  const lvl = Math.min(...Object.values(spell.levels));
  const dc = 10 + lvl + ctx.user.abilityMod('cha');
  return resolveSpell({ caster: ctx.user, spell, cl: ctx.user.hitDice(), dc, targets: ctx.targets || (ctx.target ? [ctx.target] : [ctx.user]), rng: ctx.rng, encounter: ctx.encounter });
}

function getAbility(id) {
  if (id.startsWith('sla:')) return { name: `Spell-like: ${id.slice(4)}`, action: 'standard', target: 'enemy', use: (ctx) => racialSla(ctx, id) };
  return ABILITIES[id] || null;
}

/** Use an ability: validates the character has it and pays power uses. */
function useAbility(user, id, ctx) {
  if (!user.activatedAbilities().includes(id) && id !== 'end-rage') throw err(`${user.name} does not have the ability ${id}`);
  if (id === 'end-rage' && !user.hasFlag('raging')) throw err('Not raging');
  const ab = getAbility(id);
  if (!ab) throw err(`Ability ${id} has no implementation`);
  if (['enemy', 'ally'].includes(ab.target) && !ctx.target && ab.target === 'enemy') throw err(`${ab.name} needs a target`);
  if (ab.resource) spend(user, ab.resource(user, id));
  return { ability: id, name: ab.name, action: ab.action, ...ab.use({ ...ctx, user, options: ctx.options || {} }) };
}

module.exports = { ABILITIES, getAbility, useAbility, channel, usesPerDay };
