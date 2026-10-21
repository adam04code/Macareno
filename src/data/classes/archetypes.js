'use strict';

/**
 * Archetypes (Advanced Player's Guide and later OGL books), keyed by class.
 *
 * replaces: feature keys removed at every level.
 * features: { level: [featureKey] } added (keys refer to src/data/features.js).
 * alters:   feature keys changed but not removed (used for compatibility checks).
 * progressions / classSkills { add, remove } / proficiencies / bonusFeats: overrides.
 */

const ARCHETYPES = {};

module.exports = { ARCHETYPES };
