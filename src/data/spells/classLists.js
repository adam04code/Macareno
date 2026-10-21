'use strict';

/**
 * Class spell lists maintained as tables (spell ids by level). They are merged
 * into each spell's `levels` when the spell index loads; an unknown id is a
 * load error, so the lists stay consistent with the spell data.
 * Source: the class spell lists on d20pfsrd.com (Core Rulebook entries).
 */

const CLASS_LISTS = {
  druid: {
    0: ['create-water', 'detect-magic', 'detect-poison', 'flare', 'guidance', 'know-direction', 'light', 'mending', 'purify-food-and-drink', 'read-magic', 'resistance', 'stabilize', 'virtue'],
    1: ['calm-animals', 'charm-animal', 'cure-light-wounds', 'detect-animals-or-plants', 'detect-snares-and-pits', 'endure-elements', 'entangle', 'faerie-fire', 'goodberry', 'hide-from-animals', 'jump', 'longstrider', 'magic-fang', 'magic-stone', 'obscuring-mist', 'pass-without-trace', 'produce-flame', 'shillelagh', 'speak-with-animals', 'summon-natures-ally-i'],
    2: ['animal-messenger', 'animal-trance', 'barkskin', 'bears-endurance', 'bulls-strength', 'cats-grace', 'chill-metal', 'delay-poison', 'fire-trap', 'flame-blade', 'flaming-sphere', 'fog-cloud', 'gust-of-wind', 'heat-metal', 'hold-animal', 'lesser-restoration', 'owls-wisdom', 'reduce-animal', 'resist-energy', 'soften-earth-and-stone', 'spider-climb', 'summon-natures-ally-ii', 'summon-swarm', 'tree-shape', 'warp-wood', 'wood-shape'],
    3: ['call-lightning', 'contagion', 'cure-moderate-wounds', 'daylight', 'diminish-plants', 'dominate-animal', 'greater-magic-fang', 'meld-into-stone', 'neutralize-poison', 'plant-growth', 'poison', 'protection-from-energy', 'quench', 'remove-disease', 'sleet-storm', 'snare', 'speak-with-plants', 'spike-growth', 'stone-shape', 'summon-natures-ally-iii', 'water-breathing', 'wind-wall'],
    4: ['air-walk', 'antiplant-shell', 'blight', 'command-plants', 'control-water', 'cure-serious-wounds', 'dispel-magic', 'flame-strike', 'freedom-of-movement', 'giant-vermin', 'ice-storm', 'reincarnate', 'repel-vermin', 'rusting-grasp', 'scrying', 'spike-stones', 'summon-natures-ally-iv'],
    5: ['animal-growth', 'atonement', 'awaken', 'baleful-polymorph', 'call-lightning-storm', 'commune-with-nature', 'control-winds', 'cure-critical-wounds', 'death-ward', 'hallow', 'insect-plague', 'stoneskin', 'summon-natures-ally-v', 'transmute-mud-to-rock', 'transmute-rock-to-mud', 'tree-stride', 'unhallow', 'wall-of-fire', 'wall-of-thorns'],
    6: ['antilife-shell', 'mass-bears-endurance', 'mass-bulls-strength', 'mass-cats-grace', 'mass-cure-light-wounds', 'greater-dispel-magic', 'find-the-path', 'fire-seeds', 'ironwood', 'liveoak', 'move-earth', 'mass-owls-wisdom', 'repel-wood', 'spellstaff', 'stone-tell', 'summon-natures-ally-vi', 'transport-via-plants', 'wall-of-stone'],
    7: ['animate-plants', 'changestaff', 'control-weather', 'creeping-doom', 'mass-cure-moderate-wounds', 'fire-storm', 'heal', 'greater-scrying', 'summon-natures-ally-vii', 'sunbeam', 'transmute-metal-to-wood', 'true-seeing', 'wind-walk'],
    8: ['animal-shapes', 'control-plants', 'mass-cure-serious-wounds', 'earthquake', 'finger-of-death', 'repel-metal-or-stone', 'reverse-gravity', 'summon-natures-ally-viii', 'sunburst', 'whirlwind', 'word-of-recall'],
    9: ['antipathy', 'mass-cure-critical-wounds', 'elemental-swarm', 'foresight', 'regenerate', 'shambler', 'shapechange', 'storm-of-vengeance', 'summon-natures-ally-ix', 'sympathy'],
  },
};

module.exports = { CLASS_LISTS };
