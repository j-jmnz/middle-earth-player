// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.player-elimination, rr.delayed-effects, rr.quest-advancement, rr.cancel, rr.lasting-effects, rr.effects, rr.forced (data/rules/entries.json);
// ledger lines 148003:A:1, 148003:B:2, 148003:B:3, 148004:A:1, 148004:B:1, 148004:B:2, 148008:A:2, 148012:A:1, 148013:A:1, 148015:A:2, 148017:A:2.
// The vocabulary Fog on the Barrow-downs adds (breaking, burden, quest, deck, misc, defense, sidequests and harad families), each on a table the layout kit builds from data/.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, livingSeats, updateCard, withSeat, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { resolutionStep } from "../../quest/stage-reveal.ts";
import { stagingThreat } from "../../quest/quest.ts";
import { allyCard, idOf, resolveRecords, revealFromTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { parkedStage, stageOf, stagingOf } from "./areas.ts";

const SCENARIO = "fog-on-the-barrow-downs";
const STAGE_3 = "148003";
const STAGE_4 = "148004";
const GREAT_BARROW = "148007";
const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout(SCENARIO, { stage: STAGE_3, phase: "Quest", ...layout });
const focus = (seat: number, sourceId: string | null = null) => ({ seat, sourceId });
const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);

// Two players, seat 1 trapped by a Great Barrow it revealed: seat 0 at stage 3B, seat 1 at a stage 4A.
function trapped(layout: Parameters<typeof tableFromLayout>[1] = {}) {
  const t = table({ seats: 2, firstPlayer: 1, deck: ["148011"], staging: ["148009"], ...layout });
  let state = spawn(t.state, STAGE_4, { zone: "questDeck" }).state;
  state = spawn(state, STAGE_4, { zone: "questDeck" }).state;
  const revealed = revealFromTop(state, t.ctx, GREAT_BARROW, []);
  return { t, ...revealed };
}

