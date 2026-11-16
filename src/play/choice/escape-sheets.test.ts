// Rules: sotm.escape-test, sotm.escape-test-example (data/rules/entries.json). The words of an escape test's commit sheet and its action window (docs/design-system-table.md, Choice tray): the player asked leads two-handed, the cards dealt, the stat counted,
// the most that may commit and, for a party test, that every player commits; the action window gives the stat committed so far and what the table adds to each card, and its armed Pass says the test fails while nobody is committed.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import type { Sheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

function sheetOf(layout: Layout, code: string, commit?: readonly string[]): Sheet | null {
  const made = tableFromLayout("the-dead-marshes", layout);
  let state = revealFromTop(made.state, made.ctx, code, [] as EngineStep[]).state;
  if (commit) {
    const done = reduce(state, { type: "CommitEscape", cardIds: commit.map((c) => Object.values(state.cards).find((card) => card.code === c)?.id ?? "") }, made.ctx);
    if (!done.ok) throw new Error("refused");
    state = done.state;
  }
  const names: SheetNames = { card: (id) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
}

describe("the escape test's sheets", () => {
  it("the commit sheet says who commits, the stat, the cards dealt and a tie failing, solo", () => {
    const sheet = sheetOf({ stage: "02105", staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] }, "02109");
    expect(sheet?.note).toBe("Exhaust ready characters to commit them to the escape test. 2 encounter cards are dealt next, and your committed Willpower must be higher than their Escape.");
    expect(sheet?.title).toBe("Nightfall: Escape test");
  });

  it("the commit sheet leads with the player asked two-handed, and counts Attack for Through the Mist", () => {
    const sheet = sheetOf({ stage: "02105", seats: 2, staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] }, "02110");
    expect(sheet?.note).toBe("Player 1: exhaust ready characters to commit them to the escape test. 2 encounter cards are dealt next, and your committed Attack must be higher than their Escape.");
  });

  it("the action window gives the stat committed so far, and the armed Pass says the test fails while nobody is committed", () => {
    const sheet = sheetOf({ stage: "02105", staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] }, "02109", []);
    expect(sheet?.note).toContain("Willpower 0 committed. 2 encounter cards are dealt after the actions");
    expect(JSON.stringify(sheet)).toContain("Tap again: no one is committed, so the escape test fails");
  });
});
