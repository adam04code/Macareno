'use strict';

const B = require('../src/engine/builder');

/** Point-buy (20) arrays used by the tests. */
const ARRAYS = {
  str: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  dex: { str: 12, dex: 16, con: 12, int: 14, wis: 10, cha: 10 },
  int: { str: 8, dex: 14, con: 12, int: 17, wis: 10, cha: 10 },
  wis: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
  cha: { str: 8, dex: 14, con: 12, int: 12, wis: 10, cha: 17 },
};

function make(spec) {
  return B.createCharacter({ alignment: 'N', race: 'human', racialBonus: 'str', ...spec, abilities: { method: 'pointbuy', scores: spec.scores || ARRAYS.str } });
}

/** Level a character up `n` times in classId using the automatic spec builder. */
function levelTo(char, classId, n, prefs = {}) {
  for (let i = 0; i < n; i++) {
    const spec = B.autoLevelSpec(char, classId, typeof prefs === 'function' ? prefs(char) : prefs);
    B.levelUp(char, spec, { force: true });
  }
  return char;
}

module.exports = { make, levelTo, ARRAYS };
