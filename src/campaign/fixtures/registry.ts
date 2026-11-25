// The save fixtures, by scenario (docs/architecture.md, Tests). Adding a fixture name is a line here; a new scenario
// adds its line, its JSON import in ../fixtures.ts (Metro needs static imports) and its writer in `e2e/writers.ts` in the scripts folder.
// FixtureName, FIXTURE_NAMES and STORED in ../fixtures.ts, the e2e fixtures script and the per-scenario checks
// in ../fixtures.test.ts all read it. `file` is the JSON file's name when it is not the scenario id.
//
// The registry names only committed fixtures (`fixtures.test.ts` holds it), but scenario 1's `won` and the `knife-lost` dealt from its log.
// A scenario needs a `-lost` fixture and no `-won` one: its goldens prove the win, and no agent searches for a won game
// (docs/architecture.md, Tests). A `-won` name is here only while its game is committed; a seed finder plays for no other.
// `hasFixture` says whether a name is committed, and the e2e route offers only those. The scenario's JSON holds the saves; each is a real loadout, a seed and the intents that reach the moment
// (`won`, `lost` and `duo` are scenario 1 from an empty log; `knife-lost` starts from the log `won` writes; the rest are
// two-handed games of one scenario, parked on its win or loss, and a part after the first starts from the log the earlier
// parts' wins write). The names with `showcase` are the README's captures, parked on a full table.
// An entry with `kind: "standalone"` is a scenario of a cycle (Shadows of Mirkwood): it has no log and no earlier part, so each of its saves is
// one open standalone game (a loadout of saved decks, a seed and the intents) parked on its win or loss, and the e2e route opens its table.
export const FIXTURE_REGISTRY = [
  { scenarioId: "a-shadow-of-the-past", file: "scenario-1", names: ["won", "lost", "duo", "past-showcase-board"] },
  { scenarioId: "a-knife-in-the-dark", names: ["knife-lost"] },
  { scenarioId: "passage-through-mirkwood", names: ["mirkwood-won", "mirkwood-lost"] },
  { scenarioId: "journey-along-the-anduin", names: ["anduin-lost"] },
  { scenarioId: "escape-from-dol-guldur", names: [] },
  { scenarioId: "the-oath", names: ["oath-lost"] },
  { scenarioId: "the-caves-of-nibin-dum", names: [] },
  { scenarioId: "voyage-across-belegaer", names: ["sea-solo", "sea-duo", "voyage-lost", "sea-showcase"] },
  { scenarioId: "the-fate-of-numenor", names: ["fate-lost"] },
  { scenarioId: "raid-on-the-grey-havens", names: ["raid-lost"] },
  { scenarioId: "flight-of-the-stormcaller", names: ["stormcaller-lost"] },
  { scenarioId: "the-thing-in-the-depths", names: ["depths-lost"] },
  { scenarioId: "temple-of-the-deceived", names: ["temple-lost"] },
  { scenarioId: "the-drowned-ruins", names: ["ruins-lost"] },
  { scenarioId: "a-storm-on-cobas-haven", names: ["haven-lost"] },
  { scenarioId: "the-city-of-corsairs", names: ["corsairs-lost"] },
  { scenarioId: "journey-up-the-anduin", names: ["upanduin-lost"] },
  { scenarioId: "lost-in-mirkwood", names: ["lostmirk-lost"] },
  { scenarioId: "the-kings-quest", names: ["kingsquest-lost"] },
  { scenarioId: "the-withered-heath", names: ["heath-lost"] },
  { scenarioId: "roam-across-rhovanion", names: ["rhovanion-lost"] },
  { scenarioId: "fire-in-the-night", names: ["night-lost"] },
  { scenarioId: "the-ghost-of-framsburg", names: ["framsburg-lost"] },
  { scenarioId: "mount-gundabad", names: ["gundabad-lost"] },
  { scenarioId: "the-fate-of-wilderland", names: ["wilderland-lost"] },
  { scenarioId: "the-uruk-hai", names: ["hai-lost"] },
  { scenarioId: "helms-deep", names: ["deep-lost", "deep-showcase"] },
  { scenarioId: "the-road-to-isengard", names: ["isengard-lost"] },
  { scenarioId: "the-passage-of-the-marshes", names: ["marshes-lost"] },
  { scenarioId: "journey-to-the-cross-roads", names: ["roads-lost"] },
  { scenarioId: "shelobs-lair", names: ["lair-lost"] },
  { scenarioId: "the-passing-of-the-grey-company", names: ["company-lost"] },
  { scenarioId: "the-siege-of-gondor", names: ["gondor-lost"] },
  { scenarioId: "the-battle-of-the-pelennor-fields", names: ["fields-lost"] },
  { scenarioId: "the-tower-of-cirith-ungol", names: ["ungol-lost"] },
  { scenarioId: "the-black-gate-opens", names: ["opens-won", "opens-lost"] },
  { scenarioId: "mount-doom", names: ["doom-lost"] },
  { scenarioId: "intruders-in-chetwood", names: ["chetwood-lost"] },
  { scenarioId: "the-weather-hills", names: ["hills-lost"] },
  { scenarioId: "deadmens-dike", names: ["dike-lost"] },
  { scenarioId: "the-wastes-of-eriador", names: ["eriador-lost"] },
  { scenarioId: "escape-from-mount-gram", names: ["gram-lost"] },
  { scenarioId: "across-the-ettenmoors", names: ["ettenmoors-lost"] },
  { scenarioId: "the-treachery-of-rhudaur", names: ["rhudaur-lost"] },
  { scenarioId: "the-battle-of-carn-dum", names: ["dum-lost"] },
  { scenarioId: "the-dread-realm", names: ["realm-lost"] },
  { scenarioId: "the-hunt-for-gollum", kind: "standalone", names: ["gollum-lost"] },
  { scenarioId: "conflict-at-the-carrock", kind: "standalone", names: ["carrock-lost"] },
  { scenarioId: "a-journey-to-rhosgobel", kind: "standalone", names: ["rhosgobel-lost"] },
  { scenarioId: "the-hills-of-emyn-muil", kind: "standalone", names: ["muil-lost"] },
  { scenarioId: "the-dead-marshes", kind: "standalone", names: ["deadmarshes-won", "deadmarshes-lost"] },
  { scenarioId: "return-to-mirkwood", kind: "standalone", names: ["returnmirkwood-lost"] },
  { scenarioId: "into-the-pit", kind: "standalone", names: ["pit-lost"] },
  { scenarioId: "the-seventh-level", kind: "standalone", names: ["level-lost"] },
  { scenarioId: "flight-from-moria", kind: "standalone", names: ["frommoria-lost"] },
  { scenarioId: "the-redhorn-gate", kind: "standalone", names: ["gate-lost"] },
  { scenarioId: "road-to-rivendell", kind: "standalone", names: ["rivendell-lost"] },
  { scenarioId: "the-watcher-in-the-water", kind: "standalone", names: ["water-won", "water-lost"] },
  { scenarioId: "the-long-dark", kind: "standalone", names: ["dark-won", "dark-lost"] },
  { scenarioId: "foundations-of-stone", kind: "standalone", names: ["stone-lost"] },
  { scenarioId: "shadow-and-flame", kind: "standalone", names: ["flame-lost"] },
  { scenarioId: "the-massing-at-osgiliath", kind: "standalone", names: ["osgiliath-lost"] },
  { scenarioId: "the-battle-of-lake-town", kind: "standalone", names: ["town-lost"] },
  { scenarioId: "the-stone-of-erech", kind: "standalone", names: ["erech-lost"] },
  { scenarioId: "the-old-forest", kind: "standalone", names: ["forest-lost"] },
  { scenarioId: "fog-on-the-barrow-downs", kind: "standalone", names: ["downs-lost"] },
  { scenarioId: "the-ruins-of-belegost", kind: "standalone", names: ["belegost-lost"] },
  { scenarioId: "murder-at-the-prancing-pony", kind: "standalone", names: ["pony-lost"] },
  { scenarioId: "the-siege-of-annuminas", kind: "standalone", names: ["annuminas-lost"] },
  { scenarioId: "attack-on-dol-guldur", kind: "standalone", names: ["guldur-lost"] },
  { scenarioId: "the-wizards-quest", kind: "standalone", names: ["quest-lost"] },
  { scenarioId: "the-woodland-realm", kind: "standalone", names: ["woodland-lost"] },
  { scenarioId: "the-mines-of-moria", kind: "standalone", names: ["mines-lost"] },
  { scenarioId: "escape-from-khazad-dum", kind: "standalone", names: ["khazad-lost"] },
  { scenarioId: "the-hunt-for-the-dreadnaught", kind: "standalone", names: ["dreadnaught-lost"] },
  { scenarioId: "peril-in-pelargir", kind: "standalone", names: ["pelargir-lost"] },
  { scenarioId: "into-ithilien", kind: "standalone", names: ["ithilien-lost"] },
  { scenarioId: "the-siege-of-cair-andros", kind: "standalone", names: ["andros-lost"] },
  { scenarioId: "the-stewards-fear", kind: "standalone", names: ["fear-lost"] },
  { scenarioId: "the-druadan-forest", kind: "standalone", names: ["druadan-lost"] },
  { scenarioId: "encounter-at-amon-din", kind: "standalone", names: ["din-lost"] },
  { scenarioId: "assault-on-osgiliath", kind: "standalone", names: ["assault-lost"] },
  { scenarioId: "the-blood-of-gondor", kind: "standalone", names: ["blood-lost"] },
  { scenarioId: "the-morgul-vale", kind: "standalone", names: ["vale-lost"] },
  { scenarioId: "we-must-away-ere-break-of-day", kind: "standalone", names: ["day-lost"] },
  { scenarioId: "over-the-misty-mountains-grim", kind: "standalone", names: ["grim-lost"] },
  { scenarioId: "dungeons-deep-and-caverns-dim", kind: "standalone", names: ["dim-lost"] },
  { scenarioId: "flies-and-spiders", kind: "standalone", names: ["spiders-lost"] },
  { scenarioId: "the-lonely-mountain", kind: "standalone", names: ["mountain-lost"] },
  { scenarioId: "the-battle-of-five-armies", kind: "standalone", names: ["armies-lost"] },
  { scenarioId: "the-fords-of-isen", kind: "standalone", names: ["isen-lost"] },
  { scenarioId: "to-catch-an-orc", kind: "standalone", names: ["orc-lost"] },
  { scenarioId: "into-fangorn", kind: "standalone", names: ["fangorn-lost"] },
] as const satisfies readonly { scenarioId: string; file?: string; kind?: "standalone"; names: readonly string[] }[];

// The entries as plain data, for code that reads `kind` and `file` whichever entries carry them.
type EntryShape = { scenarioId: string; file?: string; kind?: "standalone"; names: readonly string[] };
const ENTRIES: readonly EntryShape[] = FIXTURE_REGISTRY;

/** The fixture a name is: a campaign save, or (a scenario of a cycle) one open standalone game. */
export function fixtureKindOf(name: string): "campaign" | "standalone" {
  return ENTRIES.some((entry) => entry.kind === "standalone" && entry.names.includes(name)) ? "standalone" : "campaign";
}

export type FixtureScenarioId = (typeof FIXTURE_REGISTRY)[number]["scenarioId"];
export type FixtureName = (typeof FIXTURE_REGISTRY)[number]["names"][number];

export type FixtureEntry = { scenarioId: FixtureScenarioId; file?: string; names: readonly FixtureName[] };

/** The JSON file's name (without `.json`) under src/campaign/fixtures/. */
export function fixtureFile(entry: FixtureEntry): string {
  return entry.file ?? entry.scenarioId;
}
