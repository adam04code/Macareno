'use strict';

const dice = require('../engine/dice');
const inventory = require('../engine/inventory');
const spellcasting = require('../engine/spellcasting');
const T = require('../engine/tables');
const { SPELLS } = require('../data/spells');
const { FEATS } = require('../data/feats');
const { SKILLS } = require('../data/core');
const { getAbility } = require('../engine/classAbilities');
const { sheet } = require('./sheet');
const { expandDir } = require('./world');

/**
 * Text command interpreter for text clients. Parses a line like
 * "cast magic missile at goblin 2" into a world/encounter action and returns
 * { text, data }. Structured clients can call the REST/WS actions directly.
 */

const DIRS = ['north', 'south', 'east', 'west', 'up', 'down', 'northeast', 'northwest', 'southeast', 'southwest', 'n', 's', 'e', 'w', 'u', 'd', 'ne', 'nw', 'se', 'sw'];
const STEP = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0], northeast: [1, -1], northwest: [-1, -1], southeast: [1, 1], southwest: [-1, 1] };
const METAMAGIC = { empowered: 'empower-spell', empower: 'empower-spell', maximized: 'maximize-spell', maximize: 'maximize-spell', extended: 'extend-spell', extend: 'extend-spell', quickened: 'quicken-spell', quicken: 'quicken-spell', silent: 'silent-spell', still: 'still-spell', enlarged: 'enlarge-spell', widened: 'widen-spell', heightened: 'heighten-spell' };
const TOGGLES = { 'power-attack': 'powerAttack', 'deadly-aim': 'deadlyAim', 'combat-expertise': 'combatExpertise', 'rapid-shot': 'rapidShot', 'auto-battle': 'autoBattle', 'fight-defensively': 'fightingDefensively' };

