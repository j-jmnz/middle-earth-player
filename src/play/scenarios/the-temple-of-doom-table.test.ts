// Rules: rr.forced, rr.quest-advancement, rr.threat-threat-dial, rr.first-player (data/rules/entries.json); ledger lines 21053:A:1, 21054:A:2, 21080:B:2, 21085:B:2, 21065:A:1, 21062:A:1, 21070:A:2, 21060:A:2, 21081:B:1.
// What the table says of The Temple of Doom's pieces: Tribute to Mordor's damage, Thane Ulchor's hit points, stage 1B's gate, stage 2B's cap, the seat marks of Lost in the Dark, Narrow Opening and Covered in Darkness, and the owner named on each choice.
// The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { dialProps } from "../readouts/dials.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { spawn } from "../../rules/core/zones.ts";
import { updateCard } from "../../rules/core/state.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { ASKS } from "../words/asks/the-temple-of-doom.ts";
import { secondPilesOf } from "../store/pile-ids.ts";

const ID = "the-temple-of-doom";
const built = (layout: Layout) => tableFromLayout(ID, { phase: "Quest", ...layout });
const dialsOf = (layout: Layout) => {
  const made = built(layout);
  return scenarioDials(made.state, made.ctx, (code) => made.cards.get(code)?.name ?? code);
};
const POWER = ["21066", "21067", "21068"];

describe("Tribute to Mordor's dial", () => {
  it("21053:A:1 counts the damage against the 4 that reveal a card, and warms toward it", () => {
    const tribute = dialsOf({ stage: "21080", staging: [{ code: "21053", damage: 3 }], piles: { powerOfMordorDeck: POWER } }).find((dial) => dial.id === "tribute");
    expect(tribute).toMatchObject({ testID: "temple-tribute", label: "Tribute", value: 3, limit: 4, warms: true });
    expect(tribute?.warn).toBeUndefined();
    expect(tribute?.limitWords).toBe("4 damage tokens reveal a Power of Mordor card");
    expect(tribute?.note).toContain("The deck holds 3 cards");
    expect(dialProps(tribute!).elimination).toBe(true);
  });

  it("21053:A:1 warns critical with 3 damage and no card left to reveal, and not with a card left or less damage", () => {
    const empty = dialsOf({ stage: "21080", staging: [{ code: "21053", damage: 3 }] }).find((dial) => dial.id === "tribute");
    expect(empty?.warn?.level).toBe("critical");
    expect(empty?.warn?.words).toContain("the players lose the game");
    expect(dialsOf({ stage: "21080", staging: [{ code: "21053", damage: 2 }] }).find((dial) => dial.id === "tribute")?.warn).toBeUndefined();
  });

  it("shows none of the dials in another scenario, and none without the cards", () => {
    const other = tableFromLayout("danger-in-dorwinion", { stage: "21077" });
    expect(scenarioDials(other.state, other.ctx, (code) => code).filter((dial) => dial.testID?.startsWith("temple"))).toEqual([]);
    expect(dialsOf({ stage: "21080" }).find((dial) => dial.id === "tribute")).toBeUndefined();
  });
});

describe("the Power of Mordor deck", () => {
  it("21080:A:1 is a second pile beside the quest deck while the game deals it", () => {
    const made = built({ stage: "21080", piles: { powerOfMordorDeck: POWER } });
    expect(secondPilesOf(made.state)).toEqual(["powerOfMordorDeck"]);
    expect(made.state.piles?.powerOfMordorDeck).toHaveLength(3);
  });
});

describe("Thane Ulchor's dial", () => {
  it("21054:A:2 shows the hit points left and says X, 1 more than the quest stages in the victory display", () => {
    const ulchor = dialsOf({ stage: "21085", staging: [{ code: "21054", damage: 4 }], victory: ["21080", "21081", "21083"] }).find((dial) => dial.id === "ulchor");
    expect(ulchor).toMatchObject({ testID: "temple-ulchor", label: "Ulchor", value: 5 });
    expect(ulchor?.warn).toBeUndefined();
    expect(ulchor?.note).toContain("5 hit points left. X is 4");
    expect(ulchor?.note).toContain("cannot be engaged unless X is 5");
  });
});

describe("the stage dials", () => {
  it("21080:B:2 counts the resources on stage 1B against the 2 that advance the quest, a goal dial", () => {
    const gate = dialsOf({ stage: "21080" }).find((dial) => dial.id === "gate");
    expect(gate).toMatchObject({ testID: "temple-gate", label: "Temple", value: 0, limit: 2, goal: true });
    expect(gate?.warn).toBeUndefined();
    expect(gate?.limitWords).toBe("2 resources advance the quest");
    expect(dialsOf({ stage: "21080", side: "A" }).find((dial) => dial.id === "gate")).toBeUndefined();
  });

  it("21085:B:2 shows the progress against the cap only once the Forced effect has set one", () => {
    expect(dialsOf({ stage: "21085" }).find((dial) => dial.id === "cap")).toBeUndefined();
    const made = built({ stage: "21085" });
    const stage = made.state.questStage!;
    const capped = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: stage, sourceId: stage, stat: "stageProgressCap", amount: 3, until: "endOfRound" }, { instanceId: stage, sourceId: stage, stat: "stageProgressPlaced", amount: 1, until: "endOfRound" }] } as ScenarioState;
    const cap = scenarioDials(capped, made.ctx, (code) => code).find((dial) => dial.id === "cap");
    expect(cap).toMatchObject({ testID: "temple-cap", value: 1, limit: 3 });
    expect(cap?.warn).toBeUndefined();
    const full = { ...capped, modifiers: [...capped.modifiers, { instanceId: stage, sourceId: stage, stat: "stageProgressPlaced", amount: 2, until: "endOfRound" }] } as ScenarioState;
    expect(scenarioDials(full, made.ctx, (code) => code).find((dial) => dial.id === "cap")?.warn?.level).toBe("near");
  });
});

