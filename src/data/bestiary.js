'use strict';

/**
 * Bestiary (Pathfinder RPG Bestiary, OGL). Stat blocks are stored as printed;
 * the Monster class (src/engine/monster.js) applies live modifiers on top.
 *
 * Attack entry: { name, bonus, damage, type[], crit: [range, mult], onHit[], natural, primary, count }
 * Full attack = every entry (count copies). Single attack = first entry.
 * ac: component bonuses (dex and size are derived from abilities/size).
 */

const SLASH = ['slashing'], PIERCE = ['piercing'], BLUDG = ['bludgeoning'], BPS = ['bludgeoning', 'piercing', 'slashing'];
const atk = (name, bonus, damage, extra = {}) => ({ name, bonus, damage, type: extra.type || BPS, crit: extra.crit || [20, 2], natural: extra.natural ?? true, ...extra });
const weapon = (name, bonus, damage, extra = {}) => atk(name, bonus, damage, { natural: false, ...extra });

const trip = { kind: 'trip' };
const grab = { kind: 'grab' };
const poison = (name, dc, damage, frequency = 6, cure = 1) => ({ kind: 'poison', name, save: 'fort', dc, damage, frequency, cure });
const disease = (name, dc, damage) => ({ kind: 'disease', name, save: 'fort', dc, damage });
const paralysis = (dc, duration, immune = []) => ({ kind: 'paralysis', dc, duration, immune });
const energy = (dice, type) => ({ kind: 'energy', dice, type });
const burn = (dice, dc) => ({ kind: 'burn', dice, dc });

function m(name, cr, def) {
  return { name, cr, alignment: 'N', size: 'medium', type: 'humanoid', subtypes: [], speed: { land: 30 }, senses: [], skills: {}, feats: [], languages: [], immune: [], resist: {}, dr: [], weaknesses: [], special: [], spellLike: [], treasure: 'standard', ac: {}, melee: [], ranged: [], ...def };
}

