'use strict';

const { defaultRng } = require('./rng');

/**
 * Dice expressions.
 *
 * Grammar (whitespace ignored, case-insensitive):
 *   expr   := term (('+' | '-') term)*
 *   term   := dice | integer
 *   dice   := [count] 'd' (sides | '%') [('kh' | 'kl') keep]
 *
 * Examples: "1d20+5", "2d6+1d4-1", "4d6kh3", "d%", "3".
 */

const TERM_RE = /^(\d*)d(\d+|%)(?:(kh|kl)(\d+))?$/i;

function parse(expression) {
  if (typeof expression === 'number') return [{ sign: 1, kind: 'flat', value: expression }];
  const src = String(expression).replace(/\s+/g, '');
  if (!src) throw new Error('Empty dice expression');
  const parts = src.match(/[+-]?[^+-]+/g);
  if (!parts) throw new Error(`Invalid dice expression: ${expression}`);
  return parts.map((raw) => {
    let sign = 1;
    let body = raw;
    if (body[0] === '+') body = body.slice(1);
    else if (body[0] === '-') {
      sign = -1;
      body = body.slice(1);
    }
    if (/^\d+$/.test(body)) return { sign, kind: 'flat', value: Number(body) };
    const m = TERM_RE.exec(body);
    if (!m) throw new Error(`Invalid dice term "${raw}" in ${expression}`);
    const count = m[1] === '' ? 1 : Number(m[1]);
    const sides = m[2] === '%' ? 100 : Number(m[2]);
    if (count > 1000 || sides > 10000) throw new Error('Dice expression too large');
    if (sides < 1) throw new Error('Dice must have at least one side');
    const term = { sign, kind: 'dice', count, sides };
    if (m[3]) {
      term.keep = m[3].toLowerCase();
      term.keepCount = Math.min(Number(m[4]), count);
    }
    return term;
  });
}

function rollTerm(term, rng) {
  if (term.kind === 'flat') return { ...term, rolls: [], total: term.sign * term.value };
  const rolls = [];
  for (let i = 0; i < term.count; i++) rolls.push(rng.die(term.sides));
  let kept = rolls;
  if (term.keep) {
    const sorted = [...rolls].sort((a, b) => (term.keep === 'kh' ? b - a : a - b));
    kept = sorted.slice(0, term.keepCount);
  }
  const sum = kept.reduce((s, r) => s + r, 0);
  return { ...term, rolls, kept, total: term.sign * sum };
}

/**
 * Roll an expression. Returns { expression, total, terms } where each term
 * records the individual dice for client-side display / audit logs.
 */
function roll(expression, rng = defaultRng) {
  const terms = parse(expression).map((t) => rollTerm(t, rng));
  return {
    expression: String(expression),
    total: terms.reduce((s, t) => s + t.total, 0),
    terms,
  };
}

function total(expression, rng = defaultRng) {
  return roll(expression, rng).total;
}

function d20(rng = defaultRng) {
  return rng.die(20);
}

function average(expression) {
  return parse(expression).reduce((s, t) => {
    if (t.kind === 'flat') return s + t.sign * t.value;
    const n = t.keep ? t.keepCount : t.count;
    return s + t.sign * n * ((t.sides + 1) / 2);
  }, 0);
}

function max(expression) {
  return parse(expression).reduce((s, t) => {
    if (t.kind === 'flat') return s + t.sign * t.value;
    const n = t.keep ? t.keepCount : t.count;
    return s + (t.sign > 0 ? n * t.sides : -n);
  }, 0);
}

/** Multiply only the dice of an expression (Empower ignores, but e.g. "Xd6 per CL"). */
function scaleDiceCount(expression, factor) {
  return parse(expression)
    .map((t, i) => {
      const sign = t.sign < 0 ? '-' : i === 0 ? '' : '+';
      if (t.kind === 'flat') return `${sign}${t.value}`;
      return `${sign}${Math.max(1, Math.floor(t.count * factor))}d${t.sides}`;
    })
    .join('');
}

/** Build "NdS" while dropping zero-count dice. */
function dice(count, sides, bonus = 0) {
  const parts = [];
  if (count > 0) parts.push(`${count}d${sides}`);
  if (bonus) parts.push(bonus > 0 ? `+${bonus}` : `${bonus}`);
  if (!parts.length) return '0';
  const s = parts.join('');
  return s[0] === '+' ? s.slice(1) : s;
}

/** Join several expressions into one. */
function combine(...exprs) {
  const out = exprs
    .filter((e) => e !== undefined && e !== null && e !== '' && e !== 0 && e !== '0')
    .map(String)
    .map((e, i) => (i > 0 && e[0] !== '-' && e[0] !== '+' ? `+${e}` : e))
    .join('');
  return out || '0';
}

// Weapon damage by size: PF1 Table 6-5 (damage dice step chart).
const SIZE_STEPS = ['1', '1d2', '1d3', '1d4', '1d6', '1d8', '1d10', '2d6', '2d8', '3d6', '3d8', '4d6', '4d8', '6d6', '6d8', '8d6', '8d8', '12d6', '12d8', '16d6'];
const EQUIVALENT = { '2d4': '1d8', '1d12': '2d6', '3d4': '1d10', '4d4': '2d8', '2d10': '4d6', '2d12': '4d8' };

/** Step a damage die up/down by `steps` size categories (used by enlarge, monk, size changes). */
function stepDamage(expr, steps) {
  if (!steps) return expr;
  let base = EQUIVALENT[expr] || expr;
  let idx = SIZE_STEPS.indexOf(base);
  if (idx === -1) return expr;
  // Below 1d6 each step is one place; at/after 1d6 large creatures increase by two places (simplified rule).
  for (let i = 0; i < Math.abs(steps); i++) {
    if (steps > 0) idx += idx < SIZE_STEPS.indexOf('1d6') ? 1 : idx === SIZE_STEPS.indexOf('1d6') ? 1 : 2;
    else idx -= idx <= SIZE_STEPS.indexOf('1d8') ? 1 : 2;
  }
  idx = Math.max(0, Math.min(SIZE_STEPS.length - 1, idx));
  return SIZE_STEPS[idx];
}

module.exports = { parse, roll, total, d20, average, max, dice, combine, scaleDiceCount, stepDamage };
