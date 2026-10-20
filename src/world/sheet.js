'use strict';

const { attackBonus, threatRange } = require('../engine/attacks');
const spellcasting = require('../engine/spellcasting');
const inventory = require('../engine/inventory');
const { CLASSES } = require('../data/classes');
const { FEATURES } = require('../data/features');
const { FEATS } = require('../data/feats');
const { SKILLS } = require('../data/core');
const { RACES } = require('../data/races');
const { getAbility } = require('../engine/classAbilities');
const { iterativeAttacks } = require('../engine/tables');

/** Full computed character sheet for clients. */
function sheet(char) {
  const s = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const attacks = char.attackProfiles().map((p) => {
    const ab = attackBonus(char, null, p, {});
    const strPart = p.damageAbilityMult ? Math.floor(char.abilityMod('str') * (char.abilityMod('str') < 0 ? 1 : p.damageAbilityMult)) : 0;
    const dmgBonus = strPart + (p.enhancement || 0) + char.stat(['damage', p.ranged ? 'damage.ranged' : 'damage.melee'], [`weapon:${p.weaponId}`, ...(p.groups || []).map((g) => `group:${g}`), ...(p.natural ? ['natural'] : []), ...(p.source === 'weapon' ? ['weapon'] : [])]).total;
    const tr = threatRange(char, p);
    const bab = char.bab();
    const iter = iterativeAttacks(bab).map((b) => ab.total - bab + b);
    return {
      id: p.id, name: p.name, bonus: ab.total, iterative: p.natural ? [ab.total] : iter.map(s).join('/'), damage: `${p.damageDice}${dmgBonus ? s(dmgBonus) : ''}`,
      crit: `${tr < 20 ? `${tr}-20` : '20'}/x${p.critMult}`, types: p.damageTypes, melee: p.melee, ranged: p.ranged, reach: p.reach, range: p.rangeIncrement, proficient: p.proficient,
    };
  });
  const xpNext = char.xpForNextLevel();
  return {
    id: char.id, name: char.name, race: RACES[char.race].name, raceId: char.race, alignment: char.alignment, deity: char.deity, gender: char.gender, age: char.age,
    size: char.size(), type: char.creatureType(), level: char.hitDice(), xp: char.xp, xpNext, canLevelUp: char.canLevelUp(),
    classes: char.classes.map((c) => ({ id: c.id, name: CLASSES[c.id].name, level: c.level, spellProgression: c.spellProgression })),
    favoredClasses: char.favoredClasses,
    abilities: char.abilities(),
    hp: { current: char.hp.current, max: char.maxHp(), temp: char.hp.temp || 0, nonlethal: char.hp.nonlethal || 0, state: char.hpState() },
    ac: char.acSummary(), acBreakdown: char.ac().breakdown,
    initiative: char.initiative(), speed: char.speed(), flySpeed: char.flySpeed(),
    saves: { fort: char.save('fort').total, ref: char.save('ref').total, will: char.save('will').total },
    bab: char.bab(), cmb: char.cmb(), cmd: char.cmd(),
    attacks,
    skills: Object.keys(SKILLS).map((k) => {
      const sk = char.skill(k);
      return { id: k, name: SKILLS[k].name, total: sk.total, ranks: sk.ranks, classSkill: sk.classSkill, ability: SKILLS[k].ability, trainedOnly: !!SKILLS[k].trained, usable: sk.untrainedAllowed };
    }),
    skillPointsPerLevel: char.classes.length ? char.skillPointsPerLevel(char.classes[char.classes.length - 1].id) : 0,
    feats: char.allFeats().map((f) => ({ id: f.id, name: FEATS[f.id] ? FEATS[f.id].name : f.id, param: f.param, source: f.source, benefit: FEATS[f.id] ? FEATS[f.id].benefit : '' })),
    features: char.features().map((f) => ({ key: f.key, class: f.classId, level: f.level, name: FEATURES[f.key] ? FEATURES[f.key].name : f.key, description: FEATURES[f.key] ? FEATURES[f.key].description : '' })),
    choices: char.choices,
    abilitiesActivated: char.activatedAbilities().map((id) => ({ id, name: (getAbility(id) || {}).name || id, action: (getAbility(id) || {}).action })),
    resources: char.resources(),
    spellcasting: spellcasting.summary(char),
    defenses: { dr: char.dr(), resistances: char.resistances(), immunities: [...char.immunities()], sr: char.sr() },
    senses: [...char.flags()].filter((f) => /^(darkvision|blindsense|blindsight|lowlight)/.test(f)),
    languages: char.languages,
    effects: char.effects.map((e) => ({ id: e.id, name: e.name, kind: e.kind, remaining: e.remaining, conditions: e.conditions })),
    conditions: [...new Set(char.effects.flatMap((e) => e.conditions || []))],
    negativeLevels: char.negativeLevels,
    toggles: char.toggles,
    money: char.money, load: char.load(), armorCheckPenalty: char.armorCheckPenalty(), maxDex: char.maxDexBonus(), arcaneSpellFailure: char.arcaneSpellFailure(),
    inventory: inventory.describeInventory(char),
    location: char.location, status: char.status, stats: char.stats,
  };
}

module.exports = { sheet };
