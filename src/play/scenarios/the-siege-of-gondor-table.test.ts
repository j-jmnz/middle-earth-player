// Rules: mec113.saga-staging-rules, mec113.army-of-the-dead, rr.quest-advancement, rr.damage, rr.travel (data/rules/entries.json); ledger lines 145030:A:1, 145030:A:2, 145033:A:1, 145034:A:1, 145068:A:1, 145069:B:2, 145071:A:1.
// What the table says of The Siege of Gondor's pieces: The Corsair Fleet's resources, the Ship locations toward Great Corsair Ship's travel, each Pelargir Quays' damage tokens, the Port's heal cap, the progress Great Corsair Ship holds on stage 1B and the seat
// that controls the Army of the Dead. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { dialProps } from "../readouts/dials.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { siegeDials, siegeHands, siegeProgressWords } from "../readouts/siege.ts";
import { ARMY_WORDS, fleetWords, heldProgressWords, holdWords, portReachedWords, portWords, quaysNearWords, quaysWords, shipsWords } from "../words/scenarios/siege.ts";

const ID = "the-siege-of-gondor";
const GREAT_SHIP = "145030";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const names = (made: ReturnType<typeof table>) => (code: string) => made.cards.get(code)?.name ?? code;
const dial = (made: ReturnType<typeof table>, id: string) => siegeDials(made.state, made.ctx, names(made)).find((one) => one.id === id);

describe("The Corsair Fleet's resources", () => {
  it("145071:A:1 is a dial of the resources on the Fleet, X, with no limit and no warning, gone while the Fleet is not in play", () => {
    const made = table({ staging: [{ code: "145071", resources: 3 }] });
    expect(dial(made, "fleet")).toMatchObject({ id: "fleet", testID: "siege-fleet", label: "Fleet", value: 3, note: fleetWords(3) });
    expect(dial(made, "fleet")?.limit).toBeUndefined();
    expect(dial(made, "fleet")?.warms).toBeUndefined();
    expect(dialProps(dial(made, "fleet")!)).toMatchObject({ elimination: false, testID: "siege-fleet" });
    expect(dial(table(), "fleet")).toBeUndefined();
  });

  it("145030:A:1 follows the resources the engine holds, and is in the top bar's list", () => {
    const made = table({ staging: [{ code: "145071", resources: 5 }] });
    expect(scenarioDials(made.state, made.ctx, names(made)).find((one) => one.id === "fleet")?.value).toBe(5);
  });
});

describe("the Ship locations toward Great Corsair Ship", () => {
  it("145030:A:2 is a goal dial of the Ship locations in the victory display against the 3 the record asks for, never warming", () => {
    const made = table({ staging: [GREAT_SHIP], victory: ["145031", "145032", "145034"] });
    const shown = dial(made, "ships");
    expect(shown).toMatchObject({ id: "ships", testID: "siege-ships", label: "Ships", value: 2, limit: 3, goal: true, limitWords: shipsWords(3, 2) });
    expect(shown?.warms).toBeUndefined();
    expect(shown?.warn).toBeUndefined();
    expect(dialProps(shown!)).toMatchObject({ elimination: false, goal: true });
  });

  it("145030:A:2 says the travel is open once 3 are there, and is gone once Great Corsair Ship is the active location or has left play", () => {
    const open = table({ staging: [GREAT_SHIP], victory: ["145031", "145032", "145031"] });
    expect(dial(open, "ships")).toMatchObject({ value: 3, limitWords: shipsWords(3, 3) });
    expect(dial(table({ active: GREAT_SHIP, victory: ["145031"] }), "ships")).toBeUndefined();
    expect(dial(table({ victory: ["145031"] }), "ships")).toBeUndefined();
  });
});

