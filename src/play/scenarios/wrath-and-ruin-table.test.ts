// Rules: vom.controlling-locations, vom.losing-control-of-a-location, rr.travel, rr.quest-advancement (data/rules/entries.json); ledger lines 22025:B:3, 22026:B:2, 22014:A:2, 22014:A:3, 22022:A:1, 22015:A:3, 22016:A:2.
// What the table says of Wrath and Ruin's pieces: the Control dial (the locations the players control against the staging area), the Gate dial (stage 2B's progress against 12), the seat marks of the locations each seat controls, the preview of Gate of Dorwinion and of a controlled
// Contested Square or Ransacked House, and the control taken and lost (the words Assault on Osgiliath shares). The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { takeControlOfLocation } from "../../rules/families/pelargir/location-control.ts";
import { dialProps } from "../readouts/dials.ts";
import { changeWords, controlChanges, osgiliathControlSpeech } from "../readouts/against-the-shadow/osgiliath.ts";
import { wrathDetail } from "../readouts/mordor/wrath.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { ASKS } from "../words/asks/wrath-and-ruin.ts";

const ID = "wrath-and-ruin";
const [ULCHOR, GATE, SQUARE, HOUSE, FORTIFICATION, TOWER] = ["22011", "22014", "22015", "22016", "22017", "22018"];
const STAGE_1 = "22025";
const STAGE_2 = "22026";
const built = (layout: Layout) => tableFromLayout(ID, { phase: "Quest", ...layout });
const dialsOf = (layout: Layout) => {
  const made = built(layout);
  return scenarioDials(made.state, made.ctx, (code) => made.cards.get(code)?.name ?? code);
};
// The seat that resolves the effect (`who: actor`, as Ransacked House's Action) takes control of a location in the staging area.
const taking = (made: ReturnType<typeof built>, state: ScenarioState, code: string, seat: number): ScenarioState =>
  takeControlOfLocation(state, { verb: "TakeControlOfLocation", card: "self", who: "actor" }, { seat, sourceId: idOf(state, code) }, made.ctx);

describe("the Control dial (22025:B:3, 22026:B:2), the Gate counted with the locations in the staging area", () => {
  it("counts the locations the players control against more than the staging area holds, a goal that never warms", () => {
    const [control] = dialsOf({ stage: STAGE_1, staging: [ULCHOR, GATE, TOWER], controlled: [SQUARE] });
    expect(control).toMatchObject({ id: "control", testID: "wrath-control", label: "Control", value: 1, limit: 3, goal: true });
    expect(control?.warn).toBeUndefined();
    expect(control?.limitWords).toBe("More than the 2 locations in the staging area must be controlled");
    expect(dialProps(control!).elimination).toBe(false);
  });

  it("its note names the controlled locations, what is still needed and X for the Gate's Threat and Under Siege", () => {
    const [control] = dialsOf({ stage: STAGE_1, staging: [ULCHOR, GATE, TOWER, HOUSE], controlled: [SQUARE] });
    expect(control?.note).toBe("The players control 1 location: Contested Square. 3 locations lie in the staging area (the active location is not counted). They need 3 more to control more than the staging area holds. Both stages are defeated, and the players can travel to Gate of Dorwinion on stage 2B, only then. X is 2, 1 more than the locations controlled: it is Gate of Dorwinion's Threat and Under Siege's X.");
    const none = dialsOf({ stage: STAGE_1, staging: [ULCHOR, GATE] })[0];
    expect(none?.note).toContain("The players control no location.");
    const more = dialsOf({ stage: STAGE_1, staging: [GATE], controlled: [SQUARE, HOUSE] })[0];
    expect(more?.note).toContain("They control more than the staging area holds.");
  });

  it("does not count the active location or an enemy in the staging area", () => {
    const [control] = dialsOf({ stage: STAGE_1, active: FORTIFICATION, staging: [ULCHOR, GATE], controlled: [SQUARE] });
    expect(control?.limit).toBe(2);
    expect(control?.value).toBe(1);
  });
});

describe("the Gate dial (22014:A:3, 22026:B:2)", () => {
  it("shows stage 2B's progress against the 12 that open the Gate, after the Control dial, as a goal", () => {
    const dials = dialsOf({ stage: STAGE_2, staging: [ULCHOR, GATE], progress: 7 });
    expect(dials.map((dial) => dial.id)).toEqual(["control", "gate"]);
    expect(dials[1]).toMatchObject({ testID: "wrath-gate", label: "Gate", value: 7, limit: 12, goal: true, limitWords: "12 progress let the players travel to Gate of Dorwinion" });
    expect(dials[1]?.warn).toBeUndefined();
    expect(dials[1]?.note).toContain("7 of the 12 progress");
  });

  it("is absent on stage 1, and every dial is absent in another scenario", () => {
    expect(dialsOf({ stage: STAGE_1, staging: [ULCHOR, GATE] }).map((dial) => dial.id)).toEqual(["control"]);
    const other = tableFromLayout("the-temple-of-doom", { stage: "21080" });
    expect(scenarioDials(other.state, other.ctx, (code) => code).filter((dial) => dial.testID?.startsWith("wrath"))).toEqual([]);
  });
});

