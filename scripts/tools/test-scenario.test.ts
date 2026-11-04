import { describe, expect, it } from "vitest";

import { changedFamilyTests, registryTitle, scenarioTests, selectTests } from "./test-scenario.ts";

// pnpm test:scenario <id>: the selection is a pure function of the id, the changed paths and the tree of test files.
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
  "src/effects/copies.test.ts",
  "src/effects/effects.test.ts",
  "src/effects/authored/pool/index.test.ts",
  "src/catalog/families/families.test.ts",
  "src/rules/families/grapple/index.test.ts",
  "src/rules/families/sea/index.test.ts",
  "test/harness/golden-registry.test.ts",
];

describe("scenarioTests", () => {
  it("takes a folder named for the id and files that start with it, nothing that only contains it", () => {
    expect(scenarioTests("the-oath", TREE)).toEqual(["src/campaign/scenarios/the-oath/golden.test.ts", "src/campaign/scenarios/the-oath/quest.test.ts", "src/play/scenarios/the-oath-table.test.ts"]);
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
      "src/rules/families/grapple/index.test.ts",
      "src/rules/families/sea/index.test.ts",
    ]);
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
    const selected = selectTests("the-oath", [], TREE, "The Oath");
    expect(selected.goldens).toEqual({ files: ["src/campaign/causes.test.ts", "src/campaign/replay.test.ts", "src/campaign/fixtures.test.ts"], title: "The Oath" });
    expect(selected.coverage).toHaveLength(4);
    expect(selected.families).toEqual([]);
    expect(selectTests("the-oath", [], TREE, null).goldens.files).toEqual([]);
  });
});