const BESTIARY = {
  // ------------------------------------------------------------- Humanoids
  goblin: m('Goblin', '1/3', {
    alignment: 'NE', size: 'small', subtypes: ['goblinoid'], init: 6, senses: ['darkvision 60'],
    ac: { armor: 2, shield: 1 }, hp: '1d10+1', hd: 1, saves: { fort: 3, ref: 2, will: -1 },
    melee: [weapon('short sword', 2, '1d4', { type: PIERCE, crit: [19, 2] })], ranged: [weapon('shortbow', 4, '1d4', { type: PIERCE, crit: [20, 3], range: 60 })],
    abilities: { str: 11, dex: 15, con: 12, int: 10, wis: 9, cha: 6 }, bab: 1, cmb: 0, cmd: 12,
    feats: ['improved-initiative'], skills: { ride: 10, stealth: 10, swim: 4, perception: -1 }, languages: ['Goblin'],
    description: 'A small, wiry humanoid with an oversized head, a wide mouth full of jagged teeth and a love of fire.',
  }),
  kobold: m('Kobold', '1/4', {
    alignment: 'LE', size: 'small', subtypes: ['reptilian'], init: 1, senses: ['darkvision 60'],
    ac: { armor: 2, natural: 1 }, hp: '1d10', hd: 1, saves: { fort: 2, ref: 1, will: -1 },
    melee: [weapon('spear', 1, '1d6-1', { type: PIERCE, crit: [20, 3] })], ranged: [weapon('sling', 3, '1d3-1', { type: BLUDG, range: 50 })],
    abilities: { str: 9, dex: 13, con: 10, int: 10, wis: 9, cha: 8 }, bab: 1, cmb: -1, cmd: 10,
    feats: ['skill-focus'], skills: { perception: 5, stealth: 5, 'craft': 6 }, weaknesses: ['light sensitivity'], languages: ['Draconic'],
    description: 'A small, cowardly reptilian humanoid with a talent for traps.',
  }),
  orc: m('Orc', '1/3', {
    alignment: 'CE', subtypes: ['orc'], init: 0, senses: ['darkvision 60'],
    ac: { armor: 3 }, hp: '1d10+1', hd: 1, saves: { fort: 3, ref: 0, will: -1 },
    melee: [weapon('falchion', 5, '2d4+4', { type: SLASH, crit: [18, 2] })], ranged: [weapon('javelin', 1, '1d6+3', { type: PIERCE, range: 30 })],
    abilities: { str: 17, dex: 11, con: 12, int: 7, wis: 8, cha: 6 }, bab: 1, cmb: 4, cmd: 14,
    feats: ['weapon-focus'], skills: { intimidate: 2, perception: -1 }, special: [{ kind: 'ferocity' }], weaknesses: ['light sensitivity'], languages: ['Common', 'Orc'],
    description: 'A savage, brutish humanoid with grayish skin, coarse hair and jutting tusks.',
  }),
  hobgoblin: m('Hobgoblin', '1/2', {
    alignment: 'LE', subtypes: ['goblinoid'], init: 2, senses: ['darkvision 60'],
    ac: { armor: 3, shield: 1 }, hp: '2d10+6', hd: 2, saves: { fort: 5, ref: 2, will: 1 },
    melee: [weapon('longsword', 4, '1d8+1', { type: SLASH, crit: [19, 2] })], ranged: [weapon('longbow', 3, '1d8', { type: PIERCE, crit: [20, 3], range: 100 })],
    abilities: { str: 15, dex: 15, con: 16, int: 10, wis: 12, cha: 8 }, bab: 2, cmb: 4, cmd: 16,
    feats: ['toughness'], skills: { perception: 2, stealth: 5 }, languages: ['Common', 'Goblin'],
    description: 'A disciplined, militaristic goblinoid soldier.',
  }),
  gnoll: m('Gnoll', '1', {
    alignment: 'CE', subtypes: ['gnoll'], init: 0, senses: ['darkvision 60'],
    ac: { armor: 2, natural: 1, shield: 2 }, hp: '2d8+2', hd: 2, saves: { fort: 4, ref: 0, will: 0 },
    melee: [weapon('spear', 3, '1d8+3', { type: PIERCE, crit: [20, 3] })], ranged: [weapon('throwing axe', 1, '1d6+2', { type: SLASH, range: 10 })],
    abilities: { str: 15, dex: 10, con: 13, int: 8, wis: 11, cha: 8 }, bab: 1, cmb: 3, cmd: 13,
    feats: ['power-attack'], skills: { perception: 2 }, languages: ['Gnoll'],
    description: 'A hyena-headed humanoid that raids in howling packs.',
  }),
  bugbear: m('Bugbear', '2', {
    alignment: 'CE', subtypes: ['goblinoid'], init: 1, senses: ['darkvision 60', 'scent'],
    ac: { armor: 2, natural: 3, shield: 1 }, hp: '3d8+3', hd: 3, saves: { fort: 2, ref: 4, will: 1 },
    melee: [weapon('morningstar', 5, '1d8+3', { type: ['bludgeoning', 'piercing'] })], ranged: [weapon('javelin', 3, '1d6+3', { type: PIERCE, range: 30 })],
    abilities: { str: 16, dex: 13, con: 13, int: 10, wis: 12, cha: 9 }, bab: 2, cmb: 5, cmd: 16,
    feats: ['intimidating-prowess', 'skill-focus'], skills: { intimidate: 9, perception: 8, stealth: 10 }, languages: ['Common', 'Goblin'],
    description: 'A hulking, hairy goblinoid that stalks prey with surprising stealth.',
  }),
  lizardfolk: m('Lizardfolk', '1', {
    subtypes: ['reptilian'], init: 0, ac: { natural: 5, shield: 2 }, hp: '2d8+2', hd: 2, saves: { fort: 4, ref: 0, will: 0 },
    speed: { land: 30, swim: 15 },
    melee: [weapon('morningstar', 2, '1d8+1', { type: ['bludgeoning', 'piercing'] }), atk('bite', 0, '1d4', { primary: false })], ranged: [weapon('javelin', 1, '1d6+1', { type: PIERCE, range: 30 })],
    abilities: { str: 13, dex: 10, con: 13, int: 9, wis: 10, cha: 10 }, bab: 1, cmb: 2, cmd: 12,
    feats: ['multiattack'], skills: { acrobatics: 2, perception: 1, swim: 8 }, special: [{ kind: 'holdBreath' }], languages: ['Draconic'],
    description: 'A reptilian swamp-dweller with a crocodilian snout.',
  }),
  bandit: m('Bandit', '1/2', {
    alignment: 'CN', subtypes: ['human'], init: 2, ac: { armor: 3 }, hp: '1d10+1', hd: 1, saves: { fort: 3, ref: 2, will: -1 },
    melee: [weapon('short sword', 3, '1d6+1', { type: PIERCE, crit: [19, 2] })], ranged: [weapon('shortbow', 3, '1d6', { type: PIERCE, crit: [20, 3], range: 60 })],
    abilities: { str: 13, dex: 14, con: 12, int: 10, wis: 9, cha: 10 }, bab: 1, cmb: 2, cmd: 14,
    feats: ['weapon-focus'], skills: { intimidate: 4, stealth: 6 }, languages: ['Common'], treasure: 'standard',
    description: 'A roadside thug in patched leather (human warrior 1).',
  }),
  'town-guard': m('Town Guard', '1', {
    alignment: 'LN', subtypes: ['human'], init: 1, ac: { armor: 5, shield: 2 }, hp: '2d10+4', hd: 2, saves: { fort: 4, ref: 1, will: 0 },
    melee: [weapon('longsword', 5, '1d8+2', { type: SLASH, crit: [19, 2] })], ranged: [weapon('light crossbow', 3, '1d8', { type: PIERCE, crit: [19, 2], range: 80 })],
    abilities: { str: 15, dex: 12, con: 13, int: 10, wis: 11, cha: 10 }, bab: 2, cmb: 4, cmd: 15,
    feats: ['weapon-focus', 'toughness'], skills: { intimidate: 5, perception: 4 }, languages: ['Common'], treasure: 'incidental',
    description: 'A veteran member of the watch (human warrior 2).',
  }),
  cultist: m('Cultist', '1', {
    alignment: 'NE', subtypes: ['human'], init: 0, ac: { armor: 2 }, hp: '2d6+2', hd: 2, saves: { fort: 1, ref: 0, will: 5 },
    melee: [weapon('dagger', 1, '1d4', { type: PIERCE, crit: [19, 2] })],
    abilities: { str: 10, dex: 11, con: 12, int: 10, wis: 15, cha: 13 }, bab: 1, cmb: 1, cmd: 11,
    spellLike: [{ spell: 'cause-fear', perDay: 2, cl: 2, dc: 13 }, { spell: 'inflict-light-wounds', perDay: 2, cl: 2, dc: 13 }],
    feats: ['combat-casting'], skills: { 'knowledge-religion': 5, spellcraft: 5 }, languages: ['Common', 'Infernal'],
    description: 'A robed devotee of forbidden powers (human adept 2).',
  }),

  // --------------------------------------------------------------- Undead
  skeleton: m('Human Skeleton', '1/3', {
    alignment: 'NE', type: 'undead', init: 6, senses: ['darkvision 60'],
    ac: { armor: 2, natural: 2 }, hp: '1d8', hd: 1, saves: { fort: 0, ref: 2, will: 2 },
    melee: [weapon('broken scimitar', 0, '1d6', { type: SLASH, crit: [18, 2] }), atk('claw', -3, '1d4+1', { primary: false })],
    abilities: { str: 15, dex: 14, con: null, int: null, wis: 10, cha: 10 }, bab: 0, cmb: 2, cmd: 14,
    feats: ['improved-initiative'], dr: [{ amount: 5, bypass: 'bludgeoning' }], immune: ['cold'], treasure: 'none',
    description: 'An animated human skeleton, held together by necromancy.',
  }),
  zombie: m('Human Zombie', '1/2', {
    alignment: 'NE', type: 'undead', init: 0, senses: ['darkvision 60'],
    ac: { natural: 2 }, hp: '2d8+3', hd: 2, saves: { fort: 0, ref: 0, will: 3 },
    melee: [atk('slam', 4, '1d6+4', { type: BLUDG })], abilities: { str: 17, dex: 10, con: null, int: null, wis: 10, cha: 10 }, bab: 1, cmb: 4, cmd: 14,
    feats: ['toughness'], dr: [{ amount: 5, bypass: 'slashing' }], special: [{ kind: 'staggered' }], speed: { land: 30 }, treasure: 'none',
    description: 'A shambling, rotting corpse animated to mindless violence.',
  }),
  ghoul: m('Ghoul', '1', {
    alignment: 'CE', type: 'undead', init: 2, senses: ['darkvision 60'],
    ac: { natural: 2 }, hp: '2d8+4', hd: 2, saves: { fort: 2, ref: 2, will: 5 },
    melee: [atk('bite', 3, '1d6+1', { onHit: [disease('ghoul fever', 13, { con: '1d3', dex: '1d3' }), paralysis(13, '1d4+1', ['elf'])] }), atk('claw', 3, '1d6+1', { count: 2, type: SLASH, onHit: [paralysis(13, '1d4+1', ['elf'])] })],
    abilities: { str: 13, dex: 15, con: null, int: 13, wis: 14, cha: 14 }, bab: 1, cmb: 2, cmd: 14,
    feats: ['weapon-finesse'], skills: { acrobatics: 4, climb: 6, perception: 7, stealth: 7, swim: 3 }, channelResistance: 2, languages: ['Common'],
    description: 'A gaunt, ravenous corpse-eater whose touch paralyzes.',
  }),
  ghast: m('Ghast', '2', {
    alignment: 'CE', type: 'undead', init: 3, senses: ['darkvision 60'],
    ac: { natural: 4 }, hp: '2d8+8', hd: 2, saves: { fort: 4, ref: 3, will: 5 },
    melee: [atk('bite', 5, '1d8+3', { onHit: [disease('ghoul fever', 15, { con: '1d3', dex: '1d3' }), paralysis(15, '1d4+1')] }), atk('claw', 5, '1d6+3', { count: 2, type: SLASH, onHit: [paralysis(15, '1d4+1')] })],
    abilities: { str: 17, dex: 17, con: null, int: 13, wis: 14, cha: 18 }, bab: 1, cmb: 4, cmd: 17,
    feats: ['weapon-finesse'], special: [{ kind: 'aura', name: 'stench', radius: 10, condition: 'sickened', duration: '1d6+4', save: { type: 'fort', dc: 15 } }], channelResistance: 2,
    description: 'A stronger, stinking breed of ghoul.',
  }),
  wight: m('Wight', '3', {
    alignment: 'LE', type: 'undead', init: 1, senses: ['darkvision 60'],
    ac: { natural: 4 }, hp: '4d8+8', hd: 4, saves: { fort: 3, ref: 2, will: 5 },
    melee: [atk('slam', 4, '1d4+1', { type: BLUDG, onHit: [{ kind: 'energyDrain', levels: 1, dc: 14 }] })],
    abilities: { str: 12, dex: 12, con: null, int: 11, wis: 13, cha: 15 }, bab: 3, cmb: 4, cmd: 15,
    feats: ['blind-fight', 'skill-focus'], skills: { intimidate: 9, perception: 11, stealth: 16 }, weaknesses: ['resurrection vulnerability'], special: [{ kind: 'createSpawn' }], languages: ['Common'],
    description: 'A grave-born corpse that drains life with its touch.',
  }),
  shadow: m('Shadow', '3', {
    alignment: 'CE', type: 'undead', subtypes: ['incorporeal'], init: 2, senses: ['darkvision 60'],
    ac: { deflection: 2, dodge: 1 }, hp: '3d8+6', hd: 3, saves: { fort: 3, ref: 3, will: 4 }, speed: { land: 0, fly: 40 },
    melee: [atk('incorporeal touch', 4, '0', { touch: true, onHit: [{ kind: 'abilityDamage', ability: 'str', dice: '1d6' }] })],
    abilities: { str: null, dex: 14, con: null, int: 6, wis: 12, cha: 15 }, bab: 2, cmb: 4, cmd: 17,
    feats: ['dodge', 'skill-focus'], skills: { fly: 11, perception: 8, stealth: 8 }, incorporeal: true, channelResistance: 2, special: [{ kind: 'createSpawn' }],
    description: 'A living silhouette that drains strength.',
  }),
  wraith: m('Wraith', '5', {
    alignment: 'LE', type: 'undead', subtypes: ['incorporeal'], init: 7, senses: ['darkvision 60', 'lifesense'],
    ac: { deflection: 4, dodge: 1 }, hp: '5d8+25', hd: 5, saves: { fort: 6, ref: 4, will: 6 }, speed: { land: 0, fly: 60 },
    melee: [atk('incorporeal touch', 6, '1d6', { touch: true, damageType: 'negative', onHit: [{ kind: 'abilityDrain', ability: 'con', dice: '1d6', dc: 17 }] })],
    abilities: { str: null, dex: 16, con: null, int: 14, wis: 14, cha: 21 }, bab: 3, cmb: 6, cmd: 21,
    feats: ['blind-fight', 'combat-reflexes', 'improved-initiative'], skills: { diplomacy: 10, fly: 7, intimidate: 13, perception: 10, stealth: 11 }, incorporeal: true, channelResistance: 2,
    weaknesses: ['sunlight powerlessness'], special: [{ kind: 'createSpawn' }], languages: ['Common', 'Infernal'],
    description: 'An evil spirit of pure hatred, wreathed in shadow.',
  }),
  mummy: m('Mummy', '5', {
    alignment: 'LE', type: 'undead', init: 0, senses: ['darkvision 60'],
    ac: { natural: 10 }, hp: '8d8+24', hd: 8, saves: { fort: 4, ref: 2, will: 8 }, speed: { land: 20 },
    melee: [atk('slam', 14, '2d8+10', { type: BLUDG, onHit: [disease('mummy rot', 16, { con: '1d6', cha: '1d6' })] })],
    abilities: { str: 24, dex: 10, con: null, int: 6, wis: 15, cha: 15 }, bab: 6, cmb: 13, cmd: 23,
    feats: ['power-attack', 'toughness', 'weapon-focus'], dr: [{ amount: 5, bypass: '-' }], weaknesses: ['vulnerable fire'], vulnerable: ['fire'],
    special: [{ kind: 'aura', name: 'despair', radius: 30, condition: 'paralyzed', duration: '1d4', save: { type: 'will', dc: 16 }, once: true, tags: ['fear'] }],
    description: 'A bandage-wrapped corpse preserved by dark rituals.',
  }),

  // -------------------------------------------------------------- Animals
  'dire-rat': m('Dire Rat', '1/3', {
    type: 'animal', size: 'small', init: 3, senses: ['low-light vision', 'scent'], speed: { land: 40, climb: 20, swim: 20 },
    ac: {}, hp: '1d8+1', hd: 1, saves: { fort: 3, ref: 5, will: 1 },
    melee: [atk('bite', 1, '1d4', { onHit: [disease('filth fever', 11, { dex: '1d3', con: '1d3' })] })],
    abilities: { str: 10, dex: 17, con: 13, int: 2, wis: 13, cha: 4 }, bab: 0, cmb: -1, cmd: 12, feats: ['skill-focus'], skills: { climb: 11, perception: 4, stealth: 11, swim: 11 }, treasure: 'none',
    description: 'A filthy, dog-sized rat that carries disease.',
  }),
  wolf: m('Wolf', '1', {
    type: 'animal', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 50 },
    ac: { natural: 2 }, hp: '2d8+4', hd: 2, saves: { fort: 5, ref: 5, will: 1 },
    melee: [atk('bite', 2, '1d6+1', { onHit: [trip] })], abilities: { str: 13, dex: 15, con: 15, int: 2, wis: 12, cha: 6 }, bab: 1, cmb: 2, cmd: 14, cmdVs: { trip: 18 },
    feats: ['skill-focus'], skills: { perception: 8, stealth: 6, survival: 1 }, treasure: 'none',
    description: 'A lean, gray predator that hunts in packs.',
  }),
  'dire-wolf': m('Dire Wolf', '3', {
    type: 'animal', size: 'large', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 50 },
    ac: { natural: 3 }, hp: '5d8+15', hd: 5, saves: { fort: 7, ref: 6, will: 2 },
    melee: [atk('bite', 7, '1d8+6', { onHit: [trip] })], abilities: { str: 19, dex: 15, con: 17, int: 2, wis: 12, cha: 10 }, bab: 3, cmb: 8, cmd: 20, cmdVs: { trip: 24 },
    feats: ['run', 'skill-focus', 'weapon-focus'], skills: { perception: 10, stealth: 3 }, treasure: 'none',
    description: 'A huge, savage wolf the size of a horse.',
  }),
  worg: m('Worg', '2', {
    alignment: 'NE', type: 'magical beast', init: 2, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 50 },
    ac: { natural: 2 }, hp: '4d10+4', hd: 4, saves: { fort: 5, ref: 6, will: 3 },
    melee: [atk('bite', 7, '1d6+4', { onHit: [trip] })], abilities: { str: 17, dex: 15, con: 13, int: 6, wis: 14, cha: 10 }, bab: 4, cmb: 7, cmd: 19, cmdVs: { trip: 23 },
    feats: ['improved-initiative', 'skill-focus'], skills: { perception: 11, stealth: 9, survival: 5 }, languages: ['Common', 'Goblin'], treasure: 'none',
    description: 'An evil, intelligent wolf often ridden by goblins.',
  }),
  'grizzly-bear': m('Grizzly Bear', '4', {
    type: 'animal', size: 'large', init: 1, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 6 }, hp: '5d8+20', hd: 5, saves: { fort: 8, ref: 5, will: 2 },
    melee: [atk('claw', 7, '1d6+5', { count: 2, type: SLASH, onHit: [grab] }), atk('bite', 7, '1d6+5')],
    abilities: { str: 21, dex: 13, con: 19, int: 2, wis: 12, cha: 6 }, bab: 3, cmb: 9, cmd: 20, special: [{ kind: 'ferocity' }],
    feats: ['endurance', 'improved-natural-attack', 'skill-focus'], skills: { perception: 6, survival: 5, swim: 14 }, treasure: 'none',
    description: 'A massive brown bear with a hump of muscle between its shoulders.',
  }),
  eagle: m('Eagle', '1/2', {
    type: 'animal', size: 'small', init: 2, senses: ['low-light vision'], speed: { land: 10, fly: 80 },
    ac: { natural: 1 }, hp: '1d8+1', hd: 1, saves: { fort: 3, ref: 4, will: 2 },
    melee: [atk('talon', 3, '1d4', { count: 2, type: SLASH }), atk('bite', 3, '1d4')], abilities: { str: 10, dex: 15, con: 12, int: 2, wis: 15, cha: 7 }, bab: 0, cmb: -1, cmd: 11,
    feats: ['weapon-finesse'], skills: { fly: 8, perception: 10 }, treasure: 'none', description: 'A keen-eyed bird of prey.',
  }),
  'giant-fire-beetle': m('Giant Fire Beetle', '1/3', {
    type: 'vermin', size: 'small', init: 0, senses: ['low-light vision'], speed: { land: 30, fly: 30 },
    ac: { natural: 3 }, hp: '1d8+1', hd: 1, saves: { fort: 3, ref: 0, will: 0 },
    melee: [atk('bite', 1, '1d4')], abilities: { str: 10, dex: 11, con: 13, int: null, wis: 10, cha: 7 }, bab: 0, cmb: -1, cmd: 9, treasure: 'none', description: 'A glowing beetle the size of a cat.',
  }),
  'poisonous-frog': m('Poisonous Frog', '1/3', {
    type: 'animal', size: 'tiny', init: 1, senses: ['low-light vision'], speed: { land: 20, swim: 20 },
    ac: {}, hp: '1d8', hd: 1, saves: { fort: 2, ref: 3, will: 1 },
    melee: [atk('bite', 4, '1d2-4', { onHit: [poison('frog toxin', 10, { con: '1d2' }, 4)] })], abilities: { str: 2, dex: 13, con: 11, int: 1, wis: 13, cha: 4 }, bab: 0, cmb: -1, cmd: 5, treasure: 'none', description: 'A brightly colored frog whose bite carries toxin.',
  }),
  viper: m('Viper', '1/2', {
    type: 'animal', size: 'tiny', init: 3, senses: ['low-light vision', 'scent'], speed: { land: 20, climb: 20, swim: 20 },
    ac: { natural: 2 }, hp: '1d8', hd: 1, saves: { fort: 2, ref: 5, will: 1 },
    melee: [atk('bite', 5, '1d2-2', { onHit: [poison('viper venom', 9, { con: '1d2' })] })], abilities: { str: 4, dex: 17, con: 8, int: 1, wis: 13, cha: 2 }, bab: 0, cmb: 1, cmd: 8, feats: ['weapon-finesse'], treasure: 'none', description: 'A small, venomous snake.',
  }),
  pony: m('Pony', '1/2', {
    type: 'animal', init: 1, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 1 }, hp: '2d8+4', hd: 2, saves: { fort: 5, ref: 4, will: 0 },
    melee: [atk('hoof', -1, '1d3+1', { count: 2, type: BLUDG })], abilities: { str: 13, dex: 13, con: 14, int: 2, wis: 11, cha: 4 }, bab: 1, cmb: 2, cmd: 13, treasure: 'none', description: 'A small, sturdy horse.',
  }),
  horse: m('Horse', '1', {
    type: 'animal', size: 'large', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 50 },
    ac: { natural: 4 }, hp: '2d8+6', hd: 2, saves: { fort: 6, ref: 5, will: 1 },
    melee: [atk('bite', -2, '1d4+1'), atk('hoof', -2, '1d6+1', { count: 2, type: BLUDG })], abilities: { str: 16, dex: 14, con: 17, int: 2, wis: 13, cha: 7 }, bab: 1, cmb: 5, cmd: 17, treasure: 'none', description: 'A strong riding horse.',
  }),
  'giant-centipede': m('Giant Centipede', '1/2', {
    type: 'vermin', init: 2, senses: ['darkvision 60'], speed: { land: 40, climb: 40 },
    ac: { natural: 2 }, hp: '1d8', hd: 1, saves: { fort: 2, ref: 2, will: 0 },
    melee: [atk('bite', 2, '1d6-1', { onHit: [poison('centipede venom', 13, { dex: '1d3' })] })], abilities: { str: 9, dex: 15, con: 10, int: null, wis: 10, cha: 2 }, bab: 0, cmb: -1, cmd: 11, feats: ['weapon-finesse'], treasure: 'none', description: 'A venomous centipede as long as a man.',
  }),
  'giant-frog': m('Giant Frog', '1', {
    type: 'animal', init: 1, senses: ['low-light vision', 'scent'], speed: { land: 30, swim: 30 },
    ac: { natural: 1 }, hp: '2d8+4', hd: 2, saves: { fort: 5, ref: 4, will: -1 },
    melee: [atk('bite', 3, '1d6+2', { onHit: [grab] })], abilities: { str: 15, dex: 13, con: 16, int: 1, wis: 8, cha: 6 }, bab: 1, cmb: 3, cmd: 14, special: [{ kind: 'pull' }, { kind: 'swallowWhole' }], treasure: 'none', description: 'A frog the size of a pony.',
  }),
  'giant-spider': m('Giant Spider', '1', {
    type: 'vermin', init: 3, senses: ['darkvision 60', 'tremorsense 60'], speed: { land: 30, climb: 30 },
    ac: { natural: 1 }, hp: '3d8+3', hd: 3, saves: { fort: 4, ref: 4, will: 1 },
    melee: [atk('bite', 2, '1d6', { onHit: [poison('spider venom', 14, { str: '1d2' }, 4)] })],
    ranged: [atk('web', 5, '0', { touch: true, onHit: [{ kind: 'condition', condition: 'entangled', duration: null, escapeDc: 12 }], range: 50 })],
    abilities: { str: 11, dex: 17, con: 12, int: null, wis: 10, cha: 2 }, bab: 2, cmb: 2, cmd: 15, skills: { climb: 16, perception: 4, stealth: 7 }, treasure: 'incidental', description: 'A horse-sized hunting spider.',
  }),
  'giant-scorpion': m('Giant Scorpion', '3', {
    type: 'vermin', size: 'large', init: 0, senses: ['darkvision 60', 'tremorsense 60'], speed: { land: 50 },
    ac: { natural: 7 }, hp: '5d8+15', hd: 5, saves: { fort: 7, ref: 1, will: 1 },
    melee: [atk('claw', 6, '1d6+4', { count: 2, type: BLUDG, onHit: [grab] }), atk('sting', 6, '1d6+4', { type: PIERCE, onHit: [poison('scorpion venom', 17, { str: '1d2' })] })],
    abilities: { str: 19, dex: 10, con: 16, int: null, wis: 10, cha: 2 }, bab: 3, cmb: 8, cmd: 18, reach: 10,
    special: [{ kind: 'constrict', dice: '1d6+4' }], skills: { climb: 8, perception: 4, stealth: 0 }, treasure: 'none',
    description: 'A scorpion the size of a cart, with a venomous sting.',
  }),
  ape: m('Ape', '2', {
    type: 'animal', size: 'large', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 30, climb: 30 },
    ac: { natural: 3 }, hp: '3d8+6', hd: 3, saves: { fort: 5, ref: 5, will: 2 },
    melee: [atk('claw', 5, '1d4+4', { count: 2, type: SLASH })], abilities: { str: 19, dex: 15, con: 14, int: 2, wis: 12, cha: 7 }, bab: 2, cmb: 7, cmd: 19, treasure: 'none', description: 'A powerful great ape.',
  }),
  boar: m('Boar', '2', {
    type: 'animal', init: 0, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 6 }, hp: '2d8+9', hd: 2, saves: { fort: 6, ref: 3, will: 1 },
    melee: [atk('gore', 4, '1d8+4', { type: PIERCE })], abilities: { str: 17, dex: 10, con: 17, int: 2, wis: 13, cha: 4 }, bab: 1, cmb: 4, cmd: 14, special: [{ kind: 'ferocity' }], feats: ['toughness'], treasure: 'none', description: 'An ill-tempered wild pig with sharp tusks.',
  }),
  'dire-boar': m('Dire Boar', '4', {
    type: 'animal', size: 'large', init: 0, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 6 }, hp: '6d8+24', hd: 6, saves: { fort: 9, ref: 5, will: 3 },
    melee: [atk('gore', 12, '2d6+12', { type: PIERCE })], abilities: { str: 27, dex: 10, con: 17, int: 2, wis: 13, cha: 8 }, bab: 4, cmb: 13, cmd: 23, special: [{ kind: 'ferocity' }], treasure: 'none', description: 'A massive boar with tusks like spears.',
  }),
  crocodile: m('Crocodile', '2', {
    type: 'animal', size: 'large', init: 1, senses: ['low-light vision'], speed: { land: 20, swim: 30 },
    ac: { natural: 5 }, hp: '3d8+9', hd: 3, saves: { fort: 6, ref: 4, will: 2 },
    melee: [atk('bite', 5, '1d8+4', { onHit: [grab] }), atk('tail slap', 0, '1d12+2', { type: BLUDG, primary: false })],
    abilities: { str: 19, dex: 12, con: 17, int: 1, wis: 12, cha: 2 }, bab: 2, cmb: 7, cmd: 18, special: [{ kind: 'deathRoll', dice: '1d8+6' }], treasure: 'none', description: 'An armored river predator.',
  }),
  'dire-bat': m('Dire Bat', '2', {
    type: 'animal', size: 'large', init: 2, senses: ['blindsense 40'], speed: { land: 20, fly: 40 },
    ac: { natural: 3 }, hp: '4d8+12', hd: 4, saves: { fort: 7, ref: 6, will: 3 },
    melee: [atk('bite', 5, '1d8+4')], abilities: { str: 17, dex: 15, con: 17, int: 2, wis: 14, cha: 6 }, bab: 3, cmb: 7, cmd: 19, treasure: 'none', description: 'A bat with a 15-ft. wingspan.',
  }),
  leopard: m('Leopard', '2', {
    type: 'animal', init: 4, senses: ['low-light vision', 'scent'], speed: { land: 30, climb: 20 },
    ac: { natural: 1 }, hp: '3d8+6', hd: 3, saves: { fort: 5, ref: 7, will: 2 },
    melee: [atk('bite', 6, '1d6+3', { onHit: [grab] }), atk('claw', 6, '1d3+3', { count: 2, type: SLASH })],
    abilities: { str: 16, dex: 19, con: 15, int: 2, wis: 13, cha: 6 }, bab: 2, cmb: 5, cmd: 19, special: [{ kind: 'pounce' }, { kind: 'rake', count: 2, bonus: 6, damage: '1d3+3' }], treasure: 'none', description: 'A spotted big cat.',
  }),
  lion: m('Lion', '3', {
    type: 'animal', size: 'large', init: 7, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 1 }, hp: '5d8+15', hd: 5, saves: { fort: 7, ref: 7, will: 2 },
    melee: [atk('bite', 7, '1d8+5', { onHit: [grab] }), atk('claw', 7, '1d4+5', { count: 2, type: SLASH })],
    abilities: { str: 21, dex: 17, con: 17, int: 2, wis: 15, cha: 10 }, bab: 3, cmb: 9, cmd: 22, special: [{ kind: 'pounce' }, { kind: 'rake', count: 2, bonus: 7, damage: '1d4+5' }], feats: ['improved-initiative', 'run', 'skill-focus'], treasure: 'none', description: 'The king of beasts.',
  }),
  'dire-lion': m('Dire Lion', '5', {
    type: 'animal', size: 'large', init: 6, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 4 }, hp: '8d8+32', hd: 8, saves: { fort: 10, ref: 8, will: 3 },
    melee: [atk('bite', 13, '1d8+7', { onHit: [grab] }), atk('claw', 13, '1d6+7', { count: 2, type: SLASH })],
    abilities: { str: 25, dex: 15, con: 17, int: 2, wis: 15, cha: 10 }, bab: 6, cmb: 14, cmd: 26, special: [{ kind: 'pounce' }, { kind: 'rake', count: 2, bonus: 13, damage: '1d6+7' }], treasure: 'none', description: 'An immense prehistoric lion.',
  }),
  'dire-tiger': m('Dire Tiger', '8', {
    type: 'animal', size: 'large', init: 6, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 6 }, hp: '14d8+56', hd: 14, saves: { fort: 13, ref: 11, will: 5 },
    melee: [atk('claw', 18, '2d4+8', { count: 2, type: SLASH, onHit: [grab] }), atk('bite', 18, '2d6+8')],
    abilities: { str: 27, dex: 15, con: 17, int: 2, wis: 12, cha: 10 }, bab: 10, cmb: 19, cmd: 31, special: [{ kind: 'pounce' }, { kind: 'rake', count: 2, bonus: 18, damage: '2d4+8' }], treasure: 'none', description: 'A saber-toothed terror of the wilds.',
  }),
  shark: m('Shark', '2', {
    type: 'animal', size: 'large', init: 2, senses: ['blindsense 30', 'keen scent'], speed: { land: 0, swim: 60 },
    ac: { natural: 3 }, hp: '4d8+4', hd: 4, saves: { fort: 7, ref: 6, will: 2 },
    melee: [atk('bite', 4, '1d8+4')], abilities: { str: 17, dex: 15, con: 13, int: 1, wis: 12, cha: 2 }, bab: 3, cmb: 7, cmd: 19, treasure: 'none', description: 'A ravenous ocean predator.',
  }),
  wolverine: m('Wolverine', '2', {
    type: 'animal', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 30, burrow: 10, climb: 10 },
    ac: { natural: 2 }, hp: '3d8+15', hd: 3, saves: { fort: 7, ref: 5, will: 2 },
    melee: [atk('claw', 4, '1d6+2', { count: 2, type: SLASH }), atk('bite', 4, '1d4+2')], abilities: { str: 15, dex: 15, con: 19, int: 2, wis: 12, cha: 10 }, bab: 2, cmb: 4, cmd: 16, special: [{ kind: 'rage' }], treasure: 'none', description: 'A ferocious, badger-like beast.',
  }),

  // ------------------------------------------------------- Giants & brutes
  ogre: m('Ogre', '3', {
    alignment: 'CE', size: 'large', subtypes: ['giant'], init: -1, senses: ['darkvision 60', 'low-light vision'], speed: { land: 40 },
    ac: { armor: 4, natural: 5 }, hp: '4d8+12', hd: 4, saves: { fort: 6, ref: 0, will: 3 },
    melee: [weapon('greatclub', 7, '2d8+7', { type: BLUDG })], ranged: [weapon('javelin', 1, '1d8+5', { type: PIERCE, range: 30 })],
    abilities: { str: 21, dex: 8, con: 15, int: 6, wis: 10, cha: 7 }, bab: 3, cmb: 9, cmd: 18, reach: 10,
    feats: ['iron-will', 'toughness'], skills: { climb: 7, perception: 5 }, languages: ['Giant'], description: 'A lumbering, brutish giant.',
  }),
  troll: m('Troll', '5', {
    alignment: 'CE', size: 'large', subtypes: ['giant'], init: 2, senses: ['darkvision 60', 'low-light vision', 'scent'],
    ac: { natural: 5 }, hp: '6d8+36', hd: 6, saves: { fort: 11, ref: 4, will: 3 },
    melee: [atk('bite', 8, '1d8+5'), atk('claw', 8, '1d6+5', { count: 2, type: SLASH })],
    abilities: { str: 21, dex: 14, con: 23, int: 6, wis: 9, cha: 6 }, bab: 4, cmb: 10, cmd: 22, reach: 10,
    regeneration: { amount: 5, bypass: ['acid', 'fire'] }, special: [{ kind: 'rend', requires: 'claw', dice: '1d6+7' }],
    feats: ['intimidating-prowess', 'iron-will', 'skill-focus'], skills: { intimidate: 9, perception: 8 }, languages: ['Giant'], description: 'A gangly, green-skinned giant that regenerates its wounds.',
  }),
  'hill-giant': m('Hill Giant', '7', {
    alignment: 'CE', size: 'large', subtypes: ['giant'], init: -1, senses: ['low-light vision'], speed: { land: 40 },
    ac: { armor: 4, natural: 9 }, hp: '10d8+40', hd: 10, saves: { fort: 11, ref: 2, will: 3 },
    melee: [weapon('greatclub', 14, '2d8+10', { type: BLUDG }), weapon('greatclub', 9, '2d8+10', { type: BLUDG })], ranged: [weapon('rock', 6, '1d8+10', { type: BLUDG, range: 120 })],
    abilities: { str: 25, dex: 8, con: 19, int: 6, wis: 10, cha: 7 }, bab: 7, cmb: 15, cmd: 24, reach: 10,
    feats: ['cleave', 'intimidating-prowess', 'martial-weapon-proficiency', 'power-attack', 'weapon-focus'], special: [{ kind: 'rockThrowing' }, { kind: 'rockCatching' }], languages: ['Giant'], description: 'A dull-witted, hulking giant of the hills.',
  }),
  'stone-giant': m('Stone Giant', '8', {
    alignment: 'N', size: 'large', subtypes: ['earth', 'giant'], init: 2, senses: ['darkvision 60', 'low-light vision'], speed: { land: 40 },
    ac: { natural: 11 }, hp: '12d8+48', hd: 12, saves: { fort: 12, ref: 6, will: 7 },
    melee: [weapon('greatclub', 16, '2d8+12', { type: BLUDG }), weapon('greatclub', 11, '2d8+12', { type: BLUDG })], ranged: [weapon('rock', 11, '1d8+12', { type: BLUDG, range: 180 })],
    abilities: { str: 27, dex: 15, con: 19, int: 10, wis: 12, cha: 10 }, bab: 9, cmb: 18, cmd: 30, reach: 10,
    feats: ['iron-will', 'point-blank-shot', 'power-attack', 'precise-shot'], special: [{ kind: 'rockThrowing' }, { kind: 'rockCatching' }], languages: ['Common', 'Giant'], description: 'A gray-skinned giant of the mountains.',
  }),
  'frost-giant': m('Frost Giant', '9', {
    alignment: 'CE', size: 'large', subtypes: ['cold', 'giant'], init: -1, senses: ['low-light vision'], speed: { land: 40 },
    ac: { armor: 4, natural: 9 }, hp: '14d8+70', hd: 14, saves: { fort: 14, ref: 3, will: 6 },
    melee: [weapon('greataxe', 18, '3d6+13', { type: SLASH, crit: [20, 3] }), weapon('greataxe', 13, '3d6+13', { type: SLASH, crit: [20, 3] })], ranged: [weapon('rock', 9, '1d8+9', { type: BLUDG, range: 120 })],
    abilities: { str: 29, dex: 9, con: 21, int: 10, wis: 14, cha: 11 }, bab: 10, cmb: 20, cmd: 29, reach: 10,
    immune: ['cold'], vulnerable: ['fire'], feats: ['cleave', 'great-cleave', 'improved-overrun', 'power-attack'], special: [{ kind: 'rockThrowing' }, { kind: 'rockCatching' }], languages: ['Common', 'Giant'], description: 'A towering, white-bearded giant of the frozen north.',
  }),
  'fire-giant': m('Fire Giant', '10', {
    alignment: 'LE', size: 'large', subtypes: ['fire', 'giant'], init: -1, senses: ['low-light vision'], speed: { land: 40 },
    ac: { armor: 8, natural: 8 }, hp: '15d8+75', hd: 15, saves: { fort: 14, ref: 4, will: 9 },
    melee: [weapon('greatsword', 21, '3d6+15', { type: SLASH, crit: [19, 2] }), weapon('greatsword', 16, '3d6+15', { type: SLASH, crit: [19, 2] }), weapon('greatsword', 11, '3d6+15', { type: SLASH, crit: [19, 2] })],
    ranged: [weapon('rock', 10, '1d8+15', { type: BLUDG, range: 120, onHit: [energy('1d6', 'fire')] })],
    abilities: { str: 31, dex: 9, con: 21, int: 10, wis: 14, cha: 10 }, bab: 11, cmb: 22, cmd: 31, reach: 10,
    immune: ['fire'], vulnerable: ['cold'], feats: ['cleave', 'great-cleave', 'improved-overrun', 'iron-will', 'power-attack'], special: [{ kind: 'rockThrowing' }, { kind: 'rockCatching' }, { kind: 'heatedRock' }], languages: ['Common', 'Giant'],
    description: 'A soot-skinned, flame-haired giant in blackened plate.',
  }),
  minotaur: m('Minotaur', '4', {
    alignment: 'CE', size: 'large', type: 'monstrous humanoid', init: 0, senses: ['darkvision 60'],
    ac: { natural: 6 }, hp: '6d10+12', hd: 6, saves: { fort: 6, ref: 5, will: 5 },
    melee: [weapon('greataxe', 9, '3d6+6', { type: SLASH, crit: [20, 3] }), weapon('greataxe', 4, '3d6+6', { type: SLASH, crit: [20, 3] }), atk('gore', 4, '1d6+2', { type: PIERCE, primary: false })],
    abilities: { str: 19, dex: 10, con: 15, int: 7, wis: 10, cha: 8 }, bab: 6, cmb: 11, cmd: 21, reach: 10,
    special: [{ kind: 'powerfulCharge', name: 'gore', bonus: 11, damage: '2d6+6' }, { kind: 'naturalCunning' }], feats: ['great-fortitude', 'improved-bull-rush', 'power-attack'], languages: ['Giant'], description: 'A bull-headed giant that haunts labyrinths.',
  }),

  // ------------------------------------------------------ Magical beasts
  gargoyle: m('Gargoyle', '4', {
    alignment: 'CE', type: 'monstrous humanoid', subtypes: ['earth'], init: 6, senses: ['darkvision 60'], speed: { land: 40, fly: 60 },
    ac: { natural: 4 }, hp: '5d10+25', hd: 5, saves: { fort: 6, ref: 6, will: 4 },
    melee: [atk('claw', 7, '1d6+2', { count: 2, type: SLASH }), atk('bite', 7, '1d4+2'), atk('gore', 7, '1d4+2', { type: PIERCE })],
    abilities: { str: 15, dex: 14, con: 18, int: 6, wis: 11, cha: 7 }, bab: 5, cmb: 7, cmd: 19, dr: [{ amount: 10, bypass: 'magic' }],
    feats: ['hover', 'improved-initiative', 'skill-focus'], skills: { fly: 12, perception: 5, stealth: 11 }, special: [{ kind: 'freeze' }], languages: ['Common', 'Terran'], description: 'A winged, stone-skinned fiend that poses as a statue.',
  }),
  basilisk: m('Basilisk', '5', {
    type: 'magical beast', subtypes: ['reptilian'], init: -1, senses: ['darkvision 60', 'low-light vision'], speed: { land: 20 },
    ac: { natural: 8 }, hp: '7d10+14', hd: 7, saves: { fort: 7, ref: 4, will: 3 },
    melee: [atk('bite', 10, '1d8+4')], abilities: { str: 16, dex: 8, con: 15, int: 2, wis: 12, cha: 11 }, bab: 7, cmb: 10, cmd: 19,
    special: [{ kind: 'gaze', name: 'petrifying gaze', condition: 'petrified', range: 30, save: { type: 'fort', dc: 15 } }], feats: ['blind-fight', 'great-fortitude', 'skill-focus'], skills: { perception: 10, stealth: 6 },
    description: 'An eight-legged reptile whose gaze turns flesh to stone.',
  }),
  medusa: m('Medusa', '7', {
    alignment: 'LE', type: 'monstrous humanoid', init: 6, senses: ['all-around vision', 'darkvision 60'],
    ac: { armor: 2, natural: 3 }, hp: '8d10+32', hd: 8, saves: { fort: 6, ref: 8, will: 7 },
    melee: [weapon('dagger', 10, '1d4', { type: PIERCE, crit: [19, 2] }), weapon('dagger', 5, '1d4', { type: PIERCE, crit: [19, 2] }), atk('snake bite', 5, '1d4', { primary: false, onHit: [poison('medusa venom', 18, { str: '1d3' })] })],
    ranged: [weapon('longbow', 11, '1d8', { type: PIERCE, crit: [20, 3], range: 100 }), weapon('longbow', 6, '1d8', { type: PIERCE, crit: [20, 3], range: 100 })],
    abilities: { str: 10, dex: 15, con: 18, int: 12, wis: 13, cha: 15 }, bab: 8, cmb: 8, cmd: 20,
    special: [{ kind: 'gaze', name: 'petrifying gaze', condition: 'petrified', range: 30, save: { type: 'fort', dc: 16 } }], feats: ['improved-initiative', 'point-blank-shot', 'precise-shot', 'weapon-finesse'], languages: ['Common'],
    description: 'A woman whose hair is a mass of writhing snakes.',
  }),
  manticore: m('Manticore', '5', {
    alignment: 'LE', type: 'magical beast', size: 'large', init: 6, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 30, fly: 50 },
    ac: { natural: 6 }, hp: '6d10+24', hd: 6, saves: { fort: 9, ref: 7, will: 3 },
    melee: [atk('bite', 10, '1d8+5'), atk('claw', 10, '2d4+5', { count: 2, type: SLASH })], ranged: [atk('spikes', 8, '1d6+5', { count: 4, type: PIERCE, range: 180 })],
    abilities: { str: 20, dex: 15, con: 18, int: 7, wis: 12, cha: 9 }, bab: 6, cmb: 12, cmd: 24, feats: ['flyby-attack', 'improved-initiative', 'weapon-focus'], languages: ['Common'],
    description: 'A lion-bodied beast with bat wings and a spiked tail.',
  }),
  chimera: m('Chimera', '7', {
    alignment: 'CE', type: 'magical beast', size: 'large', init: 5, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 30, fly: 50 },
    ac: { natural: 8 }, hp: '9d10+36', hd: 9, saves: { fort: 10, ref: 7, will: 6 },
    melee: [atk('bite (dragon)', 12, '1d8+4'), atk('bite (lion)', 12, '2d6+4'), atk('gore', 12, '1d8+4', { type: PIERCE }), atk('claw', 12, '1d6+4', { count: 2, type: SLASH })],
    abilities: { str: 19, dex: 13, con: 17, int: 4, wis: 13, cha: 10 }, bab: 9, cmb: 14, cmd: 25,
    special: [{ kind: 'breath', name: 'fire breath', shape: 'cone', size: 30, dice: '6d8', energy: 'fire', save: { type: 'ref', dc: 17 }, recharge: '1d4' }], feats: ['hover', 'improved-initiative', 'iron-will', 'skill-focus'], languages: ['Draconic'],
    description: 'A three-headed beast: lion, goat and dragon.',
  }),
  wyvern: m('Wyvern', '6', {
    type: 'dragon', size: 'large', init: 5, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 20, fly: 60 },
    ac: { natural: 8 }, hp: '7d12+28', hd: 7, saves: { fort: 9, ref: 6, will: 6 },
    melee: [atk('sting', 10, '1d6+4', { type: PIERCE, onHit: [poison('wyvern poison', 17, { con: '1d4' }, 6, 2)] }), atk('bite', 10, '2d6+4', { onHit: [grab] }), atk('wing', 5, '1d6+2', { count: 2, primary: false, type: BLUDG })],
    abilities: { str: 19, dex: 12, con: 18, int: 7, wis: 12, cha: 9 }, bab: 7, cmb: 12, cmd: 23, immune: ['sleep', 'paralysis'], feats: ['flyby-attack', 'improved-initiative', 'iron-will', 'skill-focus'], languages: ['Draconic'],
    description: 'A two-legged dragon with a venomous tail.',
  }),
  griffon: m('Griffon', '4', {
    type: 'magical beast', size: 'large', init: 2, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 30, fly: 80 },
    ac: { natural: 5 }, hp: '5d10+15', hd: 5, saves: { fort: 7, ref: 6, will: 2 },
    melee: [atk('bite', 8, '1d6+4'), atk('talon', 8, '1d6+4', { count: 2, type: SLASH })], abilities: { str: 18, dex: 15, con: 16, int: 5, wis: 13, cha: 8 }, bab: 5, cmb: 10, cmd: 22,
    special: [{ kind: 'pounce' }, { kind: 'rake', count: 2, bonus: 8, damage: '1d6+4' }], feats: ['iron-will', 'skill-focus', 'weapon-focus'], treasure: 'none',
    description: 'An eagle-headed lion that makes a prized mount.',
  }),
  owlbear: m('Owlbear', '4', {
    type: 'magical beast', size: 'large', init: 5, senses: ['darkvision 60', 'low-light vision', 'scent'],
    ac: { natural: 5 }, hp: '5d10+25', hd: 5, saves: { fort: 9, ref: 5, will: 2 },
    melee: [atk('bite', 8, '1d6+5'), atk('claw', 8, '1d6+5', { count: 2, type: SLASH, onHit: [grab] })],
    abilities: { str: 21, dex: 12, con: 20, int: 2, wis: 12, cha: 10 }, bab: 5, cmb: 11, cmd: 22,
    feats: ['great-fortitude', 'improved-initiative', 'skill-focus'], skills: { perception: 12 }, treasure: 'incidental',
    description: 'A bear-sized beast with the head of an owl and a foul temper.',
  }),
  harpy: m('Harpy', '4', {
    alignment: 'CE', type: 'monstrous humanoid', init: 2, senses: ['darkvision 60'], speed: { land: 20, fly: 80 },
    ac: { armor: 2, natural: 1, dodge: 1 }, hp: '7d10', hd: 7, saves: { fort: 2, ref: 7, will: 6 },
    melee: [weapon('morningstar', 8, '1d8+1', { type: ['bludgeoning', 'piercing'] }), weapon('morningstar', 3, '1d8+1', { type: ['bludgeoning', 'piercing'] }), atk('talon', 3, '1d6', { count: 2, primary: false, type: SLASH })],
    abilities: { str: 12, dex: 15, con: 10, int: 7, wis: 12, cha: 17 }, bab: 7, cmb: 8, cmd: 21,
    special: [{ kind: 'aura', name: 'captivating song', radius: 300, condition: 'fascinated', duration: '1d4', save: { type: 'will', dc: 16 }, tags: ['mind-affecting', 'sonic'] }], feats: ['dodge', 'flyby-attack', 'great-fortitude', 'skill-focus'], languages: ['Common'],
    description: 'A vulture-winged woman whose song lures victims.',
  }),
  hydra: m('Hydra (5 heads)', '4', {
    type: 'magical beast', size: 'huge', init: 1, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 20, swim: 20 },
    ac: { natural: 5 }, hp: '5d10+20', hd: 5, saves: { fort: 8, ref: 5, will: 3 },
    melee: [atk('bite', 6, '1d8+3', { count: 5 })], abilities: { str: 17, dex: 12, con: 18, int: 2, wis: 11, cha: 9 }, bab: 5, cmb: 10, cmd: 21, reach: 10, fastHealing: 5,
    special: [{ kind: 'regrowHeads' }], feats: ['combat-reflexes', 'iron-will', 'lightning-reflexes'], description: 'A reptilian horror with five snapping heads.',
  }),
  ankheg: m('Ankheg', '3', {
    type: 'magical beast', size: 'large', init: 0, senses: ['darkvision 60', 'low-light vision', 'tremorsense 60'], speed: { land: 30, burrow: 20 },
    ac: { natural: 7 }, hp: '3d10+12', hd: 3, saves: { fort: 7, ref: 3, will: 2 },
    melee: [atk('bite', 5, '2d6+4', { onHit: [energy('1d4', 'acid'), grab] })], abilities: { str: 16, dex: 10, con: 17, int: 1, wis: 13, cha: 6 }, bab: 3, cmb: 7, cmd: 17,
    special: [{ kind: 'breath', name: 'spit acid', shape: 'line', size: 30, dice: '4d4', energy: 'acid', save: { type: 'ref', dc: 14 }, recharge: 'day' }], feats: ['skill-focus', 'toughness'], treasure: 'incidental',
    description: 'A burrowing, insect-like predator that spits acid.',
  }),
  'rust-monster': m('Rust Monster', '3', {
    type: 'aberration', init: 3, senses: ['darkvision 60', 'scent metals 90'], speed: { land: 40, climb: 10 },
    ac: { natural: 5 }, hp: '5d8+5', hd: 5, saves: { fort: 2, ref: 4, will: 5 },
    melee: [atk('bite', 6, '1d3'), atk('antennae', 4, '0', { touch: true, onHit: [{ kind: 'rust' }] })],
    abilities: { str: 10, dex: 17, con: 13, int: 2, wis: 13, cha: 8 }, bab: 3, cmb: 3, cmd: 16, feats: ['ability-focus', 'weapon-finesse', 'skill-focus'], treasure: 'none',
    description: 'An insectile creature that devours metal.',
  }),
  otyugh: m('Otyugh', '4', {
    type: 'aberration', size: 'large', init: 0, senses: ['darkvision 60', 'scent'], speed: { land: 20 },
    ac: { natural: 8 }, hp: '6d8+12', hd: 6, saves: { fort: 4, ref: 2, will: 6 },
    melee: [atk('bite', 7, '1d8+3', { onHit: [disease('filth fever', 14, { dex: '1d3', con: '1d3' })] }), atk('tentacle', 3, '1d6+1', { count: 2, primary: false, onHit: [grab] })],
    abilities: { str: 16, dex: 11, con: 15, int: 5, wis: 12, cha: 6 }, bab: 4, cmb: 8, cmd: 18, reach: 10, feats: ['alertness', 'toughness', 'weapon-focus'], languages: ['Common'],
    description: 'A three-legged garbage eater with grasping tentacles.',
  }),
  'gelatinous-cube': m('Gelatinous Cube', '3', {
    type: 'ooze', size: 'large', init: -5, senses: ['blindsight 60'], speed: { land: 15 },
    ac: {}, hp: '4d8+32', hd: 4, saves: { fort: 9, ref: -4, will: -4 },
    melee: [atk('slam', 2, '1d6', { type: BLUDG, onHit: [energy('1d6', 'acid'), paralysis(20, '3d6', [])] })],
    abilities: { str: 10, dex: 1, con: 26, int: null, wis: 1, cha: 1 }, bab: 3, cmb: 4, cmd: 9, immune: ['electricity'],
    special: [{ kind: 'engulf', dice: '1d6', energy: 'acid', save: { type: 'ref', dc: 12 } }, { kind: 'transparent' }], treasure: 'incidental',
    description: 'A nearly invisible cube of acidic jelly.',
  }),
  'ochre-jelly': m('Ochre Jelly', '5', {
    type: 'ooze', size: 'large', init: -5, senses: ['blindsight 60'], speed: { land: 10, climb: 10 },
    ac: {}, hp: '6d8+36', hd: 6, saves: { fort: 8, ref: -3, will: -3 },
    melee: [atk('slam', 5, '2d4+3', { type: BLUDG, onHit: [energy('1d6', 'acid'), grab] })],
    abilities: { str: 14, dex: 1, con: 22, int: null, wis: 1, cha: 1 }, bab: 4, cmb: 7, cmd: 12, immune: ['electricity', 'piercing', 'slashing'],
    special: [{ kind: 'split', on: ['slashing', 'piercing', 'electricity'] }], treasure: 'none',
    description: 'An amoeba-like mass of acidic yellow ooze.',
  }),
  'will-o-wisp': m("Will-o'-Wisp", '6', {
    alignment: 'CE', type: 'aberration', subtypes: ['air'], size: 'small', init: 13, senses: ['darkvision 60'], speed: { land: 0, fly: 50 },
    ac: { deflection: 5, dodge: 1 }, hp: '9d8', hd: 9, saves: { fort: 3, ref: 12, will: 9 },
    melee: [atk('shock', 16, '2d8', { touch: true, damageType: 'electricity' })], abilities: { str: 1, dex: 29, con: 10, int: 15, wis: 16, cha: 12 }, bab: 6, cmb: 0, cmd: 25,
    immune: ['magic'], special: [{ kind: 'naturalInvisibility' }, { kind: 'feedOnFear' }], feats: ['alertness', 'blind-fight', 'dodge', 'improved-initiative', 'weapon-finesse'], languages: ['Common'],
    description: 'A glowing ball of light that feeds on terror.',
  }),

  // ---------------------------------------------------------------- Dragons
  'red-dragon-wyrmling': m('Red Dragon Wyrmling', '4', {
    alignment: 'CE', type: 'dragon', subtypes: ['fire'], size: 'small', init: 4, senses: ['dragon senses'], speed: { land: 40, fly: 150 },
    ac: { natural: 6 }, hp: '5d12+10', hd: 5, saves: { fort: 6, ref: 4, will: 5 },
    melee: [atk('bite', 8, '1d6+4'), atk('claw', 8, '1d4+3', { count: 2, type: SLASH })], abilities: { str: 17, dex: 10, con: 15, int: 10, wis: 11, cha: 10 }, bab: 5, cmb: 7, cmd: 17,
    immune: ['fire', 'sleep', 'paralysis'], vulnerable: ['cold'],
    special: [{ kind: 'breath', name: 'fire breath', shape: 'cone', size: 15, dice: '2d10', energy: 'fire', save: { type: 'ref', dc: 14 }, recharge: '1d4' }], feats: ['improved-initiative', 'power-attack', 'weapon-focus'], languages: ['Draconic'], treasure: 'triple',
    description: 'A newly hatched red dragon, already arrogant and cruel.',
  }),
  'young-black-dragon': m('Young Black Dragon', '7', {
    alignment: 'CE', type: 'dragon', subtypes: ['water'], init: 6, senses: ['dragon senses'], speed: { land: 60, fly: 150, swim: 60 },
    ac: { natural: 9 }, hp: '8d12+24', hd: 8, saves: { fort: 9, ref: 8, will: 7 },
    melee: [atk('bite', 11, '1d8+4'), atk('claw', 11, '1d6+3', { count: 2, type: SLASH }), atk('wing', 6, '1d4+1', { count: 2, primary: false, type: BLUDG })],
    abilities: { str: 17, dex: 14, con: 17, int: 8, wis: 13, cha: 10 }, bab: 8, cmb: 11, cmd: 23, immune: ['acid', 'sleep', 'paralysis'],
    special: [{ kind: 'breath', name: 'acid breath', shape: 'line', size: 60, dice: '6d6', energy: 'acid', save: { type: 'ref', dc: 17 }, recharge: '1d4' }], spellLike: [{ spell: 'darkness', perDay: 3, cl: 8 }],
    feats: ['improved-initiative', 'iron-will', 'power-attack', 'weapon-focus'], languages: ['Draconic'], treasure: 'triple',
    description: 'A skull-faced swamp dragon with acidic breath.',
  }),
  'young-red-dragon': m('Young Red Dragon', '10', {
    alignment: 'CE', type: 'dragon', subtypes: ['fire'], size: 'large', init: 4, senses: ['dragon senses'], speed: { land: 40, fly: 200 },
    ac: { natural: 16 }, hp: '11d12+44', hd: 11, saves: { fort: 11, ref: 7, will: 9 },
    melee: [atk('bite', 17, '2d6+9'), atk('claw', 16, '1d8+6', { count: 2, type: SLASH }), atk('wing', 11, '1d6+3', { count: 2, primary: false, type: BLUDG }), atk('tail slap', 11, '1d8+9', { primary: false, type: BLUDG })],
    abilities: { str: 23, dex: 10, con: 19, int: 14, wis: 15, cha: 14 }, bab: 11, cmb: 18, cmd: 28, reach: 10,
    immune: ['fire', 'sleep', 'paralysis'], vulnerable: ['cold'],
    special: [{ kind: 'breath', name: 'fire breath', shape: 'cone', size: 40, dice: '6d10', energy: 'fire', save: { type: 'ref', dc: 19 }, recharge: '1d4' }],
    feats: ['improved-initiative', 'iron-will', 'power-attack', 'vital-strike', 'weapon-focus', 'cleave'], languages: ['Common', 'Draconic', 'Giant'], treasure: 'triple',
    description: 'A crimson dragon in the arrogant prime of its youth.',
  }),
  'adult-red-dragon': m('Adult Red Dragon', '14', {
    alignment: 'CE', type: 'dragon', subtypes: ['fire'], size: 'huge', init: 4, senses: ['dragon senses'], speed: { land: 40, fly: 200 },
    ac: { natural: 21 }, hp: '17d12+102', hd: 17, saves: { fort: 16, ref: 10, will: 14 },
    melee: [atk('bite', 26, '2d8+15', { crit: [19, 2] }), atk('claw', 26, '2d6+10', { count: 2, type: SLASH }), atk('wing', 24, '1d8+5', { count: 2, primary: false, type: BLUDG }), atk('tail slap', 24, '2d6+15', { primary: false, type: BLUDG })],
    abilities: { str: 31, dex: 10, con: 23, int: 16, wis: 17, cha: 16 }, bab: 17, cmb: 29, cmd: 39, reach: 15, sr: 25, dr: [{ amount: 5, bypass: 'magic' }],
    immune: ['fire', 'sleep', 'paralysis'], vulnerable: ['cold'],
    special: [{ kind: 'breath', name: 'fire breath', shape: 'cone', size: 50, dice: '14d10', energy: 'fire', save: { type: 'ref', dc: 24 }, recharge: '1d4' }, { kind: 'aura', name: 'frightful presence', radius: 180, condition: 'shaken', duration: '5d6', save: { type: 'will', dc: 21 }, once: true, tags: ['fear'] }],
    spellLike: [{ spell: 'fireball', perDay: 3, cl: 7, dc: 16 }, { spell: 'scorching-ray', perDay: 3, cl: 7 }],
    feats: ['improved-initiative', 'iron-will', 'power-attack', 'vital-strike', 'weapon-focus', 'cleave', 'great-cleave', 'improved-critical'], languages: ['Common', 'Draconic', 'Giant', 'Orc'], treasure: 'triple',
    description: 'A huge, greedy red dragon at the height of its power.',
  }),

  // -------------------------------------------------------------- Outsiders
  imp: m('Imp', '2', {
    alignment: 'LE', type: 'outsider', subtypes: ['devil', 'evil', 'extraplanar', 'lawful'], size: 'tiny', init: 3, senses: ['darkvision 60', 'see in darkness', 'detect good', 'detect magic'], speed: { land: 20, fly: 50 },
    ac: { dodge: 1, natural: 1 }, hp: '3d10+3', hd: 3, saves: { fort: 2, ref: 6, will: 4 },
    melee: [atk('sting', 8, '1d4', { type: PIERCE, onHit: [poison('imp poison', 13, { dex: '1d2' })] })], abilities: { str: 10, dex: 17, con: 12, int: 13, wis: 12, cha: 14 }, bab: 3, cmb: 4, cmd: 18, fastHealing: 2,
    dr: [{ amount: 5, bypass: 'good' }, { amount: 5, bypass: 'silver' }], immune: ['fire', 'poison'], resist: { acid: 10, cold: 10 },
    spellLike: [{ spell: 'invisibility', perDay: Infinity, cl: 6 }, { spell: 'suggestion', perDay: 1, cl: 6, dc: 15 }], feats: ['dodge', 'weapon-finesse'], languages: ['Common', 'Infernal'],
    description: 'A tiny winged devil, often a familiar.',
  }),
  quasit: m('Quasit', '2', {
    alignment: 'CE', type: 'outsider', subtypes: ['chaotic', 'demon', 'evil', 'extraplanar'], size: 'tiny', init: 6, senses: ['darkvision 60'], speed: { land: 20, fly: 50 },
    ac: { natural: 2 }, hp: '3d10+3', hd: 3, saves: { fort: 4, ref: 5, will: 2 },
    melee: [atk('claw', 7, '1d3-1', { count: 2, type: SLASH, onHit: [poison('quasit venom', 13, { dex: '1d2' })] }), atk('bite', 7, '1d4-1')],
    abilities: { str: 8, dex: 14, con: 13, int: 11, wis: 12, cha: 11 }, bab: 3, cmb: 3, cmd: 13, fastHealing: 2,
    dr: [{ amount: 5, bypass: 'cold iron' }, { amount: 5, bypass: 'good' }], immune: ['electricity', 'poison'], resist: { acid: 10, cold: 10, fire: 10 },
    spellLike: [{ spell: 'invisibility', perDay: Infinity, cl: 6 }, { spell: 'cause-fear', perDay: 1, cl: 6, dc: 11 }], feats: ['improved-initiative', 'weapon-finesse'], languages: ['Abyssal', 'Common'],
    description: 'A tiny, mischievous demon.',
  }),
  lemure: m('Lemure', '1', {
    alignment: 'LE', type: 'outsider', subtypes: ['devil', 'evil', 'extraplanar', 'lawful'], init: 0, senses: ['darkvision 60', 'see in darkness'], speed: { land: 20 },
    ac: { natural: 4 }, hp: '2d10+4', hd: 2, saves: { fort: 5, ref: 3, will: 0 },
    melee: [atk('claw', 4, '1d4+2', { count: 2, type: SLASH })], abilities: { str: 15, dex: 10, con: 14, int: null, wis: 11, cha: 5 }, bab: 2, cmb: 4, cmd: 14,
    dr: [{ amount: 5, bypass: 'good' }, { amount: 5, bypass: 'silver' }], immune: ['fire', 'mind-affecting', 'poison'], resist: { acid: 10, cold: 10 }, treasure: 'none',
    description: 'A mindless, molten blob of tormented soul-stuff.',
  }),
  dretch: m('Dretch', '2', {
    alignment: 'CE', type: 'outsider', subtypes: ['chaotic', 'demon', 'evil', 'extraplanar'], size: 'small', init: 0, senses: ['darkvision 60'], speed: { land: 20 },
    ac: { natural: 4 }, hp: '2d10+7', hd: 2, saves: { fort: 6, ref: 3, will: 3 },
    melee: [atk('claw', 4, '1d4+1', { count: 2, type: SLASH }), atk('bite', 4, '1d4+1')], abilities: { str: 12, dex: 10, con: 16, int: 5, wis: 11, cha: 11 }, bab: 2, cmb: 2, cmd: 12,
    dr: [{ amount: 5, bypass: 'cold iron' }, { amount: 5, bypass: 'good' }], immune: ['electricity', 'poison'], resist: { acid: 10, cold: 10, fire: 10 },
    spellLike: [{ spell: 'stinking-cloud', perDay: 1, cl: 2, dc: 13 }, { spell: 'cause-fear', perDay: 1, cl: 2, dc: 11 }], feats: ['toughness'], languages: ['Abyssal'], treasure: 'none',
    description: 'A pot-bellied, pathetic demon of sloth.',
  }),
  'lantern-archon': m('Lantern Archon', '2', {
    alignment: 'LG', type: 'outsider', subtypes: ['archon', 'extraplanar', 'good', 'lawful'], size: 'small', init: 4, senses: ['darkvision 60', 'low-light vision'], speed: { land: 0, fly: 60 },
    ac: { deflection: 2 }, hp: '2d10+2', hd: 2, saves: { fort: 4, ref: 3, will: 0 },
    ranged: [atk('light ray', 3, '1d6', { count: 2, touch: true, damageType: 'positive', range: 30 })], abilities: { str: 1, dex: 11, con: 12, int: 6, wis: 11, cha: 10 }, bab: 2, cmb: -4, cmd: 6,
    dr: [{ amount: 10, bypass: 'evil' }, { amount: 10, bypass: 'magic' }], immune: ['electricity', 'petrification'], special: [{ kind: 'auraOfMenace', dc: 12 }], feats: ['improved-initiative'], languages: ['Celestial'], treasure: 'none',
    description: 'A floating ball of holy light.',
  }),
  'hell-hound': m('Hell Hound', '3', {
    alignment: 'LE', type: 'outsider', subtypes: ['evil', 'extraplanar', 'fire', 'lawful'], init: 5, senses: ['darkvision 60', 'scent'], speed: { land: 40 },
    ac: { natural: 5 }, hp: '4d10+8', hd: 4, saves: { fort: 6, ref: 5, will: 1 },
    melee: [atk('bite', 6, '1d8+1', { onHit: [energy('1d6', 'fire')] })], abilities: { str: 13, dex: 13, con: 15, int: 6, wis: 10, cha: 6 }, bab: 4, cmb: 5, cmd: 16,
    immune: ['fire'], vulnerable: ['cold'],
    special: [{ kind: 'breath', name: 'fire breath', shape: 'cone', size: 10, dice: '2d6', energy: 'fire', save: { type: 'ref', dc: 14 }, recharge: '2d4' }], feats: ['improved-initiative', 'run'], languages: ['Infernal'], treasure: 'none',
    description: 'A rust-red hound that breathes fire.',
  }),
  'bearded-devil': m('Bearded Devil', '5', {
    alignment: 'LE', type: 'outsider', subtypes: ['devil', 'evil', 'extraplanar', 'lawful'], init: 6, senses: ['darkvision 60', 'see in darkness'], speed: { land: 40 },
    ac: { natural: 7 }, hp: '6d10+24', hd: 6, saves: { fort: 9, ref: 7, will: 2 },
    melee: [weapon('glaive', 11, '1d10+4', { type: SLASH, crit: [20, 3], onHit: [{ kind: 'bleed', amount: 2 }] }), weapon('glaive', 6, '1d10+4', { type: SLASH, crit: [20, 3], onHit: [{ kind: 'bleed', amount: 2 }] })],
    abilities: { str: 19, dex: 15, con: 19, int: 6, wis: 10, cha: 10 }, bab: 6, cmb: 10, cmd: 22, reach: 5, sr: 16,
    dr: [{ amount: 5, bypass: 'good' }, { amount: 5, bypass: 'silver' }], immune: ['fire', 'poison'], resist: { acid: 10, cold: 10 },
    special: [{ kind: 'beardAttack' }, { kind: 'battleFrenzy' }], feats: ['improved-initiative', 'power-attack', 'weapon-focus'], languages: ['Celestial', 'Common', 'Draconic', 'Infernal'],
    description: 'A soldier devil with a wriggling, snake-like beard.',
  }),
  babau: m('Babau', '6', {
    alignment: 'CE', type: 'outsider', subtypes: ['chaotic', 'demon', 'evil', 'extraplanar'], init: 5, senses: ['darkvision 60', 'see invisibility'], speed: { land: 30 },
    ac: { natural: 7 }, hp: '7d10+35', hd: 7, saves: { fort: 10, ref: 6, will: 4 },
    melee: [weapon('longspear', 12, '1d8+7', { type: PIERCE, crit: [20, 3] }), weapon('longspear', 7, '1d8+7', { type: PIERCE, crit: [20, 3] })],
    abilities: { str: 21, dex: 13, con: 20, int: 14, wis: 13, cha: 16 }, bab: 7, cmb: 12, cmd: 23, reach: 10, sr: 17, sneakAttack: 2,
    dr: [{ amount: 10, bypass: 'cold iron' }, { amount: 10, bypass: 'good' }], immune: ['electricity', 'poison'], resist: { acid: 10, cold: 10, fire: 10 },
    spellLike: [{ spell: 'darkness', perDay: Infinity, cl: 7 }, { spell: 'dispel-magic', perDay: Infinity, cl: 7 }], feats: ['improved-initiative', 'power-attack', 'skill-focus'], languages: ['Abyssal', 'Celestial', 'Draconic'],
    description: 'A gaunt, horned demon assassin coated in acidic slime.',
  }),
  salamander: m('Salamander', '6', {
    alignment: 'CE', type: 'outsider', subtypes: ['extraplanar', 'fire'], init: 1, senses: ['darkvision 60'], speed: { land: 20 },
    ac: { natural: 6 }, hp: '7d10+28', hd: 7, saves: { fort: 9, ref: 6, will: 6 },
    melee: [weapon('spear', 11, '1d8+4', { type: PIERCE, crit: [20, 3], onHit: [energy('1d6', 'fire')] }), weapon('spear', 6, '1d8+4', { type: PIERCE, crit: [20, 3], onHit: [energy('1d6', 'fire')] }), atk('tail slap', 6, '2d6+1', { primary: false, type: BLUDG, onHit: [energy('1d6', 'fire'), grab] })],
    abilities: { str: 16, dex: 13, con: 18, int: 14, wis: 15, cha: 13 }, bab: 7, cmb: 10, cmd: 21, reach: 10, dr: [{ amount: 10, bypass: 'magic' }], immune: ['fire'], vulnerable: ['cold'],
    special: [{ kind: 'constrict', dice: '2d6+4' }, { kind: 'heat', dice: '1d6' }], feats: ['cleave', 'iron-will', 'power-attack', 'skill-focus'], languages: ['Common', 'Ignan'],
    description: 'A serpent-bodied creature of living flame.',
  }),
  erinyes: m('Erinyes', '8', {
    alignment: 'LE', type: 'outsider', subtypes: ['devil', 'evil', 'extraplanar', 'lawful'], init: 9, senses: ['darkvision 60', 'see in darkness', 'true seeing'], speed: { land: 30, fly: 50 },
    ac: { natural: 6 }, hp: '9d10+45', hd: 9, saves: { fort: 11, ref: 11, will: 7 },
    melee: [weapon('longsword', 14, '1d8+6', { type: SLASH, crit: [19, 2] }), weapon('longsword', 9, '1d8+6', { type: SLASH, crit: [19, 2] })],
    ranged: [weapon('longbow', 16, '1d8+5', { type: PIERCE, crit: [20, 3], range: 100, onHit: [energy('2d6', 'unholy')] }), weapon('longbow', 11, '1d8+5', { type: PIERCE, crit: [20, 3], range: 100 })],
    abilities: { str: 20, dex: 23, con: 21, int: 14, wis: 18, cha: 21 }, bab: 9, cmb: 14, cmd: 30, sr: 19,
    dr: [{ amount: 5, bypass: 'good' }], immune: ['fire', 'poison'], resist: { acid: 10, cold: 10 }, spellLike: [{ spell: 'fear', perDay: 1, cl: 12, dc: 19 }, { spell: 'teleport', perDay: Infinity, cl: 12 }],
    feats: ['combat-reflexes', 'improved-initiative', 'point-blank-shot', 'precise-shot', 'rapid-shot'], languages: ['Celestial', 'Common', 'Draconic', 'Infernal'],
    description: 'A winged, beautiful devil of vengeance.',
  }),
  vrock: m('Vrock', '9', {
    alignment: 'CE', type: 'outsider', subtypes: ['chaotic', 'demon', 'evil', 'extraplanar'], size: 'large', init: 6, senses: ['darkvision 60'], speed: { land: 30, fly: 50 },
    ac: { natural: 9 }, hp: '14d10+70', hd: 14, saves: { fort: 14, ref: 9, will: 9 },
    melee: [atk('bite', 18, '1d8+5'), atk('claw', 18, '2d6+5', { count: 2, type: SLASH }), atk('talon', 18, '1d6+5', { count: 2, type: SLASH })],
    abilities: { str: 21, dex: 15, con: 21, int: 14, wis: 16, cha: 16 }, bab: 14, cmb: 20, cmd: 32, reach: 10, sr: 20,
    dr: [{ amount: 10, bypass: 'good' }], immune: ['electricity', 'poison'], resist: { acid: 10, cold: 10, fire: 10 },
    special: [{ kind: 'aura', name: 'stunning screech', radius: 30, condition: 'stunned', duration: '1', save: { type: 'fort', dc: 20 }, tags: ['sonic'] }], spellLike: [{ spell: 'mirror-image', perDay: 1, cl: 12 }],
    feats: ['cleave', 'combat-reflexes', 'improved-initiative', 'power-attack'], languages: ['Abyssal', 'Celestial'],
    description: 'A vulture-headed demon whose screech stuns.',
  }),
  'bone-devil': m('Bone Devil', '9', {
    alignment: 'LE', type: 'outsider', subtypes: ['devil', 'evil', 'extraplanar', 'lawful'], size: 'large', init: 9, senses: ['darkvision 60', 'see in darkness'], speed: { land: 40, fly: 60 },
    ac: { natural: 9 }, hp: '10d10+50', hd: 10, saves: { fort: 12, ref: 12, will: 7 },
    melee: [atk('bite', 14, '1d8+5'), atk('claw', 14, '1d6+5', { count: 2, type: SLASH }), atk('sting', 14, '3d4+5', { type: PIERCE, onHit: [poison('bone devil poison', 20, { str: '1d3' })] })],
    abilities: { str: 21, dex: 21, con: 20, int: 14, wis: 14, cha: 18 }, bab: 10, cmb: 16, cmd: 31, reach: 10, sr: 20,
    dr: [{ amount: 10, bypass: 'good' }], immune: ['fire', 'poison'], resist: { acid: 10, cold: 10 }, spellLike: [{ spell: 'invisibility', perDay: Infinity, cl: 12 }],
    feats: ['alertness', 'combat-reflexes', 'improved-initiative', 'iron-will'], languages: ['Infernal'],
    description: 'A gaunt, skeletal devil with a scorpion tail.',
  }),

  // ------------------------------------------------------------ Elementals
  ...elementals(),
  // ------------------------------------------------ Summon monster / nature's ally creatures
  // Stat blocks checked against the Bestiary text on Archives of Nethys.
  dolphin: m('Dolphin', '1/2', {
    type: 'animal', init: 2, senses: ['blindsight 120', 'low-light vision'], speed: { land: 0, swim: 80 },
    ac: { natural: 1 }, hp: '2d8+2', hd: 2, saves: { fort: 4, ref: 5, will: 1 },
    melee: [atk('slam', 3, '1d4+1', { type: BLUDG })], abilities: { str: 12, dex: 15, con: 13, int: 2, wis: 13, cha: 6 }, bab: 1, cmb: 2, cmd: 14,
    feats: ['weapon-finesse'], skills: { perception: 9, swim: 9 }, treasure: 'none', description: 'An intelligent, playful sea mammal that hunts by echolocation.',
  }),
  stirge: m('Stirge', '1/2', {
    type: 'magical beast', size: 'tiny', init: 4, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 10, fly: 40 },
    ac: {}, hp: '1d10', hd: 1, saves: { fort: 2, ref: 6, will: 1 },
    melee: [atk('touch', 7, '0', { onHit: [{ kind: 'attach' }, { kind: 'bloodDrain', con: 1, max: 4 }] })], abilities: { str: 3, dex: 19, con: 10, int: 1, wis: 12, cha: 6 }, bab: 1, cmb: 3, cmd: 9, cmdVs: { trip: 17 },
    feats: ['weapon-finesse'], skills: { fly: 8, stealth: 16 }, treasure: 'none', description: 'A mosquito-like flying horror that drains blood.',
  }),
  hyena: m('Hyena', '1', {
    type: 'animal', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 50 },
    ac: { natural: 2 }, hp: '2d8+4', hd: 2, saves: { fort: 5, ref: 5, will: 1 },
    melee: [atk('bite', 3, '1d6+3', { onHit: [trip] })], abilities: { str: 14, dex: 15, con: 15, int: 2, wis: 13, cha: 6 }, bab: 1, cmb: 3, cmd: 15, cmdVs: { trip: 19 },
    feats: ['skill-focus'], skills: { perception: 8, stealth: 6 }, treasure: 'none', description: 'A cackling scavenger that hunts in packs.',
  }),
  octopus: m('Octopus', '1', {
    type: 'animal', size: 'small', subtypes: ['aquatic'], init: 3, senses: ['low-light vision'], speed: { land: 20, swim: 30 },
    ac: { natural: 1 }, hp: '2d8+4', hd: 2, saves: { fort: 5, ref: 6, will: 1 },
    melee: [atk('bite', 5, '1d3+1', { onHit: [poison('octopus venom', 13, { str: '1' })] }), atk('tentacles', 3, '0', { primary: false, onHit: [grab] })],
    abilities: { str: 12, dex: 17, con: 14, int: 2, wis: 13, cha: 3 }, bab: 1, cmb: 1, cmd: 14, special: [{ kind: 'inkCloud', radius: 10 }], treasure: 'none', description: 'A clever eight-armed sea creature.',
  }),
  cheetah: m('Cheetah', '2', {
    type: 'animal', init: 8, senses: ['low-light vision', 'scent'], speed: { land: 50 },
    ac: { natural: 1 }, hp: '3d8+6', hd: 3, saves: { fort: 5, ref: 7, will: 2 },
    melee: [atk('bite', 6, '1d6+3', { onHit: [trip] }), atk('claw', 6, '1d3+3', { count: 2, type: SLASH })], abilities: { str: 17, dex: 19, con: 15, int: 2, wis: 12, cha: 6 }, bab: 2, cmb: 5, cmd: 19, cmdVs: { trip: 23 },
    feats: ['improved-initiative', 'weapon-finesse'], special: [{ kind: 'sprint' }], treasure: 'none', description: 'The fastest of the great cats.',
  }),
  'constrictor-snake': m('Constrictor Snake', '2', {
    type: 'animal', init: 3, senses: ['scent'], speed: { land: 20, climb: 20, swim: 20 },
    ac: { natural: 2 }, hp: '3d8+6', hd: 3, saves: { fort: 4, ref: 6, will: 2 },
    melee: [atk('bite', 5, '1d4+4', { onHit: [grab] })], abilities: { str: 17, dex: 17, con: 12, int: 1, wis: 12, cha: 2 }, bab: 2, cmb: 5, cmd: 18,
    special: [{ kind: 'constrict', dice: '1d4+4' }], skills: { perception: 12 }, treasure: 'none', description: 'A heavy snake that crushes its prey.',
  }),
  'monitor-lizard': m('Monitor Lizard', '2', {
    type: 'animal', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 30, swim: 30 },
    ac: { natural: 3 }, hp: '3d8+9', hd: 3, saves: { fort: 8, ref: 5, will: 2 },
    melee: [atk('bite', 5, '1d8+4', { onHit: [grab, poison('monitor lizard venom', 14, { dex: '1d2' })] })], abilities: { str: 17, dex: 15, con: 17, int: 2, wis: 12, cha: 6 }, bab: 2, cmb: 5, cmd: 17, cmdVs: { trip: 21 },
    skills: { perception: 8 }, treasure: 'none', description: 'A large venomous lizard.',
  }),
  aurochs: m('Aurochs', '2', {
    type: 'animal', size: 'large', init: 0, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 4 }, hp: '3d8+9', hd: 3, saves: { fort: 6, ref: 3, will: 1 },
    melee: [atk('gore', 7, '1d8+9', { type: PIERCE })], abilities: { str: 23, dex: 10, con: 17, int: 2, wis: 11, cha: 4 }, bab: 2, cmb: 9, cmd: 19, cmdVs: { trip: 23 },
    special: [{ kind: 'trample', dice: '2d6+9', dc: 17 }, { kind: 'stampede' }], skills: { perception: 9 }, treasure: 'none', description: 'A massive wild ox.',
  }),
  rhinoceros: m('Rhinoceros', '4', {
    type: 'animal', size: 'large', init: 0, senses: ['scent'], speed: { land: 40 },
    ac: { natural: 7 }, hp: '5d8+20', hd: 5, saves: { fort: 10, ref: 4, will: 2 },
    melee: [atk('gore', 8, '2d6+9', { type: PIERCE })], abilities: { str: 22, dex: 10, con: 19, int: 2, wis: 13, cha: 5 }, bab: 3, cmb: 10, cmd: 20, cmdVs: { trip: 24 },
    special: [{ kind: 'powerfulCharge', damage: '4d6+12' }], skills: { perception: 12 }, treasure: 'none', description: 'An armored beast that charges anything it dislikes.',
  }),
  'giant-wasp': m('Giant Wasp', '3', {
    type: 'vermin', size: 'large', init: 1, senses: ['darkvision 60'], speed: { land: 20, fly: 60 },
    ac: { natural: 4 }, hp: '4d8+16', hd: 4, saves: { fort: 8, ref: 2, will: 2 }, immune: ['mind-affecting'],
    melee: [atk('sting', 6, '1d8+6', { type: PIERCE, onHit: [poison('giant wasp venom', 18, { dex: '1d2' })] })], abilities: { str: 18, dex: 12, con: 18, int: null, wis: 13, cha: 11 }, bab: 3, cmb: 8, cmd: 19,
    skills: { perception: 9 }, treasure: 'none', description: 'A wasp the size of a horse.',
  }),
  tiger: m('Tiger', '4', {
    type: 'animal', size: 'large', init: 6, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 3 }, hp: '6d8+18', hd: 6, saves: { fort: 8, ref: 7, will: 3 },
    melee: [atk('claw', 10, '1d8+6', { count: 2, type: SLASH, onHit: [grab] }), atk('bite', 9, '2d6+6', { onHit: [grab] })],
    abilities: { str: 23, dex: 15, con: 17, int: 2, wis: 12, cha: 6 }, bab: 4, cmb: 11, cmd: 23, cmdVs: { trip: 27 }, special: [{ kind: 'pounce' }, { kind: 'rake', count: 2, bonus: 10, damage: '1d8+6' }],
    skills: { perception: 8 }, treasure: 'none', description: 'A striped great cat, the deadliest of its kind.',
  }),
  'dire-ape': m('Dire Ape', '3', {
    type: 'animal', size: 'large', init: 2, senses: ['low-light vision', 'scent'], speed: { land: 30, climb: 30 },
    ac: { natural: 4 }, hp: '4d8+12', hd: 4, saves: { fort: 7, ref: 6, will: 4 },
    melee: [atk('bite', 6, '1d6+4'), atk('claw', 6, '1d4+4', { count: 2, type: SLASH })], abilities: { str: 19, dex: 15, con: 16, int: 2, wis: 12, cha: 7 }, bab: 3, cmb: 8, cmd: 20,
    special: [{ kind: 'rend', requires: 'claw', dice: '1d4+6' }], treasure: 'none', description: 'A gigantopithecus: an ape the size of an ogre.',
  }),
  orca: m('Orca', '5', {
    type: 'animal', size: 'huge', init: 6, senses: ['blindsight 120', 'low-light vision'], speed: { land: 0, swim: 80 },
    ac: { natural: 6 }, hp: '9d8+27', hd: 9, saves: { fort: 9, ref: 8, will: 5 },
    melee: [atk('bite', 13, '2d6+12')], abilities: { str: 27, dex: 15, con: 16, int: 2, wis: 15, cha: 6 }, bab: 6, cmb: 16, cmd: 28, reach: 10,
    feats: ['endurance', 'improved-initiative', 'skill-focus', 'weapon-focus'], skills: { perception: 19 }, treasure: 'none', description: 'A killer whale, apex hunter of the seas.',
  }),
  satyr: m('Satyr', '4', {
    alignment: 'CN', type: 'fey', init: 2, senses: ['low-light vision'], speed: { land: 40 },
    ac: { dodge: 1, natural: 5 }, hp: '8d6+16', hd: 8, saves: { fort: 4, ref: 8, will: 8 }, dr: [{ amount: 5, bypass: 'cold-iron' }],
    melee: [weapon('dagger', 6, '1d4+2', { type: PIERCE, crit: [19, 2] }), atk('horns', 1, '1d6+1', { primary: false })], ranged: [weapon('shortbow', 6, '1d6', { type: PIERCE, crit: [20, 3], range: 60 })],
    abilities: { str: 14, dex: 15, con: 15, int: 12, wis: 14, cha: 19 }, bab: 4, cmb: 6, cmd: 18,
    spellLike: [{ spell: 'charm-person', perDay: Infinity, cl: 8, dc: 15 }, { spell: 'dancing-lights', perDay: Infinity, cl: 8 }, { spell: 'sleep', perDay: Infinity, cl: 8, dc: 15 }, { spell: 'suggestion', perDay: Infinity, cl: 8, dc: 17 }, { spell: 'fear', perDay: 1, cl: 8, dc: 18 }, { spell: 'summon-natures-ally-iii', perDay: 1, cl: 8 }],
    special: [{ kind: 'pipes', dc: 18 }], skills: { perception: 18 }, languages: ['Common', 'Sylvan'], description: 'A goat-legged reveler of the wild places.',
  }),
  'dire-bear': m('Dire Bear', '7', {
    type: 'animal', size: 'large', init: 5, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 8 }, hp: '10d8+50', hd: 10, saves: { fort: 12, ref: 8, will: 4 },
    melee: [atk('claw', 13, '1d6+7', { count: 2, type: SLASH, onHit: [grab] }), atk('bite', 13, '1d8+7')], abilities: { str: 25, dex: 13, con: 21, int: 2, wis: 12, cha: 10 }, bab: 7, cmb: 15, cmd: 26, cmdVs: { trip: 30 },
    treasure: 'none', description: 'A cave bear of terrifying size.',
  }),
  elephant: m('Elephant', '7', {
    type: 'animal', size: 'huge', init: 0, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 9 }, hp: '11d8+44', hd: 11, saves: { fort: 13, ref: 7, will: 6 },
    melee: [atk('gore', 16, '2d8+10', { type: PIERCE }), atk('slam', 16, '2d6+10', { type: BLUDG })], abilities: { str: 30, dex: 10, con: 19, int: 2, wis: 13, cha: 7 }, bab: 8, cmb: 20, cmd: 30, cmdVs: { trip: 34 }, reach: 10,
    special: [{ kind: 'trample', dice: '2d8+15', dc: 25 }], treasure: 'none', description: 'A towering beast with tusks and a trunk.',
  }),
  girallon: m('Girallon', '6', {
    type: 'magical beast', size: 'large', init: 7, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 40, climb: 40 },
    ac: { natural: 6 }, hp: '7d10+35', hd: 7, saves: { fort: 9, ref: 8, will: 5 },
    melee: [atk('bite', 10, '1d6+4'), atk('claw', 10, '1d4+4', { count: 4, type: SLASH })], abilities: { str: 19, dex: 17, con: 18, int: 2, wis: 12, cha: 7 }, bab: 7, cmb: 12, cmd: 25,
    special: [{ kind: 'rend', requires: 'claw', dice: '1d4+6' }], skills: { perception: 11 }, treasure: 'none', description: 'A four-armed white ape of the jungle.',
  }),
  roc: m('Roc', '9', {
    type: 'animal', size: 'gargantuan', init: 6, senses: ['low-light vision'], speed: { land: 20, fly: 80 },
    ac: { natural: 14 }, hp: '16d8+48', hd: 16, saves: { fort: 13, ref: 14, will: 8 },
    melee: [atk('talon', 18, '2d6+9', { count: 2, type: SLASH, crit: [19, 2], onHit: [grab] }), atk('bite', 17, '2d8+9')], abilities: { str: 28, dex: 15, con: 17, int: 2, wis: 12, cha: 11 }, bab: 12, cmb: 25, cmd: 37, reach: 15,
    treasure: 'none', description: 'A bird so vast it carries off elephants.',
  }),
  'dire-crocodile': m('Dire Crocodile', '9', {
    type: 'animal', size: 'gargantuan', init: 4, senses: ['low-light vision'], speed: { land: 20, swim: 30 },
    ac: { natural: 15 }, hp: '12d8+84', hd: 12, saves: { fort: 15, ref: 8, will: 8 },
    melee: [atk('bite', 18, '3d6+13', { crit: [19, 2], onHit: [grab] }), atk('tail slap', 13, '4d8+6', { type: BLUDG, primary: false })], abilities: { str: 37, dex: 10, con: 25, int: 1, wis: 14, cha: 2 }, bab: 9, cmb: 26, cmd: 36, cmdVs: { trip: 40 }, reach: 15,
    special: [{ kind: 'deathRoll', dice: '3d6+19' }, { kind: 'swallowWhole', dice: '3d6+13', ac: 16, hp: 13 }, { kind: 'sprint' }], treasure: 'none', description: 'A prehistoric crocodile large enough to swallow a horse.',
  }),
  mastodon: m('Mastodon', '9', {
    type: 'animal', size: 'huge', init: 1, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 12 }, hp: '14d8+70', hd: 14, saves: { fort: 14, ref: 10, will: 7 },
    melee: [atk('gore', 21, '2d8+12', { type: PIERCE }), atk('slam', 20, '2d6+12', { type: BLUDG })], abilities: { str: 34, dex: 12, con: 21, int: 2, wis: 13, cha: 7 }, bab: 10, cmb: 24, cmd: 35, cmdVs: { trip: 39 }, reach: 10,
    special: [{ kind: 'trample', dice: '2d8+18', dc: 29 }], treasure: 'none', description: 'A shaggy, tusked giant of the ice age.',
  }),
  'dire-shark': m('Dire Shark', '9', {
    type: 'animal', size: 'gargantuan', subtypes: ['aquatic'], init: 6, senses: ['blindsense 30', 'keen scent'], speed: { land: 0, swim: 60 },
    ac: { natural: 15 }, hp: '15d8+45', hd: 15, saves: { fort: 14, ref: 13, will: 8 },
    melee: [atk('bite', 17, '4d10+15', { crit: [19, 2], onHit: [grab] })], abilities: { str: 30, dex: 15, con: 17, int: 1, wis: 12, cha: 10 }, bab: 11, cmb: 25, cmd: 37, reach: 15,
    special: [{ kind: 'swallowWhole', dice: '2d6+15', ac: 17, hp: 11 }], treasure: 'none', description: 'A megalodon, the largest shark of all.',
  }),
  tyrannosaurus: m('Tyrannosaurus', '9', {
    type: 'animal', size: 'gargantuan', init: 5, senses: ['low-light vision', 'scent'], speed: { land: 40 },
    ac: { natural: 14 }, hp: '18d8+72', hd: 18, saves: { fort: 15, ref: 12, will: 10 },
    melee: [atk('bite', 20, '4d6+22', { crit: [19, 2], onHit: [grab] })], abilities: { str: 32, dex: 13, con: 19, int: 2, wis: 15, cha: 10 }, bab: 13, cmb: 28, cmd: 39, reach: 20,
    special: [{ kind: 'swallowWhole', dice: '2d8+11', ac: 17, hp: 15 }], treasure: 'none', description: 'The tyrant lizard king.',
  }),
  pixie: m('Pixie', '4', {
    alignment: 'NG', type: 'fey', size: 'small', init: 5, senses: ['low-light vision'], speed: { land: 20, fly: 60 },
    ac: { dodge: 1, natural: 1 }, hp: '4d6+4', hd: 4, saves: { fort: 2, ref: 9, will: 6 }, dr: [{ amount: 10, bypass: 'cold-iron' }], sr: 15, flags: ['invisible'],
    melee: [weapon('short sword', 8, '1d4-2', { type: PIERCE, crit: [19, 2] })], ranged: [weapon('longbow', 8, '1d6-2', { type: PIERCE, crit: [20, 3], range: 100, onHit: [{ kind: 'condition', condition: 'unconscious', save: 'will', dc: 15, rounds: 50 }] })],
    abilities: { str: 7, dex: 21, con: 12, int: 16, wis: 15, cha: 16 }, bab: 2, cmb: -1, cmd: 15,
    spellLike: [{ spell: 'dancing-lights', perDay: 1, cl: 8 }, { spell: 'detect-thoughts', perDay: 1, cl: 8, dc: 15 }, { spell: 'dispel-magic', perDay: 1, cl: 8 }, { spell: 'entangle', perDay: 1, cl: 8, dc: 14 }, { spell: 'shield', perDay: 1, cl: 8 }],
    feats: ['dodge', 'weapon-finesse'], skills: { perception: 9 }, languages: ['Common', 'Sylvan'], description: 'A tiny, mischievous winged fey, invisible until it chooses otherwise.',
  }),
  unicorn: m('Unicorn', '3', {
    alignment: 'CG', type: 'magical beast', size: 'large', init: 3, senses: ['darkvision 60', 'low-light vision', 'scent'], speed: { land: 60 },
    ac: { natural: 3 }, hp: '4d10+12', hd: 4, saves: { fort: 7, ref: 7, will: 6 }, immune: ['charm', 'compulsion', 'poison'],
    melee: [atk('gore', 8, '1d8+4', { type: PIERCE }), atk('hoof', 5, '1d3+2', { count: 2, type: BLUDG, primary: false })], abilities: { str: 18, dex: 17, con: 16, int: 11, wis: 21, cha: 24 }, bab: 4, cmb: 9, cmd: 22, cmdVs: { trip: 26 },
    spellLike: [{ spell: 'detect-evil', perDay: Infinity, cl: 9 }, { spell: 'light', perDay: Infinity, cl: 9 }, { spell: 'cure-light-wounds', perDay: 3, cl: 9 }, { spell: 'cure-moderate-wounds', perDay: 1, cl: 9 }, { spell: 'neutralize-poison', perDay: 1, cl: 9, dc: 21 }],
    special: [{ kind: 'powerfulCharge', damage: '2d8+8' }, { kind: 'magicCircleAgainstEvil' }], languages: ['Common', 'Sylvan'], treasure: 'none', description: 'A noble horned horse that guards sacred forests.',
  }),
};

