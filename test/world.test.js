'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const WebSocket = require('ws');
const { createApp } = require('../src/app');
const { attachWebSocket } = require('../src/net/ws');
const commands = require('../src/world/commands');
const { ARRAYS } = require('./helpers');

async function boot() {
  const ctx = createApp({ dataDir: null, seed: 11, config: { restSeconds: 0, turnTimeoutMs: 600000 } });
  const server = http.createServer(ctx.app);
  attachWebSocket(server, ctx);
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { ...ctx, server, base, call, close: () => new Promise((r) => { ctx.world.stop(); server.close(r); }) };
}

const FIGHTER = {
  name: 'Brannoc', race: 'dwarf', alignment: 'LG', class: 'fighter',
  abilities: { method: 'pointbuy', scores: ARRAYS.str }, feats: [{ id: 'power-attack' }, { id: 'weapon-focus', param: 'battleaxe' }],
  skills: { climb: 1, intimidate: 1 },
};

test('API: auth, compendium, character lifecycle, world commands', async () => {
  const s = await boot();
  try {
    assert.equal((await s.call('GET', '/api/health')).body.ok, true);
    const comp = (await s.call('GET', '/api/compendium')).body;
    assert.ok(comp.counts.spells > 200 && comp.counts.monsters > 90 && comp.counts.feats > 150 && comp.counts.classes === 18);
    const duelist = (await s.call('GET', '/api/compendium/classes/duelist')).body;
    assert.equal(duelist.levels['10'].bab, 10);
    assert.equal((await s.call('GET', '/api/compendium/monsters/troll')).body.ac, 16);
    assert.equal((await s.call('GET', '/api/compendium/spells/fireball')).body.school, 'evocation');

    assert.equal((await s.call('POST', '/api/auth/register', { username: 'alice', password: 'short' })).status, 400);
    assert.equal((await s.call('POST', '/api/auth/register', { username: 'alice', password: 'correct horse' })).status, 201);
    assert.equal((await s.call('POST', '/api/auth/login', { username: 'alice', password: 'wrong password' })).status, 401);
    const { token } = (await s.call('POST', '/api/auth/login', { username: 'alice', password: 'correct horse' })).body;
    assert.equal((await s.call('GET', '/api/characters')).status, 401);

    const bad = await s.call('POST', '/api/characters', { ...FIGHTER, feats: [] }, token);
    assert.equal(bad.status, 400);
    assert.ok(bad.body.details.length);
    const created = await s.call('POST', '/api/characters', FIGHTER, token);
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal(created.body.race, 'Dwarf');
    assert.equal(created.body.speed, 20);

    const enter = await s.call('POST', '/api/world/enter', { characterId: id }, token);
    assert.equal(enter.body.room, 'brindlemoor:square');
    const look = await s.call('POST', '/api/world/command', { characterId: id, command: 'look' }, token);
    assert.match(look.body.text, /Brindlemoor Square/);
    const shop = await s.call('POST', '/api/world/command', { characterId: id, command: 'east' }, token);
    assert.match(shop.body.text, /Copperpenny Market/);
    const buy = await s.call('POST', '/api/world/command', { characterId: id, command: 'buy torch' }, token);
    assert.match(buy.body.text, /You buy Torch/);
    const chk = await s.call('POST', `/api/characters/${id}/checks`, { kind: 'skill', id: 'climb', dc: 10, take10: true }, token);
    assert.equal(chk.body.roll, 10);
    const ev = await s.call('GET', `/api/world/events?characterId=${id}&since=0`, null, token);
    assert.ok(ev.body.length >= 2);
    const unknown = await s.call('POST', '/api/world/command', { characterId: id, command: 'dance wildly' }, token);
    assert.equal(unknown.status, 400);

    // Another account cannot touch this character.
    await s.call('POST', '/api/auth/register', { username: 'mallory', password: 'password123' });
    const t2 = (await s.call('POST', '/api/auth/login', { username: 'mallory', password: 'password123' })).body.token;
    assert.equal((await s.call('GET', `/api/characters/${id}`, null, t2)).status, 403);
  } finally {
    await s.close();
  }
});

