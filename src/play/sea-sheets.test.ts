// Rules: dcce.sailing-tests (data/rules/entries.json); ledger line 11053:A:1. The Sailing test's sheets count success symbols as the engine does: the symbols printed
// on the cards looked at, less the ones a card in play cancels, never below 0. The title, the note and the dock's readout all read that count.
import { describe, expect, it } from "vitest";

import { lookedIds, sailingSymbols } from "../rules/families/sea/sailing.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { spawn } from "../rules/core/zones.ts";
import { reduce, type PlayerIntent, type ScenarioState } from "../rules/engine/reduce.ts";

import { sailingTable } from "./sea-fixture.ts";
import { sailingReadout } from "./sea-readout.ts";
import { sailingLookSheet, sailingShiftSheet, successesOf } from "./sea-sheets.ts";

// The first player commits the Dream-chaser, which counts as 2: the test looks at the top two cards of the encounter deck (1 and 0 success symbols), with `cancel` symbols cancelled.
function looked(cancel: number, heading: "Sun" | "Rain") {
  const f = sailingTable({ heading });
  // A card in the staging area that cancels symbols, as Rough Waters does.
  const rough = spawn(f.state, "s0", { zone: "staging" });
  const names = { card: (id: string) => (id === rough.id ? "Rough Waters" : id), line: () => null };
  let state: ScenarioState = rough.state;
  if (cancel > 0) state = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: rough.id, stat: "sailingCancel", amount: cancel, until: "whileSourceInPlay" }] };
  state = expectOk(reduce(state, { type: "Commit", cardIds: [f.ids.dc!] } as PlayerIntent, f.ctx)).state;
  return { state, ctx: f.ctx, names };
}

describe("the Sailing test counts the symbols the engine counts", () => {
  it("counts printed symbols less the ones a card cancels, and names the card that cancels them", () => {
    const rain = looked(0, "Rain");
    expect(successesOf(rain.state, rain.ctx)).toBe(1);
    const sheet = sailingShiftSheet(rain.state, rain.ctx, rain.names);
    expect(sheet?.title).toBe("Sailing test · 1 success");
    expect(sheet?.note).not.toContain("cancels");
  });

  it("when the only symbol is cancelled: 0 successes, no shift to answer, and the note says what cancelled it", () => {
    const cancelled = looked(1, "Rain");
    expect(sailingSymbols(cancelled.state, lookedIds(cancelled.state), cancelled.ctx.cards)).toEqual({ printed: 1, cancelled: 1, counted: 0 });
    expect(successesOf(cancelled.state, cancelled.ctx)).toBe(0);
    // No symbol counts, so the engine asks no shift: the test waits on Done.
    expect(sailingShiftSheet(cancelled.state, cancelled.ctx, cancelled.names)).toBeNull();
    const sheet = sailingLookSheet(cancelled.state, cancelled.ctx, cancelled.names);
    expect(sheet?.title).toBe("Sailing test · 0 successes");
    expect(sheet?.note).toBe("Rough Waters cancels 1. No Sailing success symbol counts. The cards looked at are discarded when you are done.");
    // The row still shows the symbol printed on the card.
    expect(sheet?.look?.map((row) => row.success)).toEqual([1, 0]);
    expect(sailingReadout(cancelled.state, cancelled.ctx, [], cancelled.names)?.stats).toEqual([]);
  });

  it("cancels no more than are printed", () => {
    const over = looked(3, "Rain");
    const sheet = sailingLookSheet(over.state, over.ctx, over.names);
    expect(sheet?.note?.startsWith("Rough Waters cancels 1.")).toBe(true);
    expect(successesOf(over.state, over.ctx)).toBe(0);
  });
});

describe("the commit's readout", () => {
  it("adds the additional cards a card in play says to look at, and names the card (11050:A:1)", () => {
    const f = sailingTable({ heading: "Rain" });
    const calm = spawn(f.state, "s0", { zone: "staging" });
    const names = { card: (id: string) => (id === calm.id ? "Calm Waters" : id === f.ids.dc ? "Dream-chaser" : id), line: () => null };
    const plain = sailingReadout(f.state, f.ctx, [f.ids.dc!], names);
    expect(plain?.result).toBe("Looks at 2 cards · the Dream-chaser counts as 2");
    const state: ScenarioState = { ...calm.state, modifiers: [...calm.state.modifiers, { instanceId: "table", sourceId: calm.id, stat: "sailingLook", amount: 2, until: "whileSourceInPlay" }] };
    expect(sailingReadout(state, f.ctx, [f.ids.dc!], names)?.result).toBe("Looks at 4 cards · the Dream-chaser counts as 2 · Calm Waters +2");
  });
});
