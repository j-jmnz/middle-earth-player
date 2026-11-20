// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, it } from "vitest";

// What is The Wizard's Quest's own in the standalone game. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
// TODO: turn each into a test once the scenario's records exist.
describe("The Wizard's Quest in the standalone-scenarios cycle", () => {
  it.todo("deals its Nightmare deck on Nightmare when every card of it has a record (src/campaign/playable.ts)");
});
