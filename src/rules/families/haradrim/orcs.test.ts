// Rules: hrd.orcs-area, hrd.prepare-the-orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage, rr.cannot, rr.engaged, rr.quest-advancement, faq.triggering-forced-effects (data/rules/entries.json); ledger lines 17047:A:1, 17042:A:1, 17042:A:2, 17045:A:2, 17050:B:2,
// 17051:B:1, 17051:B:2, 17052:B:2, 17052:B:3, 17053:B:3, 17054:B:2, 17054:B:3. The Orcs' area of Race Across Harad on its own: the Setup that prepares it, the cards that stand in the area zone or in the staging area as the players' stage says, the progress of the
// Orcs' stage and its advance, the loss of a defeated stage and the Chieftain that cannot leave.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../core/state.ts";
import { idOf, idsOf, opened, run as runInstruction } from "../../../../test/harness/scene-kit.ts";
import { holds } from "../../interpret/conditions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { withStagingThreat } from "../attachments/hold.ts";
import { atOrcsStage, orcsAreaThreat, orcsMembers } from "./orcs-values.ts";
import { advancedTo, CHIEFTAIN, codeOf, ORCS_STAGES, prepared, raceTable, record, stageId, TREACHERY, URUK } from "./race-kit.ts";

const STAGES = ORCS_STAGES;
const table = raceTable;
const PREPARE: Effect["instructions"][number] = { verb: "PrepareOrcsArea", stages: STAGES, number: 1, place: [CHIEFTAIN] };

