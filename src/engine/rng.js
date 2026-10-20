'use strict';

/**
 * Random number generation. The engine never calls Math.random directly so
 * that every roll can be made deterministic (tests, replays, audits) by
 * swapping in a seeded generator.
 */

// mulberry32: small, fast, good-enough PRNG for dice.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    if (seed === undefined || seed === null) {
      this.seed = null;
      this.next = Math.random;
    } else {
      this.seed = seed >>> 0;
      this.next = mulberry32(this.seed);
    }
  }

  /** Integer in [1, sides]. */
  die(sides) {
    return 1 + Math.floor(this.next() * sides);
  }

  /** Integer in [min, max]. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** Percentile check: true with `percent`% chance. */
  chance(percent) {
    return this.die(100) <= percent;
  }
}

// Process-wide default generator. Seed via PF_SEED for reproducible servers.
const defaultRng = new RNG(process.env.PF_SEED !== undefined ? Number(process.env.PF_SEED) : undefined);

module.exports = { RNG, defaultRng, mulberry32 };
