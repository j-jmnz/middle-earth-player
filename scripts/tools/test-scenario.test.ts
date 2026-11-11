import { describe, expect, it } from "vitest";

import { changedFamilyTests, hasReaderGames, quickParts, registryTitle, scenarioTests, selectTests, smokeRuns } from "./test-scenario.ts";

// pnpm test scenario <id>: the selection is a pure function of the id, the changed paths and the tree of test files.
const TREE = [
  "src/campaign/scenarios/the-oath/golden.test.ts",
  "src/campaign/scenarios/the-oath/quest.test.ts",
  "src/campaign/scenarios/the-oath-extra/quest.test.ts",
  "src/play/scenarios/the-oath-table.test.ts",
  "src/play/scenarios/not-the-oath-table.test.ts",
  "src/play/scenarios/grapple-table.test.ts",
  "src/campaign/causes.test.ts",
  "src/campaign/replay.test.ts",
  "src/campaign/fixtures.test.ts",
  "scripts/checks/effect-coverage.test.ts",
  "scripts/checks/effect-migration.test.ts",
  "scripts/checks/layout.test.ts",
  "scripts/checks/spec-coverage.test.ts",
  "scripts/docs/index.test.ts",
  "scripts/checks/maestro.test.ts",
  "src/effects/copies.test.ts",
  "src/effects/effects.test.ts",
  "src/effects/authored/pool/index.test.ts",
  "src/catalog/families/families.test.ts",
  "src/rules/families/grapple/index.test.ts",
  "src/rules/families/sea/index.test.ts",
  "test/harness/golden-registry.test.ts",
  "src/rules/interpret/family-manifest.test.ts",
  "src/rules/interpret/family-hooks.test.ts",
  "src/catalog/verb-sets.test.ts",
  "src/play/store/island-place.test.ts",
  "src/play/choice/stormcaller-sheets.test.ts",
  "src/play/store/unrelated.test.ts",
  "src/play/words/scenarios/sea.test.ts",
  "src/play/words/the-oath.test.ts",
];
const SOURCES: Record<string, string> = {
  "src/play/store/island-place.test.ts": 'import { templeTable } from "../../../test/scenarios/temple-of-the-deceived/scene.ts";',
  "src/play/choice/stormcaller-sheets.test.ts": 'import {\n  flightTable,\n} from "../../../test/scenarios/flight-of-the-stormcaller/scene.ts";\nconst note = "the-oath";',
  "src/play/store/unrelated.test.ts": '// test/scenarios/temple-of-the-deceived/ is only named here\nimport { x } from "./x.ts";',
};
const read = (file: string) => SOURCES[file] ?? "";

describe("scenarioTests", () => {
  it("takes a folder named for the id and files that start with it, nothing that only contains it", () => {
    expect(scenarioTests("the-oath", TREE, read)).toEqual(["src/campaign/scenarios/the-oath/golden.test.ts", "src/campaign/scenarios/the-oath/quest.test.ts", "src/play/scenarios/the-oath-table.test.ts", "src/play/words/the-oath.test.ts"]);
  });

  it("also takes the tests that import from the scenario's test or campaign folder, whatever they are called", () => {
    expect(scenarioTests("temple-of-the-deceived", TREE, read)).toEqual(["src/play/store/island-place.test.ts"]);
    expect(scenarioTests("flight-of-the-stormcaller", TREE, read)).toEqual(["src/play/choice/stormcaller-sheets.test.ts"]);
  });
});