function err(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const slug = (s) => String(s || '').trim().toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-');

/** Split "X on Y" / "X at Y". */
function splitTarget(rest) {
  const m = /^(.*?)\s+(?:on|at|to|against)\s+(.+)$/i.exec(rest);
  return m ? [m[1].trim(), m[2].trim()] : [rest.trim(), null];
}

const HELP = `Commands:
  Exploration: look, <direction>|go <dir>, who, time, map
  Talk: say <msg>, emote <msg>, tell <name> <msg>, shout <msg>, party invite|accept|leave|list, p <msg>
  Character: score, inventory, equip <item> [offhand|twohanded], remove <item>, spells, abilities, feats, skills
  Items: get <item|all>, drop <item>, give <item> to <name>, use <item> [on <target>], list, buy <item> [xN], sell <item>
  Services: rest, service <spell> [target] (temple), respawn
  Magic: prepare <spell>, <spell>, ... [for <class>] | cast [empowered|maximized|...] <spell> [at <target>] [for <class>]
  Checks: check <skill> [dc N] [take10|take20], save <fort|ref|will> [dc N], <verb> <feature> (search/climb/swim/unlock...), identify <creature>
  Combat: attack <target>, full <target>, charge <target>, approach <target>, step <dir>, withdraw <dir>, flee, defend, stand,
          maneuver <trip|disarm|grapple|bull-rush|overrun|sunder|dirty-trick> <target>, feint <target>, demoralize <target>,
          ability <id> [on <target>], coup <target>, toggle <power-attack|deadly-aim|combat-expertise|rapid-shot|auto-battle|fight-defensively> [on|off],
          escape, end (end turn), status
  Stealth & movement: sneak on|off, follow on|off
  Dice: roll <expr>`;

function execute(world, charId, line) {
  const raw = String(line || '').trim();
  if (!raw) return { text: '' };
  const [first, ...restParts] = raw.split(/\s+/);
  const cmd = first.toLowerCase();
  const rest = restParts.join(' ');
  const char = world.loadCharacter(charId);
  const enc = world.encounterOf(charId);
  const combat = (action) => {
    const res = world.combatAction(charId, action);
    return { text: res.text || describeResult(res.result), data: res };
  };
  const target = (name) => {
    if (!enc) return name;
    const t = world.matchCombatant(enc, name, char);
    if (!t) throw err(`No combatant matches "${name}".`);
    return t.id;
  };
  const defaultEnemy = () => {
    const e = enc.enemiesOf(char).filter((x) => !['dying', 'stable'].includes(x.hpState())).sort((a, b) => enc.distance(char, a) - enc.distance(char, b))[0];
    if (!e) throw err('No enemies remain.');
    return e.id;
  };

  if (DIRS.includes(cmd) && !enc) {
    world.move(charId, expandDir(cmd));
    return { text: world.describeRoom(char), data: world.roomView(char) };
  }

  switch (cmd) {
    case 'help':
    case '?':
      return { text: HELP };
    case 'look':
    case 'l': {
      if (!rest) return { text: world.describeRoom(char), data: world.roomView(char) };
      const room = world.room(char.location.roomId);
      const t = enc ? world.matchCombatant(enc, rest, char) : world.matchTarget(room, rest, char);
      if (!t) throw err('You do not see that here.');
      const s = t.summary();
      return { text: `${t.name}: ${s.type}, ${s.size}. ${t.kind === 'monster' ? (t.def.description || '') : `Level ${t.hitDice()} ${t.race}.`} Condition: ${s.hp.state}${s.conditions.length ? `, ${s.conditions.join(', ')}` : ''}.`, data: s };
    }
    case 'go':
    case 'walk':
      world.move(charId, expandDir(rest.toLowerCase()));
      return { text: world.describeRoom(char), data: world.roomView(char) };
    case 'say':
    case "'":
      world.say(charId, rest);
      return { text: '' };
    case 'emote':
    case 'me':
      world.emote(charId, rest);
      return { text: '' };
    case 'tell':
    case 'whisper': {
      const [name, ...msg] = restParts;
      world.tell(charId, name, msg.join(' '));
      return { text: '' };
    }
    case 'shout':
      world.shout(charId, rest);
      return { text: '' };
    case 'who': {
      const list = world.who();
      return { text: `${list.length} adventurer(s) online:\n${list.map((w) => `  ${w.name} — level ${w.level} ${w.race} ${w.classes} (${w.zone})`).join('\n')}`, data: list };
    }
    case 'time': {
      const t = world.timeOfDay();
      return { text: `${t.text} (${t.period}).`, data: t };
    }
    case 'map': {
      const room = world.room(char.location.roomId);
      return { text: Object.entries(room.exits).map(([d, id]) => `${d}: ${world.room(id).name}`).join('\n'), data: room.exits };
    }
    case 'score':
    case 'sheet':
    case 'stats': {
      const s = sheet(char);
      return { text: sheetText(s), data: s };
    }
    case 'inventory':
    case 'inv':
    case 'i': {
      const inv = inventory.describeInventory(char);
      return { text: `Money: ${inv.moneyText}. Load: ${inv.load} (${inv.weight} lbs).\n${inv.items.map((i) => `  ${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}${i.equipped ? ` [${i.equipped}]` : ''}${i.charges !== undefined ? ` (${i.charges} charges)` : ''}`).join('\n') || '  (nothing)'}`, data: inv };
    }
    case 'equip':
    case 'wear':
    case 'wield': {
      if (enc) return combat({ type: 'equip', item: world.findInventoryItem(char, rest.replace(/\s+(offhand|twohanded)$/i, '')).uid });
      const m = /^(.*?)(?:\s+(offhand|off-hand|twohanded|two-handed))?$/i.exec(rest);
      const inst = world.findInventoryItem(char, m[1]);
      const res = inventory.equip(char, inst.uid, m[2] && /off/i.test(m[2]) ? 'offHand' : undefined, { twoHanded: m[2] && /two/i.test(m[2]) });
      world.markDirty(char);
      return { text: `You equip ${res.name} (${res.slot}).`, data: res };
    }
    case 'remove':
    case 'unequip': {
      const inst = world.findInventoryItem(char, rest);
      inventory.unequip(char, inst.uid);
      world.markDirty(char);
      return { text: `You remove ${inventory.displayName(inst)}.` };
    }
    case 'get':
    case 'take': {
      const r = world.pickUp(charId, rest);
      return { text: `You pick up ${r.taken.join(', ')}.`, data: r };
    }
    case 'drop': {
      const r = world.drop(charId, rest);
      return { text: `You drop ${r.dropped}.`, data: r };
    }
    case 'give': {
      const [what, who] = splitTarget(rest);
      if (!who) throw err('Give what to whom? (give <item> to <name>)');
      const gold = /^(\d+(?:\.\d+)?)\s*(gp|gold)$/i.exec(what);
      if (gold) {
        world.giveMoney(charId, Number(gold[1]), who);
        return { text: `You give ${gold[1]} gp to ${who}.` };
      }
      const r = world.give(charId, what, who);
      return { text: `You give ${r.given} to ${who}.`, data: r };
    }
    case 'list':
    case 'shop': {
      const r = world.shopList(charId);
      return { text: `${r.shop} sells:\n${r.items.map((i) => `  ${i.name} — ${i.priceGp} gp`).join('\n')}`, data: r };
    }
    case 'buy': {
      const m = /^(.*?)(?:\s+x(\d+))?$/i.exec(rest);
      const r = world.buy(charId, m[1], m[2] ? Number(m[2]) : 1);
      return { text: `You buy ${r.bought} for ${r.costText}. You have ${r.money} left.`, data: r };
    }
    case 'sell': {
      const r = world.sell(charId, rest);
      return { text: `You sell ${r.sold} for ${r.valueText}. You have ${r.money}.`, data: r };
    }
    case 'service': {
      const [spell, who] = [restParts[0], restParts.slice(1).join(' ') || null];
      const r = world.templeService(charId, slug(spell), who);
      return { text: `The priests cast ${r.service} (${r.cost}).`, data: r };
    }
    case 'rest':
    case 'sleep': {
      const r = world.rest(charId, { bed: /bed|room/i.test(rest) });
      return { text: `You begin resting (${r.seconds}s).`, data: r };
    }
    case 'respawn': {
      world.respawn(charId);
      return { text: 'You return to life at the temple.' };
    }
    case 'spells': {
      const s = spellcasting.summary(char);
      const lines = [];
      for (const [cls, info] of Object.entries(s)) {
        lines.push(`${cls} (CL ${info.casterLevel}, ${info.style}):`);
        for (const sl of info.slots) {
          const avail = (info.available[sl.level] || []).map((id) => SPELLS[id].name);
          const prepared = info.prepared ? (info.prepared[sl.level] || []).map((p) => `${SPELLS[p.spell].name}${p.used ? ' (cast)' : ''}`) : null;
          lines.push(`  Level ${sl.level}: ${sl.perDay} per day, used ${sl.used}${prepared ? ` | prepared: ${prepared.join(', ') || '-'}` : ''} | known: ${avail.join(', ') || '-'}`);
        }
      }
      return { text: lines.join('\n') || 'You cannot cast spells.', data: s };
    }
    case 'prepare': {
      const m = /^(.*?)(?:\s+for\s+([a-z-]+))?$/i.exec(rest);
      const classId = m[2] || char.casterClasses().find((id) => require('../data/classes').CLASSES[id].spellcasting.style === 'prepared');
      const list = m[1].split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
        const words = x.split(/\s+/);
        const metamagic = [];
        while (words.length > 1 && METAMAGIC[words[0].toLowerCase()]) metamagic.push(METAMAGIC[words.shift().toLowerCase()]);
        return { spell: slug(words.join(' ')), metamagic };
      });
      const r = spellcasting.prepareSpells(char, classId, list);
      world.markDirty(char);
      return { text: `You prepare ${list.length} spell(s) for ${classId}.`, data: r };
    }
    case 'cast':
    case 'c': {
      const m = /^(.*?)(?:\s+for\s+([a-z-]+))?$/i.exec(rest);
      let [spellPart, tgt] = splitTarget(m[1]);
      const words = spellPart.split(/\s+/);
      const metamagic = [];
      while (words.length > 1 && METAMAGIC[words[0].toLowerCase()]) metamagic.push(METAMAGIC[words.shift().toLowerCase()]);
      const defensive = words[0] && words[0].toLowerCase() === 'defensively' ? !!words.shift() : false;
      const spell = slug(words.join(' '));
      if (!SPELLS[spell]) throw err(`Unknown spell "${words.join(' ')}".`);
      const action = { spell, metamagic, classId: m[2], defensive };
      if (enc) {
        if (SPELLS[spell].effect.area && tgt) action.center = target(tgt);
        else if (tgt) action.target = target(tgt);
        else if (SPELLS[spell].effect.area) action.center = defaultEnemy();
        return combat({ type: 'cast', ...action });
      }
      const r = world.cast(charId, { ...action, target: tgt });
      return { text: r.queued ? `You begin combat by casting ${SPELLS[spell].name}!` : `You cast ${SPELLS[spell].name}. ${describeResult(r)}`, data: r };
    }
    case 'use': {
      const [item, tgt] = splitTarget(rest);
      const r = world.useItem(charId, item, tgt);
      return { text: describeResult(r.result || r), data: r };
    }
    case 'ability':
    case 'a': {
      const [ab, tgt] = splitTarget(rest);
      const id = slug(ab);
      if (!getAbility(id)) throw err(`Unknown ability "${ab}". Type "abilities" for a list.`);
      if (enc) return combat({ type: 'ability', ability: id, target: tgt ? target(tgt) : getAbility(id).target === 'enemy' ? defaultEnemy() : undefined });
      const r = world.useAbility(charId, id, { target: tgt });
      return { text: `You use ${r.name}.`, data: r };
    }
    case 'abilities': {
      const list = char.activatedAbilities().map((id) => ({ id, name: (getAbility(id) || {}).name || id }));
      const res = char.resources();
      return { text: `Abilities: ${list.map((a) => a.id).join(', ') || 'none'}\nResources: ${Object.entries(res).map(([k, v]) => `${k} ${v.remaining}/${v.max}`).join(', ') || 'none'}`, data: { abilities: list, resources: res } };
    }
    case 'feats':
      return { text: char.allFeats().map((f) => `${FEATS[f.id] ? FEATS[f.id].name : f.id}${f.param ? ` (${f.param})` : ''}`).join(', '), data: char.allFeats() };
    case 'skills': {
      const out = Object.keys(SKILLS).map((k) => ({ id: k, name: SKILLS[k].name, ...char.skill(k) }));
      return { text: out.map((s) => `${s.name} ${s.total >= 0 ? '+' : ''}${s.total}${s.ranks ? ` (${s.ranks} ranks)` : ''}`).join(', '), data: out };
    }
    case 'attack':
    case 'kill':
    case 'k':
    case 'hit': {
      if (!enc) {
        const snap = world.attack(charId, rest || null);
        return { text: 'Battle is joined!', data: snap };
      }
      return combat({ type: 'attack', target: rest ? target(rest) : defaultEnemy() });
    }
    case 'full':
    case 'fa':
      if (!enc) throw err('You are not in combat.');
      return combat({ type: 'full-attack', target: rest ? target(rest) : defaultEnemy() });
    case 'shoot':
    case 'fire':
      if (!enc) throw err('You are not in combat.');
      return combat({ type: 'full-attack', ranged: true, target: rest ? target(rest) : defaultEnemy() });
    case 'charge':
      if (!enc) throw err('You are not in combat.');
      return combat({ type: 'charge', target: rest ? target(rest) : defaultEnemy() });
    case 'approach':
    case 'move': {
      if (!enc) {
        world.move(charId, expandDir(rest.toLowerCase()));
        return { text: world.describeRoom(char), data: world.roomView(char) };
      }
      const dir = expandDir(rest.toLowerCase());
      if (STEP[dir]) {
        const pos = enc.get(charId).position;
        return combat({ type: 'move', to: { x: pos.x + STEP[dir][0] * 6, y: pos.y + STEP[dir][1] * 6 } });
      }
      return combat({ type: 'move', toward: rest ? target(rest) : defaultEnemy() });
    }
    case 'step': {
      if (!enc) throw err('You are not in combat.');
      const dir = expandDir(rest.toLowerCase());
      if (!STEP[dir]) throw err('step north|south|east|west|northeast|...');
      const pos = enc.get(charId).position;
      return combat({ type: 'step', to: { x: pos.x + STEP[dir][0], y: pos.y + STEP[dir][1] }, keepTurn: true });
    }
    case 'withdraw': {
      if (!enc) throw err('You are not in combat.');
      const dir = expandDir(rest.toLowerCase() || 'south');
      const pos = enc.get(charId).position;
      const v = STEP[dir] || [0, 1];
      return combat({ type: 'withdraw', to: { x: pos.x + v[0] * 12, y: pos.y + v[1] * 12 } });
    }
    case 'flee':
      if (!enc) throw err('You are not in combat.');
      return combat({ type: 'flee' });
    case 'defend':
      return combat({ type: 'total-defense' });
    case 'stand':
      return combat({ type: 'stand-up', keepTurn: true });
    case 'escape':
      return combat({ type: 'escape' });
    case 'end':
    case 'pass':
    case 'done':
      if (!enc) throw err('You are not in combat.');
      return combat({ type: 'end-turn' });
    case 'delay':
      return combat({ type: 'delay' });
    case 'maneuver':
    case 'trip':
    case 'disarm':
    case 'grapple':
    case 'bull-rush':
    case 'overrun':
    case 'sunder':
    case 'dirty-trick': {
      const type = cmd === 'maneuver' ? slug(restParts[0]) : cmd;
      const tgt = cmd === 'maneuver' ? restParts.slice(1).join(' ') : rest;
      return combat({ type: 'maneuver', maneuver: type, target: tgt ? target(tgt) : defaultEnemy() });
    }
    case 'feint':
      return combat({ type: 'feint', target: rest ? target(rest) : defaultEnemy(), keepTurn: true });
    case 'demoralize':
    case 'intimidate':
      return combat({ type: 'demoralize', target: rest ? target(rest) : defaultEnemy() });
    case 'coup':
      return combat({ type: 'coup-de-grace', target: target(rest) });
    case 'aid': {
      const [ally, foe] = splitTarget(rest);
      return combat({ type: 'aid-another', ally: target(ally), target: target(foe || '') || defaultEnemy() });
    }
    case 'stabilize':
      return combat({ type: 'heal-check', target: target(rest) });
    case 'toggle': {
      const [name, state] = restParts;
      const key = TOGGLES[slug(name)];
      if (!key) throw err(`Toggles: ${Object.keys(TOGGLES).join(', ')}`);
      const on = state ? /^(on|true|yes|1)$/i.test(state) : !char.toggles[key];
      char.toggles[key] = on;
      char.touch();
      world.markDirty(char);
      return { text: `${name} is now ${on ? 'ON' : 'OFF'}.`, data: char.toggles };
    }
    case 'status':
    case 'combat':
      if (!enc) return { text: 'You are not in combat.' };
      return { text: combatText(enc, charId), data: enc.snapshot(charId) };
    case 'party': {
      const sub = (restParts[0] || 'list').toLowerCase();
      const arg = restParts.slice(1).join(' ');
      if (sub === 'invite') return { text: `Invitation sent to ${arg}.`, data: world.invite(charId, arg) };
      if (sub === 'accept' || sub === 'join') return { text: 'You join the party.', data: world.acceptInvite(charId) };
      if (sub === 'leave') {
        world.leaveParty(charId);
        return { text: 'You leave the party.' };
      }
      if (sub === 'say') {
        world.partyChat(charId, arg);
        return { text: '' };
      }
      const p = world.partyView(charId);
      return { text: p ? p.members.map((m) => `${m.name}${m.id === p.leader ? ' (leader)' : ''} ${m.hp}/${m.maxHp} hp`).join('\n') : 'You are not in a party.', data: p };
    }
    case 'p':
      world.partyChat(charId, rest);
      return { text: '' };
    case 'follow': {
      const s = world.session(charId);
      s.follow = !/off/i.test(rest);
      return { text: `You will ${s.follow ? '' : 'no longer '}follow your party leader.` };
    }
    case 'sneak': {
      const s = world.session(charId);
      s.sneaking = !/off/i.test(rest);
      return { text: s.sneaking ? 'You move stealthily.' : 'You stop sneaking.' };
    }
    case 'check': {
      const m = /^([a-z -]+?)(?:\s+dc\s*(\d+))?(?:\s+(take10|take20))?$/i.exec(rest);
      if (!m) throw err('check <skill> [dc N] [take10|take20]');
      const sk = slug(m[1]);
      const r = world.check(charId, SKILLS[sk] ? 'skill' : 'ability', sk, { dc: m[2] ? Number(m[2]) : undefined, take10: m[3] === 'take10', take20: m[3] === 'take20' });
      return { text: `${r.name || r.label}: rolled ${r.roll} + ${r.bonus} = ${r.total}${r.dc !== undefined ? ` vs DC ${r.dc} — ${r.success ? 'success' : 'failure'}` : ''}.`, data: r };
    }
    case 'save': {
      const m = /^(fort|ref|will)\w*(?:\s+dc\s*(\d+))?$/i.exec(rest);
      if (!m) throw err('save <fort|ref|will> [dc N]');
      const r = world.check(charId, 'save', m[1].toLowerCase(), { dc: m[2] ? Number(m[2]) : undefined });
      return { text: `${r.label}: ${r.roll} + ${r.bonus} = ${r.total}${r.dc !== undefined ? ` vs DC ${r.dc} — ${r.success ? 'success' : 'failure'}` : ''}.`, data: r };
    }
    case 'identify':
    case 'recall': {
      const r = world.identify(charId, rest);
      return { text: r.success ? r.revealed.join(' ') : `You recall nothing useful (${r.total} vs DC ${r.dc}).`, data: r };
    }
    case 'roll': {
      const r = dice.roll(rest || '1d20');
      world.emote(charId, `rolls ${r.expression}: ${r.total}`);
      return { text: `${r.expression} = ${r.total}`, data: r };
    }
    case 'levelup': {
      const { levelUpPreview, eligibleClasses } = require('../engine/builder');
      if (!rest) return { text: `XP ${char.xp}/${char.xpForNextLevel()}. ${char.canLevelUp() ? 'You can level up! Use the API POST /api/characters/:id/level-up (or "levelup <class>" to preview).' : 'Not enough XP yet.'}`, data: eligibleClasses(char).filter((c) => c.ok) };
      return { text: 'Level-up preview', data: levelUpPreview(char, slug(rest)) };
    }
    default: {
      // Room feature verbs: "search cocoon", "climb cliff", "unlock chest".
      const room = world.room(char.location.roomId);
      const feature = room.features.find((f) => f.verb === cmd && (!rest || f.name.toLowerCase().includes(rest.toLowerCase()) || f.id === rest));
      if (feature) {
        const r = world.useFeature(charId, feature.id, { take20: /take20/.test(rest), take10: /take10/.test(rest) });
        return { text: r.text, data: r.check };
      }
      throw err(`Unknown command "${cmd}". Type "help".`);
    }
  }
}

