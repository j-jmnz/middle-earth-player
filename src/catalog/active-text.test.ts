// Rules: rr.keywords, rr.triggered-ability (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { activeCardCodes, cardLines, inactiveCodes, ledgerByCode, textCheck, textInactive, textLoss, unappliedLines, type PrintedSide } from "./active-text.ts";

const SPEARMAN_TEXT = "Sentinel.\n<b>Response:</b> After Gondorian Spearman is declared as a defender, deal 1 damage to the attacking enemy.";

// A ledger card with three lines: a record owns the first, the second is inert, the third nobody owns.
const STING: PrintedSide = { code: "142011", side: "A", lines: ["Attach to a hero.", "Attached hero gets +1 Willpower.", "Response: After attached hero exhausts to defend, draw 1 card."], inert: [{ line: 2 }] };
const KEYWORDS: PrintedSide = { code: "141039", side: "A", lines: ["Hide 2. Doomed 1.", "Forced: After this enemy engages you, raise your threat by 1."], inert: [] };

function check(records: { cardCode: string; lines: string[] }[]) {
  return textCheck(records, ledgerByCode([STING, KEYWORDS]));
}

describe("activeCardCodes", () => {
  it("reads cardCode from effect records", () => {
    expect(activeCardCodes([{ cardCode: "01073" }, { cardCode: "141001" }, { cardCode: "141001" }])).toEqual(new Set(["01073", "141001"]));
  });

  it("treats no records as no active text", () => {
    expect(activeCardCodes([])).toEqual(new Set());
    expect(activeCardCodes([{ cardCode: "" }])).toEqual(new Set());
  });
});

describe("a card with no record outside the ledger", () => {
  it("has nothing unapplied in a line of keywords the engine reads", () => {
    const none = check([]);
    expect(textInactive("x", "Sentinel.", none)).toBe(false);
    expect(textInactive("x", "Ranged. Sentinel.", none)).toBe(false);
    expect(textInactive("x", "Doomed 2. Hide 3.", none)).toBe(false);
    expect(textInactive("x", null, none)).toBe(false);
    expect(textInactive("x", "Hide 2. Cannot have non-Morgul attachments.", none)).toBe(true);
    expect(textInactive("x", SPEARMAN_TEXT, none)).toBe(true);
  });
});

describe("the per-line check", () => {
  it("applies a ledger line a record names, an inert one and a keyword line; not the rest", () => {
    const lines = cardLines("142011", "ignored: the ledger wins", check([{ cardCode: "142011", lines: ["142011:A:1"] }]));
    expect(lines.map((line) => [line.id, line.applied])).toEqual([
      ["142011:A:1", true],
      ["142011:A:2", true],
      ["142011:A:3", false],
    ]);
    // A record for one line does not make the whole card applied (the per-code check did).
    expect(textInactive("142011", null, check([{ cardCode: "142011", lines: ["142011:A:1"] }]))).toBe(true);
    expect(textInactive("142011", null, check([{ cardCode: "142011", lines: ["142011:A:1", "142011:A:3"] }]))).toBe(false);
  });

  it("owns a keyword-only ledger line by its keywords", () => {
    const unapplied = unappliedLines("141039", null, check([]));
    expect(unapplied.map((line) => line.id)).toEqual(["141039:A:2"]);
  });

  it("reads a card outside the ledger from its catalog text: applied only with a record, keywords always", () => {
    expect(unappliedLines("01029", SPEARMAN_TEXT, check([])).map((line) => line.text)).toEqual(["Response: After Gondorian Spearman is declared as a defender, deal 1 damage to the attacking enemy."]);
    expect(textInactive("01029", SPEARMAN_TEXT, check([{ cardCode: "01029", lines: ["01029:A:2"] }]))).toBe(false);
    expect(textInactive("01017", "Ranged.", check([]))).toBe(false);
    expect(textInactive("01013", "", check([]))).toBe(false);
    expect(cardLines("01033", "Action: Deal 1 damage to each enemy engaged with a player. [attack]", check([]))[0]?.text).toBe("Action: Deal 1 damage to each enemy engaged with a player. Attack");
  });

  it("lists the codes with a line the app does not apply", () => {
    const codes = inactiveCodes(
      [
        ["01029", SPEARMAN_TEXT],
        ["01017", "Ranged."],
        ["142011", null],
      ],
      check([{ cardCode: "142011", lines: ["142011:A:1"] }]),
    );
    expect([...codes].sort()).toEqual(["01029", "142011"]);
  });
});

describe("textLoss", () => {
  it("names what a player loses by the card's type", () => {
    const none = check([]);
    expect(textLoss("ally", "01029", none)).toBe("ability");
    expect(textLoss("hero", "01001", none)).toBe("ability");
    // An event with no record cannot be played (rr.triggered-ability); one with a record only loses the unread lines.
    expect(textLoss("event", "02003", none)).toBe("cannotPlay");
    expect(textLoss("event", "02003", check([{ cardCode: "02003", lines: ["02003:A:1"] }]))).toBe("ability");
    expect(textLoss("attachment", "02026", none)).toBe("noEffect");
  });
});
