// Rules: rr.step-2-2, mec108.side-quests-in-play (data/rules/entries.json). A player side quest on the table: played, it lies in the staging area
// beside the encounter cards (The Lost Realm rules), with its progress over its quest points.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { play, put, seat, sideCtx } from "../../rules/families/sidequests/fixture.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { zoneIds } from "../store/selectors.ts";

const ctx = sideCtx(RECORDS);

describe("a player side quest on the table", () => {
  it("played from the hand, it is drawn in the staging area with its progress over its quest points", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const card = put(table.state, "09014", "hand");
    const state = play(card.state, card.id, ctx);
    const id = card.id;
    expect(state.cards[id]?.zone).toBe("staging");
    expect(zoneIds(state, "staging", 0)).toContain(id);
    expect(slotNumbers(state, ctx, id).questPoints).toBe(4);
  });
});
