# Macareno API Reference

All endpoints are JSON. Authenticated endpoints take `Authorization: Bearer <token>`
(or `?token=` for quick testing). Errors look like `{ "error": "message", "details": [...] }`
with an HTTP status (400 invalid, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict/wrong state, 402 not enough money).

The very first account registered on a fresh server becomes an **admin** (or list usernames in `ADMINS`).

---

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, password }` | 3-20 chars `[A-Za-z0-9_]`, password ≥ 8 |
| POST | `/api/auth/login` | `{ username, password }` | → `{ token, expires, account }` (7-day token) |
| POST | `/api/auth/logout` | – | |
| GET | `/api/auth/me` | – | |

## Compendium (public, read-only rules data)

`GET /api/compendium` lists sections and counts. Sections:

- `/races`, `/races/:id`
- `/classes`, `/classes/:id` (full level table: features, BAB, saves, spells per day/known, prestige requirements)
- `/feats?type=combat|metamagic|item-creation|general&q=`, `/feats/:id`
- `/spells?list=wizard|cleric|bard|paladin|ranger|magus|sorcerer&level=&school=&descriptor=&q=`, `/spells/:id`, `/summon-tables`
- `/monsters?type=&cr=&q=`, `/monsters/:id` (computed stat block)
- `/items?kind=weapon|armor|shield|wondrous|potion|scroll|wand|gear|ammo|splash&q=`, `/items/:id`, `/weapon-specials`, `/armor-specials`
- `/skills`, `/conditions`, `/sizes`, `/alignments`, `/creature-types`, `/languages`
- `/deities`, `/domains`, `/schools`, `/bloodlines`, `/dragon-types`, `/rage-powers`, `/rogue-talents`, `/magus-arcana`, `/mercies`, `/combat-styles`, `/favored-enemies`, `/terrains`, `/weapon-groups`
- `/tables` (XP tracks, CR→XP, point buy, wealth by level, treasure by CR, carrying capacity)

`POST /api/dice/roll { "expression": "4d6kh3+2" }` → `{ total, terms: [{ rolls, kept }] }`.

## Characters

| Method | Path | Notes |
|---|---|---|
| GET | `/api/characters` | your characters |
| POST | `/api/characters/roll-abilities` | server rolls 4d6-drop-lowest ×6 and stores it on your account |
| POST | `/api/characters` | create (see spec below) → full sheet |
| GET | `/api/characters/:id` | full computed sheet |
| DELETE | `/api/characters/:id` | |
| GET | `/api/characters/:id/eligible-classes` | every class with `{ ok, failures }` (prestige requirements) |
| GET | `/api/characters/:id/level-up/:classId` | preview: features gained, feat slots, skill ranks, whether an ability increase or spell progression choice is needed |
| POST | `/api/characters/:id/level-up` | apply a level (spec below) |
| POST | `/api/characters/:id/checks` | `{ kind: skill|ability|save|caster|concentration|initiative, id, dc?, take10?, take20?, tags?, circumstance? }` |
| GET | `/api/characters/:id/inventory` | |
| POST | `/api/characters/:id/equip` | `{ item: uid|itemId, slot?, twoHanded? }` |
| POST | `/api/characters/:id/unequip` | `{ item: uid|slot }` |
| GET | `/api/characters/:id/spells` | slots, prepared, known, spellbook, DCs, spell failure |
| POST | `/api/characters/:id/spells/prepare` | `{ classId, spells: ["bless", { spell: "fireball", metamagic: ["empower-spell"], slot: "domain" }] }` |
| POST | `/api/characters/:id/spells/learn` | wizards/magi copy from a scroll: `{ classId, spell, fromScroll: uid }` (Spellcraft DC 15 + level, 10 gp/page) |
| POST | `/api/characters/:id/toggles` | `{ powerAttack, deadlyAim, combatExpertise, rapidShot, fightingDefensively, autoBattle }` |

### Creation spec

```json
{
  "name": "Seoni",
  "race": "human",                         // human, dwarf, elf, gnome, half-elf, half-orc, halfling, aasimar, tiefling, drow
  "racialBonus": "cha",                    // races with a floating +2 (human, half-elf, half-orc)
  "alignment": "NG",                       // LG NG CG LN N CN LE NE CE
  "class": "sorcerer",                     // any base class
  "deity": "the-dawnflame",                // clerics
  "abilities": { "method": "pointbuy", "scores": { "str": 8, "dex": 14, "con": 12, "int": 12, "wis": 10, "cha": 17 } },
  "feats": [{ "id": "toughness" }, { "id": "skill-focus", "param": "bluff" }],
  "skills": { "bluff": 1, "spellcraft": 1 },
  "choices": { "bloodline": "draconic", "dragonType": "red" },
  "spells": { "known": ["acid-splash", "detect-magic", "light", "ray-of-frost", "magic-missile", "shield"] },
  "languages": ["Draconic"],
  "favoredClass": "sorcerer", "favoredBonus": "hp",   // or "skill"
  "adaptabilitySkill": "perception",       // half-elves
  "kit": true                              // buy & equip a starting kit from starting gold
}
```

Point buy budget defaults to 20 (`POINT_BUY` env). `abilities.method: "rolled"` uses the array from `roll-abilities`.

Class choices at 1st level: `domains: [a, b]` (cleric), `school` + `opposition: [a, b]` (wizard; `universalist` has none),
`bloodline` (+ `dragonType` for draconic, `element` for elemental), `favored-enemy` (ranger), `arcaneBond`.
Spellbook: `spells.spellbook` with up to 3 + Int modifier (+1 for specialists) 1st-level spells (cantrips are automatic).

### Level-up spec

```json
{
  "class": "eldritch-knight",
  "spellProgression": "wizard",            // prestige classes that advance casting (mystic theurge: { "arcane": "wizard", "divine": "cleric" })
  "hpMethod": "average",                   // or "roll"
  "favoredBonus": "hp",
  "abilityIncrease": "str",                // every 4th character level
  "feats": [{ "id": "power-attack" }],    // one per odd level + class bonus feats
  "skills": { "climb": 1 },
  "choices": { "rage-power": "superstition", "rogue-talent": "bleeding-attack", "magus-arcana": "arcane-accuracy", "mercy": "sickened",
               "weapon-training": "heavy-blades", "favored-enemy": "undead", "favored-enemy-increase": "humanoid:orc",
               "favored-terrain": "forest", "combat-style": "archery", "combat-style-feat": "rapid-shot", "dragonType": "blue" },
  "spells": { "wizard": ["fireball", "fly"] }   // spellbook additions (2/level) or new spells known
}
```

Level-ups are validated on a copy and only applied if every rule passes; failures come back in `details`.
Prestige classes check their requirements (BAB, skills, feats, spellcasting level, alignment, special).

## World

| Method | Path | Body |
|---|---|---|
| POST | `/api/world/enter` | `{ characterId }` |
| POST | `/api/world/leave` | `{ characterId }` |
| POST | `/api/world/command` | `{ characterId, command: "cast fireball at goblin 2" }` → `{ text, data }` |
| POST | `/api/world/action` | `{ characterId, action: { type, ... } }` structured actions (below) |
| GET | `/api/world/events?characterId=&since=<seq>` | poll events (WebSocket clients get them pushed) |
| GET | `/api/world/room?characterId=` | room view |
| GET | `/api/world/who` | online characters |
| GET | `/api/world/time` | game clock |
| GET | `/api/world/zones` | zones and room graph |
| GET | `/api/world/party?characterId=` | |

Structured world actions: `look`, `move {direction}`, `say/emote/shout {text}`, `tell {to, text}`, `attack {target}`,
`cast {spell, target?, classId?, metamagic?, options?}`, `ability {ability, target?, options?}`, `use-item {item, target?}`,
`pick-up {item}`, `drop {item, qty?}`, `give {item, to}`, `give-money {gp, to}`, `shop`, `buy {item, qty?}`, `sell {item}`,
`service {spell, target?}`, `rest {bed?}`, `respawn`, `feature {feature, take10?, take20?}`, `identify {target}`,
`party-invite {name}`, `party-accept`, `party-leave`, `party-chat {text}`, `sneak {on}`, `follow {on}`, `combat {action}`.

Text commands: send `help`.

## Combat

`GET /api/combat/:characterId` → encounter snapshot (initiative order, positions on the 5-ft. grid, hp of allies,
health bands of enemies, current turn, action budget, last 30 log lines).

`POST /api/combat/:characterId/action` with one of:

| type | fields | action cost |
|---|---|---|
| `attack` | `target, weapon?, ranged?, vitalStrike?, cleave?, fightDefensively?` | standard |
| `full-attack` | `target, weapon?, ranged?, noFlurry?, fightDefensively?` | full-round (iteratives, TWF, flurry, natural attacks, haste, Rapid Shot, Manyshot) |
| `charge` | `target` | full-round (+2 attack, −2 AC; pounce = full attack) |
| `move` | `to: {x,y}` or `toward: id` | move (pathfinding, provokes AoO) |
| `step` | `to: {x,y}` (adjacent) | 5-ft. step (no AoO) |
| `withdraw` | `to` | full-round (first square safe) |
| `flee` | – | full-round, leaves the fight |
| `cast` | `spell, classId?, target?, targets?, center?, point?, metamagic?, defensive?, convertFrom?, options?, spellstrike?` | per casting time (quicken = swift) |
| `spellstrike` | `spell, target` | magus: touch spell through a weapon hit |
| `spell-combat` | `target, spell, spellTarget?` | magus: full attack at −2 + cast |
| `spell-like` | `spell, target?` | monsters |
| `ability` | `ability, target?, targets?, options?` | per ability (rage: free, smite: swift, channel: standard...) |
| `maneuver` | `maneuver: trip|disarm|grapple|bull-rush|overrun|sunder|reposition|dirty-trick, target, condition?` | standard (provokes unless Improved X) |
| `maintain-grapple` | `mode: damage|pin|move` | standard (move with Greater Grapple) |
| `escape` | – | standard |
| `feint` / `demoralize` | `target` | standard (feint: move with Improved Feint) |
| `total-defense` | – | standard |
| `stand-up` | – | move (provokes) |
| `coup-de-grace` | `target` | full-round |
| `aid-another` | `target, ally, mode: attack|ac` | standard |
| `use-item` | `item, target?` | standard (potions provoke; wands/scrolls need the spell on your list or Use Magic Device) |
| `equip` | `item, slot?` | move (free with Quick Draw) |
| `heal-check` | `target` | standard (Heal DC 15 stabilizes) |
| `toggle` | `powerAttack, deadlyAim, combatExpertise, rapidShot, fightingDefensively` | free, any time |
| `delay`, `end-turn` | – | |

Player turns time out after `TURN_TIMEOUT_MS` (default 60 s); characters with the `autoBattle` toggle are then played by the AI.
Disconnected characters are played by the AI until the fight ends.

## WebSocket

Connect to `ws://host/ws?token=<token>`. Requests (each may carry an `id` echoed in the reply):

