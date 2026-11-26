// Rules: rm.time-x (data/rules/entries.json). One table says what the last time counter does on each of the eight time stages: the dial's note and warning and the Choose's caution all read it.
import { describe, expect, it } from "vitest";

import { FORDS_STAGES } from "../../../readouts/ring-maker/fords.ts";
import { lastCounterWords, stageTimeNearWords, stageTimeWords } from "./fords-table.ts";

describe("what the last time counter does", () => {
  it("names a sentence for every stage with a time dial, and none for another card", () => {
    expect(FORDS_STAGES).toHaveLength(10);
    for (const code of FORDS_STAGES) expect(lastCounterWords(code), code).toMatch(/\.$/);
    expect(lastCounterWords("07058")).toBeNull();
  });

  it("puts that sentence after the count on the dial's note and, with the last counter near, on its warning", () => {
    for (const code of FORDS_STAGES) {
      const last = lastCounterWords(code) ?? "";
      expect(stageTimeWords(code, 3), code).toContain(`With the last gone, ${last}`);
      expect(stageTimeNearWords(code, 1), code).toContain(`With the last gone, ${last}`);
      expect(stageTimeNearWords(code, 0), code).toContain(last);
      expect(stageTimeNearWords(code, 2), code).not.toContain(last);
    }
  });
});
