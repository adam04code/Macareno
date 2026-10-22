'use strict';

/**
 * Occult Adventures classes used by this engine: the kineticist (WotR scope).
 * Elements, blasts, infusions and wild talents live in src/data/kineticist.js.
 */

const at = (levels, key) => Object.fromEntries(levels.map((l) => [l, [key]]));
function merge(...maps) {
  const out = {};
  for (const m of maps) for (const [l, keys] of Object.entries(m)) out[l] = [...(out[l] || []), ...keys];
  return out;
}

const CLASSES = {
  kineticist: {
    name: 'Kineticist', type: 'base', source: 'Occult Adventures', hitDie: 8, skillRanks: 4, bab: 'threeQuarter', saves: { fort: 'good', ref: 'good', will: 'poor' },
    classSkills: ['acrobatics', 'craft', 'heal', 'intimidate', 'perception', 'profession', 'stealth', 'use-magic-device'],
    proficiencies: { weapons: ['simple'], armor: ['light'], shields: [] },
    features: merge(
      { 1: ['burn', 'elemental-focus', 'gather-power', 'kinetic-blast'], 2: ['elemental-defense'], 3: ['elemental-overflow'], 5: ['infusion-specialization', 'metakinesis'], 6: ['internal-buffer'],
        7: ['expanded-element'], 11: ['supercharge'], 15: ['expanded-element-15'], 16: ['composite-specialization'], 19: ['metakinetic-master'], 20: ['omnikinesis'] },
      at([1, 3, 5, 9, 11, 13, 17, 19], 'infusion'),
      at([2, 4, 6, 8, 10, 12, 14, 16, 18, 20], 'utility-wild-talent'),
    ),
    progressions: {
      kineticistLevel: (l) => l,
      blastDice: (l) => Math.ceil(l / 2),
      burnPerRound: (l) => (l >= 6 ? 2 + Math.floor((l - 6) / 3) : 1),
      overflowCap: (l) => Math.floor(l / 3),
      infusionSpecialization: (l) => (l >= 5 ? 1 + Math.floor((l - 5) / 3) : 0),
      internalBufferMax: (l) => (l >= 16 ? 3 : l >= 11 ? 2 : l >= 6 ? 1 : 0),
    },
    startingWealth: 140,
  },
};

for (const [id, c] of Object.entries(CLASSES)) {
  c.id = id;
  c.maxLevel = 20;
  c.saveFormula = 'base';
}

module.exports = { CLASSES };
