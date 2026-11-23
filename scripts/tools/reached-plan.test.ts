import { describe, expect, it } from "vitest";

import { cardOf, gameTests, kindOf, notRun, planReached, plannedFiles, relatedSeeds, type ReachInput } from "./reached-plan.ts";

// pnpm test reached: which tests a change selects, from the changed files, the records that moved and what the scenarios deal.
const tree = [
  "src/campaign/fixtures.test.ts",
  "src/campaign/scenarios/helms-deep/golden.test.ts",
  "src/campaign/scenarios/the-uruk-hai/golden.test.ts",
  "src/effects/card-text.test.ts",
  "src/rules/core/state.test.ts",
  "scripts/card-smoke/suite-1.test.ts",
  "scripts/card-smoke/encounter-sweep-1.test.ts",
  "scripts/checks/agent-docs.test.ts",
  "scripts/docs/index.test.ts",
  "scripts/data/build.test.ts",
  "scripts/tools/other.test.ts",
];
const base: ReachInput = {
  changed: [],
  tree,
  related: [],
  moved: null,
  sources: { "src/effects/card-text.test.ts": 'it("01234:A:1 draws a card", () => {});' },
  deals: { "helms-deep": new Set(["01234", "09999"]), "the-uruk-hai": new Set(["07777"]) },
  smokeable: new Set(["05555"]),
  registrySource: 'entry("helms-deep", "Helm\'s Deep", x)',
};

describe("test reached", () => {
  it("sorts a changed file into the kind that decides what runs", () => {
    expect(kindOf("src/effects/authored/helms-deep.ts")).toBe("records");
    expect(kindOf("src/rules/core/state.ts")).toBe("engine");
    expect(kindOf("src/rules/core/state.test.ts")).toBe("other");
    expect(kindOf("src/catalog/version.ts")).toBe("other");
    expect(kindOf("src/effects/generated/records.ts")).toBe("data");
    expect(kindOf("docs/brief.md")).toBe("docs");
    expect(kindOf("package.json")).toBe("config");
    expect(kindOf("src/play/table.tsx")).toBe("other");
  });

  it("asks vitest about every changed file that is not a record, a doc or gone", () => {
    const changed = ["src/effects/authored/a.ts", "docs/a.md", "src/rules/core/state.ts", "src/rules/gone.ts"];
    expect(relatedSeeds(changed, (file) => file !== "src/rules/gone.ts")).toEqual(["src/rules/core/state.ts"]);
    expect(cardOf("01026:action:1")).toBe("01026");
  });

  it("takes the golden test and the encounter smoke of a scenario that deals a moved record's card, and the tests that name it", () => {
    const plan = planReached({ ...base, changed: ["src/effects/authored/helms-deep.ts"], moved: { records: ["01234:action:1"], lines: ["01234:A:1"] } });
    expect(plan.scenarios).toEqual([{ id: "helms-deep", codes: ["01234"] }]);
    expect([...plan.whole.keys()]).toEqual(["src/campaign/scenarios/helms-deep/golden.test.ts"]);
    expect(plan.titled.map((one) => one.file)).toEqual(["src/effects/card-text.test.ts"]);
    expect(plan.fixtureTitles).toEqual(["Helm's Deep"]);
    expect(plan.encounter).toEqual(["helms-deep"]);
    expect(plan.games).toBeNull();
    expect(plannedFiles(plan).size).toBe(3);
  });

  it("plays a moved player card in the card smoke, and names a card nothing plays", () => {
    const plan = planReached({ ...base, changed: ["src/effects/authored/x.ts"], moved: { records: ["05555:action:1", "08888:forced:1"], lines: [] } });
    expect(plan.smoke).toEqual(["05555"]);
    expect(plan.unplaced).toEqual(["08888"]);
    expect(plan.scenarios).toEqual([]);
  });

  it("falls back to every golden test and smoke shard for engine code, and says why", () => {
    const plan = planReached({ ...base, changed: ["src/rules/core/state.ts"], related: ["src/rules/core/state.test.ts"] });
    expect(plan.games).toContain("engine code changed");
    expect([...plan.whole.keys()].sort()).toEqual([...gameTests(tree), "src/rules/core/state.test.ts"].sort());
    expect(plan.encounter).toEqual([]);
    expect(plan.dataCheck).toBe(false);
  });

  it("selects the doc checks for a doc, the data tests and the data check for data, and everything for a configuration file", () => {
    expect([...planReached({ ...base, changed: ["docs/brief.md"] }).whole.keys()].sort()).toEqual(["scripts/checks/agent-docs.test.ts", "scripts/docs/index.test.ts"]);
    const data = planReached({ ...base, changed: ["data/cards/x.json"] });
    expect([...data.whole.keys()]).toEqual(["scripts/data/build.test.ts"]);
    expect(data.dataCheck).toBe(true);
    expect(data.games).toBeNull();
    expect(planReached({ ...base, changed: ["data/scenarios/x.json"] }).games).toContain("generated records or scenarios");
    const all = planReached({ ...base, changed: ["vitest.config.mts"] });
    expect(all.everything).toBe(true);
    expect(all.whole.size).toBe(tree.length);
  });

  it("counts what it leaves out by folder", () => {
    const left = notRun(tree, new Set(["scripts/tools/other.test.ts", "scripts/docs/index.test.ts"]));
    expect(left.count).toBe(tree.length - 2);
    expect(left.groups[0]).toEqual(["scenario golden tests", 2]);
  });
});
