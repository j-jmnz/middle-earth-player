import { describe, expect, it } from "vitest";

import { addedScenarios, branchSince, hasPipelineMeasure, playableIn } from "./pipeline-measure.ts";

// A branch that adds a scenario to PLAYABLE_SCENARIOS records its pipeline measures in a commit body (docs/agents/agent-brief.md, Measure). The commits are read from the merge base with
// origin/main; on main itself the range is empty, and a checkout that cannot reach the merge base (a shallow CI clone) skips the check with a notice.

const LIST = (ids: readonly string[]) => `// the scenarios\nexport const PLAYABLE_SCENARIOS: readonly string[] = [${ids.map((id) => `"${id}"`).join(", ")}];\n\nexport const NIGHTMARE_PLAYABLE: readonly string[] = ["other"];\n`;

describe("pipeline measure: the reading of the commits", () => {
  it("reads the ids of PLAYABLE_SCENARIOS and no other list", () => {
    expect(playableIn(LIST(["a", "b-c"]))).toEqual(["a", "b-c"]);
    expect(playableIn("export const OTHER = [];")).toEqual([]);
  });

  it("finds the scenarios a branch adds, and none for a removal or no change", () => {
    expect(addedScenarios(LIST(["a"]), LIST(["a", "b"]))).toEqual(["b"]);
    expect(addedScenarios(LIST(["a", "b"]), LIST(["a"]))).toEqual([]);
    expect(addedScenarios(LIST(["a"]), LIST(["a"]))).toEqual([]);
  });

  it("finds the Pipeline measure line in a body, at the start of a line only", () => {
    expect(hasPipelineMeasure(["feat: Add a scenario\n\nPipeline measure: open lines 40, templates 12"])).toBe(true);
    expect(hasPipelineMeasure(["feat: Add a scenario\n\nDetails\nPipeline measure:\n- open lines 40"])).toBe(true);
    expect(hasPipelineMeasure(["feat: Add a scenario\n\nThe Pipeline measure: is in the pull request"])).toBe(false);
    expect(hasPipelineMeasure([])).toBe(false);
  });
});

const branch = branchSince();
if (branch === null) console.info("pipeline measure: the merge base with origin/main cannot be found (no origin/main ref, or a shallow checkout), so the commits are not read");

describe("pipeline measure: this branch", () => {
  it.skipIf(branch === null)("has a Pipeline measure line in a commit body when it adds a scenario to PLAYABLE_SCENARIOS", () => {
    const { added = [], bodies = [] } = branch ?? {};
    expect(added.length === 0 || hasPipelineMeasure(bodies), `${added.join(", ")} added to PLAYABLE_SCENARIOS: the last commit of the scenario phase records its \`Pipeline measure:\` (docs/agents/agent-brief.md, Measure)`).toBe(true);
  });
});
