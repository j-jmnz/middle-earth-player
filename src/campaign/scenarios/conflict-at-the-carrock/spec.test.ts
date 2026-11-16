// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Conflict at the Carrock (shadows-of-mirkwood part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
// TODO: the rows; the todo below stands in until there is one.
const ROWS: readonly Row[] = [];

if (ROWS.length > 0) cardSpecs("conflict-at-the-carrock", ROWS);
else describe("conflict-at-the-carrock card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
