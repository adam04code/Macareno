'use strict';

const { WebSocketServer } = require('ws');
const { URL } = require('url');
const commands = require('../world/commands');
const { worldAction } = require('../app');
const { plain } = require('../api/compendium');

/**
 * WebSocket gateway: ws://host/ws?token=<bearer token>
 *
 * Client -> server messages (JSON):
 *   { id?, type: 'enter', characterId }
 *   { id?, type: 'command', characterId?, text }       text command (see "help")
 *   { id?, type: 'action', characterId?, action }      structured world action
 *   { id?, type: 'combat', characterId?, action }      combat action ({ type: 'attack', target } ...)
 *   { id?, type: 'leave', characterId? }
 *   { type: 'ping' }
 * Server -> client:
 *   { type: 'event', characterId, event }              every world/combat event
 *   { type: 'result', id, ok, data | error }           reply to a request
 */
function attachWebSocket(server, { world, accounts }) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const url = new URL(req.url, 'http://localhost');
    const account = accounts.authenticate(url.searchParams.get('token') || (req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!account) {
      socket.send(JSON.stringify({ type: 'error', error: 'Authentication required' }));
      socket.close(4401, 'unauthorized');
      return;
    }
    const subs = new Map(); // characterId -> unsubscribe
    let current = null;
    const send = (msg) => socket.readyState === 1 && socket.send(JSON.stringify(plain(msg)));

    const own = (id) => {
      const charId = id || current;
      if (!charId) throw Object.assign(new Error('characterId required (send "enter" first)'), { status: 400 });
      const c = world.loadCharacter(charId);
      if (c.accountId !== account.id && account.role !== 'admin') throw Object.assign(new Error('Not your character'), { status: 403 });
      return c;
    };

    const ensureEntered = (c) => {
      if (!world.online.has(c.id)) world.enter(c.id);
      if (!subs.has(c.id)) subs.set(c.id, world.subscribe(c.id, (event) => send({ type: 'event', characterId: c.id, event })));
    };

    socket.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        return send({ type: 'error', error: 'Invalid JSON' });
      }
      const reply = (ok, payload) => send({ type: 'result', id: msg.id, ok, ...(ok ? { data: payload } : { error: payload.message, details: payload.details }) });
      try {
        switch (msg.type) {
          case 'ping':
            return send({ type: 'pong', at: Date.now() });
          case 'enter': {
            const c = own(msg.characterId);
            current = c.id;
            if (!world.online.has(c.id)) world.enter(c.id, account.role === 'admin' ? undefined : account.id);
            ensureEntered(c);
            // Replay the latest room description to this socket.
            send({ type: 'event', characterId: c.id, event: { type: 'look', text: world.describeRoom(c), data: world.roomView(c) } });
            return reply(true, { character: c.id });
          }
          case 'command': {
            const c = own(msg.characterId);
            ensureEntered(c);
            return reply(true, commands.execute(world, c.id, msg.text));
          }
          case 'action': {
            const c = own(msg.characterId);
            ensureEntered(c);
            return reply(true, worldAction(world, c.id, msg.action || {}));
          }
          case 'combat': {
            const c = own(msg.characterId);
            ensureEntered(c);
            return reply(true, world.combatAction(c.id, msg.action || {}));
          }
          case 'leave': {
            const c = own(msg.characterId);
            const unsub = subs.get(c.id);
            if (unsub) unsub();
            subs.delete(c.id);
            world.leave(c.id);
            if (current === c.id) current = null;
            return reply(true, { left: c.id });
          }
          default:
            return reply(false, new Error(`Unknown message type ${msg.type}`));
        }
      } catch (e) {
        return reply(false, e);
      }
    });

    socket.on('close', () => {
      for (const [charId, unsub] of subs) {
        unsub();
        // Leave the world if no other socket is watching this character.
        const s = world.online.get(charId);
        if (s && s.subscribers.size === 0) world.leave(charId);
      }
      subs.clear();
    });
  });

  return wss;
}

module.exports = { attachWebSocket };
