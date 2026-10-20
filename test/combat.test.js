'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Encounter } = require('../src/engine/combat');
const { Monster } = require('../src/engine/monster');
const { RNG } = require('../src/engine/rng');
const { resolveAttack, applyDamage, drAmount } = require('../src/engine/attacks');
const { resolveSpell } = require('../src/engine/spellEffects');
const { SPELLS } = require('../src/data/spells');
const maneuvers = require('../src/engine/maneuvers');
const classAbilities = require('../src/engine/classAbilities');
const sc = require('../src/engine/spellcasting');
const { make, levelTo, ARRAYS } = require('./helpers');

/** RNG that returns a scripted sequence of d20s (then falls back to a seeded RNG). */
function scripted(values, seed = 1) {
  const base = new RNG(seed);
  const queue = [...values];
  return { die: (n) => (queue.length ? queue.shift() : base.die(n)), next: () => base.next(), int: (a, b) => base.int(a, b), pick: (l) => base.pick(l), chance: (p) => base.chance(p) };
}

const fighter = (name = 'Valeros') => make({ name, class: 'fighter', feats: [{ id: 'power-attack' }, { id: 'weapon-focus', param: 'longsword' }, { id: 'dodge' }] });

test('monster stat blocks match the Bestiary', () => {
  const g = new Monster({ templateId: 'goblin' });
  assert.deepEqual(g.acSummary(), { ac: 16, touch: 13, flatFooted: 14 });
  assert.equal(g.save('fort').total, 3);
  assert.equal(g.maxHp(), 6);
  const t = new Monster({ templateId: 'troll' });
  assert.deepEqual(t.acSummary(), { ac: 16, touch: 11, flatFooted: 14 });
  assert.equal(t.cmd(), 22);
  const d = new Monster({ templateId: 'young-red-dragon' });
  assert.equal(d.acSummary().ac, 25);
  assert.ok(d.isImmune(['fire']));
});

test('attack roll: natural 20 hits and threatens, natural 1 misses', () => {
  const f = fighter();
  const g = new Monster({ templateId: 'goblin' });
  const sword = f.attackProfiles().find((p) => p.weaponId === 'longsword');
  const hit = resolveAttack(f, g, sword, { rng: scripted([20, 20, 3, 3, 3, 3]) });
  assert.equal(hit.hit, true);
  assert.equal(hit.critical, true);
  const miss = resolveAttack(f, new Monster({ templateId: 'goblin' }), sword, { rng: scripted([1]) });
  assert.equal(miss.hit, false);
  // Attack bonus: BAB 1 + Str 4 + Weapon Focus 1 = +6.
  assert.equal(hit.bonus, 6);
});

test('damage reduction and energy resistance', () => {
  const skel = new Monster({ templateId: 'skeleton' });
  assert.equal(drAmount(skel, { damageTypes: ['slashing'] }), 5);
  assert.equal(drAmount(skel, { damageTypes: ['bludgeoning'] }), 0);
  const imp = new Monster({ templateId: 'imp' });
  assert.equal(drAmount(imp, { damageTypes: ['piercing'], material: 'silver' }), 0, 'either alternative bypasses DR 5/good or silver');
  assert.equal(drAmount(imp, { damageTypes: ['piercing'] }), 5);
  const before = imp.hp.current;
  const r = applyDamage(imp, [{ amount: 8, type: 'cold' }]);
  assert.equal(r.total, 0, 'imp resists cold 10');
  assert.equal(imp.hp.current, before);
  const ghoul = new Monster({ templateId: 'ghoul' });
  const healed = applyDamage(ghoul, [{ amount: 5, type: 'negative' }]);
  assert.equal(healed.total, 0, 'negative energy heals undead');
});

test('conditions: fear escalation, fatigue stacking, immunities', () => {
  const f = fighter();
  f.addCondition('shaken', 5);
  f.addCondition('shaken', 5);
  assert.ok(f.hasCondition('frightened'));
  f.addCondition('shaken', 5);
  assert.ok(f.hasCondition('panicked'));
  f.addCondition('fatigued', null);
  f.addCondition('fatigued', null);
  assert.ok(f.hasCondition('exhausted'));
  const z = new Monster({ templateId: 'zombie' });
  assert.equal(z.addCondition('shaken', 3), null, 'mindless undead are immune to fear');
  const before = f.save('will').total;
  f.removeConditions(['panicked']);
  assert.equal(f.save('will').total, before + 2);
});

