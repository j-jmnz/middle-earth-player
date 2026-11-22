import { describe, expect, it } from "vitest";

import { holds } from "../../interpret/conditions.ts";
import { hero, table } from "../defense/table.ts";

// Rules: dcce.last-player (data/rules/entries.json); ledger line 03035:A:2 (docs/scenarios/dwarrowdelf.md, Into the Pit). The condition `lastPlayer`: the acting player is the last player, the one to the first player's right; with one player he is the last player too.

describe("the lastPlayer condition (03035:A:2)", () => {
  it("holds for the only player of a solo game", () => {
    const { state, ctx } = table({ cards: [hero("a")], effects: [], heroes: [{ code: "a" }] });
    expect(holds(state, { kind: "lastPlayer" }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(true);
  });

  it("holds for the player before the first player and not for the others", () => {
    const { state, ctx } = table({ seatCount: 2, cards: [hero("a"), hero("b")], effects: [], heroes: [{ code: "a" }, { code: "b", seat: 1 }] });
    expect(holds(state, { kind: "lastPlayer" }, { actor: 1, sourceId: null, returned: 0 }, ctx)).toBe(true);
    expect(holds(state, { kind: "lastPlayer" }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(false);
  });
});
