import { describe, expect, it } from "vitest";

import { sphereTell } from "../../play/words/scenarios/aflame.ts";

import { actionLine, dealSentence, gainLine, needWords, problemWords } from "./words.ts";

describe("briefing words", () => {
  it("words a missing Ring-bearer as the seat that needs one", () => {
    const words = problemWords({ rule: "A Ring-bearer is required", message: "Sam Gamgee (141002): the first seat needs a Fellowship-sphere hero with the Ring-bearer trait" });
    expect(words).toBe("Seat 1 needs a Ring-bearer.");
  });

  it("drops collector codes from other sentences and keeps the rest", () => {
    expect(problemWords({ rule: "One version of Frodo", message: "Frodo Baggins (142001): only one version of Frodo may start" })).toBe("Frodo Baggins: only one version of Frodo may start");
    // A rule span id becomes the book and page, and an id no book carries is left as it is.
    const refused = problemWords({ rule: "Fellowship heroes only in a saga", message: "Frodo Baggins (141001): a Fellowship-sphere hero can only be used when playing the scenarios in the saga expansions (mec109.the-fellowship-sphere)" });
    expect(refused).toMatch(/^Frodo Baggins: a Fellowship-sphere hero .* \(.+, page \d+\)$/);
    expect(refused).not.toContain("mec109.");
    expect(problemWords({ rule: "Choose a deck", message: "Choose a saved deck for seat 1." })).toBe("Choose a saved deck for seat 1.");
  });

  it("warns over Deal only when an open scenario would be dropped", () => {
    expect(dealSentence(false)).toBeNull();
    expect(dealSentence(true)).toBe("A scenario is already open. Dealing again drops it.");
  });
});

describe("campaign choice words (41050:A:2)", () => {
  const adaptation = (code: string) => (code.startsWith("4104") ? ["Adaptation"] : []);
  it("explains an Adaptation choice and names what the Deal bar waits for", () => {
    const words = needWords(1, ["41044>02116", "41045>02116"], adaptation);
    expect(words.intro).toBe("Choose 1 Adaptation boon and the hero who carries it. It joins your Campaign Pool.");
    expect(words.waiting).toBe("Choose an Adaptation for seat 2 above.");
  });

  it("says a card for any other choice and adds no explanation", () => {
    expect(needWords(0, ["02001", "skip"], adaptation)).toEqual({ intro: null, waiting: "Choose a card for seat 1 above." });
  });

  it("reads the Action line of a card's printed text, or nothing", () => {
    expect(actionLine("Setup. Attach to a hero.\nAttached hero gains the Lore resource icon.\nAction: Exhaust the attached hero to place 3 progress on a location. (Limit once per campaign.)")).toBe("Action: Exhaust the attached hero to place 3 progress on a location. (Limit once per campaign.)");
    expect(actionLine("Forced: something")).toBeNull();
    expect(actionLine(null)).toBeNull();
  });

  it("reads what a boon gives the hero it is attached to, or nothing", () => {
    expect(gainLine("Setup. Attach to a hero.\nAttached hero gains the Lore resource icon.\nAction: Heal.")).toBe("Attached hero gains the Lore resource icon.");
    expect(gainLine("Action: Heal.")).toBeNull();
    expect(gainLine(undefined)).toBeNull();
  });
});

describe("campaign choice words (11182:A:2)", () => {
  const nameOf = (code: string) => (code.startsWith("1118") ? "Galdor's Counsel" : "Other");
  it("explains the offer of a Galdor's Counsel, naming what the Deal bar waits for, and tells the four copies apart by sphere", () => {
    const words = needWords(0, ["11184", "11185", "11186", "11187", "skip"], () => [], nameOf);
    expect(words.intro).toBe("Choose 1 Galdor's Counsel to add to your hand, or skip. It joins your Campaign Pool if you win the scenario.");
    expect(words.waiting).toBe("Choose Galdor's Counsel for seat 1 above.");
    const text = "Action: Add X resources to any hero's resource pool. X is half the level of Galdor's Counsel (Leadership), rounded up. Add Galdor's Counsel to the victory display.";
    expect(sphereTell("Galdor's Counsel", text)).toBe(" (Leadership)");
    expect(sphereTell("Galdor's Counsel", "Action: Look at the top X or bottom X cards. X is half the level of Galdor's Counsel (Lore), rounded up.")).toBe(" (Lore)");
    expect(sphereTell("Spyglass", text)).toBe("");
    expect(sphereTell("Galdor's Counsel", null)).toBe("");
    expect(needWords(0, ["02001", "skip"], () => [], nameOf).intro).toBeNull();
  });
});
