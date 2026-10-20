# Writing a Client

The server is the whole game. A client logs in, picks a character, opens a WebSocket and renders events.

## Minimal flow

1. `POST /api/auth/register`, then `POST /api/auth/login` → `token`.
2. `GET /api/compendium/races`, `/classes`, `/feats`, `/spells?list=...` to build a character-creation screen.
   Use `GET /api/compendium/classes/:id` for the level table, and the error `details` array from `POST /api/characters` for inline validation.
3. `POST /api/characters` → the sheet. `GET /api/characters` lists them.
4. Open `ws://host/ws?token=...` and send `{ "type": "enter", "characterId": "..." }`.
5. Render every `{ type: "event" }` message. Text clients can print `event.text`; graphical clients can use `event.type` and `event.data` (room views, encounter snapshots).
6. Send input either as text (`{ type: "command", text: "attack goblin" }`) or as structured actions (`{ type: "action" }` / `{ type: "combat" }`).

## Text client in ~20 lines (Node)

```js
const WebSocket = require('ws');
const readline = require('readline');
const [,, url, token, characterId] = process.argv;
const ws = new WebSocket(`${url}/ws?token=${token}`);
ws.on('open', () => ws.send(JSON.stringify({ type: 'enter', characterId })));
ws.on('message', (m) => {
  const msg = JSON.parse(m);
  if (msg.type === 'event' && msg.event.text) console.log(msg.event.text);
  if (msg.type === 'result' && msg.ok && msg.data && msg.data.text) console.log(msg.data.text);
  if (msg.type === 'result' && !msg.ok) console.log(`! ${msg.error}`);
});
readline.createInterface({ input: process.stdin }).on('line', (text) => ws.send(JSON.stringify({ type: 'command', text })));
```

## Combat UI tips

- On `combat:your-turn`, `event.data` is a full encounter snapshot: initiative order, grid positions, your action `budget`, and allies' hp. Enemies show health bands only.
- Target creatures by id in structured actions. Text commands accept names with an index (`goblin 2`).
- Turns time out (60 s by default). Offer an "auto-battle" toggle (`POST /api/characters/:id/toggles { autoBattle: true }`).
- Area spells need a `center` creature id or a `point: {x, y}`.

## Polling instead of WebSockets

Use `POST /api/world/command` for input and `GET /api/world/events?characterId=&since=<last seq>` for output.