describe("changedFamilyTests", () => {
  it("is empty when no pool or family file changed", () => {
    expect(changedFamilyTests(["src/play/table.ts", "src/effects/authored/the-oath.ts"], TREE)).toEqual([]);
  });

  it("adds the effects tests, the manifest test and the tests of each changed family", () => {
    expect(changedFamilyTests(["src/rules/families/sea/stages.ts", "src/catalog/families/grapple.ts"], TREE)).toEqual([
      "src/effects/copies.test.ts",
      "src/effects/effects.test.ts",
      "src/effects/authored/pool/index.test.ts",
      "src/catalog/families/families.test.ts",
      "src/rules/interpret/family-manifest.test.ts",
      "src/rules/interpret/family-hooks.test.ts",
      "src/catalog/verb-sets.test.ts",
      "src/rules/families/grapple/index.test.ts",
      "src/rules/families/sea/index.test.ts",
    ]);
  });

  it("treats the hook, manifest and setup files as family files", () => {
    for (const file of ["src/rules/interpret/family-hooks.ts", "src/rules/interpret/family-manifest.ts", "src/catalog/family-manifest.ts", "src/catalog/verb-flags.ts", "src/catalog/verb-sets.ts", "src/catalog/effect-schema-verbs.ts"]) {
      expect(changedFamilyTests([file], TREE), file).toEqual(expect.arrayContaining(["src/rules/interpret/family-manifest.test.ts", "src/rules/interpret/family-hooks.test.ts", "src/catalog/verb-sets.test.ts"]));
    }
    expect(changedFamilyTests(["src/catalog/verb-sets.ts"], TREE).some((file) => file.startsWith("src/rules/families/"))).toBe(false);
    expect(changedFamilyTests(["src/rules/interpret/family-hooks.ts"], TREE)).toContain("src/rules/families/sea/index.test.ts");
  });

  it("runs every family for a file that names none, and none for a pool file", () => {
    expect(changedFamilyTests(["src/rules/families/index.ts"], TREE)).toContain("src/rules/families/sea/index.test.ts");
    expect(changedFamilyTests(["src/effects/authored/pool/Core.ts"], TREE).some((file) => file.startsWith("src/rules/families/"))).toBe(false);
  });
});

describe("registryTitle", () => {
  it("reads the title of the id's entry, or null", () => {
    const source = '  entry("the-oath", "The Oath", oath.OATH_GOLDENS, oath.oathWorld, oath.playGolden),';
    expect(registryTitle("the-oath", source)).toBe("The Oath");
    expect(registryTitle("the-fate-of-numenor", source)).toBeNull();
  });
});

describe("selectTests", () => {
  it("gathers the parts, and skips the golden tests for a scenario with no registry entry", () => {
    const selected = selectTests("the-oath", [], TREE, "The Oath", read);
    expect(selected.goldens).toEqual({ files: ["src/campaign/causes.test.ts", "src/campaign/replay.test.ts", "src/campaign/fixtures.test.ts"], title: "The Oath" });
    expect(selected.coverage).toEqual(["scripts/checks/effect-coverage.test.ts", "scripts/checks/effect-migration.test.ts", "src/effects/copies.test.ts", "test/harness/golden-registry.test.ts", "scripts/checks/layout.test.ts", "scripts/checks/spec-coverage.test.ts", "scripts/docs/index.test.ts", "scripts/checks/maestro.test.ts", "src/play/words/scenarios/sea.test.ts"]);
    expect(selected.families).toEqual([]);
    expect(selectTests("the-oath", [], TREE, null, read).goldens.files).toEqual([]);
  });

  it("runs the goldens a-shadow-of-the-past has without a registry entry, whole, once", () => {
    expect(selectTests("a-shadow-of-the-past", [], TREE, null, read).goldens).toEqual({ files: ["src/campaign/causes.test.ts", "src/campaign/replay.test.ts"], title: null });
    const imported = (file: string) => (file.startsWith("src/campaign/") ? 'import { campaign } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";' : "");
    const selected = selectTests("a-shadow-of-the-past", [], TREE, null, imported);
    expect(selected.tests).toContain("src/campaign/replay.test.ts");
    expect(selected.goldens.files).toEqual([]);
  });

  it("runs every choice-words test, the scenario's own in tests", () => {
    const selected = selectTests("the-oath", [], TREE, "The Oath", read);
    expect(selected.tests).toContain("src/play/words/the-oath.test.ts");
    expect(selected.coverage).toContain("src/play/words/scenarios/sea.test.ts");
    expect(selected.coverage).not.toContain("src/play/words/the-oath.test.ts");
  });

  it("runs a file once: a coverage test the families would add stays in coverage", () => {
    const selected = selectTests("the-oath", ["src/rules/families/sea/stages.ts"], TREE, "The Oath", read);
    expect(selected.coverage).toContain("src/effects/copies.test.ts");
    expect(selected.families).not.toContain("src/effects/copies.test.ts");
    expect(selected.families).toContain("src/effects/effects.test.ts");
  });
});

