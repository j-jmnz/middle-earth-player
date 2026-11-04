// The Maestro save fixtures, by scenario (docs/architecture.md, Tests). Adding a fixture name is a line here; a new scenario
// adds its line, its JSON import in ../fixtures.ts (Metro needs static imports) and its writer in `e2e/fixtures.ts` in the scripts folder.
// FixtureName, FIXTURE_NAMES and STORED in ../fixtures.ts, the e2e fixtures script and the per-scenario checks
// in ../fixtures.test.ts all read it. `file` is the JSON file's name when it is not the scenario id.
//
// A name that is not committed is open (docs/phases/STATUS.md): `hasFixture` says so, and the e2e route offers only the
// committed ones. The scenario's JSON holds the saves; each is a real loadout, a seed and the intents that reach the moment
// (`won`, `lost` and `duo` are scenario 1 from an empty log; `knife-lost` starts from the log `won` writes; the rest are
// two-handed games of one scenario, parked on its win or loss, and a part after the first starts from the log the earlier
// parts' wins write).
export const FIXTURE_REGISTRY = [
  { scenarioId: "a-shadow-of-the-past", file: "scenario-1", names: ["won", "lost", "duo"] },
  { scenarioId: "a-knife-in-the-dark", names: ["knife-lost"] },
  { scenarioId: "passage-through-mirkwood", names: ["mirkwood-won", "mirkwood-lost"] },
  { scenarioId: "journey-along-the-anduin", names: ["anduin-won", "anduin-lost"] },
  { scenarioId: "escape-from-dol-guldur", names: ["dol-guldur-won", "dol-guldur-lost"] },
  { scenarioId: "the-oath", names: ["oath-won", "oath-lost"] },
  { scenarioId: "the-caves-of-nibin-dum", names: ["nibin-dum-won", "nibin-dum-lost"] },
  { scenarioId: "voyage-across-belegaer", names: ["sea-solo", "sea-duo", "voyage-won", "voyage-lost"] },
  { scenarioId: "the-fate-of-numenor", names: ["fate-won", "fate-lost"] },
  { scenarioId: "raid-on-the-grey-havens", names: ["raid-won", "raid-lost"] },
  { scenarioId: "flight-of-the-stormcaller", names: ["stormcaller-won", "stormcaller-lost"] },
  { scenarioId: "the-thing-in-the-depths", names: ["depths-won", "depths-lost"] },
  { scenarioId: "temple-of-the-deceived", names: ["temple-won", "temple-lost"] },
] as const satisfies readonly { scenarioId: string; file?: string; names: readonly string[] }[];

export type FixtureScenarioId = (typeof FIXTURE_REGISTRY)[number]["scenarioId"];
export type FixtureName = (typeof FIXTURE_REGISTRY)[number]["names"][number];

export type FixtureEntry = { scenarioId: FixtureScenarioId; file?: string; names: readonly FixtureName[] };

export const FIXTURE_ENTRIES: readonly FixtureEntry[] = FIXTURE_REGISTRY;

/** The JSON file's name (without `.json`) under src/campaign/fixtures/. */
export function fixtureFile(entry: FixtureEntry): string {
  return entry.file ?? entry.scenarioId;
}
