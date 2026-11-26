// Rules: rr.reveal, rr.forced, rm.parallel-stages (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, resolve, threat, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Nîn-in-Eilph (the-ring-maker part 7): the When Revealed of each stage 2, a row each. The lines that need a random stage, the time counters or a longer play (Time X, the last-counter advance, the defeat advance) are line specs in
// stages.test.ts, and the encounter cards and the Marsh-dweller are scene tests in cards.test.ts and engine.test.ts.
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
const stageTwo = (code: string): Omit<Row, "line"> => ({
  name: "When Revealed: Raise each player's threat by 1",
  layout: { stage: code, side: "A", seats: 2, threat: [28, 30] },
  act: resolve(code, "whenRevealed"),
  expect: [threat(29), threat(31, 1)],
});

const ROWS: readonly Row[] = [{ line: "08095:A:1", ...stageTwo("08095") }, { line: "08096:A:1", ...stageTwo("08096") }, { line: "08097:A:1", ...stageTwo("08097") }];

if (ROWS.length > 0) cardSpecs("the-nin-in-eilph", ROWS);
else describe("the-nin-in-eilph card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
