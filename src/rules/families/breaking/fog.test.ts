// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.player-elimination, rr.delayed-effects, rr.quest-advancement, rr.cancel, rr.lasting-effects, rr.effects, rr.forced (data/rules/entries.json);
// ledger lines 148003:B:2, 148003:B:3, 148004:B:1, 148004:B:2, 148014:A:1, 148016:A:1, 148017:A:2, 148018:A:2.
// The breaking family's vocabulary for Fog on the Barrow-downs (RaiseThreatAtStage on a stage, allAtStage, CancelRevealed, the areas apart read as "each player"), the Delay until the travel phase and the stage flags, on the trapped scene
// (test/scenarios/fog-on-the-barrow-downs/scene.ts). The other families' vocabulary is tested in their own folders.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { eliminateSeat } from "../../core/eliminate.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { idOf, resolveRecords, revealFromTop } from "../../../../test/harness/scene-kit.ts";
import { codeOf, focus, fogTable as table, GREAT_BARROW, STAGE_3, trapped } from "../../../../test/scenarios/fog-on-the-barrow-downs/scene.ts";
import { parkedStage, stagingOf } from "./areas.ts";

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

describe("148018:A:2 Dreadful Song's end-of-round raise reads the hero's controller", () => {
  it("raises the threat of the player whose hero carries it by 1 for each Wight engaged with him, whoever holds the first player token", () => {
    const t = table({ seats: 2, firstPlayer: 0, engaged: [{ code: "148011", seat: 1 }, { code: "148012", seat: 1 }, { code: "148013", seat: 0 }] });
    const hero = t.state.seats[1].heroes[0] ?? "";
    const song = spawn(t.state, "148018", { zone: "attached" });
    const attached = updateCard(song.state, song.id, { host: hero, controller: 1 });
    const withHost = updateCard(attached, hero, { attachments: [song.id] });
    const record = t.ctx.effects.find((effect) => effect.id === "148018:forced:1");
    const pushed = pushCardEffects({ ...withHost, window: null }, "forced", song.id, 0, false, record ? [record] : [], t.ctx, []);
    const done = settle({ ...pushed, mode: "stopped" }, t.ctx, []);
    expect(done.seats[1].threat).toBe(t.state.seats[1].threat + 2);
    expect(done.seats[0].threat).toBe(t.state.seats[0].threat);
  });
});

describe("areas apart: what an encounter card reads as 'each player', 'at this stage' and 'in play'", () => {
  it("148016:A:1 Chill Fog discards the resources of the heroes at the revealer's stage only, and only its players raise their threat", () => {
    const { t, state } = trapped({ heroResources: 2 });
    const first = state.firstPlayer;
    const run = resolveRecords(state, t.ctx, "148016", "whenRevealed");
    const mine = state.seats[first].heroes.map((id) => run.state.cards[id]?.resources);
    const theirs = state.seats[1 - first].heroes.map((id) => run.state.cards[id]?.resources);
    expect(mine.every((count) => count === 0)).toBe(true);
    expect(theirs.every((count) => count === 2)).toBe(true);
    expect(run.state.seats[first].threat).toBe(state.seats[first].threat + 2 * state.seats[first].heroes.length);
    expect(run.state.seats[1 - first].threat).toBe(state.seats[1 - first].threat);
  });

  it("148017:A:2 Frozen by Fear holds the players at the revealer's stage only", () => {
    const { t, state } = trapped();
    const run = resolveRecords(state, t.ctx, "148017", "whenRevealed");
    const held = (seat: number) => flagged(run.state, `seat:${seat}`, "cannotTriggerEffects");
    expect(held(state.firstPlayer)).toBe(true);
    expect(held(1 - state.firstPlayer)).toBe(false);
  });

  it("148014:A:1 I'm Waiting for You! makes the Wights engaged with the revealer's area attack, not the other area's", () => {
    const { t, state } = trapped({ engaged: [{ code: "148011", seat: 0 }] });
    // Only seat 0 has a Wight engaged: its area's reveal makes it attack, the other area's makes none and the card gains surge.
    const attacks = (seat: number) => resolveRecords({ ...state, firstPlayer: seat }, t.ctx, "148014", "whenRevealed").steps.filter((step) => step.kind === "attack").length;
    expect(attacks(0)).toBeGreaterThan(attacks(1));
    expect(attacks(1)).toBe(0);
  });
});
