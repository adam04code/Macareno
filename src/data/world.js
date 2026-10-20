'use strict';

/**
 * The default game world: zones, rooms, exits, spawns, NPC services and
 * skill-check features. All names are original (no Paizo product identity).
 * Operators can replace this file or load zones through the admin API.
 *
 * Room: { name, description, exits {dir: roomId}, flags [], terrain, light,
 *         spawns [{ monster, count: 'NdM'|n, respawn: seconds, aggressive }],
 *         npcs [{ id, name, role, stock?, services? }],
 *         features [{ id, name, skill, dc, verb, success, failure, once, reward }] }
 *
 * Flags: safe (no combat), inn (bed rest), temple, shop, pvp, start, dark.
 */

const GENERAL_STOCK = ['backpack', 'bedroll', 'rope-hemp', 'rope-silk', 'torch', 'trail-rations', 'waterskin', 'flint-and-steel', 'healers-kit', 'thieves-tools', 'climbers-kit', 'disguise-kit', 'spell-component-pouch', 'holy-symbol-wooden', 'holy-symbol-silver', 'spellbook', 'arrows', 'bolts', 'sling-bullets', 'musical-instrument', 'sunrod', 'antitoxin', 'alchemists-fire', 'acid-flask', 'holy-water', 'tanglefoot-bag'];
const SMITH_STOCK = [
  'dagger', 'club', 'quarterstaff', 'spear', 'shortspear', 'longspear', 'light-mace', 'heavy-mace', 'morningstar', 'sickle', 'light-crossbow', 'heavy-crossbow', 'sling', 'javelin', 'dart',
  'handaxe', 'battleaxe', 'greataxe', 'short-sword', 'longsword', 'greatsword', 'rapier', 'scimitar', 'falchion', 'kukri', 'warhammer', 'light-hammer', 'flail', 'heavy-flail', 'glaive', 'halberd', 'guisarme', 'ranseur', 'scythe', 'trident', 'lance', 'sap', 'heavy-pick', 'light-pick', 'greatclub', 'throwing-axe', 'starknife',
  'shortbow', 'longbow', 'composite-shortbow', 'composite-longbow',
  'bastard-sword', 'dwarven-waraxe', 'whip', 'kama', 'nunchaku', 'sai', 'siangham', 'shuriken', 'spiked-chain', 'elven-curve-blade', 'hand-crossbow', 'two-bladed-sword', 'orc-double-axe', 'dwarven-urgrosh', 'bolas',
  'padded', 'leather', 'studded-leather', 'chain-shirt', 'hide', 'scale-mail', 'chainmail', 'breastplate', 'splint-mail', 'banded-mail', 'half-plate', 'full-plate',
  'buckler', 'light-wooden-shield', 'light-steel-shield', 'heavy-wooden-shield', 'heavy-steel-shield', 'tower-shield',
  { itemId: 'longsword', masterwork: true }, { itemId: 'rapier', masterwork: true }, { itemId: 'greatsword', masterwork: true }, { itemId: 'composite-longbow', masterwork: true }, { itemId: 'chain-shirt', masterwork: true }, { itemId: 'breastplate', masterwork: true }, { itemId: 'full-plate', masterwork: true },
];
const ARCANE_STOCK = [
  'potion-cure-light-wounds', 'potion-cure-moderate-wounds', 'potion-cure-serious-wounds', 'potion-bulls-strength', 'potion-cats-grace', 'potion-bears-endurance', 'potion-barkskin', 'potion-invisibility', 'potion-enlarge-person', 'potion-shield-of-faith', 'potion-protection-from-evil', 'potion-fly', 'potion-haste', 'potion-lesser-restoration', 'potion-remove-fear', 'potion-neutralize-poison',
  'scroll-magic-missile', 'scroll-fireball', 'scroll-cure-light-wounds', 'wand-cure-light-wounds', 'wand-magic-missile', 'wand-scorching-ray', 'wand-lightning-bolt',
  'ring-of-protection-1', 'ring-of-protection-2', 'amulet-of-natural-armor-1', 'amulet-of-natural-armor-2', 'cloak-of-resistance-1', 'cloak-of-resistance-2', 'cloak-of-resistance-3', 'bracers-of-armor-1', 'bracers-of-armor-2',
  'belt-of-giant-strength-2', 'belt-of-incredible-dexterity-2', 'belt-of-mighty-constitution-2', 'headband-of-vast-intelligence-2', 'headband-of-inspired-wisdom-2', 'headband-of-alluring-charisma-2',
  'boots-of-elvenkind', 'cloak-of-elvenkind', 'eyes-of-the-eagle', 'gloves-of-swimming-and-climbing', 'handy-haversack', 'bag-of-holding-1', 'pearl-of-power-1', 'ioun-stone-dusty-rose',
  { itemId: 'longsword', enhancement: 1 }, { itemId: 'rapier', enhancement: 1 }, { itemId: 'greatsword', enhancement: 1 }, { itemId: 'longbow', enhancement: 1 }, { itemId: 'scimitar', enhancement: 1 }, { itemId: 'quarterstaff', enhancement: 1 },
  { itemId: 'chain-shirt', enhancement: 1 }, { itemId: 'breastplate', enhancement: 1 }, { itemId: 'full-plate', enhancement: 1 }, { itemId: 'heavy-steel-shield', enhancement: 1 },
  { itemId: 'longsword', enhancement: 1, special: ['flaming'] }, { itemId: 'scimitar', enhancement: 1, special: ['keen'] }, { itemId: 'longbow', enhancement: 1, special: ['frost'] },
];

