// Rules: mec109.stage-4 (data/rules/entries.json). The table's words for the active locations and the facedown Ring-bearer: shown
// for The Ring Goes South, which declares a second active location, with what the engine holds, and absent for the other scenarios.
import { beforeAll, describe, expect, it } from "vitest";

import { DOORS, loadSouthWorld, southTable, WATCHER, type SouthWorld } from "../../scripts/south-scene.ts";
import { first, loadWorld, table, type World } from "../../scripts/past-scene.ts";

import { locationReadout } from "./widgets.ts";

let south: SouthWorld;
let past: World;

beforeAll(async () => {
  south = await loadSouthWorld();
  past = await loadWorld();
});

describe("the active location readout", () => {
  it("names both active locations in slot order, and the card holding the Ring-bearer", () => {
    const { state } = southTable(south, { stage: "142023", active: DOORS, second: "place", captive: true });
    expect(locationReadout(state)).toEqual({ active: [DOORS, "place"], heldUnder: WATCHER });
    const one = southTable(south, { stage: "142023", active: DOORS });
    expect(locationReadout(one.state)).toEqual({ active: [DOORS], heldUnder: null });
    expect(locationReadout(southTable(south, { stage: "142023" }).state)).toEqual({ active: [], heldUnder: null });
  });

  it("follows the engine: the Ring-bearer back in play is no longer held", () => {
    const { state, frodo } = southTable(south, { stage: "142023", active: DOORS, captive: true });
    const freed = { ...state, cards: { ...state.cards, [frodo]: { ...state.cards[frodo]!, zone: "heroes" as const } } };
    expect(locationReadout(freed)?.heldUnder).toBeNull();
    void first;
  });

  it("is absent on a scenario that declares no second active location", () => {
    const { state } = table(past);
    expect(state.widgets.secondActiveLocation).toBe(false);
    expect(locationReadout(state)).toBeNull();
  });
});
