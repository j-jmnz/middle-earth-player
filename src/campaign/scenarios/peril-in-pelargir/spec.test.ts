// Rules: TODO name the rule ids the rows exercise (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Peril in Pelargir (against-the-shadow part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// TODO: the rows; the todo below stands in until there is one.
const ROWS: readonly Row[] = [];

if (ROWS.length > 0) cardSpecs("peril-in-pelargir", ROWS);
else describe("peril-in-pelargir card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