// Temple spellcasting services (Core Rulebook "Spellcasting and Services": CL x spell level x 10 gp + material).
const TEMPLE_SERVICES = {
  'cure-light-wounds': { cl: 1, costGp: 10 },
  'cure-moderate-wounds': { cl: 3, costGp: 60 },
  'cure-serious-wounds': { cl: 5, costGp: 150 },
  'lesser-restoration': { cl: 3, costGp: 60 },
  'remove-disease': { cl: 5, costGp: 150 },
  'neutralize-poison': { cl: 7, costGp: 280 },
  'remove-curse': { cl: 5, costGp: 150 },
  restoration: { cl: 7, costGp: 280 + 100 },
  'remove-blindness-deafness': { cl: 5, costGp: 150 },
  'raise-dead': { cl: 9, costGp: 450 + 5000 },
  resurrection: { cl: 13, costGp: 910 + 10000 },
};

const ZONES = {
  brindlemoor: { name: 'Brindlemoor', description: 'A walled market town at the edge of the wild March.', levelRange: [1, 20] },
  thornwood: { name: 'The Thornwood', description: 'An old forest of briar and black oak, thick with goblins and beasts.', levelRange: [1, 3] },
  'barrow-hills': { name: 'The Barrow Hills', description: 'Wind-scoured hills honeycombed with the tombs of forgotten kings.', levelRange: [2, 6] },
  'sunken-mire': { name: 'The Sunken Mire', description: 'A steaming swamp where lizardfolk hunt and something old sleeps in the water.', levelRange: [3, 8] },
  'ember-peaks': { name: 'The Ember Peaks', description: 'Volcanic mountains ruled by giants, trolls and a young red wyrm.', levelRange: [5, 12] },
  'hollow-deep': { name: 'The Hollow Deep', description: 'A dungeon of carved halls beneath the hills, crawling with aberrations and fiends.', levelRange: [4, 10] },
  'shattered-rift': { name: 'The Shattered Rift', description: 'A wound in the world where the elemental planes bleed through.', levelRange: [8, 15] },
};

