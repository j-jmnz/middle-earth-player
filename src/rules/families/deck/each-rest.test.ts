// Rules: rr.the-word-choose (data/rules/entries.json); ledger line 148004:A:1.
// Each `rest` (deck family): the acting player keeps exactly X of his allies, and the rest are discarded. Stage 4A of Fog on the Barrow-downs.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { allyCard, idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { codeOf, fogTable as table, STAGE_4 } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";

describe("Each rest keeps exactly X (148004:A:1)", () => {
  it("148004:A:1 the player keeps exactly X allies, X the enemies engaged with him: he chooses which; fewer allies than X lose none", () => {
    const t = table({ seats: 1, stage: STAGE_4, deck: ["148011"], engaged: ["148012", "148012"] });
    for (const name of ["a1", "a2", "a3"]) t.cards.set(name, allyCard(name, 1));
    let state = t.state;
    for (const name of ["a1", "a2", "a3"]) state = spawn(state, name, { zone: "play", seat: 0 }).state;
    const stage = idOf(state, STAGE_4);
    // Two enemies engaged: keep 2 of the 3 allies; the first choice (a1) and the second (a2) are kept, a3 is discarded.
    const run = resolveRecords(state, t.ctx, STAGE_4, "whenRevealed", stage);
    const left = run.state.seats[0].play.map((id) => codeOf(run.state, id));
    expect(left).toEqual(["a1", "a2"]);
    expect(run.state.seats[0].discard.map((id) => codeOf(run.state, id))).toEqual(["a3"]);
    // With one more ally than enemies, one is discarded; with no more allies than enemies, none.
    const two = { ...state, seats: [{ ...state.seats[0], play: state.seats[0].play.slice(0, 2) }, state.seats[1]] as ScenarioState["seats"] };
    expect(resolveRecords(two, t.ctx, STAGE_4, "whenRevealed", stage).state.seats[0].discard).toEqual([]);
  });
});
