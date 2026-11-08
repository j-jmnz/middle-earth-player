// Rules: mec112.pursuit, rr.player-elimination (data/rules/entries.json); ledger lines 143069:A:1, 143022:A:1, 143024:A:1. What the table draws of The Uruk-hai's own pieces: every Captive faceup under the card that holds it (To Isengard!
// holds one for each player), the Captive Grishnákh holds under him, and the pursuit value as a readout the engine's number feeds.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, haiTable, loadHaiWorld, type HaiWorld } from "../../../test/scenarios/the-uruk-hai/scene.ts";
import { widgetReadouts } from "../readouts/widgets.ts";
import { zoneSelector } from "./selectors.ts";

let world: HaiWorld;
beforeAll(async () => {
  world = await loadHaiWorld();
});

const facts = { typeOf: () => "enemy", shipRank: () => null } as const;

describe("the pieces of The Uruk-hai on the table", () => {
  it("draws each Captive under To Isengard!, all of them in two-handed play", () => {
    const { state, hero2, seat1Hero } = haiTable(world, { seats: 2, captives: ["hero2", "seat1"], staging: [CODES.ugluk] });
    const view = zoneSelector("staging", 0, facts)(state);
    const isengard = view.entries.find((entry) => entry.card.code === CODES.toIsengard);
    expect(isengard?.attached.map((card) => card.id).sort()).toEqual([hero2, seat1Hero ?? ""].sort());
    // Uglúk beside it holds nothing.
    expect(view.entries.find((entry) => entry.card.code === CODES.ugluk)?.attached).toEqual([]);
  });

  it("shows the pursuit value only while the engine holds one", () => {
    const { state } = haiTable(world, { pursuit: 14 });
    expect(widgetReadouts(state).pursuit).toBe(14);
    expect(widgetReadouts({ ...state, pursuit: 0 }).pursuit).toBe(0);
    const { pursuit: _gone, ...without } = state;
    expect(widgetReadouts(without).pursuit).toBeUndefined();
  });
});
