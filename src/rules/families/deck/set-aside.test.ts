// Rules: rr.setup (data/rules/entries.json); ledger line 132067:A:1. ShuffleSetAsideIntoDeck (deck family): the set-aside card with the printed code goes into the acting player's deck, which is shuffled; nothing happens when none is set aside.
import { describe, expect, it } from "vitest";

import { runInstruction } from "../../interpret/interpret.ts";
import { spiderTable } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

const RING = "132019";

describe("ShuffleSetAsideIntoDeck", () => {
  it("puts the set-aside copy into the deck of the acting player and shuffles that deck, whoever is the first player", () => {
    const t = spiderTable({ seats: 2, setAside: [RING] });
    const ring = Object.values(t.state.cards).find((card) => card.code === RING);
    expect(ring?.zone).toBe("setAside");
    const out = runInstruction(t.state, { verb: "ShuffleSetAsideIntoDeck", code: RING }, { seat: 1, sourceId: null }, t.ctx, []);
    expect(out.cards[ring?.id ?? ""]).toMatchObject({ zone: "deck" });
    expect(out.seats[1].deck).toContain(ring?.id);
    expect(out.seats[1].deck.length).toBe(t.state.seats[1].deck.length + 1);
    expect(out.seats[0].deck, "the other deck is not touched").toEqual(t.state.seats[0].deck);
    expect(out.setAside).not.toContain(ring?.id);
  });

  it("does nothing when no copy is set aside", () => {
    const t = spiderTable({ seats: 1 });
    expect(runInstruction(t.state, { verb: "ShuffleSetAsideIntoDeck", code: RING }, { seat: 0, sourceId: null }, t.ctx, [])).toBe(t.state);
  });
});
