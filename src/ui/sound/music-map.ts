// The music (docs/design-system-table.md, Sound): looped passages of the film trilogy's score (user request, 2026-11-18), a calm loop
// for each scenario and a combat loop for its Combat phase, and the menu's loop everywhere else. The boxes with no film scene take a
// mood's pair. The files are packed into assets/music as `<loop>.m4a` (scripts/build/pack-music.ts); a build without them plays none.
export const MUSIC_LOOPS = [
  "menu",
  "shire",
  "bree",
  "shadow",
  "rivendell",
  "moria",
  "river",
  "rohan",
  "fangorn",
  "marshes",
  "crossroads",
  "greycompany",
  "gondor",
  "morgul",
  "cirith",
  "doom",
  "havens",
  "nazgul",
  "weathertop",
  "chase",
  "isengard",
  "khazad",
  "amonhen",
  "uruk",
  "helmsdeep",
  "ents",
  "deadpaths",
  "siege",
  "pelennor",
  "shelob",
  "blackgate",
  "crackofdoom",
] as const;

export type MusicLoop = (typeof MUSIC_LOOPS)[number];

export function isMusicLoop(name: string): name is MusicLoop {
  return (MUSIC_LOOPS as readonly string[]).includes(name);
}

type Pair = { calm: MusicLoop; combat: MusicLoop };

// Mirkwood and the other dark woods fight spiders and wargs.
const FOREST: Pair = { calm: "shadow", combat: "shelob" };
const WILDS: Pair = { calm: "river", combat: "uruk" };
// The hills of Eriador and Angmar: Rohan's theme belongs to Rohan.
const HILLS: Pair = { calm: "river", combat: "amonhen" };
const FORTRESS: Pair = { calm: "morgul", combat: "isengard" };
const UNDERGROUND: Pair = { calm: "moria", combat: "khazad" };
const DRAGONS: Pair = { calm: "rivendell", combat: "khazad" };
const SEA: Pair = { calm: "havens", combat: "helmsdeep" };
// The undead (the barrow-wights, the Dead of Deadmen's Dike, the ghost of Framsburg) and the Corsairs' black ships.
const UNDEAD = "deadpaths";
const CORSAIRS = "pelennor";

