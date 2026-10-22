# Adding Content

All game content is plain data under `src/data/`. No engine code changes are needed for most additions.
Restart the server after editing, then run `npm test`.

## A spell — `src/data/spells/{low,mid,high}.js`

```js
'acid-arrow': spell('Acid Arrow', 'conjuration', { wizard: 2, magus: 2 }, {
  descriptors: ['acid'], range: 'long', duration: '1 round + 1 round per three levels', sr: false,
  description: 'Ray: 2d4 acid damage, plus 2d4 each round.',
}, damage(() => '2d4', 'acid', { attack: 'rangedTouch', ongoing: { dice: '2d4', type: 'acid', rounds: (cl) => Math.floor(cl / 3) } })),
```

Effect helpers (`helpers.js`): `damage(dice, energy, opts)`, `buff(duration, modifiers, opts)`, `condition(id, duration, opts)`,
`cure()/inflict()`, or raw `{ kind: 'summon' | 'remove' | 'dispel' | 'revive' | 'slay' | 'powerWord' | 'teleport' | 'utility' | 'multi' ... }`.
Durations: `D.rounds(n)`, `D.minutes(n)`, `D.tenMinutes`, `D.hours(n)`, `D.fixed(r)`, `D.permanent`. Dice can be functions of caster level.
Modifier targets: ability ids, `attack`, `attack.melee`, `damage`, `ac` (with bonus type), `save`, `save.fort`, `skill`, `skill.<id>`, `initiative`, `cmb`, `cmd`, `speed`, `hp`, `cl`, `concentration`, `spellDC.<school|descriptor>`, `srCheck`, `critConfirm`.

## A creature — `src/data/bestiary.js`

Enter the stat block as printed. Dex and size AC are derived, so list only the other AC components:

```js
gnoll: m('Gnoll', '1', {
  alignment: 'CE', subtypes: ['gnoll'], init: 0, senses: ['darkvision 60'],
  ac: { armor: 2, natural: 1, shield: 2 }, hp: '2d8+2', hd: 2, saves: { fort: 4, ref: 0, will: 0 },
  melee: [weapon('spear', 3, '1d8+3', { type: PIERCE, crit: [20, 3] })],
  abilities: { str: 15, dex: 10, con: 13, int: 8, wis: 11, cha: 8 }, bab: 1, cmb: 3, cmd: 13,
}),
```

Riders: `onHit: [trip, grab, poison(name, dc, { con: '1d2' }), paralysis(dc, '1d4+1', ['elf']), energy('1d6', 'fire'), burn('1d6', dc)]`.
Specials: `{ kind: 'breath', shape, size, dice, energy, save, recharge }`, `gaze`, `aura`, `rend`, `pounce`, `rake`, `ferocity`, `constrict`.
Also: `regeneration: { amount, bypass: ['fire'] }`, `fastHealing`, `dr`, `resist`, `immune`, `vulnerable`, `sr`, `spellLike`, `treasure`.

## A feat — `src/data/feats.js`

```js
'great-fortitude': F('Great Fortitude', ['general'], {}, '+2 on Fortitude saves.', { modifiers: () => [mod('save.fort', 2, 'untyped', 'Great Fortitude')] }),
```

Prerequisite keys: `abilities, bab, feats, featParams, skills, casterLevel, classLevel, fighterLevel, level, classFeature, spellcaster, race, proficient, casting, progression, custom` (`custom(char)` returns a list of failure strings).
Feats with combat effects (Power Attack, TWF...) are looked up by id in `src/engine/attacks.js` and `combat.js`.

## Items — `src/data/equipment.js`

Weapons: `w(name, category, use, cost, damage, [critRange, mult], range, weight, damageTypes, groups, special)`.
Wondrous items: `wondrous(name, slot, cost, (source) => [modifiers])`. Potions, scrolls and wands reference a spell and a caster level.

## Classes

- Base classes: `src/data/classes/base.js` (Core + magus), `apg.js`, `acg.js`, `oa.js`. Prestige classes: `prestige.js`. Spell tables: `spellTables.js`.
- Selectable options (talents, hexes, domains, bloodlines...) go in an option group in `src/data/classOptions.js` (`classOptionsApg.js`, `classOptionsAcg.js`, `kineticist.js` hold the tables). A class feature with `choice: '<group>'` asks for one pick at that level.
- Class spell lists that aren't stored on the spells themselves live in `src/data/spells/classLists.js`; classes that borrow a list are in `LIST_ALIASES` (`src/data/spells/index.js`).
- `features: { level: [featureKey] }` refers to `src/data/features.js`, where each feature can provide `modifiers(c)`, `flags(c)`, `resources(c)`, `abilities`, `dr(c)`, `resistances(c)`, `immunities`, `grantsFeats` and `naturalAttacks(c)`.
- `progressions` are summed across classes, so sneak attack from rogue, assassin and arcane trickster stacks automatically.
- Activated abilities live in `src/engine/classAbilities.js` (plus `abilitiesApg.js`, `abilitiesAcg.js`, `abilitiesOa.js`). `perDay(u)` registers a daily `power:<id>` resource automatically.

## The world — `src/data/world.js`

```js
'thornwood:den': {
  name: 'Wolf Den', zone: 'thornwood', terrain: 'forest', light: 'dim',
  description: 'Gnawed bones litter a hollow beneath a fallen oak.',
  exits: { west: 'thornwood:edge' },
  spawns: [{ monster: 'wolf', count: '1d2+1', respawn: 240, aggressive: true, chance: 100 }],
  npcs: [{ id: 'smith', name: 'Smith', role: 'shopkeeper', stock: ['longsword', { itemId: 'rapier', enhancement: 1 }] }],
  features: [{ id: 'chest', name: 'chest', skill: 'disable-device', dc: 20, verb: 'unlock', success: '...', failure: '...', reward: { gold: 50, item: 'potion-cure-light-wounds' }, once: true, failureDamage: '1d6' }],
},
```

Room flags: `safe` (no combat), `start`, `inn` (bed rest), `temple`, `shop`, `pvp`. NPC roles: `shopkeeper`, `priest` (spell `services` with costs), `innkeeper`, `herald`, `guard`.
Exits are validated when the server starts.