function describeResult(r) {
  if (!r) return '';
  if (r.results && Array.isArray(r.results)) return r.results.map((x) => (x.text ? x.text : x.hit !== undefined ? `${x.hit ? 'hit' : 'miss'}${x.damage ? ` for ${x.damage}` : ''}` : x.healed !== undefined ? `healed ${x.healed}` : x.damage !== undefined ? `${x.damage} damage` : x.effect || x.condition || x.note || '')).filter(Boolean).join('; ');
  if (r.text) return r.text;
  return '';
}

function combatText(enc, viewerId) {
  const s = enc.snapshot(viewerId);
  const cur = s.combatants.find((c) => c.id === s.current);
  return [`Round ${s.round}. Current turn: ${cur ? cur.name : '-'}.`, ...s.combatants.map((c) => `  ${c.id === s.current ? '>' : ' '} ${c.name} [${c.side}] init ${c.initiative} at (${c.position.x},${c.position.y}) ${c.hp.current !== undefined ? `${c.hp.current}/${c.hp.max} hp` : `${c.hp.state} ${c.hp.percent}%`}${c.conditions.length ? ` (${c.conditions.join(', ')})` : ''}`)].join('\n');
}

const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

function sheetText(s) {
  const ab = Object.entries(s.abilities).map(([k, v]) => `${k.toUpperCase()} ${v.score ?? '-'} (${v.mod >= 0 ? '+' : ''}${v.mod})`).join('  ');
  return [
    `${s.name} — ${s.race} ${s.classes.map((c) => `${c.name} ${c.level}`).join(' / ')} (${s.alignment})`,
    `Level ${s.level}  XP ${s.xp}/${s.xpNext ?? 'max'}  HP ${s.hp.current}/${s.hp.max}${s.hp.temp ? ` (+${s.hp.temp} temp)` : ''}`,
    ab,
    `AC ${s.ac.ac} (touch ${s.ac.touch}, flat-footed ${s.ac.flatFooted})  Init ${s.initiative >= 0 ? '+' : ''}${s.initiative}  Speed ${s.speed} ft.`,
    `Fort ${sign(s.saves.fort)}  Ref ${sign(s.saves.ref)}  Will ${sign(s.saves.will)}  BAB ${sign(s.bab)}  CMB ${sign(s.cmb)}  CMD ${s.cmd}`,
    `Attacks: ${s.attacks.map((a) => `${a.name} ${a.bonus >= 0 ? '+' : ''}${a.bonus} (${a.damage}${a.crit ? `, ${a.crit}` : ''})`).join('; ')}`,
    `Money: ${T.formatMoney(s.money)}  Load: ${s.load}`,
  ].join('\n');
}

module.exports = { execute, HELP, sheetText };
