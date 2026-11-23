import { describe, expect, it } from "vitest";

import { rangeProblems, reviewedFiles } from "./range-rules.ts";

// What a whole branch's commits must hold (scripts/git/range-rules.ts): a `Reviewed:` line when engine or record code changed (docs/agents/card-audit.md, Fix and review) and a
// `Pipeline measure:` line when a scenario became playable (docs/agents/agent-brief.md, Measure).

const LIST = (ids: readonly string[]) => `export const PLAYABLE_SCENARIOS: readonly string[] = [${ids.map((id) => `"${id}"`).join(", ")}];\n`;
const SAME = { base: LIST(["a"]), head: LIST(["a"]) };

describe("the files a review must have read", () => {
  it("are the engine and the authored records, not their tests, the generated records, the docs or the scripts", () => {
    expect(
      reviewedFiles(["src/rules/player/potential.ts", "src/rules/player/potential.test.ts", "src/effects/authored/pool/HoN.ts", "src/effects/generated/player-pool.ts", "docs/brief.md", "scripts/checks/tracked.ts", "src/campaign/scenarios/the-oath/golden.json"]),
    ).toEqual(["src/rules/player/potential.ts", "src/effects/authored/pool/HoN.ts"]);
  });
});

describe("what a branch's commits must hold", () => {
  it("asks for a Reviewed line when engine or record code changed, at the start of a line and with what was looked at", () => {
    const changed = ["src/rules/core/zones.ts"];
    expect(rangeProblems({ changed, bodies: ["fix: Announce every attachment that leaves play\n\nBody."], playable: SAME })).toHaveLength(1);
    expect(rangeProblems({ changed, bodies: ["fix: One\n\nBody.", "fix: Two\n\nReviewed: reviewer agent on the whole diff, moveCard's callers first"], playable: SAME })).toEqual([]);
    expect(rangeProblems({ changed, bodies: ["fix: One\n\nIt was Reviewed: yes"], playable: SAME })).toHaveLength(1);
    expect(rangeProblems({ changed, bodies: ["fix: One\n\nReviewed: yes"], playable: SAME })).toHaveLength(1);
  });

  it("asks for nothing when only tests, docs, data or scripts changed", () => {
    expect(rangeProblems({ changed: ["src/rules/core/zones.test.ts", "docs/brief.md", "data/printed/player-cards.json"], bodies: ["repo: Test a line"], playable: SAME })).toEqual([]);
  });

  it("asks for a Pipeline measure line when a scenario became playable", () => {
    const playable = { base: LIST(["a"]), head: LIST(["a", "b"]) };
    expect(rangeProblems({ changed: [], bodies: ["feat: Add b"], playable })).toHaveLength(1);
    expect(rangeProblems({ changed: [], bodies: ["feat: Add b\n\nPipeline measure: open lines 40"], playable })).toEqual([]);
  });
});