test('world: aggressive monsters start combat, combat resolves with loot and XP', async () => {
  const s = await boot();
  try {
    await s.call('POST', '/api/auth/register', { username: 'bob', password: 'password123' });
    const { token } = (await s.call('POST', '/api/auth/login', { username: 'bob', password: 'password123' })).body;
    const { id } = (await s.call('POST', '/api/characters', { ...FIGHTER, name: 'Grunda' }, token)).body;
    // Admin (first account) boosts the hero so the fight is decisive.
    await s.call('POST', '/api/admin/grant', { characterId: id, xp: 5000 }, token);
    const world = s.world;
    world.enter(id);
    commands.execute(world, id, 'north');
    commands.execute(world, id, 'north');
    commands.execute(world, id, 'east');
    const enc = world.encounterOf(id);
    assert.ok(enc, 'wolves in the den attack on sight');
    const char = world.characters.get(id);
    char.hp.current = 500; // keep the test hero standing
    let guard = 0;
    while (world.encounterOf(id) && guard++ < 60) {
      const e = world.encounterOf(id);
      if (e.current() && e.current().id === id) {
        try {
          commands.execute(world, id, 'full');
        } catch (x) {
          commands.execute(world, id, 'approach');
        }
        if (world.encounterOf(id) && e.current() && e.current().id === id) commands.execute(world, id, 'end');
      }
    }
    await new Promise((r) => setImmediate(r));
    assert.equal(world.encounterOf(id), null);
    assert.ok(char.xp > 5000, 'XP awarded for defeated wolves');
    const room = world.room('thornwood:den');
    assert.equal([...room.monsters.values()].length, 0);
  } finally {
    await s.close();
  }
});

test('world: resting, temple service, dying and respawn', async () => {
  const s = await boot();
  try {
    await s.call('POST', '/api/auth/register', { username: 'carol', password: 'password123' });
    const { token } = (await s.call('POST', '/api/auth/login', { username: 'carol', password: 'password123' })).body;
    const { id } = (await s.call('POST', '/api/characters', { ...FIGHTER, name: 'Hilda' }, token)).body;
    const world = s.world;
    world.enter(id);
    const c = world.characters.get(id);
    c.takeDamage(5);
    commands.execute(world, id, 'rest');
    assert.equal(c.hp.current, c.maxHp() - 5 + 1, 'natural healing: 1 hp per level');
    commands.execute(world, id, 'west');
    c.money += 100000;
    commands.execute(world, id, 'service cure-light-wounds');
    c.takeDamage(c.hp.current + 100);
    assert.equal(c.status, 'dead');
    commands.execute(world, id, 'respawn');
    assert.equal(c.status, 'alive');
    assert.equal(c.abilityDrain.con, 2, 'raise dead on a 1st-level character drains 2 Con');
  } finally {
    await s.close();
  }
});

test('WebSocket: enter, text commands and live events', async () => {
  const s = await boot();
  try {
    await s.call('POST', '/api/auth/register', { username: 'dave', password: 'password123' });
    const { token } = (await s.call('POST', '/api/auth/login', { username: 'dave', password: 'password123' })).body;
    const { id } = (await s.call('POST', '/api/characters', { ...FIGHTER, name: 'Durgen' }, token)).body;
    const ws = new WebSocket(`${s.base.replace('http', 'ws')}/ws?token=${token}`);
    const events = [];
    ws.on('message', (m) => {
      const msg = JSON.parse(m);
      if (msg.type === 'event') events.push(msg.event);
    });
    await new Promise((r) => ws.on('open', r));
    const request = (msg) => new Promise((resolve) => {
      const rid = Math.random().toString(36).slice(2);
      const h = (m) => {
        const x = JSON.parse(m);
        if (x.type === 'result' && x.id === rid) {
          ws.off('message', h);
          resolve(x);
        }
      };
      ws.on('message', h);
      ws.send(JSON.stringify({ id: rid, ...msg }));
    });
    assert.equal((await request({ type: 'enter', characterId: id })).ok, true);
    const r = await request({ type: 'command', text: 'say Hello, Brindlemoor!' });
    assert.equal(r.ok, true);
    const bad = await request({ type: 'command', text: 'fly to the moon' });
    assert.equal(bad.ok, false);
    const act = await request({ type: 'action', action: { type: 'move', direction: 'north' } });
    assert.equal(act.ok, true);
    await new Promise((res) => setTimeout(res, 50));
    assert.ok(events.some((e) => e.type === 'say'));
    assert.ok(events.some((e) => e.type === 'look' && /North Gate/.test(e.text)));
    ws.close();
  } finally {
    await s.close();
  }
});
