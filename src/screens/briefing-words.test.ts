import { describe, expect, it } from "vitest";

import { dealSentence, problemWords } from "./briefing-words.ts";

describe("briefing words", () => {
  it("words a missing Ring-bearer as the slot asks for it", () => {
    const words = problemWords({ rule: "A Ring-bearer is required", message: "Sam Gamgee (141002): the first seat needs a Fellowship-sphere hero with the Ring-bearer trait" });
    expect(words).toContain("Ring-bearer");
    expect(words).not.toContain("Sam Gamgee");
    expect(words).not.toMatch(/\d/);
  });

  it("drops collector codes from other sentences and keeps the rest", () => {
    expect(problemWords({ rule: "One version of Frodo", message: "Frodo Baggins (142001): only one version of Frodo may start" })).toBe("Frodo Baggins: only one version of Frodo may start");
    expect(problemWords({ rule: "Choose a deck", message: "Choose a saved deck for seat 1." })).toBe("Choose a saved deck for seat 1.");
  });

  it("names the difficulty in the sentence over Deal", () => {
    expect(dealSentence("Easy", false)).toBe("Easy difficulty. Dealing starts the scenario.");
    expect(dealSentence("Normal", true)).toBe("Normal difficulty. A scenario is already open. Dealing again drops it.");
  });
});