const ROOMS = {
  // ------------------------------------------------------------------ Brindlemoor
  'brindlemoor:square': {
    name: 'Brindlemoor Square', zone: 'brindlemoor', flags: ['safe', 'start'], terrain: 'urban', light: 'bright',
    description: 'Cobbles worn smooth by centuries of carts surround a moss-green fountain. Heralds cry the news, and adventurers gather beneath the notice board.',
    exits: { north: 'brindlemoor:north-gate', east: 'brindlemoor:market', west: 'brindlemoor:temple', south: 'brindlemoor:south-gate', up: 'brindlemoor:inn' },
    npcs: [{ id: 'herald', name: 'Herald Oswin', role: 'herald', dialogue: 'Goblins in the Thornwood, dead men walking in the Barrow Hills, and smoke over the Ember Peaks. Plenty of work for brave souls!' }],
    features: [{ id: 'notice-board', name: 'notice board', skill: 'knowledge-local', dc: 10, verb: 'study', success: 'You piece together rumors: the troll at Cinder Bridge fears fire; the barrow-wight drains life; the red wyrm sleeps on a hoard of gold.', failure: 'The notices are a jumble of gossip.' }],
  },
  'brindlemoor:market': {
    name: 'Copperpenny Market', zone: 'brindlemoor', flags: ['safe', 'shop'], terrain: 'urban', light: 'bright',
    description: 'Striped awnings shade stalls of rope, lanterns, rations and every adventuring sundry imaginable.',
    exits: { west: 'brindlemoor:square', north: 'brindlemoor:smithy', east: 'brindlemoor:tower' },
    npcs: [{ id: 'merchant', name: 'Merchant Tilda Copperpenny', role: 'shopkeeper', stock: GENERAL_STOCK }],
  },
  'brindlemoor:smithy': {
    name: "Harrow's Forge", zone: 'brindlemoor', flags: ['safe', 'shop'], terrain: 'urban', light: 'bright',
    description: 'Heat rolls from a roaring forge. Racks of blades, bows and armor line the soot-black walls.',
    exits: { south: 'brindlemoor:market' },
    npcs: [{ id: 'smith', name: 'Smith Bram Harrow', role: 'shopkeeper', stock: SMITH_STOCK }],
  },
  'brindlemoor:tower': {
    name: 'The Violet Spire', zone: 'brindlemoor', flags: ['safe', 'shop'], terrain: 'urban', light: 'bright',
    description: 'Shelves of glowing vials, humming wands and rune-stitched cloaks fill this narrow arcane emporium.',
    exits: { west: 'brindlemoor:market' },
    npcs: [{ id: 'enchanter', name: 'Magister Ilsabet Vane', role: 'shopkeeper', stock: ARCANE_STOCK }],
  },
  'brindlemoor:temple': {
    name: 'Temple of the Dawnflame', zone: 'brindlemoor', flags: ['safe', 'temple'], terrain: 'urban', light: 'bright',
    description: 'Sunlight pours through amber glass onto a marble altar. Priests tend the wounded and, for a donation, the dead.',
    exits: { east: 'brindlemoor:square' },
    npcs: [{ id: 'priest', name: 'High Priestess Maren', role: 'priest', services: TEMPLE_SERVICES }],
  },
  'brindlemoor:inn': {
    name: 'The Gilded Griffon', zone: 'brindlemoor', flags: ['safe', 'inn'], terrain: 'urban', light: 'bright',
    description: 'A warm common room smelling of stew and pipe smoke. Rooms upstairs rent for 2 gp a night.',
    exits: { down: 'brindlemoor:square' },
    npcs: [{ id: 'innkeeper', name: 'Innkeeper Hollis', role: 'innkeeper', roomCostGp: 2 }],
  },
  'brindlemoor:north-gate': {
    name: 'North Gate', zone: 'brindlemoor', flags: ['safe'], terrain: 'urban', light: 'bright',
    description: 'Iron-banded gates open onto the Thornwood road. A bored guard leans on a halberd.',
    exits: { south: 'brindlemoor:square', north: 'thornwood:edge' },
    npcs: [{ id: 'guard', name: 'Watch Sergeant Kell', role: 'guard', dialogue: 'Mind the goblins past the bridge. And whatever you do, do not wake the owlbear.' }],
  },
  'brindlemoor:south-gate': {
    name: 'South Gate', zone: 'brindlemoor', flags: ['safe'], terrain: 'urban', light: 'bright',
    description: 'The southern gate overlooks the barrow-dotted hills and, beyond them, the misty mire.',
    exits: { north: 'brindlemoor:square', south: 'barrow-hills:road', east: 'brindlemoor:arena' },
  },
  'brindlemoor:arena': {
    name: 'The Proving Pit', zone: 'brindlemoor', flags: ['pvp'], terrain: 'urban', light: 'bright',
    description: 'A sand-floored pit where adventurers test their mettle against each other. Duels here are sanctioned.',
    exits: { west: 'brindlemoor:south-gate' },
  },

  // ------------------------------------------------------------------ Thornwood
  'thornwood:edge': {
    name: 'Thornwood Edge', zone: 'thornwood', terrain: 'forest', light: 'dim',
    description: 'The road narrows as black oaks close overhead. Tracks of small, clawed feet cross the mud.',
    exits: { south: 'brindlemoor:north-gate', north: 'thornwood:path', east: 'thornwood:den' },
    spawns: [{ monster: 'dire-rat', count: '1d3', respawn: 120 }],
    features: [{ id: 'tracks', name: 'tracks', skill: 'survival', dc: 10, verb: 'follow', success: 'Goblin tracks lead north toward the old bridge; wolf prints lead east.', failure: 'The ground is too churned to read.' }],
  },
  'thornwood:path': {
    name: 'Briar Path', zone: 'thornwood', terrain: 'forest', light: 'dim',
    description: 'Thorny vines snag at cloaks. Crude goblin totems hang from the branches.',
    exits: { south: 'thornwood:edge', north: 'thornwood:bridge', west: 'thornwood:hollow' },
    spawns: [{ monster: 'goblin', count: '1d4+1', respawn: 180, aggressive: true }],
  },
  'thornwood:den': {
    name: 'Wolf Den', zone: 'thornwood', terrain: 'forest', light: 'dim',
    description: 'Gnawed bones litter a hollow beneath a fallen oak. Yellow eyes watch from the dark.',
    exits: { west: 'thornwood:edge' },
    spawns: [{ monster: 'wolf', count: '1d2+1', respawn: 240, aggressive: true }],
  },
  'thornwood:hollow': {
    name: 'Spider Hollow', zone: 'thornwood', terrain: 'forest', light: 'dark',
    description: 'Webs thick as sailcloth drape between the trees. Something large shifts above.',
    exits: { east: 'thornwood:path' },
    spawns: [{ monster: 'giant-spider', count: '1d2', respawn: 300, aggressive: true }],
    features: [{ id: 'cocoon', name: 'silk cocoon', skill: 'perception', dc: 15, verb: 'search', success: 'Inside a cocoon you find a dead adventurer\'s purse.', reward: { gold: 25 }, once: true, failure: 'Only husks and bones.' }],
  },
  'thornwood:bridge': {
    name: 'Old Stone Bridge', zone: 'thornwood', terrain: 'forest', light: 'dim',
    description: 'A mossy bridge spans a fast, cold stream. The current looks treacherous.',
    exits: { south: 'thornwood:path', north: 'thornwood:camp', east: 'thornwood:glade' },
    features: [{ id: 'stream', name: 'stream', skill: 'swim', dc: 15, verb: 'swim', success: 'You find a glinting ring wedged between rocks in the streambed.', reward: { item: 'ring-of-protection-1' }, once: true, failure: 'The current drags you downstream and you scramble out, bruised.', failureDamage: '1d6' }],
  },
  'thornwood:camp': {
    name: 'Goblin Camp', zone: 'thornwood', terrain: 'forest', light: 'dim',
    description: 'A ramshackle palisade of sharpened stakes surrounds smoky cookfires. Goblins shriek and point.',
    exits: { south: 'thornwood:bridge' },
    spawns: [{ monster: 'goblin', count: '2d3', respawn: 240, aggressive: true }, { monster: 'worg', count: 1, respawn: 600, aggressive: true }, { monster: 'hobgoblin', count: '1d2', respawn: 400, aggressive: true }],
    features: [{ id: 'chief-chest', name: "chieftain's chest", skill: 'disable-device', dc: 20, verb: 'unlock', success: 'The lock clicks open revealing coins and a potion.', reward: { gold: 120, item: 'potion-cure-moderate-wounds' }, once: true, failure: 'The lock resists your efforts.' }],
  },
  'thornwood:glade': {
    name: 'Moonlit Glade', zone: 'thornwood', terrain: 'forest', light: 'dim',
    description: 'A ring of standing stones. Deep claw marks score the bark of every tree around it.',
    exits: { west: 'thornwood:bridge' },
    spawns: [{ monster: 'owlbear', count: 1, respawn: 900, aggressive: true }],
  },

  // ------------------------------------------------------------------ Barrow Hills
  'barrow-hills:road': {
    name: 'Barrow Road', zone: 'barrow-hills', terrain: 'plains', light: 'bright',
    description: 'A windswept track winds between grassy mounds. Crows circle overhead.',
    exits: { north: 'brindlemoor:south-gate', south: 'barrow-hills:mound', east: 'barrow-hills:camp', west: 'sunken-mire:verge' },
    spawns: [{ monster: 'bandit', count: '1d3', respawn: 240, aggressive: true }],
  },
  'barrow-hills:camp': {
    name: 'Gnoll Lookout', zone: 'barrow-hills', terrain: 'hills', light: 'bright',
    description: 'Hyena-headed raiders squat around a crude watchfire on a hilltop.',
    exits: { west: 'barrow-hills:road', south: 'hollow-deep:entrance' },
    spawns: [{ monster: 'gnoll', count: '1d3+1', respawn: 300, aggressive: true }, { monster: 'bugbear', count: 1, respawn: 450, aggressive: true }],
  },
  'barrow-hills:mound': {
    name: 'The Great Barrow', zone: 'barrow-hills', terrain: 'hills', light: 'bright',
    description: 'A stone doorway carved with weeping kings leads into the largest mound.',
    exits: { north: 'barrow-hills:road', down: 'barrow-hills:crypt' },
    features: [{ id: 'runes', name: 'carved runes', skill: 'knowledge-religion', dc: 15, verb: 'read', success: 'The runes warn of the restless dead and name the wight-king Vorth.', failure: 'The script is beyond you.' }],
  },
  'barrow-hills:crypt': {
    name: 'Crypt Hall', zone: 'barrow-hills', terrain: 'underground', light: 'dark',
    description: 'Niches of bones line the walls. Some of them are moving.',
    exits: { up: 'barrow-hills:mound', down: 'barrow-hills:ossuary' },
    spawns: [{ monster: 'skeleton', count: '2d3', respawn: 200, aggressive: true }, { monster: 'zombie', count: '1d3', respawn: 200, aggressive: true }],
  },
  'barrow-hills:ossuary': {
    name: 'Ossuary of Hunger', zone: 'barrow-hills', terrain: 'underground', light: 'dark',
    description: 'Gnawed skulls fill this chamber. Ghouls crouch over a fresh meal.',
    exits: { up: 'barrow-hills:crypt', east: 'barrow-hills:tomb' },
    spawns: [{ monster: 'ghoul', count: '1d3+1', respawn: 300, aggressive: true }, { monster: 'ghast', count: 1, respawn: 450, aggressive: true }],
  },
  'barrow-hills:tomb': {
    name: "Tomb of the Wight-King", zone: 'barrow-hills', terrain: 'underground', light: 'dark',
    description: 'A sarcophagus of black basalt dominates the room. Shadows move against the light.',
    exits: { west: 'barrow-hills:ossuary' },
    spawns: [{ monster: 'wight', count: 1, respawn: 600, aggressive: true }, { monster: 'shadow', count: '1d2', respawn: 600, aggressive: true }, { monster: 'wraith', count: 1, respawn: 1200, aggressive: true, chance: 50 }, { monster: 'mummy', count: 1, respawn: 1200, aggressive: true, chance: 35 }],
    features: [{ id: 'sarcophagus', name: 'sarcophagus', skill: 'str', dc: 22, verb: 'open', success: "Within lies the wight-king's grave goods.", reward: { gold: 600, item: 'cloak-of-resistance-1' }, once: true, failure: 'The stone lid will not budge.' }],
  },

  // ------------------------------------------------------------------ Sunken Mire
  'sunken-mire:verge': {
    name: 'Mire Verge', zone: 'sunken-mire', terrain: 'swamp', light: 'dim',
    description: 'The ground turns to sucking mud. Reeds rattle though there is no wind.',
    exits: { east: 'barrow-hills:road', west: 'sunken-mire:village', south: 'sunken-mire:pools' },
    spawns: [{ monster: 'giant-frog', count: '1d2', respawn: 200, aggressive: true }, { monster: 'crocodile', count: 1, respawn: 300, aggressive: true }],
  },
  'sunken-mire:village': {
    name: 'Lizardfolk Stilt-Village', zone: 'sunken-mire', terrain: 'swamp', light: 'dim',
    description: 'Huts on stilts surround a muddy pool. Scaled warriors hiss challenges.',
    exits: { east: 'sunken-mire:verge' },
    spawns: [{ monster: 'lizardfolk', count: '2d3', respawn: 300, aggressive: true }],
  },
  'sunken-mire:pools': {
    name: 'Bubbling Pools', zone: 'sunken-mire', terrain: 'swamp', light: 'dim',
    description: 'Yellow slime coats the rocks around steaming pools. Five long necks rise from the water.',
    exits: { north: 'sunken-mire:verge', south: 'sunken-mire:lair' },
    spawns: [{ monster: 'hydra', count: 1, respawn: 900, aggressive: true }, { monster: 'ochre-jelly', count: 1, respawn: 600, aggressive: true, chance: 50 }],
  },
  'sunken-mire:lair': {
    name: 'Drowned Temple', zone: 'sunken-mire', terrain: 'swamp', light: 'dark',
    description: 'A half-sunken temple where a skull-faced black dragon coils upon a hoard.',
    exits: { north: 'sunken-mire:pools' },
    spawns: [{ monster: 'young-black-dragon', count: 1, respawn: 3600, aggressive: true }],
  },

  // ------------------------------------------------------------------ Hollow Deep
  'hollow-deep:entrance': {
    name: 'Hollow Deep Entrance', zone: 'hollow-deep', terrain: 'underground', light: 'dark',
    description: 'Worked stone stairs descend into darkness. Gargoyles perch on the lintel — or are they statues?',
    exits: { north: 'barrow-hills:camp', down: 'hollow-deep:hall' },
    spawns: [{ monster: 'gargoyle', count: '1d2', respawn: 600, aggressive: true }],
  },
  'hollow-deep:hall': {
    name: 'Hall of Pillars', zone: 'hollow-deep', terrain: 'underground', light: 'dark',
    description: 'A forest of carved pillars. The floor gleams with a strange, clean sheen.',
    exits: { up: 'hollow-deep:entrance', east: 'hollow-deep:midden', west: 'hollow-deep:gallery' },
    spawns: [{ monster: 'gelatinous-cube', count: 1, respawn: 600, aggressive: true }, { monster: 'rust-monster', count: 1, respawn: 600, aggressive: true, chance: 50 }],
    features: [{ id: 'trapdoor', name: 'pressure plate', skill: 'disable-device', dc: 20, verb: 'disarm', success: 'You jam the plate; beneath it is a hidden coffer.', reward: { gold: 300 }, once: true, failure: 'Darts hiss from the walls!', failureDamage: '2d4' }],
  },
  'hollow-deep:midden': {
    name: 'The Midden', zone: 'hollow-deep', terrain: 'underground', light: 'dark',
    description: 'A reeking garbage pit. Tentacles probe the filth.',
    exits: { west: 'hollow-deep:hall' },
    spawns: [{ monster: 'otyugh', count: 1, respawn: 600, aggressive: true }],
  },
  'hollow-deep:gallery': {
    name: 'Gallery of Statues', zone: 'hollow-deep', terrain: 'underground', light: 'dim',
    description: 'Lifelike statues of terrified adventurers line the walls. Something hisses in the shadows.',
    exits: { east: 'hollow-deep:hall', down: 'hollow-deep:pit' },
    spawns: [{ monster: 'medusa', count: 1, respawn: 1800, aggressive: true }, { monster: 'basilisk', count: 1, respawn: 1200, aggressive: true, chance: 40 }],
  },
  'hollow-deep:pit': {
    name: 'The Summoning Pit', zone: 'hollow-deep', terrain: 'underground', light: 'dark',
    description: 'Blood-red sigils pulse around a circular pit. Fiends claw at the edge of reality.',
    exits: { up: 'hollow-deep:gallery' },
    spawns: [{ monster: 'cultist', count: '1d3', respawn: 300, aggressive: true }, { monster: 'imp', count: 1, respawn: 300, aggressive: true }, { monster: 'bearded-devil', count: 1, respawn: 1200, aggressive: true, chance: 50 }, { monster: 'babau', count: 1, respawn: 1800, aggressive: true, chance: 30 }],
  },

  // ------------------------------------------------------------------ Ember Peaks
  'ember-peaks:pass': {
    name: 'Ashfall Pass', zone: 'ember-peaks', terrain: 'mountain', light: 'bright',
    description: 'Grey ash drifts like snow on the switchback trail. Boulders the size of houses lie shattered.',
    exits: { down: 'barrow-hills:camp', up: 'ember-peaks:bridge', east: 'ember-peaks:camp' },
    spawns: [{ monster: 'ogre', count: '1d2', respawn: 400, aggressive: true }],
    features: [{ id: 'cliff', name: 'cliff', skill: 'climb', dc: 15, verb: 'climb', success: 'From the ledge you spot a hidden path to the wyvern roost.', failure: 'You slip and fall.', failureDamage: '2d6' }],
  },
  'ember-peaks:bridge': {
    name: 'Cinder Bridge', zone: 'ember-peaks', terrain: 'mountain', light: 'bright',
    description: 'A chain bridge over a chasm of glowing lava. A troll grins beneath it.',
    exits: { down: 'ember-peaks:pass', up: 'ember-peaks:roost', north: 'ember-peaks:lair' },
    spawns: [{ monster: 'troll', count: 1, respawn: 900, aggressive: true }],
  },
  'ember-peaks:camp': {
    name: "Giant's Hearth", zone: 'ember-peaks', terrain: 'mountain', light: 'bright',
    description: 'A giant-sized firepit ringed by stone thrones. Hill giants gnaw on whole oxen.',
    exits: { west: 'ember-peaks:pass', east: 'ember-peaks:forge' },
    spawns: [{ monster: 'hill-giant', count: 1, respawn: 1200, aggressive: true }, { monster: 'stone-giant', count: 1, respawn: 1800, aggressive: true, chance: 40 }],
  },
  'ember-peaks:forge': {
    name: 'The Molten Forge', zone: 'ember-peaks', terrain: 'mountain', light: 'bright',
    description: 'A fire giant hammers at an anvil the size of a wagon while hell hounds pace.',
    exits: { west: 'ember-peaks:camp' },
    spawns: [{ monster: 'fire-giant', count: 1, respawn: 2400, aggressive: true }, { monster: 'hell-hound', count: '1d2', respawn: 600, aggressive: true }],
  },
  'ember-peaks:roost': {
    name: 'Wyvern Roost', zone: 'ember-peaks', terrain: 'mountain', light: 'bright',
    description: 'Bones and broken eggshells crowd a windy aerie.',
    exits: { down: 'ember-peaks:bridge' },
    spawns: [{ monster: 'wyvern', count: '1d2', respawn: 900, aggressive: true }, { monster: 'griffon', count: 1, respawn: 900, aggressive: true, chance: 30 }],
  },
  'ember-peaks:lair': {
    name: "Pyraxis's Lair", zone: 'ember-peaks', terrain: 'mountain', light: 'bright',
    description: 'Mountains of coins glitter in the heat-haze. A crimson dragon raises its head.',
    exits: { south: 'ember-peaks:bridge', down: 'shattered-rift:rim' },
    spawns: [{ monster: 'young-red-dragon', count: 1, respawn: 7200, aggressive: true }],
  },

  // ------------------------------------------------------------------ Shattered Rift
  'shattered-rift:rim': {
    name: 'Rift Rim', zone: 'shattered-rift', terrain: 'planes', light: 'bright',
    description: 'The ground splits into a canyon of raw elemental chaos: flame, stone, storm and tide.',
    exits: { up: 'ember-peaks:lair', down: 'shattered-rift:heart' },
    spawns: [{ monster: 'large-fire-elemental', count: 1, respawn: 600, aggressive: true }, { monster: 'large-air-elemental', count: 1, respawn: 600, aggressive: true, chance: 50 }, { monster: 'large-earth-elemental', count: 1, respawn: 600, aggressive: true, chance: 50 }],
  },
  'shattered-rift:heart': {
    name: 'Heart of the Rift', zone: 'shattered-rift', terrain: 'planes', light: 'bright',
    description: 'Elemental lords of storm and flame war in the open air. A great red wyrm circles above.',
    exits: { up: 'shattered-rift:rim' },
    spawns: [{ monster: 'greater-fire-elemental', count: 1, respawn: 1800, aggressive: true }, { monster: 'huge-earth-elemental', count: 1, respawn: 1800, aggressive: true }, { monster: 'adult-red-dragon', count: 1, respawn: 14400, aggressive: true, chance: 25 }],
  },
};

// Ember Peaks are reached from the gnoll lookout in the hills.
ROOMS['barrow-hills:camp'].exits.up = 'ember-peaks:pass';

const START_ROOM = 'brindlemoor:square';
const TEMPLE_ROOM = 'brindlemoor:temple';

module.exports = { ZONES, ROOMS, START_ROOM, TEMPLE_ROOM, TEMPLE_SERVICES };