describe("148004:A:1 End your quest phase, then keep as many allies as enemies are engaged", () => {
  it("EndQuestPhase own: only the acting seat's reveals stop, its characters stop being committed and its quest is not resolved", () => {
    const { t, state } = trapped();
    const hero = state.seats[1].heroes[0] ?? "";
    const staging = { ...updateCard(state, hero, { committed: true }), mode: "staging" as const, revealCursor: { seats: [1, 0], index: 1 } };
    const ended = runInstruction(staging, { verb: "EndQuestPhase", own: true }, focus(1, stageOf(staging, 1)), t.ctx, []);
    expect(ended.mode).toBe("staging");
    expect(ended.questEnded).toEqual([1]);
    expect(ended.cards[hero]?.committed).toBe(false);
    // Seat 1 had made one of the reveals: the cursor now counts the seats left (seat 0) from none made.
    expect(ended.revealCursor).toEqual({ seats: [0], index: 0 });
    // Without separate areas it is the whole phase ending, as ever.
    const shared = table({ seats: 2 });
    const whole = runInstruction({ ...shared.state, mode: "staging", revealCursor: { seats: [0, 1], index: 1 } }, { verb: "EndQuestPhase", own: true }, focus(0), shared.ctx, []);
    expect(whole.mode).toBe("resolution");
    expect(whole.questEnded).toBeUndefined();
  });

  it("the resolution leaves the seat out: no quest step for it, and its threat does not rise", () => {
    const { t, state } = trapped();
    const ended = { ...state, mode: "resolution" as const, questEnded: [1], questResolved: false, window: null };
    const steps: EngineStep[] = [];
    const resolved = resolutionStep(ended, t.ctx, steps);
    expect(steps.filter((step) => step.kind === "quest")).toHaveLength(1);
    expect(resolved.seats[1].threat).toBe(state.seats[1].threat);
    expect(resolved.questEnded).toBeUndefined();
  });

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

describe("148003:B:2 and B:3 the shared stage", () => {
  it("148003:B:2 hears every elimination (playerEliminated) and raises the players at its stage by 10; one at another stage is not raised", () => {
    const { t, state } = trapped();
    const steps: EngineStep[] = [];
    const eliminated = eliminateSeat({ ...state, firstPlayer: 0 }, 1, steps);
    const heard = settle({ ...eliminated, mode: "stopped", window: null }, t.ctx, steps);
    // Seat 0 is the only seat left at stage 3B: raised by 10 once.
    expect(heard.seats[0].threat).toBe(state.seats[0].threat + 10);
    expect(livingSeats(heard)).toEqual([0]);
    // The eliminated player's stage went back to the quest deck and the areas are one again.
    expect(heard.separate).toBeUndefined();
  });

  it("148003:B:2 with nobody at stage 3B nobody is raised, and the stage stays in play", () => {
    const { t, state } = trapped();
    const stage = state.seats[0].stage ?? "";
    const steps: EngineStep[] = [];
    const heard = settle({ ...eliminateSeat(state, 0, steps), mode: "stopped", window: null }, t.ctx, steps);
    expect(heard.seats[1].threat).toBe(state.seats[1].threat);
    expect(parkedStage(heard)).toBe(stage);
    expect(heard.cards[stage]?.zone).toBe("questStage");
  });

  it("148003:B:3 allAtStage holds with one area and fails once a player is trapped, for the stage and for no stage", () => {
    const shared = table({ seats: 2 });
    const stage = idOf(shared.state, STAGE_3);
    const all = (state: ScenarioState, ctx: typeof shared.ctx, is: boolean, source: string | null) => holds(state, { kind: "allAtStage", is }, { actor: 0, sourceId: source, returned: 0 }, ctx);
    expect(all(shared.state, shared.ctx, true, stage)).toBe(true);
    const { t, state } = trapped();
    expect(all(state, t.ctx, true, state.seats[0].stage ?? "")).toBe(false);
    expect(all(state, t.ctx, false, state.seats[0].stage ?? "")).toBe(true);
    // Once the other player is eliminated the one left is at the stage alone.
    const steps: EngineStep[] = [];
    const alone = settle({ ...eliminateSeat(state, 1, steps), mode: "stopped", window: null }, t.ctx, steps);
    expect(all(alone, t.ctx, true, alone.questStage ?? "")).toBe(true);
  });

  it("148003:B:3 defeating stage 3B wins the game (its Forced effect), and stage 4B is held, not won, when it is defeated", () => {
    const won = table({ seats: 1, victory: ["148006"], progress: 0 });
    const stage = idOf(won.state, STAGE_3);
    const points = printedOf(won.ctx.cards, STAGE_3).questPoints ?? 1;
    const full = updateCard(won.state, stage, { progress: points });
    const run = resolveRecords(full, won.ctx, STAGE_3, "forced", stage);
    expect(run.state).toBeDefined();
    // 3B is not followed by stage 4 in the order the quest lists: advancing it ends the game (held, with its Forced effect to win).
    const advanced = runInstruction(updateCard(won.state, stage, { progress: points }), { verb: "AdvanceStage" }, focus(0, stage), won.ctx, []);
    expect(advanced.stageHeld).toBe(stage);
    expect(advanced.questStage).toBe(stage);
    // Stage 4B: held on its defeat; its own Forced effect sends the player back.
    const trap = trapped();
    const four = trap.state.seats[1].stage ?? "";
    const defeated = runInstruction(trap.state, { verb: "AdvanceStage" }, focus(1, four), trap.t.ctx, []);
    expect(defeated.stageHeld).toBe(four);
    expect(defeated.stageCleared).not.toBe(true);
  });
});

describe("148004:B:2 the Delay until the travel phase begins", () => {
  it("returns the player to stage 3B when the travel phase begins, not before, and places 1 progress on a Great Barrow there", () => {
    const { t, state } = trapped();
    const four = state.seats[1].stage ?? "";
    const barrow = idOf(state, GREAT_BARROW);
    const record = t.ctx.effects.find((effect) => effect.id === "148004:forced:2");
    const pushed = pushCardEffects({ ...state, stageHeld: four, window: null }, "forced", four, 1, false, record ? [record] : [], t.ctx, []);
    const quest = settle({ ...pushed, mode: "stopped" }, t.ctx, []);
    // The Forced effect only schedules the return: the player is still at stage 4B, the stage held.
    expect(quest.delayed.map((entry) => entry.until)).toEqual(["beginningOfTravel"]);
    expect(quest.separate).toBe(true);
    const travel = settle({ ...quest, phase: "Travel", boundaryPhase: "Quest", mode: "travel", window: null }, t.ctx, []);
    expect(travel.delayed).toEqual([]);
    expect(travel.separate).toBeUndefined();
    expect(codeOf(travel, travel.questStage)).toBe(STAGE_3);
    expect(travel.stageHeld).toBeUndefined();
    // The 1 progress went on the Great Barrow (1 quest point: explored, in the victory display).
    expect(travel.cards[barrow]?.zone).toBe("victory");
  });
});

describe("148004:B:1 a location revealed at stage 4B", () => {
  it("is canceled and discarded, the revealer raises his threat by its Threat, and no other card is revealed in its place", () => {
    const { t, state } = trapped({ deck: ["f0", "148011", "f3"] });
    const before = state.seats[1].threat;
    // Seat 1, at stage 4B, reveals a location (a place of 2 Threat): the Forced effect on the reveal cancels it.
    const revealed = revealFromTop(state, t.ctx, "place", []);
    const place = revealed.id;
    expect(revealed.state.cards[place]?.zone).toBe("encounterDiscard");
    expect(revealed.state.seats[1].threat).toBe(before + 2);
    expect(stagingOf(revealed.state, 1).includes(place)).toBe(false);
    // No card is revealed in its place: the deck holds what it did, and nothing else entered the area.
    expect(revealed.state.encounterDeck.map((id) => codeOf(revealed.state, id))).toEqual(["f3"]);
    // The player at stage 3B reveals it as ever: it stays in the staging area.
    const other = revealFromTop({ ...state, firstPlayer: 0 }, t.ctx, "place", []);
    expect(other.state.cards[other.id]?.zone).toBe("staging");
    expect(other.state.seats[0].threat).toBe(state.seats[0].threat);
  });
});

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
    const explored = runInstruction(run.state, { verb: "ReturnFacedownToHands" }, { seat: 0, sourceId: barrow }, t.ctx, []);
    expect(explored.cards[ally]?.zone === "hand" || explored.cards[ally]?.zone === "under").toBe(true);
  });
});