describe("17047:A:1 PrepareOrcsArea: the Orcs' area is created with a second quest deck", () => {
  it("the stages become the Orcs' quest deck in order, 1C on top played as 1D, and Uruk Chieftain stands in the area", () => {
    const { state } = prepared();
    const area = state.orcs;
    expect(codeOf(state, area?.stage ?? "")).toBe("17051");
    expect(area?.number).toBe(1);
    expect((area?.deck ?? []).map((id) => codeOf(state, id))).toEqual(["17052", "17053", "17054"]);
    expect(state.cards[area?.stage ?? ""]).toMatchObject({ zone: "orcsArea", face: "B" });
    expect((area?.members ?? []).map((id) => codeOf(state, id))).toEqual([CHIEFTAIN]);
    expect(state.cards[idOf(state, CHIEFTAIN)]?.zone).toBe("orcsArea");
  });

  it("the Orcs' area is never a ship game: no state.sea is set by the Setup, the progress, the advance or a loss", () => {
    const { made, state } = prepared();
    expect(state.sea).toBeUndefined();
    const advanced = advancedTo(made, runInstruction(made, state, { verb: "AddOrcsProgress", amount: 3 }), 4);
    expect(advanced.sea).toBeUndefined();
  });

  it("the area is prepared once and the deck comes out the same on every replay", () => {
    const { made, state } = prepared();
    expect(runInstruction(made, state, PREPARE).orcs).toEqual(state.orcs);
    expect(prepared().state.orcs).toEqual(state.orcs);
    expect(prepared({ seed: 7 }).state.orcs?.deck.map((id) => codeOf(prepared({ seed: 7 }).state, id))).toEqual(["17052", "17053", "17054"]);
  });

  it("a Setup with no Orcs' stage set aside fails and leaves no area", () => {
    const made = table({ setAside: [CHIEFTAIN] });
    const state = runInstruction(made, opened(made).state, PREPARE);
    expect(state.orcs).toBeUndefined();
    expect(state.failure).toMatch(/Orcs' area/);
  });
});

describe("hrd.orcs-area-different-stage the cards of the area stand apart while the players are at another stage", () => {
  it("at another stage the cards are in the area zone, not in the staging area: no Threat there, and no player card effect can choose one", () => {
    const { made, state } = prepared({ staging: ["17042"] });
    const road = idOf(state, "17042");
    const moved = runInstruction(made, state, { verb: "MoveToOrcsArea" }, { sourceId: road });
    // The Chieftain stands apart; a card not yet moved is still in the staging area.
    expect(state.cards[idOf(state, CHIEFTAIN)]?.zone).toBe("orcsArea");
    expect(state.staging).not.toContain(idOf(state, CHIEFTAIN));
    expect(moved.orcs?.members).toContain(idOf(state, CHIEFTAIN));
    const spec = { type: "enemy", control: "any", staging: true, affectable: true } as const;
    expect(pickCandidates(state, spec, 0, [], null, made.ctx)).not.toContain(idOf(state, CHIEFTAIN));
    expect(moved.cards[road]?.zone).toBe("orcsArea");
    expect(pickCandidates(moved, { type: "location", control: "any", staging: true }, 0, [], null, made.ctx)).not.toContain(road);
  });

  it("a card moved into the area leaves the staging area, a card that is moved into the area while engaged loses its engagement", () => {
    const { made, state } = prepared({ staging: ["17042"], engaged: [URUK] });
    const road = idOf(state, "17042");
    const uruk = idOf(state, URUK);
    const next = runInstruction(made, runInstruction(made, state, { verb: "MoveToOrcsArea" }, { sourceId: road }), { verb: "MoveToOrcsArea" }, { sourceId: uruk });
    expect(next.cards[road]?.zone).toBe("orcsArea");
    expect(next.cards[uruk]?.zone).toBe("orcsArea");
    expect(next.seats[0]?.engaged ?? []).not.toContain(uruk);
    expect(next.staging).not.toContain(road);
    expect(next.orcs?.members).toEqual(expect.arrayContaining([road, uruk]));
  });

  it("an enemy destroyed in an attack (out of play) is not moved into the area, and a card moved from the set-aside cards by its code joins it", () => {
    const { made, state } = prepared({ discard: [URUK], setAside: [...STAGES, CHIEFTAIN, "16063"] });
    const uruk = idOf(state, URUK);
    const same = runInstruction(made, state, { verb: "MoveToOrcsArea" }, { sourceId: uruk });
    expect(same.cards[uruk]?.zone).toBe("encounterDiscard");
    expect(same.orcs?.members).not.toContain(uruk);
    const rider = runInstruction(made, state, { verb: "MoveToOrcsArea", code: "16063" });
    expect(rider.cards[idOf(rider, "16063")]?.zone).toBe("orcsArea");
  });
});

describe("hrd.orcs-area-same-stage the cards of the area stand in the staging area when the players reach the Orcs' stage", () => {
  it("at the same stage the members stand in the staging area and add their Threat to its total, and stand apart again when the stages differ", () => {
    const { made, state } = prepared({ stage: "17047" });
    // Stage 1 for the players and 1D for the Orcs: the same stage.
    expect(atOrcsStage(state)).toBe(true);
    const chieftain = idOf(state, CHIEFTAIN);
    expect(state.cards[chieftain]?.zone).toBe("staging");
    expect(state.staging).toContain(chieftain);
    expect(orcsMembers(state)).toEqual([chieftain]);
    const apart = runInstruction(made, { ...state, orcs: { ...state.orcs!, number: 2 } }, { verb: "AddOrcsProgress", amount: 1 });
    expect(atOrcsStage(apart)).toBe(false);
    expect(apart.cards[chieftain]?.zone).toBe("orcsArea");
    const back = runInstruction(made, { ...apart, orcs: { ...apart.orcs!, number: 1 } }, { verb: "AddOrcsProgress", amount: 1 });
    expect(back.cards[chieftain]?.zone).toBe("staging");
    expect(back.orcs?.members).toContain(chieftain);
  });

  it("a member that left the area (engaged, active or discarded) is no longer one, whatever the stage", () => {
    const first = prepared({ stage: "17048" });
    const made = first.made;
    const state = advancedTo(made, first.state, 2);
    const chieftain = idOf(state, CHIEFTAIN);
    expect(state.cards[chieftain]?.zone).toBe("staging");
    const engaged = runInstruction(made, state, { verb: "EngageSeatWithMost", pick: { type: "enemy", control: "any", trait: "Orc", nonUnique: true } }, { sourceId: chieftain });
    expect(engaged.cards[chieftain]?.zone).toBe("engaged");
    expect(engaged.orcs?.members).not.toContain(chieftain);
    const apart = runInstruction(made, { ...engaged, orcs: { ...engaged.orcs!, number: 3 } }, { verb: "AddOrcsProgress", amount: 1 });
    expect(apart.cards[chieftain]?.zone).toBe("engaged");
  });

  it("the condition orcsStage reads the main quest stage only, a number of the Orcs' stage, and is false in a game with no area", () => {
    const { made, state } = prepared();
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const test = (s: ScenarioState, condition: Parameters<typeof holds>[1]): boolean => holds(s, condition, scope, made.ctx);
    expect(test(state, { kind: "orcsStage", is: "differentStage" })).toBe(true);
    expect(test(state, { kind: "orcsStage", is: "sameStage" })).toBe(false);
    expect(test(state, { kind: "orcsStage", at: 1 })).toBe(true);
    expect(test(state, { kind: "orcsStage", at: 2 })).toBe(false);
    const bare = opened(made).state;
    expect(test(bare, { kind: "orcsStage", is: "differentStage" })).toBe(false);
    expect(test(bare, { kind: "orcsStage", is: "sameStage" })).toBe(false);
  });
});

describe("17051:B:2 OrcsProgress: the Orcs' stage takes the discarded card's Threat plus the total Threat in the area", () => {
  it("X is the printed Threat of the discarded card (0 for a treachery) plus the current Threat of the cards in the area, the Chieftain included", () => {
    const { made, state } = prepared({ deck: [URUK, TREACHERY] });
    const first = runInstruction(made, state, { verb: "OrcsProgress" });
    expect(first.cards[stageId(first)]?.progress).toBe(2 + 4);
    expect(first.cards[idOf(first, URUK)]?.zone).toBe("encounterDiscard");
    // The second discard is a treachery: 0 + 4 makes 10, the quest points of 1D: the Orcs advance to 2C and 2D.
    const second = runInstruction(made, first, { verb: "OrcsProgress" });
    expect(codeOf(second, stageId(second))).toBe("17052");
  });

  it("the Threat counted is the modified one and a card added to the area adds its own, engaged enemies not", () => {
    const { made, state } = prepared({ deck: [TREACHERY], engaged: [URUK], staging: ["17042"] });
    const road = idOf(state, "17042");
    const withRoad = runInstruction(made, state, { verb: "MoveToOrcsArea" }, { sourceId: road });
    expect(orcsAreaThreat(withRoad, made.cards)).toBe(4 + 5);
    const boosted = { ...withRoad, modifiers: [...withRoad.modifiers, { instanceId: idOf(withRoad, CHIEFTAIN), sourceId: "t", stat: "threat" as const, amount: 2, until: "endOfGame" as const }] };
    expect(orcsAreaThreat(boosted, made.cards)).toBe(6 + 5);
    // X is 0 + 11, more than the 10 quest points of 1D: the stage is defeated and the Orcs advance.
    const done = runInstruction(made, boosted, { verb: "OrcsProgress" });
    expect(codeOf(done, stageId(done))).toBe("17052");
    const partial = runInstruction(made, { ...boosted, modifiers: boosted.modifiers.slice(0, -1) }, { verb: "OrcsProgress" });
    expect(partial.cards[stageId(partial)]?.progress).toBe(9);
  });

  it("17054:B:2 at stage 4D X counts the Threat of each engaged enemy and not the area's", () => {
    const { made, state } = prepared({ deck: ["17046"], engaged: [URUK, "16063"] });
    const done = runInstruction(made, state, { verb: "OrcsProgress", engaged: true });
    expect(done.cards[stageId(done)]?.progress).toBe(0 + 2 + 3);
  });

  it("a stage never holds more progress than its quest points", () => {
    const { made, state } = prepared({ deck: [URUK] });
    const full = runInstruction(made, state, { verb: "AddOrcsProgress", amount: 9 });
    const done = runInstruction(made, full, { verb: "AddOrcsProgress", amount: 1 });
    expect(codeOf(done, stageId(done))).toBe("17052");
    expect(done.cards[stageId(done)]?.progress).toBe(0);
  });
});

describe("hrd.orcs-area the Orcs advance through their quest deck, C side first, then D side", () => {
  it("a full 1D is defeated: 1C leaves, stage 2 takes its place on its D side and its When Revealed resolves", () => {
    const { made, state } = prepared({ stage: "17049", deck: [TREACHERY, TREACHERY, URUK] });
    const done = runInstruction(made, state, { verb: "AddOrcsProgress", amount: 10 });
    expect(codeOf(done, stageId(done))).toBe("17052");
    expect(done.orcs?.number).toBe(2);
    expect((done.orcs?.deck ?? []).map((id) => codeOf(done, id))).toEqual(["17053", "17054"]);
    expect(done.cards[stageId(done)]).toMatchObject({ zone: "orcsArea", face: "B" });
    expect(done.cards[idOf(state, "17051")]?.zone).toBe("setAside");
    // 17052:A:1: the players are at stage 3, past 2B, so an Orc discarded from the top joins the area.
    expect((done.orcs?.members ?? []).map((id) => codeOf(done, id))).toContain(URUK);
  });

  it("17052:A:1 while the players are still at stage 2B the C side adds no Orc", () => {
    const { made, state } = prepared({ stage: "17048", deck: [TREACHERY, URUK] });
    const done = runInstruction(made, state, { verb: "AddOrcsProgress", amount: 10 });
    expect(codeOf(done, stageId(done))).toBe("17052");
    expect((done.orcs?.members ?? []).map((id) => codeOf(done, id))).toEqual([CHIEFTAIN]);
  });

  it("only the stage in play fires its Forced: a defeated stage leaves surplus progress behind, and the next D side starts empty", () => {
    const { made, state } = prepared({ deck: [URUK] });
    const done = runInstruction(made, state, { verb: "AddOrcsProgress", amount: 99 });
    expect(done.cards[stageId(done)]?.progress).toBe(0);
    expect(done.orcs?.number).toBe(2);
  });
});

describe("17052:B:3 17053:B:3 17054:B:3 a stage the Orcs defeat loses the game when its line says so", () => {
  it("2D defeated while the players are at 2B loses the game; at 3B the Orcs advance and the game goes on", () => {
    const at2 = prepared({ stage: "17048" });
    const lost = runInstruction(at2.made, advancedTo(at2.made, at2.state, 2), { verb: "AddOrcsProgress", amount: 15 });
    expect(lost.lost).toBeTruthy();
    const at3 = prepared({ stage: "17049" });
    const goes = runInstruction(at3.made, advancedTo(at3.made, at3.state, 2), { verb: "AddOrcsProgress", amount: 15 });
    expect(goes.lost).toBeFalsy();
    expect(codeOf(goes, stageId(goes))).toBe("17053");
  });

  it("3D defeated while the players are at 3B loses the game, at 4B it does not", () => {
    const at3 = prepared({ stage: "17049" });
    const lost = runInstruction(at3.made, advancedTo(at3.made, at3.state, 3), { verb: "AddOrcsProgress", amount: 20 });
    expect(lost.lost).toBeTruthy();
    const at4 = prepared({ stage: "17050" });
    const goes = runInstruction(at4.made, advancedTo(at4.made, at4.state, 3), { verb: "AddOrcsProgress", amount: 20 });
    expect(goes.lost).toBeFalsy();
    expect(codeOf(goes, stageId(goes))).toBe("17054");
  });

  it("4D defeated loses the game whatever stage the players are at, and the stage stays in play", () => {
    const at4 = prepared({ stage: "17050" });
    const done = runInstruction(at4.made, advancedTo(at4.made, at4.state, 4), { verb: "AddOrcsProgress", amount: 20 });
    expect(done.lost).toBeTruthy();
    expect(codeOf(done, stageId(done))).toBe("17054");
  });
});

describe("17050:B:2 17045:A:3 progress placed on the Orcs' stage by a card", () => {
  it("1 progress and 2 progress go on the current stage, whatever stage the players are at", () => {
    const { made, state } = prepared({ stage: "17050" });
    const one = runInstruction(made, state, { verb: "AddOrcsProgress", amount: 1 });
    expect(one.cards[stageId(one)]?.progress).toBe(1);
    expect(runInstruction(made, one, { verb: "AddOrcsProgress", amount: 2 }).cards[stageId(one)]?.progress).toBe(3);
  });

  it("with no Orcs' area (any other game) a progress verb changes nothing", () => {
    const made = table();
    const state = opened(made).state;
    expect(runInstruction(made, state, { verb: "AddOrcsProgress", amount: 3 })).toEqual(runInstruction(made, state, { verb: "AddOrcsProgress", amount: 3 }));
    expect(runInstruction(made, state, { verb: "OrcsProgress" }).orcs).toBeUndefined();
  });
});

describe("17051:B:1 17052:B:2 Uruk Chieftain cannot leave the Orcs' area", () => {
  const engage = { verb: "EngageSeatWithMost", pick: { type: "enemy", control: "any", trait: "Orc", nonUnique: true } } as const;

  it("at another stage the Chieftain in the area zone never engages, with or without the flag", () => {
    const { made, state } = prepared();
    const chieftain = idOf(state, CHIEFTAIN);
    expect(runInstruction(made, state, engage, { sourceId: chieftain }).cards[chieftain]?.zone).toBe("orcsArea");
  });

  it("17051:B:1 while stage 1D is in play the Chieftain does not engage even at the same stage", () => {
    const { made, state } = prepared({ stage: "17047" });
    const chieftain = idOf(state, CHIEFTAIN);
    expect(state.cards[chieftain]?.zone).toBe("staging");
    expect(runInstruction(made, state, engage, { sourceId: chieftain }).cards[chieftain]?.zone).toBe("staging");
  });

  it("at the same stage 2 the Chieftain engages the player (the first player chooses among players at 0), and a card that says he cannot leave holds him", () => {
    const first = prepared({ stage: "17048" });
    const made = first.made;
    const state = advancedTo(made, first.state, 2);
    const chieftain = idOf(state, CHIEFTAIN);
    expect(runInstruction(made, state, engage, { sourceId: chieftain }).cards[chieftain]?.zone).toBe("engaged");
    const held = { ...state, modifiers: [...state.modifiers, { instanceId: chieftain, sourceId: stageId(state), stat: "cannotLeaveOrcsArea" as const, amount: 1, until: "endOfGame" as const }] };
    expect(runInstruction(made, held, engage, { sourceId: chieftain }).cards[chieftain]?.zone).toBe("staging");
  });

  it("17052:B:2 an engaged Chieftain returns to the Orcs' area first, losing his engagement, then the Orcs make progress with his Threat", () => {
    const first = prepared({ stage: "17048", deck: [TREACHERY] });
    const made = first.made;
    const state = advancedTo(made, first.state, 2);
    const chieftain = idOf(state, CHIEFTAIN);
    const seized = runInstruction(made, state, { verb: "EngageSeatWithMost", pick: { type: "enemy", control: "any", trait: "Orc", nonUnique: true } }, { sourceId: chieftain });
    expect(seized.cards[chieftain]?.zone).toBe("engaged");
    const back = record(made, seized, "17052:forced:1", stageId(seized));
    expect(back.seats[0]?.engaged ?? []).not.toContain(chieftain);
    expect(back.orcs?.members).toContain(chieftain);
    // He returned to the area (the same stage: it is the staging area), so his Threat of 4 counts in X.
    expect(back.cards[stageId(back)]?.progress).toBe(0 + 4);
  });

  it("17052:B:2 with no Chieftain in play the return does nothing and the Orcs still make progress", () => {
    const first = prepared({ stage: "17048", deck: [URUK] });
    const made = first.made;
    const state = advancedTo(made, first.state, 2);
    const gone = { ...state, cards: { ...state.cards, [idOf(state, CHIEFTAIN)]: { ...state.cards[idOf(state, CHIEFTAIN)]!, zone: "discard" as const } } };
    const done = record(made, gone, "17052:forced:1", stageId(gone));
    expect(done.cards[stageId(done)]?.progress).toBe(2);
  });
});

describe("17045:A:2 the Orc enemy discarded from the top goes into the Orcs' area", () => {
  it("the cards above it are discarded, the Orc is added to the area (no When Revealed), a Creature such as Racing Warg is skipped", () => {
    const { made, state } = prepared({ deck: [TREACHERY, "17044", URUK, TREACHERY] });
    const done = record(made, state, "17045:whenRevealed:1", idOf(state, "17047"));
    expect(idsOf(done, URUK).map((id) => done.cards[id]?.zone)).toEqual(["orcsArea"]);
    expect(done.encounterDiscard.map((id) => codeOf(done, id))).toEqual([TREACHERY, "17044"]);
    expect(done.orcs?.members).toContain(idOf(done, URUK));
    expect(withStagingThreat(done, 0, made.cards)).toBe(0);
  });
});
