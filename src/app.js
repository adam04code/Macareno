'use strict';

const express = require('express');
const path = require('path');
const { Store } = require('./world/store');
const { Accounts } = require('./world/accounts');
const { World } = require('./world/world');
const commands = require('./world/commands');
const { sheet } = require('./world/sheet');
const builder = require('./engine/builder');
const spellcasting = require('./engine/spellcasting');
const inventory = require('./engine/inventory');
const dice = require('./engine/dice');
const { Monster } = require('./engine/monster');
const { Encounter } = require('./engine/combat');
const { RNG } = require('./engine/rng');
const { compendiumRouter, plain } = require('./api/compendium');
const { BESTIARY } = require('./data/bestiary');

/**
 * Build the Express app plus the World it serves.
 * opts: { dataDir (null = memory), seed, config (world config), pointBuy, admins: [usernames] }
 */
function createApp(opts = {}) {
  const store = new Store(opts.dataDir === undefined ? path.join(process.cwd(), 'var') : opts.dataDir);
  const rng = opts.seed !== undefined ? new RNG(opts.seed) : undefined;
  const accounts = new Accounts(store, { admins: opts.admins });
  const world = new World({ store, rng, config: opts.config });
  const pointBuy = opts.pointBuy ?? 20;

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', opts.corsOrigin || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  // ------------------------------------------------------------ helpers
  const wrap = (fn) => (req, res, next) => {
    try {
      const out = fn(req, res);
      if (out !== undefined && !res.headersSent) res.json(plain(out));
    } catch (e) {
      next(e);
    }
  };
  const auth = (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
    const account = accounts.authenticate(token);
    if (!account) return res.status(401).json({ error: 'Authentication required' });
    req.account = account;
    req.token = token;
    return next();
  };
  const admin = (req, res, next) => (req.account.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' }));
  const ownChar = (req, id) => {
    const charId = id || req.params.id || req.body.characterId || req.query.characterId;
    if (!charId) throw Object.assign(new Error('characterId required'), { status: 400 });
    const c = world.loadCharacter(charId);
    if (c.accountId !== req.account.id && req.account.role !== 'admin') throw Object.assign(new Error('Not your character'), { status: 403 });
    return c;
  };

  // ------------------------------------------------------------ public
  app.get('/api/health', (req, res) => res.json({ ok: true, online: world.online.size, encounters: [...world.encounters.values()].filter((e) => e.state === 'active').length, time: world.timeOfDay() }));
  app.get('/api', (req, res) => res.json({ name: 'Macareno', rules: 'Pathfinder Roleplaying Game (1st Edition) — Open Game License content', docs: '/api/docs' }));
  app.get('/api/docs', (req, res) => res.sendFile(path.join(__dirname, '..', 'docs', 'API.md')));
  app.use('/api/compendium', compendiumRouter());
  app.post('/api/dice/roll', wrap((req) => dice.roll(req.body.expression || '1d20', world.rng)));

  // ------------------------------------------------------------ auth
  app.post('/api/auth/register', wrap((req, res) => {
    const a = accounts.register(req.body.username, req.body.password);
    res.status(201);
    return a;
  }));
  app.post('/api/auth/login', wrap((req) => accounts.login(req.body.username, req.body.password)));
  app.post('/api/auth/logout', auth, wrap((req) => {
    accounts.logout(req.token);
    return { ok: true };
  }));
  app.get('/api/auth/me', auth, wrap((req) => accounts.publicAccount(req.account)));

  // ------------------------------------------------------------ characters
  app.get('/api/characters', auth, wrap((req) => req.account.characters.map((id) => {
    try {
      const c = world.loadCharacter(id);
      return { id, name: c.name, race: c.race, level: c.hitDice(), classes: c.classes, status: c.status, online: world.online.has(id) };
    } catch (e) {
      return null;
    }
  }).filter(Boolean)));

  app.post('/api/characters/roll-abilities', auth, wrap((req) => {
    const arr = builder.rollAbilityArray(world.rng);
    req.account.rolledArray = arr;
    accounts.save(req.account);
    return { rolled: arr, note: 'Assign these six scores with abilities.method = "rolled".' };
  }));

  app.post('/api/characters', auth, wrap((req, res) => {
    if (req.account.characters.length >= 10) throw Object.assign(new Error('Character limit reached (10)'), { status: 409 });
    const taken = [...world.characters.values()].some((c) => c.name.toLowerCase() === String(req.body.name || '').toLowerCase()) || store.all('characters').some((c) => c.name.toLowerCase() === String(req.body.name || '').toLowerCase());
    if (taken) throw Object.assign(new Error('That name is taken'), { status: 409 });
    const char = builder.createCharacter(req.body, { pointBuy, rolledArray: req.account.rolledArray, accountId: req.account.id, allowFree: req.account.role === 'admin' });
    world.addCharacter(char);
    req.account.characters.push(char.id);
    if (req.body.abilities && req.body.abilities.method === 'rolled') delete req.account.rolledArray;
    accounts.save(req.account);
    res.status(201);
    return sheet(char);
  }));

  app.get('/api/characters/:id', auth, wrap((req) => sheet(ownChar(req))));
  app.get('/api/characters/:id/raw', auth, wrap((req) => ownChar(req).toJSON()));
  app.delete('/api/characters/:id', auth, wrap((req) => {
    const c = ownChar(req);
    world.deleteCharacter(c.id);
    req.account.characters = req.account.characters.filter((x) => x !== c.id);
    accounts.save(req.account);
    return { deleted: c.id };
  }));

  app.get('/api/characters/:id/eligible-classes', auth, wrap((req) => builder.eligibleClasses(ownChar(req))));
  app.get('/api/characters/:id/level-up/:classId', auth, wrap((req) => builder.levelUpPreview(ownChar(req), req.params.classId)));
  app.post('/api/characters/:id/level-up', auth, wrap((req) => {
    const c = ownChar(req);
    if (world.encounterOf(c.id)) throw Object.assign(new Error('Cannot level up during combat'), { status: 409 });
    const r = builder.levelUp(c, req.body, { rng: world.rng, force: req.account.role === 'admin' && req.body.force, hpMethod: world.config.hpMethod });
    world.markDirty(c);
    world.send(c.id, { type: 'level-up', text: `You are now level ${r.level}!` });
    return { ...r, sheet: sheet(c) };
  }));

  app.post('/api/characters/:id/checks', auth, wrap((req) => {
    const c = ownChar(req);
    const { kind, id, dc, take10, take20, tags, circumstance } = req.body;
    if (!world.online.has(c.id)) world.characters.set(c.id, c);
    return world.check(c.id, kind, id, { dc, take10, take20, tags, circumstance });
  }));

  app.post('/api/characters/:id/equip', auth, wrap((req) => {
    const c = ownChar(req);
    if (world.encounterOf(c.id)) return world.combatAction(c.id, { type: 'equip', item: req.body.item, slot: req.body.slot });
    const r = inventory.equip(c, req.body.item, req.body.slot, { twoHanded: req.body.twoHanded });
    world.markDirty(c);
    return r;
  }));
  app.post('/api/characters/:id/unequip', auth, wrap((req) => {
    const c = ownChar(req);
    const r = inventory.unequip(c, req.body.item);
    world.markDirty(c);
    return r;
  }));
  app.get('/api/characters/:id/inventory', auth, wrap((req) => inventory.describeInventory(ownChar(req))));

  app.get('/api/characters/:id/spells', auth, wrap((req) => spellcasting.summary(ownChar(req))));
  app.post('/api/characters/:id/spells/prepare', auth, wrap((req) => {
    const c = ownChar(req);
    if (world.encounterOf(c.id)) throw Object.assign(new Error('Cannot prepare spells in combat'), { status: 409 });
    const r = spellcasting.prepareSpells(c, req.body.classId, req.body.spells || []);
    world.markDirty(c);
    return r;
  }));
  app.post('/api/characters/:id/spells/learn', auth, wrap((req) => {
    const c = ownChar(req);
    const { classId, spell, fromScroll } = req.body;
    const cls = require('./data/classes').CLASSES[classId];
    if (!cls || !cls.spellcasting) throw Object.assign(new Error('Not a spellcasting class'), { status: 400 });
    if (cls.spellcasting.spellbook) {
      // Copying into a spellbook: Spellcraft DC 15 + spell level, 10 gp per page (1 page/level, min 1).
      const { SPELLS, spellLevelFor } = require('./data/spells');
      const s = SPELLS[spell];
      if (!s) throw Object.assign(new Error('Unknown spell'), { status: 400 });
      const lvl = spellLevelFor(s, cls.spellcasting.list);
      if (fromScroll) {
        const inst = world.findInventoryItem(c, fromScroll);
        const def = require('./data/equipment').ITEMS[inst.itemId];
        if (def.kind !== 'scroll' || def.spell !== spell) throw Object.assign(new Error('That scroll does not contain the spell'), { status: 400 });
      } else if (req.account.role !== 'admin') throw Object.assign(new Error('Wizards and magi learn new spells from scrolls or spellbooks (fromScroll) or at level-up'), { status: 400 });
      const check = require('./engine/checks').skillCheck(c, 'spellcraft', { dc: 15 + lvl, rng: world.rng });
      if (!check.success) return { learned: false, check };
      inventory.pay(c, 10 * 100 * Math.max(1, lvl));
      if (fromScroll) inventory.removeItem(c, world.findInventoryItem(c, fromScroll).uid, 1);
      const r = spellcasting.learnSpell(c, classId, spell);
      world.markDirty(c);
      return { learned: true, check, ...r };
    }
    if (req.account.role !== 'admin') throw Object.assign(new Error('Spontaneous casters learn spells when they level up'), { status: 400 });
    const r = spellcasting.learnSpell(c, classId, spell);
    world.markDirty(c);
    return r;
  }));
  app.post('/api/characters/:id/toggles', auth, wrap((req) => {
    const c = ownChar(req);
    for (const k of ['powerAttack', 'deadlyAim', 'combatExpertise', 'rapidShot', 'autoBattle', 'fightingDefensively']) if (req.body[k] !== undefined) c.toggles[k] = !!req.body[k];
    c.touch();
    world.markDirty(c);
    return c.toggles;
  }));

  // ------------------------------------------------------------ world
  app.post('/api/world/enter', auth, wrap((req) => {
    const c = ownChar(req, req.body.characterId);
    return world.enter(c.id, req.account.role === 'admin' ? undefined : req.account.id);
  }));
  app.post('/api/world/leave', auth, wrap((req) => {
    const c = ownChar(req, req.body.characterId);
    world.leave(c.id);
    return { ok: true };
  }));
  app.post('/api/world/command', auth, wrap((req) => {
    const c = ownChar(req, req.body.characterId);
    if (!world.online.has(c.id)) world.enter(c.id);
    return commands.execute(world, c.id, req.body.command);
  }));
  app.post('/api/world/action', auth, wrap((req) => {
    const c = ownChar(req, req.body.characterId);
    if (!world.online.has(c.id)) world.enter(c.id);
    return worldAction(world, c.id, req.body.action || {});
  }));
  app.get('/api/world/events', auth, wrap((req) => {
    const c = ownChar(req, req.query.characterId);
    return world.events(c.id, Number(req.query.since || 0));
  }));
  app.get('/api/world/room', auth, wrap((req) => {
    const c = ownChar(req, req.query.characterId);
    return world.roomView(c);
  }));
  app.get('/api/world/who', auth, wrap(() => world.who()));
  app.get('/api/world/time', wrap(() => world.timeOfDay()));
  app.get('/api/world/zones', wrap(() => Object.entries(world.zones).map(([id, z]) => ({ id, ...z, rooms: [...world.rooms.values()].filter((r) => r.zone === id).map((r) => ({ id: r.id, name: r.name, exits: r.exits, flags: r.flags })) }))));
  app.get('/api/world/party', auth, wrap((req) => world.partyView(ownChar(req, req.query.characterId).id)));

  // ------------------------------------------------------------ combat
  app.get('/api/combat/:characterId', auth, wrap((req) => {
    const c = ownChar(req, req.params.characterId);
    const enc = world.encounterOf(c.id);
    return enc ? enc.snapshot(c.id) : { state: 'none' };
  }));
  app.post('/api/combat/:characterId/action', auth, wrap((req) => {
    const c = ownChar(req, req.params.characterId);
    return world.combatAction(c.id, req.body);
  }));

  // ------------------------------------------------------------ admin
  app.post('/api/admin/spawn', auth, admin, wrap((req) => {
    const room = world.room(req.body.roomId);
    if (!BESTIARY[req.body.monster]) throw Object.assign(new Error('Unknown monster'), { status: 400 });
    const out = [];
    for (let i = 0; i < (req.body.count || 1); i++) {
      const m = new Monster({ templateId: req.body.monster }, { rollHp: true, rng: world.rng });
      m.aggressive = !!req.body.aggressive;
      room.monsters.set(m.id, m);
      out.push(m.id);
    }
    world.broadcastRoom(room.id, { type: 'spawn', text: `${BESTIARY[req.body.monster].name} appears!` });
    return { spawned: out };
  }));
  app.post('/api/admin/grant', auth, admin, wrap((req) => {
    const c = world.loadCharacter(req.body.characterId);
    if (req.body.xp) c.xp += Number(req.body.xp);
    if (req.body.gold) inventory.earn(c, Math.round(Number(req.body.gold) * 100));
    if (req.body.item) inventory.addItem(c, inventory.createItem(req.body.item, req.body.itemOptions || {}));
    c.touch();
    world.markDirty(c);
    return sheet(c);
  }));
  app.post('/api/admin/teleport', auth, admin, wrap((req) => {
    const c = world.loadCharacter(req.body.characterId);
    world.room(req.body.roomId);
    c.location = { ...c.location, roomId: req.body.roomId };
    world.markDirty(c);
    if (world.online.has(c.id)) world.send(c.id, { type: 'look', text: world.describeRoom(c), data: world.roomView(c) });
    return { ok: true };
  }));
  app.post('/api/admin/heal', auth, admin, wrap((req) => {
    const c = world.loadCharacter(req.body.characterId);
    c.status = 'alive';
    c.effects = [];
    c.abilityDamage = {};
    c.negativeLevels = { temporary: 0, permanent: 0 };
    c.touch();
    c.hp = { current: c.maxHp(), temp: 0, nonlethal: 0 };
    spellcasting.restoreSlots(c);
    c.restoreResources();
    world.markDirty(c);
    return sheet(c);
  }));
  /** Run a fully AI-driven battle between characters and/or monsters (balancing and testing). */
  app.post('/api/admin/simulate', auth, admin, wrap((req) => {
    const enc = new Encounter({ rng: req.body.seed !== undefined ? new RNG(req.body.seed) : world.rng });
    const sides = req.body.sides || {};
    for (const [side, members] of Object.entries(sides)) {
      members.forEach((m, i) => {
        const cr = m.monster ? new Monster({ templateId: m.monster }) : (() => {
          const { Character } = require('./engine/character');
          return new Character(JSON.parse(JSON.stringify(world.loadCharacter(m.character).toJSON())));
        })();
        enc.add(cr, side, { controller: 'ai', position: { x: i * 2, y: Object.keys(sides).indexOf(side) * 5 } });
      });
    }
    enc.start();
    let guard = 0;
    while (enc.state === 'active' && guard++ < 2000) {
      const cur = enc.current();
      enc.runAi(cur);
    }
    return { winner: enc.winner, rounds: enc.round, log: enc.log.map((e) => e.text) };
  }));

  // ------------------------------------------------------------ errors
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((e, req, res, next) => {
    const status = e.status || (e.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(e);
    res.status(status).json({ error: e.message, ...(e.details ? { details: e.details } : {}) });
  });

  return { app, world, accounts, store };
}

/** Structured (non-text) world actions for graphical clients. */
function worldAction(world, charId, a) {
  switch (a.type) {
    case 'look': return world.roomView(world.loadCharacter(charId));
    case 'move': return world.move(charId, a.direction);
    case 'say': return world.say(charId, a.text), { ok: true };
    case 'emote': return world.emote(charId, a.text), { ok: true };
    case 'tell': return world.tell(charId, a.to, a.text), { ok: true };
    case 'shout': return world.shout(charId, a.text), { ok: true };
    case 'attack': return world.attack(charId, a.target);
    case 'cast': return world.cast(charId, a);
    case 'ability': return world.useAbility(charId, a.ability, a);
    case 'use-item': return world.useItem(charId, a.item, a.target);
    case 'pick-up': return world.pickUp(charId, a.item);
    case 'drop': return world.drop(charId, a.item, a.qty);
    case 'give': return world.give(charId, a.item, a.to, a.qty);
    case 'give-money': return world.giveMoney(charId, a.gp, a.to);
    case 'shop': return world.shopList(charId);
    case 'buy': return world.buy(charId, a.item, a.qty || 1);
    case 'sell': return world.sell(charId, a.item, a.qty);
    case 'service': return world.templeService(charId, a.spell, a.target);
    case 'rest': return world.rest(charId, { bed: a.bed });
    case 'respawn': return world.respawn(charId);
    case 'feature': return world.useFeature(charId, a.feature, a);
    case 'identify': return world.identify(charId, a.target);
    case 'party-invite': return world.invite(charId, a.name);
    case 'party-accept': return world.acceptInvite(charId);
    case 'party-leave': return world.leaveParty(charId), { ok: true };
    case 'party-chat': return world.partyChat(charId, a.text), { ok: true };
    case 'sneak': return (world.session(charId).sneaking = !!a.on), { sneaking: !!a.on };
    case 'follow': return (world.session(charId).follow = !!a.on), { follow: !!a.on };
    case 'combat': return world.combatAction(charId, a.action || {});
    default:
      throw Object.assign(new Error(`Unknown world action ${a.type}`), { status: 400 });
  }
}

module.exports = { createApp, worldAction };