describe("Pelargir Quays' damage tokens", () => {
  it("145034:A:1 is a dial of its damage against the 4 at which it is discarded, and warms one token short of it", () => {
    const calm = table({ staging: [{ code: "145034", damage: 1 }] });
    expect(dial(calm, "quays-1")).toMatchObject({ testID: "siege-quays", label: "Quays", value: 1, limit: 4, warms: true, limitWords: quaysWords(4) });
    expect(dial(calm, "quays-1")?.warn).toBeUndefined();
    const near = table({ staging: [{ code: "145034", damage: 3 }] });
    expect(dial(near, "quays-1")?.warn).toEqual({ level: "near", words: quaysNearWords(3, 4) });
    expect(dialProps(dial(near, "quays-1")!)).toMatchObject({ elimination: true, testID: "siege-quays" });
  });

  it("145034:A:1 has a dial for each copy, as the active location too, and none once it is discarded", () => {
    const made = table({ staging: [{ code: "145034", damage: 2 }], active: "145034" });
    const shown = siegeDials(made.state, made.ctx, names(made)).filter((one) => one.id.startsWith("quays"));
    expect(shown.map((one) => [one.testID, one.label])).toEqual([["siege-quays", "Quays"], ["siege-quays-2", "Quays 2"]]);
    expect(siegeDials(table().state, table().ctx, names(table())).filter((one) => one.id.startsWith("quays"))).toEqual([]);
  });
});

describe("the Port's heal cap", () => {
  it("145033:A:1 is a dial of the most damage healed from one character this round against the 1 the Port allows, and warms once it is reached", () => {
    const made = table({ staging: ["145033"] });
    expect(dial(made, "port")).toMatchObject({ testID: "siege-port", label: "Healed", value: 0, limit: 1, limitWords: portWords(1) });
    expect(dial(made, "port")?.warn).toBeUndefined();
    const healed = { ...made.state, roundHealed: { [made.hero]: 1 } };
    expect(siegeDials(healed, made.ctx, names(made)).find((one) => one.id === "port")).toMatchObject({ value: 1, warn: { level: "near", words: portReachedWords(1) } });
  });

  it("145033:A:1 is held only while the Port is in the staging area", () => {
    expect(dial(table({ active: "145033" }), "port")).toBeUndefined();
    expect(dial(table(), "port")).toBeUndefined();
  });
});

describe("stage 1B's held progress", () => {
  it("145069:B:2 is a goal dial of the stage's progress against its 20 while Great Corsair Ship is in play, never warming, and reads above it", () => {
    const made = table({ staging: [GREAT_SHIP], progress: 23 });
    const shown = dial(made, "hold");
    expect(shown).toMatchObject({ id: "hold", testID: "siege-hold", label: "To win", value: 23, limit: 20, goal: true, limitWords: holdWords(20) });
    expect(shown?.warms).toBeUndefined();
    expect(shown?.warn).toBeUndefined();
  });

  it("145069:B:2 is gone once the Ship has left play, and the meter says the stage is held only while it is in play and the progress would reach 20", () => {
    expect(dial(table({ progress: 23 }), "hold")).toBeUndefined();
    const made = table({ staging: [GREAT_SHIP], progress: 17 });
    expect(siegeProgressWords(made.state, made.ctx, 4)).toBe(heldProgressWords(4));
    expect(siegeProgressWords(made.state, made.ctx, 2)).toBeNull();
    expect(siegeProgressWords(made.state, made.ctx, 0)).toBeNull();
    const gone = table({ progress: 17 });
    expect(siegeProgressWords(gone.state, gone.ctx, 4)).toBeNull();
  });
});

describe("the Army of the Dead's seat", () => {
  it("145068:A:1 marks the seat that controls it: solo the mark is its word, two-handed it names the seat, and it follows the first player token", () => {
    const solo = table({ play: ["145068"] });
    expect(siegeHands(syncConstants(solo.state, solo.ctx))).toEqual([{ seat: 0, label: "Army", note: ARMY_WORDS }]);
    const pair = table({ seats: 2, play: [{ code: "145068", seat: 1 }] });
    expect(siegeHands(pair.state)).toEqual([{ seat: 1, label: "P2 · Army", note: ARMY_WORDS }]);
    expect(seatMarks(pair.state, pair.ctx)).toEqual([{ seat: 1, label: "P2 · Army", note: ARMY_WORDS }]);
    const passed = updateCard(pair.state, idOf(pair.state, "145068"), { controller: 0 });
    expect(siegeHands(passed)).toEqual([{ seat: 0, label: "P1 · Army", note: ARMY_WORDS }]);
  });

  it("145068:A:3 has no mark once the Army has left play", () => {
    expect(siegeHands(table().state)).toEqual([]);
    const gone = table({ seats: 2, discard: ["145068"] });
    expect(siegeHands(gone.state)).toEqual([]);
  });
});
