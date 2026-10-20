'use strict';

const { mod } = require('../engine/modifiers');

/**
 * Races: Core Rulebook races plus the aasimar, tiefling and drow
 * (Advanced Race Guide / Bestiary, OGL).
 *
 * abilityMods: fixed racial adjustments. anyBonus: number of +2s chosen freely.
 * modifiers(): passive bonuses. flags: engine-readable traits.
 */

const RACES = {
  human: {
    name: 'Human', type: 'humanoid', subtypes: ['human'], size: 'medium', speed: 30,
    abilityMods: {}, anyBonus: 1, languages: ['Common'], bonusLanguages: 'any',
    traits: ['Bonus Feat: an extra feat at 1st level.', 'Skilled: +1 skill rank per level.'],
    bonusFeats: 1, skillRanksPerLevel: 1,
    modifiers: () => [],
    flags: [],
  },
  dwarf: {
    name: 'Dwarf', type: 'humanoid', subtypes: ['dwarf'], size: 'medium', speed: 20, speedNeverReduced: true,
    abilityMods: { con: 2, wis: 2, cha: -2 }, languages: ['Common', 'Dwarven'],
    bonusLanguages: ['Giant', 'Gnome', 'Goblin', 'Orc', 'Terran', 'Undercommon'],
    traits: ['Darkvision 60 ft.', 'Defensive Training: +4 dodge AC vs giants.', 'Hardy: +2 saves vs poison, spells and spell-like abilities.', 'Stability: +4 CMD vs bull rush and trip.', 'Greed: +2 Appraise on precious metals/gems.', 'Stonecunning: +2 Perception to notice unusual stonework.', 'Hatred: +1 attack vs orcs and goblinoids.', 'Weapon Familiarity: battleaxe, heavy pick, warhammer; dwarven weapons are martial.'],
    modifiers: (s = 'Dwarf') => [
      mod('ac', 4, 'dodge', `${s} defensive training`, ['vsGiant']),
      mod('save', 2, 'racial', `${s} hardy`, ['poison', 'spell', 'spell-like']),
      mod('cmd', 4, 'racial', `${s} stability`, ['bullRush', 'trip']),
      mod('skill.appraise', 2, 'racial', `${s} greed`, ['preciousMetal']),
      mod('skill.perception', 2, 'racial', `${s} stonecunning`, ['stonework']),
      mod('attack', 1, 'racial', `${s} hatred`, ['vsOrc', 'vsGoblinoid']),
    ],
    flags: ['darkvision:60'], weaponFamiliarity: ['battleaxe', 'heavy-pick', 'warhammer', 'dwarven-waraxe', 'dwarven-urgrosh'],
  },
  elf: {
    name: 'Elf', type: 'humanoid', subtypes: ['elf'], size: 'medium', speed: 30,
    abilityMods: { dex: 2, int: 2, con: -2 }, languages: ['Common', 'Elven'],
    bonusLanguages: ['Celestial', 'Draconic', 'Gnoll', 'Gnome', 'Goblin', 'Orc', 'Sylvan'],
    traits: ['Low-Light Vision.', 'Elven Immunities: immune to magic sleep, +2 vs enchantment.', 'Elven Magic: +2 caster level checks to overcome spell resistance, +2 Spellcraft to identify magic items.', 'Keen Senses: +2 Perception.', 'Weapon Familiarity: longbows, longswords, rapiers, shortbows; elven weapons are martial.'],
    modifiers: (s = 'Elf') => [
      mod('save', 2, 'racial', `${s} immunities`, ['enchantment']),
      mod('srCheck', 2, 'racial', `${s} magic`),
      mod('skill.spellcraft', 2, 'racial', `${s} magic`, ['identifyItem']),
      mod('skill.perception', 2, 'racial', `${s} keen senses`),
    ],
    flags: ['lowlight', 'immune:sleep'], immunities: ['sleep'], weaponFamiliarity: ['longbow', 'longsword', 'rapier', 'shortbow', 'elven-curve-blade'],
  },
  gnome: {
    name: 'Gnome', type: 'humanoid', subtypes: ['gnome'], size: 'small', speed: 20,
    abilityMods: { con: 2, cha: 2, str: -2 }, languages: ['Common', 'Gnome', 'Sylvan'],
    bonusLanguages: ['Draconic', 'Dwarven', 'Elven', 'Giant', 'Goblin', 'Orc'],
    traits: ['Low-Light Vision.', 'Defensive Training: +4 dodge AC vs giants.', 'Gnome Magic: +1 DC of illusion spells; dancing lights, ghost sound, prestidigitation, speak with animals 1/day (Cha 11+).', 'Hatred: +1 attack vs reptilians and goblinoids.', 'Illusion Resistance: +2 saves vs illusions.', 'Keen Senses: +2 Perception.', 'Obsessive: +2 on a chosen Craft or Profession.'],
    modifiers: (s = 'Gnome') => [
      mod('ac', 4, 'dodge', `${s} defensive training`, ['vsGiant']),
      mod('spellDC.illusion', 1, 'racial', `${s} magic`),
      mod('attack', 1, 'racial', `${s} hatred`, ['vsReptilian', 'vsGoblinoid']),
      mod('save', 2, 'racial', `${s} illusion resistance`, ['illusion']),
      mod('skill.perception', 2, 'racial', `${s} keen senses`),
      mod('skill.craft', 2, 'racial', `${s} obsessive`),
    ],
    flags: ['lowlight'], spellLikeAbilities: [{ spell: 'dancing-lights', perDay: 1, minCha: 11 }, { spell: 'ghost-sound', perDay: 1, minCha: 11 }, { spell: 'prestidigitation', perDay: 1, minCha: 11 }],
  },
  'half-elf': {
    name: 'Half-Elf', type: 'humanoid', subtypes: ['elf', 'human'], size: 'medium', speed: 30,
    abilityMods: {}, anyBonus: 1, languages: ['Common', 'Elven'], bonusLanguages: 'any',
    traits: ['Low-Light Vision.', 'Adaptability: Skill Focus as a bonus feat.', 'Elf Blood: counts as elf and human.', 'Elven Immunities.', 'Keen Senses: +2 Perception.', 'Multitalented: two favored classes.'],
    modifiers: (s = 'Half-elf') => [
      mod('save', 2, 'racial', `${s} immunities`, ['enchantment']),
      mod('skill.perception', 2, 'racial', `${s} keen senses`),
    ],
    flags: ['lowlight', 'immune:sleep'], immunities: ['sleep'], favoredClasses: 2, bonusFeatChoices: [{ feat: 'skill-focus' }],
  },
  'half-orc': {
    name: 'Half-Orc', type: 'humanoid', subtypes: ['human', 'orc'], size: 'medium', speed: 30,
    abilityMods: {}, anyBonus: 1, languages: ['Common', 'Orc'], bonusLanguages: ['Abyssal', 'Draconic', 'Giant', 'Gnoll', 'Goblin'],
    traits: ['Darkvision 60 ft.', 'Intimidating: +2 Intimidate.', 'Orc Blood: counts as orc and human.', 'Orc Ferocity: once per day, keep fighting for 1 round when brought below 0 hp.', 'Weapon Familiarity: greataxe, falchion; orc weapons are martial.'],
    modifiers: (s = 'Half-orc') => [mod('skill.intimidate', 2, 'racial', `${s} intimidating`)],
    flags: ['darkvision:60', 'orcFerocity'], weaponFamiliarity: ['greataxe', 'falchion', 'orc-double-axe'],
  },
  halfling: {
    name: 'Halfling', type: 'humanoid', subtypes: ['halfling'], size: 'small', speed: 20,
    abilityMods: { dex: 2, cha: 2, str: -2 }, languages: ['Common', 'Halfling'],
    bonusLanguages: ['Dwarven', 'Elven', 'Gnome', 'Goblin'],
    traits: ['Fearless: +2 vs fear.', 'Halfling Luck: +1 on all saving throws.', 'Keen Senses: +2 Perception.', 'Sure-Footed: +2 Acrobatics and Climb.', 'Weapon Familiarity: slings; halfling weapons are martial.'],
    modifiers: (s = 'Halfling') => [
      mod('save', 2, 'racial', `${s} fearless`, ['fear']),
      mod('save', 1, 'luck', `${s} luck`),
      mod('skill.perception', 2, 'racial', `${s} keen senses`),
      mod('skill.acrobatics', 2, 'racial', `${s} sure-footed`),
      mod('skill.climb', 2, 'racial', `${s} sure-footed`),
    ],
    flags: [], weaponFamiliarity: ['sling'],
  },
  aasimar: {
    name: 'Aasimar', type: 'outsider', subtypes: ['native'], size: 'medium', speed: 30,
    abilityMods: { wis: 2, cha: 2 }, languages: ['Common', 'Celestial'], bonusLanguages: ['Draconic', 'Dwarven', 'Elven', 'Gnome', 'Halfling', 'Sylvan'],
    traits: ['Darkvision 60 ft.', 'Celestial Resistance: acid, cold and electricity resistance 5.', 'Skilled: +2 Diplomacy and Perception.', 'Spell-Like Ability: daylight 1/day.'],
    modifiers: (s = 'Aasimar') => [mod('skill.diplomacy', 2, 'racial', s), mod('skill.perception', 2, 'racial', s)],
    flags: ['darkvision:60'], resistances: { acid: 5, cold: 5, electricity: 5 }, spellLikeAbilities: [{ spell: 'daylight', perDay: 1 }],
  },
  tiefling: {
    name: 'Tiefling', type: 'outsider', subtypes: ['native'], size: 'medium', speed: 30,
    abilityMods: { dex: 2, int: 2, cha: -2 }, languages: ['Common', 'Abyssal', 'Infernal'], bonusLanguages: ['Draconic', 'Dwarven', 'Elven', 'Gnome', 'Goblin', 'Halfling', 'Orc'],
    traits: ['Darkvision 60 ft.', 'Fiendish Resistance: cold, electricity and fire resistance 5.', 'Skilled: +2 Bluff and Stealth.', 'Spell-Like Ability: darkness 1/day.'],
    modifiers: (s = 'Tiefling') => [mod('skill.bluff', 2, 'racial', s), mod('skill.stealth', 2, 'racial', s)],
    flags: ['darkvision:60'], resistances: { cold: 5, electricity: 5, fire: 5 }, spellLikeAbilities: [{ spell: 'darkness', perDay: 1 }],
  },
  drow: {
    name: 'Drow', type: 'humanoid', subtypes: ['elf'], size: 'medium', speed: 30,
    abilityMods: { dex: 2, cha: 2, con: -2 }, languages: ['Elven', 'Undercommon'], bonusLanguages: ['Abyssal', 'Aklo', 'Aquan', 'Common', 'Draconic', 'Gnome', 'Goblin'],
    traits: ['Darkvision 120 ft.', 'Drow Immunities: immune to magic sleep, +2 vs enchantment.', 'Spell Resistance 6 + character level.', 'Keen Senses: +2 Perception.', 'Drow Magic: dancing lights, darkness, faerie fire 1/day.', 'Light Blindness.', 'Poison Use.', 'Weapon Familiarity: hand crossbow, rapier, short sword.'],
    modifiers: (s = 'Drow') => [mod('save', 2, 'racial', `${s} immunities`, ['enchantment']), mod('skill.perception', 2, 'racial', `${s} keen senses`)],
    flags: ['darkvision:120', 'lightBlindness', 'poisonUse'], immunities: ['sleep'], srBase: 6,
    spellLikeAbilities: [{ spell: 'dancing-lights', perDay: 1 }, { spell: 'darkness', perDay: 1 }, { spell: 'faerie-fire', perDay: 1 }],
    weaponFamiliarity: ['hand-crossbow', 'rapier', 'short-sword'],
  },
};

module.exports = { RACES };