// The film's own scene where the scenario has one; a mood's pair otherwise.
const SCENARIO_MUSIC: Readonly<Record<string, Pair>> = {
  "a-shadow-of-the-past": { calm: "shire", combat: "nazgul" },
  "a-knife-in-the-dark": { calm: "bree", combat: "weathertop" },
  "flight-to-the-ford": { calm: "shadow", combat: "chase" },
  "the-ring-goes-south": { calm: "rivendell", combat: "isengard" },
  "journey-in-the-dark": { calm: "moria", combat: "khazad" },
  "breaking-of-the-fellowship": { calm: "river", combat: "amonhen" },
  "the-uruk-hai": { calm: "rohan", combat: "uruk" },
  "helms-deep": { calm: "rohan", combat: "helmsdeep" },
  "the-road-to-isengard": { calm: "fangorn", combat: "ents" },
  "the-passage-of-the-marshes": { calm: "marshes", combat: "blackgate" },
  "journey-to-the-cross-roads": { calm: "crossroads", combat: "morgul" },
  "shelobs-lair": { calm: "cirith", combat: "shelob" },
  "the-passing-of-the-grey-company": { calm: "greycompany", combat: "deadpaths" },
  "the-siege-of-gondor": { calm: "gondor", combat: "siege" },
  "the-battle-of-the-pelennor-fields": { calm: "rohan", combat: "pelennor" },
  "the-tower-of-cirith-ungol": { calm: "cirith", combat: "morgul" },
  "the-black-gate-opens": { calm: "gondor", combat: "blackgate" },
  "mount-doom": { calm: "doom", combat: "crackofdoom" },
  "passage-through-mirkwood": FOREST,
  "lost-in-mirkwood": FOREST,
  "return-to-mirkwood": FOREST,
  "the-hunt-for-gollum": FOREST,
  "a-journey-to-rhosgobel": FOREST,
  "intruders-in-chetwood": { calm: "bree", combat: "weathertop" },
  "journey-along-the-anduin": WILDS,
  "journey-up-the-anduin": WILDS,
  "roam-across-rhovanion": WILDS,
  "conflict-at-the-carrock": WILDS,
  "the-hills-of-emyn-muil": WILDS,
  "the-dead-marshes": { calm: "marshes", combat: "uruk" },
  "the-weather-hills": HILLS,
  "the-wastes-of-eriador": HILLS,
  "across-the-ettenmoors": HILLS,
  "the-oath": HILLS,
  "escape-from-dol-guldur": FORTRESS,
  "escape-from-mount-gram": FORTRESS,
  "the-treachery-of-rhudaur": FORTRESS,
  "the-battle-of-carn-dum": FORTRESS,
  "the-dread-realm": FORTRESS,
  "deadmens-dike": { calm: "morgul", combat: UNDEAD },
  "the-caves-of-nibin-dum": UNDERGROUND,
  "mount-gundabad": UNDERGROUND,
  "the-kings-quest": DRAGONS,
  "the-withered-heath": DRAGONS,
  "fire-in-the-night": DRAGONS,
  "the-ghost-of-framsburg": { calm: "rivendell", combat: UNDEAD },
  "the-fate-of-wilderland": DRAGONS,
  "voyage-across-belegaer": SEA,
  "the-fate-of-numenor": SEA,
  "raid-on-the-grey-havens": SEA,
  "flight-of-the-stormcaller": { calm: "havens", combat: CORSAIRS },
  "the-thing-in-the-depths": SEA,
  "temple-of-the-deceived": SEA,
  "the-drowned-ruins": SEA,
  "a-storm-on-cobas-haven": SEA,
  "the-city-of-corsairs": { calm: "havens", combat: CORSAIRS },
  "into-the-pit": UNDERGROUND,
  "the-seventh-level": UNDERGROUND,
  "flight-from-moria": UNDERGROUND,
  "the-redhorn-gate": { calm: "rivendell", combat: "isengard" },
  "road-to-rivendell": { calm: "rivendell", combat: "chase" },
  "the-watcher-in-the-water": UNDERGROUND,
  "the-long-dark": UNDERGROUND,
  "foundations-of-stone": UNDERGROUND,
  "shadow-and-flame": UNDERGROUND,
  "the-massing-at-osgiliath": { calm: "gondor", combat: "siege" },
  "the-battle-of-lake-town": DRAGONS,
  "the-stone-of-erech": { calm: "greycompany", combat: "deadpaths" },
  "the-old-forest": { calm: "fangorn", combat: "ents" },
  "fog-on-the-barrow-downs": { calm: "morgul", combat: UNDEAD },
  "the-ruins-of-belegost": DRAGONS,
  "murder-at-the-prancing-pony": { calm: "bree", combat: "weathertop" },
  "the-siege-of-annuminas": { calm: "gondor", combat: "siege" },
  "attack-on-dol-guldur": FORTRESS,
  "the-wizards-quest": { calm: "shadow", combat: "isengard" },
  "the-woodland-realm": FOREST,
  "the-mines-of-moria": UNDERGROUND,
  "escape-from-khazad-dum": UNDERGROUND,
  "the-hunt-for-the-dreadnaught": SEA,
  "peril-in-pelargir": { calm: "gondor", combat: "siege" },
  "into-ithilien": { calm: "crossroads", combat: "pelennor" },
  "the-siege-of-cair-andros": { calm: "gondor", combat: "siege" },
  "the-stewards-fear": { calm: "gondor", combat: "shadow" },
  "the-druadan-forest": { calm: "crossroads", combat: "uruk" },
  "encounter-at-amon-din": { calm: "gondor", combat: "uruk" },
  "assault-on-osgiliath": { calm: "gondor", combat: "siege" },
  "the-blood-of-gondor": { calm: "crossroads", combat: "uruk" },
  "the-morgul-vale": { calm: "morgul", combat: "uruk" },
  "we-must-away-ere-break-of-day": { calm: "shire", combat: "chase" },
  "over-the-misty-mountains-grim": UNDERGROUND,
  "dungeons-deep-and-caverns-dim": UNDERGROUND,
  "flies-and-spiders": FOREST,
  "the-lonely-mountain": DRAGONS,
  "the-battle-of-five-armies": { calm: "rohan", combat: "pelennor" },
  "the-fords-of-isen": { calm: "rohan", combat: "isengard" },
  "to-catch-an-orc": { calm: "rohan", combat: "uruk" },
  "into-fangorn": { calm: "fangorn", combat: "ents" },
  "the-dunland-trap": { calm: "rohan", combat: "isengard" },
  "escape-from-umbar": { calm: "havens", combat: "chase" },
  "desert-crossing": { calm: "rohan", combat: "chase" },
  "the-long-arm-of-mordor": { calm: "shadow", combat: "uruk" },
  "the-three-trials": { calm: "fangorn", combat: UNDEAD },
  "trouble-in-tharbad": { calm: "crossroads", combat: "uruk" },
  "the-nin-in-eilph": { calm: "marshes", combat: "chase" },
  "the-mumakil": { calm: "fangorn", combat: "pelennor" },
};

/** The loop a table plays: its scenario's combat loop during the Combat phase, its calm loop otherwise, and the menu's for a scenario with no pair. */
export function tableMusic(scenarioId: string, combat: boolean): MusicLoop {
  const pair = SCENARIO_MUSIC[scenarioId];
  if (!pair) return "menu";
  return combat ? pair.combat : pair.calm;
}

/** The scenarios with a pair of their own, for the test that every playable scenario has one. */
export const MUSIC_SCENARIOS: readonly string[] = Object.keys(SCENARIO_MUSIC);