describe("the reader parity check (src/play/reader-play.test.ts)", () => {
  const registry = ['  entry("the-oath", "The Oath", oath.OATH_GOLDENS, oath.oathWorld, oath.playGolden),', '  // entry("the-next", "The Next", next.NEXT_GOLDENS, next.nextWorld, next.playGolden),'].join("\n");

  it("plays the first scenario and each scenario with a line in the golden registry, not a commented-out one or an unlisted one", () => {
    expect(hasReaderGames("a-shadow-of-the-past", registry)).toBe(true);
    expect(hasReaderGames("the-oath", registry)).toBe(true);
    expect(hasReaderGames("the-next", registry)).toBe(false);
    expect(hasReaderGames("the-oat", registry)).toBe(false);
  });
});

describe("the card smokes (smokeRuns)", () => {
  it("runs the encounter smoke for every scenario, with or without player cards", () => {
    const withCards = smokeRuns("the-oath", ["141001", "141002"]);
    expect(withCards.map((run) => run.name)).toEqual(["smoke", "encounter"]);
    expect(withCards[0]?.args.slice(-2)).toEqual(["141001", "141002"]);
    const without = smokeRuns("the-oath", []);
    expect(without.map((run) => run.name)).toEqual(["smoke", "encounter"]);
    // The player-card smoke is skipped: no arguments to run.
    expect(without[0]?.args).toEqual([]);
    expect(without[1]?.args.slice(-2)).toEqual(["scripts/card-smoke/encounter.ts", "the-oath"]);
  });
});

describe("quickParts (--quick)", () => {
  const parts = [
    { name: "tests", files: ["src/campaign/scenarios/the-oath/golden.test.ts", "src/campaign/scenarios/the-oath/quest.test.ts"] },
    { name: "goldens", files: ["src/campaign/causes.test.ts", "src/campaign/replay.test.ts"], filter: "The Oath" },
    { name: "coverage", files: ["scripts/checks/effect-coverage.test.ts"] },
    { name: "families", files: [] as string[], note: "no pool, family or manifest file changed" },
    { name: "reader", files: ["src/play/reader-play.test.ts"] },
  ];

  it("is the same parts without --quick", () => {
    expect(quickParts(parts, "the-oath", false)).toEqual(parts);
  });

  it("skips the registry-wide goldens, the reader check and the scenario's own golden test, and says so", () => {
    const quick = quickParts(parts, "the-oath", true);
    const by = (name: string) => quick.find((part) => part.name === name);
    expect(by("goldens")).toMatchObject({ files: [], note: "skipped by --quick" });
    expect(by("reader")).toMatchObject({ files: [], note: "skipped by --quick" });
    expect(by("tests")?.files).toEqual(["src/campaign/scenarios/the-oath/quest.test.ts"]);
    expect(by("tests")?.note).toContain("--quick");
  });

  it("skips the goldens a scenario's tests part reads directly: a-shadow-of-the-past's replay and causes tests", () => {
    const direct = [{ name: "tests", files: ["src/campaign/causes.test.ts", "src/campaign/replay.test.ts", "src/campaign/scenarios/a-shadow-of-the-past/quest.test.ts"] }];
    expect(quickParts(direct, "a-shadow-of-the-past", true)[0]?.files).toEqual(["src/campaign/scenarios/a-shadow-of-the-past/quest.test.ts"]);
    // Another scenario's tests part keeps them: they are its tests, not goldens it skips.
    expect(quickParts(direct, "the-oath", true)[0]?.files).toEqual(direct[0]!.files);
  });

  it("keeps the coverage and family parts, and another scenario's golden test", () => {
    const quick = quickParts(parts, "the-oath-extra", true);
    expect(quick.find((part) => part.name === "coverage")).toEqual(parts[2]);
    expect(quick.find((part) => part.name === "families")).toEqual(parts[3]);
    expect(quick.find((part) => part.name === "tests")).toEqual(parts[0]);
  });
});
