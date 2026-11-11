import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT, tracked } from "./tracked.ts";

// The test suite's cost stays where it is as scenarios are added (.claude/rules/code-standards.md, Test cost). Whole games are the
// expensive part, so a golden game is played once, in its scenario's golden.test.ts; everything else reads its final state from
// golden.json (test/harness/golden-state.ts). The lists below hold what is there today: an entry may not grow, and an entry that is
// back to nothing (or under the limit) is stale and goes.

const files = tracked();
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");

// Test files, other than the golden tests, that still play a scenario's goldens (each mention of `playGolden`, its import included).
// A new file plays none: it reads a golden's final state with `goldenState`, or builds the table it needs with the scene kit.
const REPLAYS: Readonly<Record<string, number>> = {
  "src/campaign/scenarios/a-storm-on-cobas-haven/campaign.test.ts": 2,
  "src/campaign/scenarios/breaking-of-the-fellowship/campaign.test.ts": 3,
  "src/campaign/scenarios/escape-from-dol-guldur/campaign.test.ts": 6,
  "src/campaign/scenarios/flight-of-the-stormcaller/campaign.test.ts": 2,
  "src/campaign/scenarios/flight-to-the-ford/campaign.test.ts": 4,
  "src/campaign/scenarios/helms-deep/campaign.test.ts": 3,
  "src/campaign/scenarios/journey-along-the-anduin/campaign.test.ts": 2,
  "src/campaign/scenarios/journey-in-the-dark/campaign.test.ts": 3,
  "src/campaign/scenarios/lost-in-mirkwood/campaign.test.ts": 2,
  "src/campaign/scenarios/passage-through-mirkwood/campaign.test.ts": 2,
  "src/campaign/scenarios/raid-on-the-grey-havens/campaign.test.ts": 3,
  "src/campaign/scenarios/the-caves-of-nibin-dum/campaign.test.ts": 7,
  "src/campaign/scenarios/the-caves-of-nibin-dum/resolution.test.ts": 3,
  "src/campaign/scenarios/the-city-of-corsairs/campaign.test.ts": 2,
  "src/campaign/scenarios/the-fate-of-numenor/campaign.test.ts": 3,
  "src/campaign/scenarios/the-ring-goes-south/campaign.test.ts": 3,
  "src/campaign/scenarios/the-road-to-isengard/campaign.test.ts": 5,
  "src/campaign/scenarios/voyage-across-belegaer/campaign.test.ts": 3,
};

// The files that may import the golden registry: its own test and the reader check. A test that loops over the registry plays every
// scenario's goldens again; a check on golden games goes in test/harness/golden-suite.ts, which runs it on the games it has played.
const REGISTRY_IMPORTERS = ["test/harness/golden-registry.test.ts", "src/play/reader-play/games.ts"];

// A scenario's goldens hold at most MOST_INTENTS intents in all: a few wins and a loss for each way to lose, not every seed and option.
// The scenarios over it today are listed at their count, with SLACK for an engine change that moves their games; a new golden there
// does not fit.
const MOST_INTENTS = 3000;
const SLACK = 1.1;
const OVER_INTENTS: Readonly<Record<string, number>> = {
  "fire-in-the-night": 5195,
  "mount-gundabad": 9480,
  "roam-across-rhovanion": 9749,
  "temple-of-the-deceived": 3871,
  "the-city-of-corsairs": 4120,
  "the-fate-of-numenor": 5541,
  "the-fate-of-wilderland": 5064,
  "the-ghost-of-framsburg": 11173,
  "the-thing-in-the-depths": 3031,
  "the-withered-heath": 8001,
};

const isTest = (file: string): boolean => file.endsWith(".test.ts") && (file.startsWith("src/") || file.startsWith("test/"));
const replays = new Map(files.filter((file) => isTest(file) && !file.endsWith("/golden.test.ts")).map((file) => [file, read(file).match(/\bplayGolden\b/g)?.length ?? 0]));
const intents = new Map(
  files
    .filter((file) => /^src\/campaign\/scenarios\/[^/]+\/golden\.json$/.test(file))
    .map((file) => [file.split("/")[3] ?? "", (JSON.parse(read(file)) as { intents?: unknown[] }[]).reduce((sum, golden) => sum + (golden.intents?.length ?? 0), 0)]),
);

describe("test cost", () => {
  it("plays a scenario's goldens only in its golden test, the listed files at their count", () => {
    const over = [...replays].filter(([file, count]) => count > (REPLAYS[file] ?? 0)).map(([file, count]) => `${file}: playGolden ${count} times, at most ${REPLAYS[file] ?? 0} (read the state with goldenState)`);
    expect(over).toEqual([]);
  });

  it("lists in REPLAYS only files that still play goldens, at their count", () => {
    const loose = Object.entries(REPLAYS).filter(([file, count]) => (replays.get(file) ?? 0) !== count).map(([file, count]) => `${file}: ${replays.get(file) ?? 0}, listed at ${count}`);
    expect(loose, "lower or remove the entry").toEqual([]);
  });

  it("never plays another scenario's goldens in a scenario's game: the earlier parts' log comes from golden.json", () => {
    const chained = files.filter((file) => /^test\/scenarios\/[^/]+\/game\.ts$/.test(file) && /\bplayGolden as\b/.test(read(file)));
    expect(chained).toEqual([]);
  });

  it("imports the golden registry only where it may", () => {
    const importers = files.filter((file) => /\.tsx?$/.test(file) && /from\s+"[^"]*golden-registry\.ts"/.test(read(file)));
    expect(importers.filter((file) => !REGISTRY_IMPORTERS.includes(file))).toEqual([]);
  });

  it(`keeps each scenario's goldens to ${MOST_INTENTS} intents in all, the listed ones near their count`, () => {
    const over = [...intents].filter(([id, count]) => count > (OVER_INTENTS[id] ? Math.floor(OVER_INTENTS[id] * SLACK) : MOST_INTENTS)).map(([id, count]) => `${id}: ${count} intents`);
    expect(over).toEqual([]);
  });

  it("lists in OVER_INTENTS only scenarios still over the limit", () => {
    const stale = Object.keys(OVER_INTENTS).filter((id) => (intents.get(id) ?? 0) <= MOST_INTENTS);
    expect(stale, "remove the entry").toEqual([]);
  });
});