describe("the seat marks", () => {
  it("21062:A:1 marks each seat with the cards it played this round against the 1 allowed while Narrow Opening is the active location", () => {
    const solo = built({ stage: "21081", active: "21062" });
    expect(seatMarks(solo.state, solo.ctx)).toMatchObject([{ seat: 0, label: "Play 0/1" }]);
    const pair = built({ seats: 2, stage: "21081", active: "21062" });
    expect(seatMarks(pair.state, pair.ctx).map((mark) => mark.label)).toEqual(["P1 0/1", "P2 0/1"]);
    const played = { ...pair.state, played: [{ id: "x", code: "x", seat: 1, round: pair.state.round }] } as ScenarioState;
    expect(seatMarks(played, pair.ctx).map((mark) => mark.label)).toEqual(["P1 0/1", "P2 1/1"]);
    expect(seatMarks(played, pair.ctx)[1]?.warn).toBeUndefined();
    const away = built({ stage: "21081", staging: ["21062"] });
    expect(seatMarks(away.state, away.ctx)).toEqual([]);
  });

  it("21070:A:2 marks each seat with the threat its card effects took off this round against the 1 allowed", () => {
    const pair = built({ seats: 2, stage: "21081", staging: ["21070"] });
    expect(seatMarks(pair.state, pair.ctx).map((mark) => mark.label)).toEqual(["P1 0/1", "P2 0/1"]);
    const spent = { ...pair.state, playerThreatLoweredBy: { 0: 1 } } as ScenarioState;
    expect(seatMarks(spent, pair.ctx)[0]).toMatchObject({ label: "P1 1/1" });
    expect(seatMarks(spent, pair.ctx)[0]?.note).toContain("Covered in Darkness");
  });

  it("21065:A:1 marks each seat with the cards under its threat dial, a count and never which, and keeps it in a two-handed caption", () => {
    const made = built({ seats: 2, stage: "21081", staging: ["21065"] });
    expect(seatMarks(made.state, made.ctx).map((mark) => mark.label)).toEqual(["P1 0", "P2 0"]);
    const quest = Object.values(made.state.cards).find((card) => card.code === "21065")!.id;
    let state = made.state;
    for (const [index, seat] of [0, 0, 0, 1].entries()) {
      const spawned = spawn(state, "21066", { zone: "under", locationId: quest });
      state = updateCard(spawned.state, spawned.id, { owner: seat, stackedAt: index });
    }
    const marks = seatMarks(state, made.ctx);
    expect(marks.map((mark) => mark.label)).toEqual(["P1 3", "P2 1"]);
    expect(marks[0]?.note).toContain("3 cards facedown under this threat dial");
    expect(marks[0]?.warn).toBeUndefined();
    expect(marks.every((mark) => mark.label.length <= 5)).toBe(true);
  });

  it("merges two pieces on one seat into one mark that keeps both counts", () => {
    const made = built({ seats: 2, stage: "21081", active: "21062", staging: ["21070"] });
    expect(seatMarks(made.state, made.ctx).map((mark) => mark.label)).toEqual(["P1 0/1 · 0/1", "P2 0/1 · 0/1"]);
  });
});

describe("the asks name their owner and say the tie", () => {
  it("21056:A:1, 21068:A:1, 21081:B:1 and 21085:B:2 are one player's own choice, so two-handed the sentence leads with the player and the card is in the why", () => {
    for (const key of ["21056:forced:1 @0.0 Pick", "21068:whenRevealed:1 @0.0 DiscardFromHand", "21081:forced:1 @0.0 Pick", "21085:forced:1 @0.0 Pick"]) {
      expect(ASKS[key]?.owned, key).toBe(true);
      expect(ASKS[key]?.why, key).toBeDefined();
      expect(String(ASKS[key]?.note), key).not.toContain(": ");
    }
  });

  it("21022:A:3, 21023:A:3, 21024:A:2, 21057:A:1 and 21060:A:2 are the first player's for the group, so the sheet adds who chooses", () => {
    for (const key of ["21022:whenRevealed:1 @0 Pick", "21023:whenRevealed:1 @0 Pick", "21024:forced:2 @0 Pick", "21057:whenRevealed:1 @1 Choose", "21060:whenRevealed:1 @0 PickLowestDefense"]) expect(ASKS[key]?.owned, key).toBeUndefined();
  });

  it("21022:A:3 and 21023:A:3 say the tie and its number", () => {
    expect(ASKS["21022:whenRevealed:1 @0 Pick"]?.note).toContain("{tied} Easterling enemies are tied for the lowest Attack ({lowAttack})");
    expect(ASKS["21023:whenRevealed:1 @0 Pick"]?.note).toContain("{tied} Easterling enemies are tied for the highest engagement cost ({highCost})");
  });

  it("21057:A:1 says Tribute's damage and the result of each row, and no row can eliminate a player", () => {
    expect(ASKS["21057:whenRevealed:1 @1 Choose"]?.note).toContain("{tribute} of 4 damage");
    expect(ASKS["21057:whenRevealed:1 @1 damage"]?.label).toContain("{tribute} to {next} of 4");
    expect(ASKS["21057:whenRevealed:1 @1 surge"]?.label).toContain("gains surge");
    for (const key of Object.keys(ASKS)) expect(ASKS[key]?.caution, key).toBeUndefined();
  });
});
