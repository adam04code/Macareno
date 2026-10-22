# Macareno

A headless, text-first MMORPG server built on the **Pathfinder Roleplaying Game (1st Edition)** rules published under the
Open Game License (the rules hosted on d20pfsrd.com). It is a server and rules engine only: no client is included.
Any platform (terminal/MUD client, web, mobile, Discord bot, game engine) can connect over HTTP + WebSocket.

> The d20pfsrd.com reference is Pathfinder **1st Edition**, so that is the edition implemented. Content scope follows
> what *Pathfinder: Wrath of the Righteous* uses, limited to Open Game Content: the 25 base classes from the Core
> Rulebook, Advanced Player's Guide, Advanced Class Guide and Occult Adventures (kineticist), 8 prestige classes,
> 13 races, 670+ spells, 250+ feats and 127 Bestiary creatures. See [docs/RULES.md](docs/RULES.md) for the full list.

## Quick start

```bash
npm install
npm start                 # http://localhost:3000, WebSocket ws://localhost:3000/ws
npm test                  # 42 tests: rules, all classes 1-20, prestige classes, combat, spells, world, HTTP + WebSocket
```

```bash
# register (the first account becomes admin), log in, create a character, play with text commands
curl -s localhost:3000/api/auth/register -H 'content-type: application/json' -d '{"username":"alice","password":"correct horse"}'
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'content-type: application/json' -d '{"username":"alice","password":"correct horse"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s localhost:3000/api/characters -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{
  "name":"Valeros","race":"human","racialBonus":"str","alignment":"NG","class":"fighter",
  "abilities":{"method":"pointbuy","scores":{"str":16,"dex":14,"con":14,"int":10,"wis":12,"cha":8}},
  "feats":[{"id":"power-attack"},{"id":"weapon-focus","param":"longsword"},{"id":"dodge"}],
  "skills":{"climb":1,"intimidate":1,"perception":1}}'
curl -s localhost:3000/api/world/command -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"characterId":"<id>","command":"look"}'
```

Documentation:

- [docs/API.md](docs/API.md): every HTTP endpoint, the WebSocket protocol, and combat actions
- [docs/RULES.md](docs/RULES.md): which Pathfinder rules are implemented and what is simplified
- [docs/CLIENTS.md](docs/CLIENTS.md): how to build a client (with a 20-line text client)
- [docs/CONTENT.md](docs/CONTENT.md): adding spells, monsters, feats, items, classes and rooms

 Send the text command `help` for the in-game command list.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | HTTP/WebSocket port |
| `DATA_DIR` | `./var` | JSON persistence directory (accounts, characters, world state) |
| `ADMINS` | – | comma-separated usernames that get the admin role |
| `POINT_BUY` | 20 | ability score point-buy budget (15 standard, 20 high, 25 epic) |
| `TURN_TIMEOUT_MS` | 60000 | time a player has to act on their combat turn |
| `REST_SECONDS` | 10 | real seconds an 8-hour rest takes |
| `MONSTER_DYING_RULES` | 0 | 1 = monsters use the full dying rules instead of dropping at 0 hp |
| `PF_SEED` | – | seed every die roll (reproducible servers) |

## Architecture

```
src/
  index.js            HTTP + WebSocket server bootstrap, world clock, graceful save
  app.js              Express routes (auth, compendium, characters, world, combat, admin)
  net/ws.js           WebSocket gateway (requests + pushed events)
  engine/             the rules engine; no I/O
    dice.js rng.js      dice expressions (NdS, keep-highest), seedable RNG
    modifiers.js        typed bonus stacking (dodge/untyped/circumstance stack, penalties stack, same-source rule)
    tables.js           BAB/save progressions, XP tracks, CR→XP, point buy, carrying capacity, wealth, treasure
    creature.js         shared creature model: abilities, AC/touch/flat-footed, saves, CMB/CMD, HP states, effects, conditions
    character.js        player characters: race + multiclass levels + feats + features + gear + spellcasting
    monster.js          bestiary creatures (printed stat block + live ability-score deltas, regeneration, fast healing)
    checks.js           every d20: skills, abilities, saves, caster level/SR, concentration, opposed, identify monster
    prerequisites.js    feat and prestige-class requirements
    builder.js          character creation and level-up validation, automatic level specs
    spellcasting.js     slots, bonus spells, domain/school slots, known/spellbook, prepare, spontaneous, metamagic, DCs
    spellEffects.js     spell resolution: damage/saves/evasion, buffs, conditions, summons, dispel, raise dead, poisons/diseases
    attacks.js          attack bonus, AC, concealment, mirror image, crits, damage, DR, resistances, incorporeal
    classAbilities.js   activated abilities (rage, smite, channel, bardic performance, ki, arcane pool, breath weapon...)
    abilitiesApg.js     alchemist bombs/mutagen, cavalier challenge, judgments, revelations, witch hexes
    abilitiesAcg.js     bloodrage, arcanist exploits, spirit powers, raging songs, studied target, blessings, fervor
    abilitiesOa.js      kinetic blast (infusions, metakinesis, burn), gather power, internal buffer
    companion.js        animal companions (druid, ranger, cavalier, hunter) built from the advancement table
    maneuvers.js        combat maneuvers, grapple, feint, demoralize
    combat.js           encounters: initiative, action economy, grid movement, AoO, full attacks, casting, monster AI
    inventory.js        items, equipment slots, buying/selling, encumbrance
  world/              the persistent MMO layer
    world.js            rooms, spawns, sessions, parties, encounters, loot, rest, temple, death/respawn, clock
    commands.js         text command interpreter for text clients
    sheet.js            character sheet serializer
    store.js accounts.js JSON persistence, scrypt-hashed accounts, bearer tokens
  data/               Open Game Content as data
    races, classes (core/apg/acg/oa base classes + prestige), features, class options, feats, spells (0-9) and
    class spell lists, kineticist talents, companions, wild shape forms, bestiary, equipment, conditions, world
test/                 node:test suites
```

## License

Code: see repository owner. Game rules content is Open Game Content under the [Open Game License v1.0a](OGL.md).
World content (Brindlemoor and its surroundings, deities) is original and contains no Paizo Product Identity.
"Pathfinder" is a trademark of Paizo Inc.; this project is not affiliated with or endorsed by Paizo.
