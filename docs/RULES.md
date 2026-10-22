# Rules Coverage

What the engine implements from the Pathfinder RPG (1st Edition) Open Game Content, and where the code deviates or simplifies.
"Rules faithful" means the numbers come out as the Core Rulebook / Bestiary specify. "Simplified" sections explain what was approximated and why.

## Content in the box

| Category | Count | Notes |
|---|---|---|
| Races | 13 | 7 core races plus aasimar, tiefling, drow, dhampir, kitsune and oread (racial traits, ability modifiers, senses, resistances, spell-like abilities, weapon familiarity, natural attacks) |
| Base classes | 25 | **Core:** barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, wizard; **Ultimate Magic:** magus; **APG:** alchemist, cavalier, inquisitor, oracle, witch; **ACG:** arcanist, bloodrager, hunter, shaman, skald, slayer, warpriest; **Occult Adventures:** kineticist. Levels 1–20 |
| Prestige classes | 8 | arcane trickster, assassin, dragon disciple, duelist, eldritch knight, loremaster, mystic theurge, stalwart defender. Levels 1–10 |
| Class features | 320+ | every level of every class, with mechanical hooks |
| Class options | 700+ in 32 groups | rage powers, rogue/slayer talents, 32 domains, arcane schools, 10 sorcerer and 10 bloodrager bloodlines, magus arcana, mercies, discoveries, cavalier orders, judgments, 10 oracle mysteries with revelations and curses, witch and shaman hexes, patrons, familiars, arcanist exploits, 10 shaman spirits, warpriest blessings, kineticist elements, 40 infusions and utility wild talents, loremaster secrets, defensive powers, animal companions |
| Feats | 258 | Core Rulebook feats, teamwork, style and combat feats and metamagic from the APG, UM, UC and ACG, extra-class-feature feats, monster feats |
| Spells | 676 | all Core Rulebook spells plus the APG/UM/UC/ACG spells the newer classes need. Class lists: sorcerer/wizard (also arcanist), cleric (also oracle; warpriest up to 6th), druid, bard (also skald), paladin, ranger, magus, alchemist, inquisitor, witch, shaman, bloodrager; hunter uses the druid or ranger level |
| Creatures | 127 | humanoids, undead, animals, magical beasts, giants, dragons, outsiders, oozes, aberrations, 24 elementals and every creature on the summon monster and summon nature's ally tables |
| Items | 187 | weapons, armor/shields, weapon & armor special abilities, wondrous items, potions, scrolls, wands, alchemical items, gear |
| Conditions | 30+ | all Core Rulebook conditions |

Rules and numbers were checked against d20pfsrd.com and, where its pages were unavailable, the Archives of Nethys
(the same OGL text). The previous **Darkfire Adept** prestige class was removed: it is a third-party product that
isn't on d20pfsrd or in WotR, and its mechanics had been reconstructed without the source text.

Not implemented yet: the shifter (Ultimate Wilderness) and class archetypes (`src/data/classes/archetypes.js` supports
them, but none are populated).

## Class mechanics beyond the Core Rulebook

- **Choices** are data-driven option groups (`src/data/classOptions.js`): a class feature declares `choice: '<group>'` and the builder validates level, prerequisites, deity/alignment and spirit/element access.
- **Animal companions** advance on the druid table for druids, rangers (level −3), cavaliers (mounts) and hunters, built in `src/engine/companion.js`. Wild shape uses the beast shape / elemental body form tables.
- **Alchemist:** bombs (splash, discoveries modify them), mutagens and cognatogens, extracts that only affect the drinker. **Cavalier:** challenge, orders, banner, tactician. **Inquisitor:** judgments, bane, domain powers. **Oracle:** mysteries, revelations, curses, mystery spells. **Witch:** hexes, major and grand hexes, patron spells, familiar.
- **Arcanist:** spellbook plus a daily set of prepared spells cast with spontaneous slots, arcane reservoir (spend for +1 CL or DC, cast option `reservoir`), consume spells, exploits. **Bloodrager:** bloodrage, bloodline powers active while raging (claws, resistances, wings), bonus feats and spells, blood casting. **Hunter:** animal focus aspects, shared teamwork feats, summon nature's ally known. **Shaman:** spirit and wandering spirit (spirit magic slots, abilities, greater spirit), Wis-based hexes. **Skald:** raging song and inspired rage that shares rage powers. **Slayer:** studied target, sneak attack, slayer talents. **Warpriest:** blessings, fervor, sacred weapon and armor, channel energy through fervor.
- **Kineticist:** simple and composite blasts (physical = ranged attack, energy = ranged touch), form and substance infusions, burn as nonlethal damage per character level that only rest removes (per-round and total limits), gather power, elemental overflow (attack/damage and size bonuses by burn), infusion specialization, metakinesis, internal buffer, elemental defense, expanded element.