function elementals() {
  const out = {};
  const sizes = [
    { key: 'small', size: 'small', cr: '1', hdN: 2 },
    { key: 'medium', size: 'medium', cr: '3', hdN: 4 },
    { key: 'large', size: 'large', cr: '5', hdN: 8 },
    { key: 'huge', size: 'huge', cr: '7', hdN: 10 },
    { key: 'greater', size: 'huge', cr: '9', hdN: 13 },
    { key: 'elder', size: 'huge', cr: '11', hdN: 16 },
  ];
  const kinds = {
    fire: {
      name: 'Fire Elemental', speed: { land: 50 }, immune: ['fire'], vulnerable: ['cold'], subtypes: ['fire'], lang: 'Ignan',
      stats: [
        { hp: '2d10', ac: { natural: 3, dodge: 1 }, saves: [3, 4, 0], slam: [4, '1d4', 1], burn: ['1d4', 11], ab: [10, 13, 10, 4, 11, 11], cmb: 1, cmd: 13 },
        { hp: '4d10+8', ac: { natural: 3, dodge: 1 }, saves: [6, 6, 1], slam: [6, '1d6+1', 1], burn: ['1d6', 14], ab: [12, 17, 14, 4, 11, 11], cmb: 5, cmd: 19 },
        { hp: '8d10+16', ac: { natural: 3, dodge: 1 }, saves: [8, 11, 2], slam: [12, '1d8+2', 2], burn: ['1d8', 16], ab: [14, 21, 16, 6, 11, 11], cmb: 11, cmd: 28, dr: 5 },
        { hp: '10d10+30', ac: { natural: 4, dodge: 1 }, saves: [10, 12, 3], slam: [14, '2d6+4', 2], burn: ['2d6', 18], ab: [18, 23, 16, 6, 11, 11], cmb: 16, cmd: 33, dr: 5 },
        { hp: '13d10+52', ac: { natural: 6, dodge: 1 }, saves: [12, 14, 4], slam: [18, '2d8+5', 2], burn: ['2d8', 20], ab: [20, 25, 18, 8, 11, 11], cmb: 20, cmd: 38, dr: 10 },
        { hp: '16d10+64', ac: { natural: 10, dodge: 1 }, saves: [14, 17, 5], slam: [22, '2d8+7', 2], burn: ['2d8', 22], ab: [24, 29, 18, 10, 11, 11], cmb: 25, cmd: 45, dr: 10 },
      ],
    },
    earth: {
      name: 'Earth Elemental', speed: { land: 20, burrow: 20 }, immune: [], subtypes: ['earth'], lang: 'Terran',
      stats: [
        { hp: '2d10+2', ac: { natural: 7 }, saves: [4, -1, 3], slam: [6, '1d6+4', 1], ab: [16, 8, 13, 4, 11, 11], cmb: 3, cmd: 12 },
        { hp: '4d10+12', ac: { natural: 8 }, saves: [7, 0, 4], slam: [9, '1d8+7', 1], ab: [20, 8, 17, 4, 11, 11], cmb: 9, cmd: 18 },
        { hp: '8d10+32', ac: { natural: 9 }, saves: [10, 1, 6], slam: [14, '2d6+8', 2], ab: [24, 8, 19, 6, 11, 11], cmb: 16, cmd: 25, dr: 5 },
        { hp: '10d10+50', ac: { natural: 11 }, saves: [12, 2, 7], slam: [17, '2d8+10', 2], ab: [28, 8, 21, 6, 11, 11], cmb: 21, cmd: 30, dr: 5 },
        { hp: '13d10+65', ac: { natural: 12 }, saves: [13, 3, 8], slam: [21, '2d10+11', 2], ab: [32, 8, 21, 8, 11, 11], cmb: 26, cmd: 35, dr: 10 },
        { hp: '16d10+80', ac: { natural: 13 }, saves: [15, 4, 9], slam: [23, '2d10+12', 2], ab: [34, 8, 21, 10, 11, 11], cmb: 30, cmd: 39, dr: 10 },
      ],
    },
    air: {
      name: 'Air Elemental', speed: { land: 0, fly: 100 }, immune: [], subtypes: ['air'], lang: 'Auran',
      stats: [
        { hp: '2d10+2', ac: { natural: 1, dodge: 1 }, saves: [4, 6, 0], slam: [6, '1d4+1', 1], ab: [12, 17, 12, 4, 11, 11], cmb: 1, cmd: 15 },
        { hp: '4d10+8', ac: { natural: 1, dodge: 1 }, saves: [6, 9, 1], slam: [9, '1d6+3', 1], ab: [14, 21, 14, 4, 11, 11], cmb: 6, cmd: 22 },
        { hp: '8d10+24', ac: { natural: 4, dodge: 1 }, saves: [9, 13, 2], slam: [14, '1d8+4', 2], ab: [18, 25, 16, 6, 11, 11], cmb: 13, cmd: 31, dr: 5 },
        { hp: '10d10+40', ac: { natural: 5, dodge: 1 }, saves: [11, 16, 3], slam: [17, '2d6+6', 2], ab: [22, 29, 18, 6, 11, 11], cmb: 18, cmd: 38, dr: 5 },
      ],
    },
    water: {
      name: 'Water Elemental', speed: { land: 20, swim: 90 }, immune: [], subtypes: ['water'], lang: 'Aquan',
      stats: [
        { hp: '2d10+4', ac: { natural: 6 }, saves: [5, 3, 0], slam: [5, '1d6+3', 1], ab: [14, 10, 13, 4, 11, 11], cmb: 3, cmd: 13 },
        { hp: '4d10+12', ac: { natural: 7 }, saves: [7, 4, 1], slam: [7, '1d8+4', 1], ab: [16, 12, 17, 4, 11, 11], cmb: 7, cmd: 18 },
        { hp: '8d10+32', ac: { natural: 8 }, saves: [10, 4, 2], slam: [12, '2d6+5', 2], ab: [20, 14, 19, 6, 11, 11], cmb: 14, cmd: 26, dr: 5 },
        { hp: '10d10+50', ac: { natural: 9 }, saves: [12, 5, 3], slam: [15, '2d8+7', 2], ab: [24, 14, 21, 6, 11, 11], cmb: 19, cmd: 31, dr: 5 },
      ],
    },
  };
  for (const [kind, def] of Object.entries(kinds)) {
    def.stats.forEach((st, i) => {
      const sz = sizes[i];
      const [str, dex, con, int, wis, cha] = st.ab;
      const onHit = st.burn ? [burn(st.burn[0], st.burn[1])] : [];
      out[`${sz.key}-${kind}-elemental`] = m(`${sz.key[0].toUpperCase()}${sz.key.slice(1)} ${def.name}`, sz.cr, {
        type: 'outsider', subtypes: ['elemental', 'extraplanar', ...def.subtypes], size: sz.size, init: Math.floor((dex - 10) / 2), senses: ['darkvision 60'], speed: def.speed,
        ac: st.ac, hp: st.hp, hd: sz.hdN, saves: { fort: st.saves[0], ref: st.saves[1], will: st.saves[2] },
        melee: [atk('slam', st.slam[0], st.slam[1], { type: BLUDG, count: st.slam[2], onHit })],
        abilities: { str, dex, con, int, wis, cha }, bab: sz.hdN, cmb: st.cmb, cmd: st.cmd,
        reach: sz.size === 'huge' ? 15 : sz.size === 'large' ? 10 : 5,
        dr: st.dr ? [{ amount: st.dr, bypass: '-' }] : [], immune: ['bleed', 'paralysis', 'poison', 'sleep', 'stun', 'critical', 'flanking', 'precision', ...def.immune], vulnerable: def.vulnerable || [],
        languages: [def.lang], treasure: 'none', description: `A being of living ${kind}.`,
      });
    });
  }
  return out;
}

for (const [id, b] of Object.entries(BESTIARY)) b.id = id;

module.exports = { BESTIARY };
