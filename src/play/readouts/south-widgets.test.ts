// Rules: mec109.stage-4 (data/rules/entries.json). The table's words for the facedown Ring-bearer: shown for The Ring Goes South,
// which declares a second active location, with what the engine holds, and absent for the other scenarios.
import { beforeAll, describe, expect, it } from "vitest";

import { DOORS, loadSouthWorld, southTable, WATCHER, type SouthWorld } from "../../../test/scenarios/the-ring-goes-south/scene.ts";
import { loadWorld, table, type World } from "../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first } from "../../../test/harness/scene-kit.ts";

import { locationReadout, ringWords } from "./widgets.ts";

let south: SouthWorld;
let past: World;

beforeAll(async () => {
  south = await loadSouthWorld();
  past = await loadWorld();
});

describe("the facedown Ring-bearer readout", () => {
  it("names the card holding the Ring-bearer and the seat that gets it back (the first player)", () => {
    const { state } = southTable(south, { stage: "142023", active: DOORS, second: "place", captive: true });
    expect(locationReadout(state)).toEqual({ heldUnder: WATCHER, heldBy: state.firstPlayer });
    expect(locationReadout({ ...state, firstPlayer: 1 })).toEqual({ heldUnder: WATCHER, heldBy: 1 });
    const one = southTable(south, { stage: "142023", active: DOORS });
    expect(locationReadout(one.state)).toEqual({ heldUnder: null, heldBy: null });
    expect(locationReadout(southTable(south, { stage: "142023" }).state)).toEqual({ heldUnder: null, heldBy: null });
  });

  it("words it for the dial, exactly as the Maestro flow asserts it", () => {
    const { state } = southTable(south, { stage: "142023", active: DOORS, captive: true });
    expect(ringWords(locationReadout(state), (code) => (code === WATCHER ? "Watcher in the Water" : code))).toBe("The Ring-bearer is facedown under Watcher in the Water");
    expect(ringWords(null, (code) => code)).toBeNull();
    expect(ringWords({ heldUnder: null, heldBy: null }, (code) => code)).toBeNull();
  });

  it("follows the engine: the Ring-bearer back in play is no longer held", () => {
    const { state, frodo } = southTable(south, { stage: "142023", active: DOORS, captive: true });
    const freed = { ...state, cards: { ...state.cards, [frodo]: { ...state.cards[frodo]!, zone: "heroes" as const } } };
    expect(locationReadout(freed)?.heldUnder).toBeNull();
    expect(locationReadout(freed)?.heldBy).toBeNull();
    void first;
  });

  it("is absent on a scenario that declares no second active location", () => {
    const { state } = table(past);
    expect(state.widgets.secondActiveLocation).toBe(false);
    expect(locationReadout(state)).toBeNull();
  });
});