describe("the flags a Wight and Frozen by Fear set", () => {
  it("148012:A:1 noCardDraw bars a card effect's draw and not the resource phase's", () => {
    const t = table({ seats: 1, deckOf: ["ally", "ally"] });
    const hold = { ...t.state, modifiers: [{ instanceId: "seat:0", sourceId: "x", stat: "noCardDraw" as const, amount: 1, until: "endOfRound" as const }] };
    const drawn = runInstruction(hold, { verb: "Draw", amount: 1 }, focus(0, null), t.ctx, []);
    expect(drawn.seats[0].hand).toHaveLength(0);
    expect(flagged(hold, "seat:0", "noCardDraw")).toBe(true);
  });

  it("148013:A:1 noCardResources bars a card effect's resources on the hero and not the collection", () => {
    const t = table({ seats: 1 });
    const hero = t.state.seats[0].heroes[0] ?? "";
    const hold = { ...t.state, modifiers: [{ instanceId: hero, sourceId: "x", stat: "noCardResources" as const, amount: 1, until: "endOfRound" as const }] };
    const source = spawn(hold, "attachment", { zone: "staging" });
    const gained = runInstruction(source.state, { verb: "AddResources", amount: 2, to: "picked" }, focus(0, source.id), t.ctx, []);
    expect(gained.cards[hero]?.resources).toBe(t.state.cards[hero]?.resources);
  });

  it("148017:A:2 a seat held by cannotTriggerEffects triggers no Action or Response and plays no event", () => {
    const t = table({ seats: 2, hand: [{ code: "event", seat: 1 }] });
    const event = idOf(t.state, "event");
    const frozen = { ...t.state, modifiers: [{ instanceId: "seat:1", sourceId: "x", stat: "cannotTriggerEffects" as const, amount: 1, until: "endOfRound" as const }] };
    expect(flagged(frozen, "seat:1", "cannotTriggerEffects")).toBe(true);
    expect(frozen.cards[event]?.zone).toBe("hand");
    expect(withSeat).toBeDefined();
  });
});

describe("148015:A:2 each Wight engaged with the revealer contributes its Threat", () => {
  it("engagedThreatSeat with a Trait counts only the enemies with it, and only those of the seat's own area", () => {
    const t = table({ seats: 2, engaged: [{ code: "148011", seat: 0 }, { code: "f3", seat: 0 }, { code: "148012", seat: 1 }] });
    const base = stagingThreat(t.state, t.ctx.cards);
    const held = { ...t.state, modifiers: [{ instanceId: "seat:0", sourceId: "x", stat: "engagedThreatSeat" as const, amount: 1, until: "endOfPhase" as const, trait: "Wight" }] };
    const wight = printedOf(t.ctx.cards, "148011").threat ?? 0;
    expect(stagingThreat(held, t.ctx.cards)).toBe(base + wight);
  });
});

describe("148003:A:1 shuffling each copy of Great Barrow into the encounter deck", () => {
  it("ShuffleSetAsideIntoEncounterDeck all puts every set-aside copy in, and without all only the first", () => {
    const t = table({ seats: 1, setAside: [GREAT_BARROW, GREAT_BARROW, GREAT_BARROW] });
    const one = runInstruction(t.state, { verb: "ShuffleSetAsideIntoEncounterDeck", code: GREAT_BARROW }, focus(0), t.ctx, []);
    expect(one.setAside.filter((id) => codeOf(one, id) === GREAT_BARROW)).toHaveLength(2);
    const all = runInstruction(t.state, { verb: "ShuffleSetAsideIntoEncounterDeck", code: GREAT_BARROW, all: true }, focus(0), t.ctx, []);
    expect(all.setAside.filter((id) => codeOf(all, id) === GREAT_BARROW)).toHaveLength(0);
    expect(all.encounterDeck.filter((id) => codeOf(all, id) === GREAT_BARROW)).toHaveLength(3);
  });
});
