// The Maestro save fixtures, by scenario (docs/architecture.md, Tests). Adding a fixture name is a line here; a new scenario
// adds its line, its JSON import in ../fixtures.ts (Metro needs static imports) and its writer in `e2e/fixtures.ts` in the scripts folder.
// FixtureName, FIXTURE_NAMES and STORED in ../fixtures.ts, the e2e fixtures script and the per-scenario checks
// in ../fixtures.test.ts all read it. `file` is the JSON file's name when it is not the scenario id.
//
// A name that is not committed is open (docs/phases/STATUS.md): `hasFixture` says so, and the e2e route offers only the
// committed ones. The scenario's JSON holds the saves; each is a real loadout, a seed and the intents that reach the moment
// (`won`, `lost` and `duo` are scenario 1 from an empty log; `knife-lost` starts from the log `won` writes; the rest are
// two-handed games of one scenario, parked on its win or loss, and a part after the first starts from the log the earlier
// parts' wins write). The names with `showcase` are the README's captures (docs/showcase.md), parked on a full table.
export const FIXTURE_REGISTRY = [
  { scenarioId: "a-shadow-of-the-past", file: "scenario-1", names: ["won", "lost", "duo", "past-showcase-board", "past-showcase-quest", "past-showcase-combat"] },
  { scenarioId: "a-knife-in-the-dark", names: ["knife-lost"] },
  { scenarioId: "passage-through-mirkwood", names: ["mirkwood-won", "mirkwood-lost"] },
  { scenarioId: "journey-along-the-anduin", names: ["anduin-won", "anduin-lost"] },
  { scenarioId: "escape-from-dol-guldur", names: ["dol-guldur-won", "dol-guldur-lost"] },
  { scenarioId: "the-oath", names: ["oath-won", "oath-lost"] },
  { scenarioId: "the-caves-of-nibin-dum", names: ["nibin-dum-won", "nibin-dum-lost"] },
  { scenarioId: "voyage-across-belegaer", names: ["sea-solo", "sea-duo", "voyage-won", "voyage-lost", "sea-showcase"] },
  { scenarioId: "the-fate-of-numenor", names: ["fate-won", "fate-lost"] },
  { scenarioId: "raid-on-the-grey-havens", names: ["raid-won", "raid-lost"] },
  { scenarioId: "flight-of-the-stormcaller", names: ["stormcaller-won", "stormcaller-lost"] },
  { scenarioId: "the-thing-in-the-depths", names: ["depths-won", "depths-lost"] },
  { scenarioId: "temple-of-the-deceived", names: ["temple-won", "temple-lost"] },
  { scenarioId: "the-drowned-ruins", names: ["ruins-won", "ruins-lost"] },
  { scenarioId: "a-storm-on-cobas-haven", names: ["haven-won", "haven-lost"] },
  { scenarioId: "the-city-of-corsairs", names: ["corsairs-won", "corsairs-lost"] },
  { scenarioId: "journey-up-the-anduin", names: ["upanduin-won", "upanduin-lost"] },
  { scenarioId: "lost-in-mirkwood", names: ["lostmirk-won", "lostmirk-lost"] },
  { scenarioId: "the-kings-quest", names: ["kingsquest-won", "kingsquest-lost"] },
  { scenarioId: "the-withered-heath", names: ["heath-won", "heath-lost"] },
  { scenarioId: "roam-across-rhovanion", names: ["rhovanion-won", "rhovanion-lost"] },
  { scenarioId: "fire-in-the-night", names: ["night-won", "night-lost"] },
  { scenarioId: "the-ghost-of-framsburg", names: ["framsburg-won", "framsburg-lost"] },
  { scenarioId: "mount-gundabad", names: ["gundabad-won", "gundabad-lost"] },
  { scenarioId: "the-fate-of-wilderland", names: ["wilderland-won", "wilderland-lost"] },
  { scenarioId: "the-uruk-hai", names: ["hai-won", "hai-lost"] },
  { scenarioId: "helms-deep", names: ["deep-won", "deep-lost", "deep-showcase"] },
  { scenarioId: "the-road-to-isengard", names: ["isengard-won", "isengard-lost"] },
  { scenarioId: "the-passage-of-the-marshes", names: ["marshes-won", "marshes-lost"] },
  { scenarioId: "journey-to-the-cross-roads", names: ["roads-won", "roads-lost"] },
  { scenarioId: "shelobs-lair", names: ["lair-won", "lair-lost"] },
  { scenarioId: "the-passing-of-the-grey-company", names: ["company-won", "company-lost"] },
  { scenarioId: "the-siege-of-gondor", names: ["gondor-won", "gondor-lost"] },
  { scenarioId: "the-battle-of-the-pelennor-fields", names: ["fields-won", "fields-lost"] },
  { scenarioId: "the-tower-of-cirith-ungol", names: ["ungol-won", "ungol-lost"] },
  { scenarioId: "the-black-gate-opens", names: ["opens-won", "opens-lost"] },
] as const satisfies readonly { scenarioId: string; file?: string; names: readonly string[] }[];

export type FixtureScenarioId = (typeof FIXTURE_REGISTRY)[number]["scenarioId"];
export type FixtureName = (typeof FIXTURE_REGISTRY)[number]["names"][number];

export type FixtureEntry = { scenarioId: FixtureScenarioId; file?: string; names: readonly FixtureName[] };

/** The JSON file's name (without `.json`) under src/campaign/fixtures/. */
export function fixtureFile(entry: FixtureEntry): string {
  return entry.file ?? entry.scenarioId;
}
