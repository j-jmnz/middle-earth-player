// A log line is one accessible element for a screen reader: the step, then its cause.
import { describe, expect, it } from "vitest";

import { logLineSpeech } from "./log.ts";

describe("what a screen reader hears of a log line", () => {
  it("is the step and its cause as one sentence, or the step alone", () => {
    expect(logLineSpeech({ text: "3 damage on Aragorn", cause: "Enemy attack" })).toBe("3 damage on Aragorn. Enemy attack");
    expect(logLineSpeech({ text: "Threat 30 to 31", cause: null })).toBe("Threat 30 to 31");
  });
});