test('spells: fireball damage, reflex half, evasion', () => {
  const w = make({ name: 'Ezren', class: 'wizard', scores: ARRAYS.int, racialBonus: 'int', feats: [{ id: 'toughness' }, { id: 'iron-will' }], choices: { school: 'universalist' } });
  const goblins = [new Monster({ templateId: 'goblin' }), new Monster({ templateId: 'goblin' })];
  const res = resolveSpell({ caster: w, spell: SPELLS.fireball, cl: 5, dc: 17, targets: goblins, rng: new RNG(5) });
  assert.equal(res.results.length, 2);
  for (const r of res.results) assert.ok(r.save);
  const rogue = make({ name: 'Merisiel', class: 'rogue', scores: ARRAYS.dex, racialBonus: 'dex', feats: [{ id: 'toughness' }, { id: 'iron-will' }] });
  levelTo(rogue, 'rogue', 1);
  const hpBefore = rogue.hp.current;
  const r2 = resolveSpell({ caster: w, spell: SPELLS.fireball, cl: 5, dc: 1, targets: [rogue], rng: scripted([10, 10, 10, 10, 10, 10, 10]) });
  assert.equal(r2.results[0].save.success, true);
  assert.equal(rogue.hp.current, hpBefore, 'evasion negates damage on a successful Reflex save');
});

test('spells: magic missile, buffs, cure vs undead, hold person', () => {
  const w = make({ name: 'Ezren', class: 'wizard', scores: ARRAYS.int, racialBonus: 'int', feats: [{ id: 'toughness' }, { id: 'iron-will' }], choices: { school: 'universalist' } });
  const g = new Monster({ templateId: 'goblin' });
  const mm = resolveSpell({ caster: w, spell: SPELLS['magic-missile'], cl: 9, dc: 0, targets: [g], rng: new RNG(2) });
  assert.ok(mm.results.length >= 1 && mm.results.length <= 5, 'one result per missile until the target drops');
  assert.equal(g.isAlive(), false, 'five missiles (CL 9) kill a 6 hp goblin');
  assert.ok(mm.results.every((r) => r.damage >= 2 && r.damage <= 5));
  const f = fighter();
  const acBefore = f.acSummary().ac;
  resolveSpell({ caster: w, spell: SPELLS['shield-of-faith'], cl: 6, dc: 0, targets: [f], rng: new RNG(1) });
  assert.equal(f.acSummary().ac, acBefore + 3);
  resolveSpell({ caster: w, spell: SPELLS['mage-armor'], cl: 1, dc: 0, targets: [f], rng: new RNG(1) });
  assert.equal(f.acSummary().ac, acBefore + 3, 'mage armor (+4 armor) does not stack with scale mail (+5 armor)');
  const z = new Monster({ templateId: 'zombie' });
  const before = z.hp.current;
  resolveSpell({ caster: w, spell: SPELLS['cure-light-wounds'], cl: 1, dc: 1, targets: [z], rng: new RNG(1) });
  assert.ok(z.hp.current < before, 'cure spells damage undead');
  const bandit = new Monster({ templateId: 'bandit' });
  const hold = resolveSpell({ caster: w, spell: SPELLS['hold-person'], cl: 5, dc: 99, targets: [bandit], rng: new RNG(1) });
  assert.equal(hold.results[0].condition, 'paralyzed');
  assert.ok(bandit.hasFlag('helpless'));
  assert.equal(bandit.ability('dex'), 0);
});

test('maneuvers: trip and grapple', () => {
  const f = fighter();
  const g = new Monster({ templateId: 'goblin' });
  const r = maneuvers.perform(f, g, 'trip', { rng: scripted([20]) });
  assert.equal(r.success, true);
  assert.ok(g.hasCondition('prone'));
  assert.equal(r.provoked, true);
  const gr = maneuvers.perform(f, new Monster({ templateId: 'goblin' }), 'grapple', { rng: scripted([20]) });
  assert.equal(gr.success, true);
  assert.ok(f.hasFlag('grappled'));
  const big = maneuvers.perform(new Monster({ templateId: 'goblin' }), new Monster({ templateId: 'hill-giant' }), 'trip', { rng: scripted([20]) });
  assert.equal(big.success, false, 'a Small creature cannot trip a Large one (two sizes larger)');
  assert.match(big.note, /too large/);
});

