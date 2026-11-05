// What a screen reader is told when the table's moment changes: whether focus stays on the card it is on, what is announced once focus has
// settled, and the dock's waiting sentence with no glow in it. The focus decision itself is src/ui/reader-focus.test.ts.
import { describe, expect, it } from "vitest";

import type { MultiSheet, PickSheet, TriggerSheet } from "./sheet-types.ts";
import type { Dock } from "./table-choice.ts";
import { holdsFocus, momentSpeech, readerDock, readerWhy } from "./reader-moment.ts";

const pick = { kind: "pick", key: "p" } as unknown as PickSheet;
const multi = { kind: "multi", key: "m" } as unknown as MultiSheet;
const trigger = { kind: "trigger", key: "t" } as unknown as TriggerSheet;

describe("focus on a card", () => {
  it("stays when the card the reader last activated is one the new moment still asks about", () => {
    expect(holdsFocus("hero", new Set(["hero", "ally"]))).toBe(true);
  });

  it("moves to the title when that card is not asked about, or the reader has touched no card", () => {
    expect(holdsFocus("enemy", new Set(["hero"]))).toBe(false);
    expect(holdsFocus(null, new Set(["hero"]))).toBe(false);
  });
});

describe("what is announced for a new moment", () => {
  it("is the note alone once focus moved to the title, which the reader hears from the focus", () => {
    expect(momentSpeech({ title: "Defend", note: "Choose a defender.", moved: true })).toBe("Choose a defender.");
    expect(momentSpeech({ title: "Defend", note: null, moved: true })).toBe("");
  });

  it("is the title and its note when focus stayed on a card", () => {
    expect(momentSpeech({ title: "Defend", note: "Choose a defender.", moved: false })).toBe("Defend. Choose a defender.");
    expect(momentSpeech({ title: "Victory", note: null, moved: false })).toBe("Victory");
  });
});

describe("the dock's waiting sentence for a reader", () => {
  it("names no glowing card, by the kind of sheet", () => {
    expect(readerWhy(pick, "Tap a glowing card to choose it.")).toBe("Choose a card that can be picked.");
    expect(readerWhy(multi, "Tap at least one glowing card.")).toBe("Choose at least one card.");
    expect(readerWhy(trigger, "Tap a glowing card.")).toBe("Choose a card that can be used.");
  });

  it("leaves every other sentence as it is", () => {
    expect(readerWhy(pick, "Choose one above.")).toBe("Choose one above.");
    expect(readerWhy(multi, "No character can be chosen.")).toBe("No character can be chosen.");
    expect(readerWhy(pick, null)).toBeNull();
  });

  it("keeps the same dock for everyone but a reader", () => {
    const dock: Dock = { primary: null, why: "Tap a glowing card.", secondary: [], single: false };
    expect(readerDock(dock, trigger, false)).toBe(dock);
    expect(readerDock(dock, trigger, true).why).toBe("Choose a card that can be used.");
    const plain: Dock = { ...dock, why: "Choose one above." };
    expect(readerDock(plain, pick, true)).toBe(plain);
  });
});