describe("the seat marks", () => {
  it("two-handed each seat wears the count of the locations it controls, with their names in the note", () => {
    const made = built({ seats: 2, stage: STAGE_1, staging: [ULCHOR, GATE, SQUARE, HOUSE] });
    const state = taking(made, taking(made, made.state, SQUARE, 0), HOUSE, 1);
    const marks = seatMarks(state, made.ctx);
    expect(marks.map((mark) => mark.label)).toEqual(["P1 1", "P2 1"]);
    expect(marks[1]?.note).toBe("Player 2 control 1 location: Ransacked House. Street Fighting, Ulchor's Revenge and Easterling shadow effects count them: X is 2.");
    expect(marks.every((mark) => mark.warn === undefined)).toBe(true);
  });

  it("true solo has no mark, since the Control dial says the one count", () => {
    const made = built({ stage: STAGE_1, staging: [ULCHOR, GATE], controlled: [SQUARE] });
    expect(seatMarks(made.state, made.ctx)).toEqual([]);
  });
});

describe("card previews and the control banner", () => {
  it("22014:A:2, 22014:A:3: Gate of Dorwinion's preview gives its Threat and what stops a travel", () => {
    const made = built({ stage: STAGE_2, staging: [GATE, TOWER], controlled: [SQUARE], progress: 5 });
    expect(wrathDetail(made.state, made.ctx, idOf(made.state, GATE))).toBe("Threat 2, 1 more than the 1 location the players control. The players cannot travel here until stage 2B holds 12 progress (5 now) and they control more locations than the staging area holds (1 against 2).");
  });

  it("22015:A:3, 22016:A:2: a controlled Contested Square or Ransacked House says when it returns, and only while controlled", () => {
    const made = built({ stage: STAGE_1, staging: [GATE, HOUSE], controlled: [SQUARE] });
    expect(wrathDetail(made.state, made.ctx, idOf(made.state, SQUARE))).toBe("While you control it, it returns to the staging area after a character you control is destroyed.");
    expect(wrathDetail(made.state, made.ctx, idOf(made.state, HOUSE))).toBeNull();
    const held = taking(made, made.state, HOUSE, 0);
    expect(wrathDetail(held, made.ctx, idOf(held, HOUSE))).toBe("While you control it, it returns to the staging area after you lose control of another location.");
  });

  it("a controlled location is spoken as controlled by its player and the banner names control taken", () => {
    const made = built({ seats: 2, stage: STAGE_1, staging: [GATE, SQUARE] });
    const held = taking(made, made.state, SQUARE, 1);
    expect(osgiliathControlSpeech(held, idOf(held, SQUARE))).toBe("controlled by Player 2");
    const [change] = controlChanges(made.state, held);
    expect(change).toMatchObject({ kind: "took", seat: 1 });
    expect(changeWords(change!, 2, "Contested Square")).toContain("Contested Square");
  });

  it("the control hooks are silent in another scenario", () => {
    const made = built({ stage: STAGE_1, staging: [GATE], controlled: [SQUARE] });
    expect(osgiliathControlSpeech({ ...made.state, scenarioId: "the-temple-of-doom" }, idOf(made.state, SQUARE))).toBeNull();
    expect(wrathDetail({ ...made.state, scenarioId: "the-temple-of-doom" }, made.ctx, idOf(made.state, GATE))).toBeNull();
  });
});

describe("the choices", () => {
  it("each Pick and Choose of the scenario has an entry that names its number or its owner", () => {
    for (const key of ["22013:forced:1 @0 Pick", "22022:shadow:1 @1.0 Pick", "22026:whenRevealed:1 @0.0 Pick"]) {
      expect(ASKS[key]?.owned).toBe(true);
      expect(JSON.stringify(ASKS[key]?.note)).toContain("{tied}");
    }
    expect(JSON.stringify(ASKS["22011:forced:1 @0 attack"]?.label)).toContain("{ulchorAttack}");
    expect(JSON.stringify(ASKS["22012:forced:1 @0 attack"]?.label)).toContain("{champAttack}");
  });
});