## Characters

- **Ability scores:** point buy (budget configurable) or server-side 4d6-drop-lowest. Racial adjustments, the floating +2 for some races, +1 every 4 levels, inherent bonuses, ability damage and drain, and enhancement/size/morale bonuses with correct stacking.
- **Multiclassing:** BAB and saves are summed per class (base and prestige save formulas). HP is max at 1st level and average or rolled after that. Favored class bonus (hp or skill). Skill ranks are capped at character level, with the +3 class-skill bonus and armor check penalties (doubled for Swim).
- **Feats:** prerequisites are validated, including fighter level (eldritch knight and magus fighter training count), class features, caster level, skills and parameterized feats (Weapon Focus *longsword*, Spell Focus *evocation*...). Bonus feat lists are enforced for fighter, monk (prerequisites ignored), wizard, magus, eldritch knight, ranger combat style and the Combat Trick talent.
- **Prestige classes:** every requirement type is enforced: BAB, skills, feats, alignment, languages, race, sneak attack dice, "can cast Xth-level arcane/divine spells", "casts spontaneously", "casts *mage hand*", draconic bloodline, martial weapon proficiency. The assassin's "kill someone to join" is an honor-system flag (`choices.specialRequirements`).
- **Spellcasting progression:** prestige levels advance an existing class's spells per day and caster level on the exact table levels. Mystic theurge advances both an arcane and a divine class.
- **Encumbrance:** carrying capacity by Str and size, light/medium/heavy load effects on max Dex, check penalty and speed. Armor reduces speed (dwarves exempt). Fighter armor training applies.
- **XP:** slow, medium and fast tracks. CR-based awards are divided among surviving player characters.

## Checks

Every d20 goes through `src/engine/checks.js`: skill checks (trained-only rule, take 10/20 restrictions in combat), ability checks, saving throws (natural 1/20), caster level checks, spell resistance, concentration, opposed checks with tie-breaking, initiative, stabilization, and Knowledge checks to identify creatures (DC 10 + CR, more facts per 5 points).

## Combat

