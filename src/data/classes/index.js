'use strict';

const { CLASSES: BASE } = require('./base');
const { PRESTIGE } = require('./prestige');

const CLASSES = { ...BASE, ...PRESTIGE };

function getClass(id) {
  const c = CLASSES[id];
  if (!c) throw Object.assign(new Error(`Unknown class: ${id}`), { status: 400 });
  return c;
}

/** Feature keys gained at exactly `level` in class `id`. */
function featuresAt(id, level) {
  return getClass(id).features[level] || [];
}

module.exports = { CLASSES, BASE_CLASSES: BASE, PRESTIGE_CLASSES: PRESTIGE, getClass, featuresAt };
