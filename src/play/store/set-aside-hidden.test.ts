// Rules: ats.hidden-cards, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 06117:B:1.
// The hidden cards of The Blood of Gondor lie set aside facedown in a play area: the table's Set aside list counts them and names none.
import { describe, expect, it } from "vitest";

import { CODES, run, table, takes } from "../../../test/scenarios/the-blood-of-gondor/table.ts";
import { setAsideCount, setAsideList } from "./set-aside.ts";

describe("the Set aside list of The Blood of Gondor", () => {
  it("counts each hidden card as facedown and names none, whoever holds it", () => {
    const t = table({ seats: 2, deck: [CODES.ambusher, CODES.uruk, CODES.looms, "f0"] });
    const state = takes(t, takes(t, t.state, 0, 2), 1);
    expect(setAsideList(state, t.ctx)).toEqual({ cards: [], rows: [], facedown: 3 });
    expect(setAsideCount(state, t.ctx)).toBe(3);
  });

  it("holds no card once the hidden cards are turned", () => {
    const t = table({ deck: [CODES.looms, CODES.southern, "f0"] });
    const turned = run(t, takes(t, t.state, 0, 2), { verb: "TurnHiddenCards", who: "actor" });
    expect(setAsideCount(turned, t.ctx)).toBe(0);
  });
});
