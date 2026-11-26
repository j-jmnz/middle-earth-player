// Rules: TODO name the rule ids the scenario implements (data/rules/entries.json).
import { describe, it } from "vitest";

// What is Trouble in Tharbad's own in the standalone game. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
// TODO: turn each into a test once the scenario's records exist.
describe("Trouble in Tharbad in the the-ring-maker cycle", () => {
  it.todo("deals its Nightmare deck on Nightmare when every card of it has a record (src/campaign/playable.ts)");
});