- **Initiative and turns:** flat-footed until a creature's first turn (uncanny dodge negates this). Surprise applies when a sneaking party ambushes. A round has standard, move, swift and immediate actions plus a 5-ft. step. Full-round actions are blocked after moving. Staggered, nauseated and disabled limits are enforced.
- **Grid:** 5-ft. squares with PF diagonal counting. Pathfinding goes around enemies (allies can be passed through). Reach, flanking geometry, and range increments with the −2 per increment penalty (Far Shot) are handled.
- **Attacks:** iteratives, two-weapon fighting (light off-hand, ITWF/GTWF, Double Slice), monk flurry (monk level as BAB, extra attacks at 8th/15th, ki extra attack), natural attacks (primary/secondary, Multiattack), haste and *speed* weapons, Rapid Shot, Manyshot, Power Attack, Deadly Aim, Combat Expertise, fighting defensively, total defense, Vital Strike, Cleave/Great Cleave, charge (+2/−2, pounce, rake, powerful charge), aid another, coup de grace.
- **Hits:** touch and flat-footed AC, concealment and total concealment (Blind-Fight reroll), invisibility, mirror image, critical threat ranges (keen and Improved Critical don't stack), confirmation rolls (Critical Focus), crit immunity, fortification, critical feats (bleeding, sickening, staggering, stunning, blinding, deafening, tiring, exhausting).
- **Damage:** Str multipliers (×1.5 two-handed, ×½ off-hand), enhancement, DR with "or" alternatives (magic, materials, alignments, damage types, DR/—), energy resistance and immunity, vulnerability (+50%), incorporeal half damage, nonlethal damage, temporary hp, stoneskin and protection from energy pools, minimum 1 damage, precision damage that isn't multiplied on a crit.
- **Sneak attack:** works with flanking, denied Dex, feint, invisibility and impromptu sneak attack. Ranged is limited to 30 ft. Bleeding Attack, Crippling Strike and the assassin's death attack (3 rounds of study) are implemented.
- **Attacks of opportunity:** provoked by leaving threatened squares (Mobility +4), casting (or cast defensively with DC 15 + 2×level), ranged attacks, unarmed attacks without IUS, drinking potions, standing up and maneuvers without the Improved feat. Combat Reflexes grants extra AoOs.
- **Maneuvers:** trip, disarm, grapple (maintain, pin, escape, constrict), bull rush, overrun, sunder, reposition and dirty trick. CMB/CMD use size, Improved/Greater feats, agile maneuvers and monk maneuver training. Feint and demoralize are included.
- **Dying:** disabled at 0 hp, dying below 0 with a DC 10 Con check each round, dead at −Con (Diehard applies). Monsters drop at 0 hp unless they have ferocity (set `MONSTER_DYING_RULES=1` for full rules). Regeneration (stopped by its bypass energy) and fast healing work.
- **Monster specials:** breath weapons with recharge, gaze attacks, auras (stench, frightful presence, captivating song), on-hit riders (trip, grab, poison, disease, paralysis with elf immunity, energy drain, ability damage/drain, burn, bleed, rust), rend, spell-like abilities and summoned creatures.

## Magic

- Slots per day for every table, bonus spells from ability scores (minimum score 10 + level), cleric domain slots, specialist school slots, opposition schools costing two slots, cantrips and orisons cast at will, and dragon disciple bonus spells.
- Prepared casting (wizard, cleric, paladin, ranger, magus) and spontaneous casting (sorcerer, bard, and cleric cure/inflict conversion). Spellbooks can be learned from scrolls (Spellcraft DC 15 + level, 10 gp/page). Spell recall and pearls of power restore slots.
- Metamagic: Empower, Maximize (and both together), Extend, Quicken (swift action), Silent, Still, Enlarge, Widen, Heighten. Spontaneous metamagic casting takes a full-round action.
- Save DCs include Spell Focus, Greater Spell Focus, racial (gnome illusion, kitsune enchantment), bloodline arcana (+2 charm/compulsion) and the arcanist reservoir. Spell resistance uses caster level checks (Spell Penetration, elven magic).
- Arcane spell failure from armor, with exceptions for bards in light armor and magi in light/medium/heavy by level. Silence blocks verbal spells. Grappled casters must make concentration checks.
- Effect kinds: damage (dice per level with caps, rays, missiles, touch attacks with crits, area bursts, cones and lines, evasion and improved evasion, ongoing acid, chain), healing and inflicting (positive and negative energy against undead), buffs (typed modifiers, temp hp, DR, resistances, SR, size changes, mirror images, fire shield), conditions (HD limits and HD pools for *sleep*/*color spray*, saves every round), debuffs, removal (*remove fear*, *restoration*, *heal*...), targeted dispel checks, summon monster I–IX tables, raise dead/resurrection with their negative levels, death effects, power words, holy word/blasphemy, energy drain, *black tentacles*, *spiritual weapon*, poison, teleport and time stop.

## Afflictions

Poisons and diseases use onset saves and frequency (every round for poison, every day for disease), ability damage, cure after N consecutive saves, and stacking doses (+2 DC, +50% duration). They are cured by *neutralize poison* / *remove disease* / *heal* or a paladin's mercy.

## Simplifications (deliberate)

- Large creatures occupy one grid square for movement and adjacency. Their reach is still correct.
- Area shapes are radius checks around a point or creature. Cones and lines use the area's size as a radius.
- Readied actions, mounted combat, falling, underwater combat and cover modifiers aren't simulated in combat. Their feats are recorded but only partially enforced.
- Polymorph effects (alter self, form of the dragon, elemental body) apply their numeric bonuses but not new natural attacks or movement types.
- Charm, suggestion and dominate apply a tracked condition. Clients and GMs decide behavior.
- Item creation feats are recorded. Crafting isn't implemented yet.
- Spell lists cover every Core Rulebook spell plus the later spells the implemented classes need, not every OGL spell. Adding more is data-only (see `CONTENT.md`).
- Many utility wild talents, revelations and hexes with narrative effects (scrying, shaping stone, weather) are recorded with their rules text but have no combat automation.
