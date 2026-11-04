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
  "src/rules/interpret/family-manifest.test.ts",
  "src/rules/interpret/family-hooks.test.ts",
  "src/catalog/setup-verbs.test.ts",
  "src/play/store/island-place.test.ts",
  "src/play/choice/stormcaller-sheets.test.ts",
  "src/play/store/unrelated.test.ts",
];
const SOURCES: Record<string, string> = {
  "src/play/store/island-place.test.ts": 'import { templeTable } from "../../../test/scenarios/temple-of-the-deceived/scene.ts";',
  "src/play/choice/stormcaller-sheets.test.ts": 'import {\n  flightTable,\n} from "../../../test/scenarios/flight-of-the-stormcaller/scene.ts";\nconst note = "the-oath";',
  "src/play/store/unrelated.test.ts": '// test/scenarios/temple-of-the-deceived/ is only named here\nimport { x } from "./x.ts";',
};
const read = (file: string) => SOURCES[file] ?? "";

describe("scenarioTests", () => {
  it("takes a folder named for the id and files that start with it, nothing that only contains it", () => {
    expect(scenarioTests("the-oath", TREE, read)).toEqual(["src/campaign/scenarios/the-oath/golden.test.ts", "src/campaign/scenarios/the-oath/quest.test.ts", "src/play/scenarios/the-oath-table.test.ts"]);
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
      "src/catalog/setup-verbs.test.ts",
      "src/rules/families/grapple/index.test.ts",
      "src/rules/families/sea/index.test.ts",
    ]);
  });

  it("treats the hook, manifest and setup files as family files", () => {
    for (const file of ["src/rules/interpret/family-hooks.ts", "src/rules/interpret/family-manifest.ts", "src/catalog/family-manifest.ts", "src/catalog/setup-role.ts", "src/catalog/setup-verbs.ts", "src/catalog/effect-schema-verbs.ts"]) {
      expect(changedFamilyTests([file], TREE), file).toEqual(expect.arrayContaining(["src/rules/interpret/family-manifest.test.ts", "src/rules/interpret/family-hooks.test.ts", "src/catalog/setup-verbs.test.ts"]));
    }
    expect(changedFamilyTests(["src/catalog/setup-verbs.ts"], TREE).some((file) => file.startsWith("src/rules/families/"))).toBe(false);
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
    expect(selected.coverage).toHaveLength(4);
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

  it("runs a file once: a coverage test the families would add stays in coverage", () => {
    const selected = selectTests("the-oath", ["src/rules/families/sea/stages.ts"], TREE, "The Oath", read);
    expect(selected.coverage).toContain("src/effects/copies.test.ts");
    expect(selected.families).not.toContain("src/effects/copies.test.ts");
    expect(selected.families).toContain("src/effects/effects.test.ts");
  });
});