test('class abilities: rage, smite evil, channel energy', () => {
  const b = make({ name: 'Amiri', class: 'barbarian', alignment: 'CN', feats: [{ id: 'power-attack' }, { id: 'toughness' }] });
  const str = b.ability('str');
  const res = classAbilities.useAbility(b, 'rage', { options: { rounds: 3 }, rng: new RNG(1) });
  assert.equal(res.rounds, 3);
  assert.equal(b.ability('str'), str + 4);
  assert.ok(b.hasFlag('raging'));
  for (let i = 0; i < 3; i++) b.tickEffects(1);
  assert.ok(!b.hasFlag('raging'));
  assert.ok(b.hasCondition('fatigued'), 'fatigued after rage');

  const p = make({ name: 'Seelah', class: 'paladin', alignment: 'LG', scores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 14 }, feats: [{ id: 'power-attack' }, { id: 'toughness' }] });
  const ghoul = new Monster({ templateId: 'ghoul' });
  classAbilities.useAbility(p, 'smite-evil', { target: ghoul, rng: new RNG(1) });
  const enc = new Encounter({ rng: new RNG(1) });
  enc.add(p, 'a');
  enc.add(ghoul, 'b', { position: { x: 1, y: 0 } });
  const prof = p.attackProfiles().find((x) => x.melee);
  const ctx = enc.offenseContext(p, ghoul, prof);
  assert.equal(ctx.smite, true);
  assert.equal(ctx.smiteDamage, 2, 'first hit doubles paladin level vs undead');

  const c = make({ name: 'Kyra', class: 'cleric', alignment: 'NG', deity: 'the-dawnflame', scores: ARRAYS.wis, racialBonus: 'wis', feats: [{ id: 'toughness' }, { id: 'improved-initiative' }], choices: { domains: ['healing', 'sun'] } });
  const z = new Monster({ templateId: 'zombie' });
  const ch = classAbilities.useAbility(c, 'channel-energy', { options: { mode: 'harm', nearby: [z] }, rng: new RNG(1) });
  assert.equal(ch.results.length, 1);
});

test('encounter: initiative, flat-footed, AoO on casting, XP awards', () => {
  const rng = new RNG(42);
  const f = fighter();
  const w = make({ name: 'Ezren', class: 'wizard', scores: ARRAYS.int, racialBonus: 'int', feats: [{ id: 'toughness' }, { id: 'iron-will' }], choices: { school: 'universalist' }, spells: { spellbook: ['magic-missile'] } });
  sc.prepareSpells(w, 'wizard', ['magic-missile', 'magic-missile', 'ray-of-frost']);
  const enc = new Encounter({ rng });
  enc.add(f, 'players', { position: { x: 0, y: 0 } });
  enc.add(w, 'players', { position: { x: 0, y: 1 } });
  const g = new Monster({ templateId: 'goblin' });
  enc.add(g, 'monsters', { position: { x: 1, y: 1 } });
  enc.start();
  assert.equal(enc.state, 'active');
  // Drive the fight: players attack/cast on their turns; the AI acts on its own.
  let guard = 0;
  while (enc.state === 'active' && guard++ < 50) {
    const cur = enc.current();
    if (cur.id === f.id) enc.act(f.id, enc.distance(f, g) <= 5 ? { type: 'full-attack', target: g.id } : { type: 'move', toward: g.id });
    else if (cur.id === w.id) enc.act(w.id, { type: 'cast', spell: 'ray-of-frost', target: g.id, defensive: true });
    if (enc.state === 'active' && enc.current().id === cur.id) enc.act(cur.id, { type: 'end-turn' });
  }
  assert.equal(enc.state, 'ended');
  assert.equal(enc.winner, 'players');
  const share = Math.floor(135 / 2);
  assert.equal(f.xp, share);
  assert.equal(w.xp, share);
  assert.ok(enc.log.some((e) => e.type === 'start'));
});

test('encounter: action economy is enforced', () => {
  const f = fighter();
  const g = new Monster({ templateId: 'goblin' });
  const enc = new Encounter({ rng: new RNG(9) });
  enc.add(f, 'p', { position: { x: 0, y: 0 } });
  enc.add(g, 'm', { position: { x: 8, y: 0 } });
  enc.start();
  while (enc.current().id !== f.id) enc.endTurn();
  enc.act(f.id, { type: 'move', toward: g.id });
  assert.throws(() => enc.act(f.id, { type: 'full-attack', target: g.id }), /full-round|No full/);
  assert.throws(() => enc.act(g.id, { type: 'attack', target: f.id }), /not your turn/);
});

test('sneak attack applies when flanking', () => {
  const r = make({ name: 'Merisiel', class: 'rogue', scores: ARRAYS.dex, racialBonus: 'dex', feats: [{ id: 'weapon-finesse' }, { id: 'toughness' }] });
  const f = fighter();
  const orc = new Monster({ templateId: 'troll' });
  const enc = new Encounter({ rng: new RNG(4) });
  enc.add(r, 'p', { position: { x: 0, y: 1 } });
  enc.add(f, 'p', { position: { x: 2, y: 1 } });
  enc.add(orc, 'm', { position: { x: 1, y: 1 } });
  const prof = r.attackProfiles().find((p) => p.melee);
  const ctx = enc.offenseContext(r, orc, prof);
  assert.equal(ctx.flanking, true);
  assert.equal(ctx.sneakAttackDice, 1);
});