```json
{ "id": "1", "type": "enter", "characterId": "..." }
{ "id": "2", "type": "command", "text": "attack goblin" }
{ "id": "3", "type": "action", "action": { "type": "move", "direction": "north" } }
{ "id": "4", "type": "combat", "action": { "type": "full-attack", "target": "..." } }
{ "id": "5", "type": "leave" }
{ "type": "ping" }
```

Server messages: `{ type: "result", id, ok, data | error }` and `{ type: "event", characterId, event: { seq, at, type, text, data } }`.
Event types include `look`, `arrive`, `depart`, `say`, `tell`, `shout`, `party`, `combat:start`, `combat:turn`, `combat:your-turn`,
`combat:attack`, `combat:cast`, `combat:ability`, `combat:aoo`, `combat:end`, `xp`, `loot`, `rest`, `death`, `respawn`, `check`, `level-up`.

## Admin (role `admin`)

| POST | Body |
|---|---|
| `/api/admin/spawn` | `{ roomId, monster, count?, aggressive? }` |
| `/api/admin/grant` | `{ characterId, xp?, gold?, item?, itemOptions? }` |
| `/api/admin/teleport` | `{ characterId, roomId }` |
| `/api/admin/heal` | `{ characterId }` (full restore, revive) |
| `/api/admin/simulate` | `{ sides: { a: [{ character: id }], b: [{ monster: "troll" }] }, seed? }` → AI-vs-AI battle log |
