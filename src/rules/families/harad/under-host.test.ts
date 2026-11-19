// Rules: rr.effects (data/rules/entries.json); ledger line 148008:A:2.
// PlaceFacedownUnder `host: "self"` (harad family): each player at the card's stage places an ally he controls facedown under it, and the allies return when it is explored. Ancient Barrow of Fog on the Barrow-downs.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import { spawn } from "../../core/zones.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { allyCard, idOf, revealFromTop } from "../../../../test/harness/scene-kit.ts";
import { focus, fogTable as table } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("148008:A:2 an ally facedown under Ancient Barrow", () => {
  it("each player at its stage places an ally under it, which returns to its owner's hand when it is explored", () => {
    const t = table({ seats: 1, staging: [] });
    t.cards.set("a1", allyCard("a1", 1));
    const state = spawn(t.state, "a1", { zone: "play", seat: 0 }).state;
    const run = revealFromTop(state, t.ctx, "148008", []);
    const barrow = run.id;
    const ally = idOf(run.state, "a1");
    expect(run.state.cards[ally]).toMatchObject({ zone: "under", host: barrow, owner: 0 });
    // Its Threat is 1 plus the cards facedown under it.
    expect(modifiedStat(run.state, run.state.cards[barrow]!, "threat", t.ctx.cards)).toBe(2);
    const explored = runInstruction(run.state, { verb: "ReturnFacedownToHands" }, focus(0, barrow), t.ctx, []);
    expect(explored.cards[ally]?.zone === "hand" || explored.cards[ally]?.zone === "under").toBe(true);
  });
});

