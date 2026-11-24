// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, hon.battle, hon.siege, rr.quest-advancement, faq.progress-without-advancing, rr.forced (data/rules/entries.json); ledger lines 132075:B:1, 132076:B:1, 132076:B:2, 132077:B:1, 132077:B:2, 132077:B:3, 132078:B:1, 132078:B:2, 132078:B:3, 132079:B:2.
// The stage lines on purpose: the choice of the current stage each round, progress on the current stage only, "complete" at the quest points, each stage's gate on the other two, each end-of-round Forced at no progress, Battle and Siege while their stage is current, and stage 5's bar on progress.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { askCurrentStage, stageComplete } from "../../../rules/families/armies/stages.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { committedWillpower, stagingThreat } from "../../../rules/quest/quest.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { withoutLines } from "../../../../test/harness/card-spec.ts";
import { answer, finish, first, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const [S1, S2, S3, S4, S5] = ["132075", "132076", "132077", "132078", "132079"] as const;
const STAGES = [S2, S3, S4] as const;
const table = (layout: Layout = {}, effects = EFFECTS) => tableFromLayout("the-battle-of-five-armies", { stage: S1, ...layout }, { effects });
// Stage 1's When Revealed has put stages 2, 3 and 4 into play, stage 2 the current stage.
function inPlay(layout: Layout = {}, effects = EFFECTS) {
  const made = table(layout, effects);
  return { ...made, state: resolveRecords(made.state, made.ctx, S1, "whenRevealed", first(made.state, S1)).state };
}
type Made = ReturnType<typeof inPlay>;
const idOf = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";
const progressOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
const withProgress = (state: ScenarioState, code: string, progress: number): ScenarioState => ({ ...state, cards: { ...state.cards, [idOf(state, code)]: { ...state.cards[idOf(state, code)]!, progress } } });
const currentCode = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;
const atStage = (made: Made, current: string): Made => ({ ...made, state: { ...made.state, questStage: idOf(made.state, current) } });
// `amount` progress is placed on the current stage by a quest result.
function place(made: Made, amount: number): ScenarioState {
  const placed = runInstruction(syncConstants(made.state, made.ctx), { verb: "ProgressQuest", amount }, { seat: 0, sourceId: null }, made.ctx, []);
  return settle({ ...placed, window: null }, made.ctx, []);
}
function endOfRound(made: Made, state: ScenarioState = made.state): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null }, { trigger: "endOfRound", seat: null }, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
}

describe("the current stage is chosen each round (132075:B:1)", () => {
  const ask = (made: Made, round: number) => {
    const asked = askCurrentStage({ ...made.state, round }, []);
    return settle({ ...asked!, window: null }, made.ctx, []);
  };

  it("132075:B:1 the choice is asked again in the next round, and the stage chosen last round stays until then", () => {
    const made = inPlay();
    const one = answer({ state: ask(made, 1), steps: [] }, made.ctx, () => idOf(made.state, S4));
    expect(currentCode(one.state)).toBe(S4);
    expect(askCurrentStage(one.state, [])).toBeNull();
    const two = { ...one.state, round: 2 };
    expect(currentCode(two)).toBe(S4);
    expect(askCurrentStage(two, [])).not.toBeNull();
  });

  it("132075:B:1 the first player makes the choice, and offers each of the three stages in play", () => {
    const made = inPlay({ seats: 2, firstPlayer: 1 });
    const settled = ask(made, 1);
    expect(settled.window?.kind).toBe("choose");
    expect(JSON.stringify(settled.window)).toContain(idOf(made.state, S2));
    expect(JSON.stringify(settled.window)).toContain(idOf(made.state, S3));
    expect(JSON.stringify(settled.window)).toContain(idOf(made.state, S4));
    expect(settled.window).toMatchObject({ kind: "choose", seat: 1 });
  });
});

describe("progress goes on the current stage only (132076:B:1, 132077:B:1, 132078:B:1)", () => {
  for (const current of STAGES) {
    it(`${current}:B:1 progress from a quest goes on the current stage and on no other`, () => {
      const after = place(atStage(inPlay({ seats: 2 }), current), 3);
      for (const code of STAGES) expect(progressOn(after, code)).toBe(code === current ? 3 : 0);
    });

    it(`${current}:B:1 the stage is complete at its quest points (8) and not at 7`, () => {
      const made = inPlay();
      expect(stageComplete(withProgress(made.state, current, 7), idOf(made.state, current), made.ctx.cards)).toBe(false);
      expect(stageComplete(withProgress(made.state, current, 8), idOf(made.state, current), made.ctx.cards)).toBe(true);
    });
  }
});

describe("a stage advances only when the other two are complete (132076:B:1, 132077:B:1, 132078:B:1)", () => {
  for (const current of STAGES) {
    const others = STAGES.filter((code) => code !== current);
    it(`${current}:B:1 players cannot advance from it unless ${others.join(" and ")} are complete, and advance together when they are`, () => {
      const made = atStage(inPlay(), current);
      // The stage is full, one other stage complete, the other one short by 1: it waits, whichever of the two is short.
      for (const [done, short] of [[others[0]!, others[1]!], [others[1]!, others[0]!]] as const) {
        const waiting = place({ ...made, state: withProgress(withProgress(made.state, done, 8), short, 7) }, 8);
        expect(currentCode(waiting)).toBe(current);
        expect(waiting.armies).toBeDefined();
        expect(waiting.cards[idOf(waiting, current)]?.zone).toBe("questStage");
        expect(progressOn(waiting, current)).toBe(8);
      }
      const alone = place(made, 8);
      expect(currentCode(alone)).toBe(current);
      expect(alone.armies).toBeDefined();
      const both = place({ ...made, state: withProgress(withProgress(made.state, others[0]!, 8), others[1]!, 8) }, 8);
      expect(currentCode(both)).toBe(S5);
      expect(both.armies).toBeUndefined();
    });
  }

  it("132077:B:1 the last stage to be completed is any of the three: stage 2 and stage 4 full, progress on stage 3 completes it and all advance", () => {
    const made = atStage(inPlay(), S3);
    const full = place({ ...made, state: withProgress(withProgress(made.state, S2, 8), S4, 8) }, 2);
    expect(currentCode(full)).toBe(S3);
    const done = place({ ...made, state: withProgress(withProgress(withProgress(made.state, S2, 8), S4, 8), S3, 6) }, 2);
    expect(currentCode(done)).toBe(S5);
  });
});

describe("each end-of-round Forced needs no progress on its stage (132076:B:2, 132077:B:3, 132078:B:3)", () => {
  it("132076:B:2 with no progress on stage 2 each of two players discards 1 random card, whichever stage is current", () => {
    const made = atStage(inPlay({ seats: 2, hand: ["filler", "filler", "filler"] }), S4);
    const sizes = (state: ScenarioState) => state.seats.map((seat) => seat.hand.length);
    const before = sizes(made.state);
    expect(sizes(endOfRound(made)).map((size, seat) => before[seat]! - size)).toEqual([1, 1]);
    expect(sizes(endOfRound(made, withProgress(made.state, S2, 1))).map((size, seat) => before[seat]! - size)).toEqual([0, 0]);
    expect(sizes(endOfRound(made, withProgress(made.state, S3, 5))).map((size, seat) => before[seat]! - size)).toEqual([1, 1]);
  });

  it("132076:B:2 a player with no card in hand discards nothing", () => {
    const made = inPlay({ seats: 2 });
    expect(endOfRound(made).seats.map((seat) => seat.hand.length)).toEqual(made.state.seats.map((seat) => seat.hand.length));
  });

  it("132077:B:3 with no progress on stage 3 the first player adds the enemy, and only an enemy, and nothing when the discard pile has none", () => {
    const stagedCodes = (state: ScenarioState) => state.staging.map((id) => state.cards[id]?.code);
    const made = inPlay({ seats: 2, discard: ["132055", "132060"] });
    expect(stagedCodes(endOfRound(made))).not.toContain("132060");
    expect(stagedCodes(endOfRound(made))).toContain("132055");
    const none = inPlay({ seats: 2, discard: ["132060"] });
    expect(endOfRound(none).staging).toEqual(none.state.staging);
    const empty = inPlay({ seats: 2 });
    expect(endOfRound(empty).staging).toEqual(empty.state.staging);
    expect(stagedCodes(endOfRound(made, withProgress(made.state, S3, 1)))).not.toContain("132055");
  });

  it("132078:B:3 with no progress on stage 4 the heroes of both players lose every resource, and progress on stage 4 keeps them", () => {
    const made = inPlay({ seats: 2, heroResources: 2 });
    const pools = (state: ScenarioState) => state.seats.flatMap((seat) => seat.heroes.map((id) => state.cards[id]?.resources ?? 0));
    expect(pools(made.state).every((count) => count === 2)).toBe(true);
    expect(pools(endOfRound(made)).every((count) => count === 0)).toBe(true);
    expect(pools(endOfRound(made, withProgress(made.state, S4, 1))).every((count) => count === 2)).toBe(true);
    expect(pools(endOfRound(made, withProgress(made.state, S2, 3))).every((count) => count === 0)).toBe(true);
  });
});

describe("Battle and Siege while the stage is current (132077:B:2, 132078:B:2)", () => {
  // A committed hero with Willpower, Attack and Defense raised to three different numbers, so each total names the stat it counts.
  const totals = (current: string) => {
    const made = atStage(inPlay({ committed: ["dh1"] }), current);
    const hero = idOf(made.state, "dh1");
    const set = (stat: "willpower" | "attack" | "defense", amount: number) => ({ instanceId: hero, sourceId: hero, stat, amount, until: "endOfRound" as const });
    const raised = { ...made.state, modifiers: [...made.state.modifiers, set("willpower", 1), set("attack", 4), set("defense", 7)] };
    const synced = syncConstants(raised, made.ctx);
    const read = (stat: "willpower" | "attack" | "defense") => modifiedStat(synced, synced.cards[hero]!, stat, made.ctx.cards);
    return { total: committedWillpower(synced, made.ctx.cards), willpower: read("willpower"), attack: read("attack"), defense: read("defense") };
  };

  it("132077:B:2 characters use Attack instead of Willpower while stage 3 is current, and Willpower while stage 2 or 4 is", () => {
    const [two, three, four] = [totals(S2), totals(S3), totals(S4)];
    expect(new Set([two.willpower, two.attack, two.defense]).size).toBe(3);
    expect(three.total).toBe(three.attack);
    expect(two.total).toBe(two.willpower);
    expect(four.total).toBe(four.defense);
  });

  it("132078:B:2 characters use Defense instead of Willpower while stage 4 is current, and Willpower while stage 2 or 3 is", () => {
    const four = totals(S4);
    expect(four.total).toBe(four.defense);
    expect(four.total).not.toBe(four.willpower);
    expect(totals(S2).total).toBe(totals(S2).willpower);
  });
});

describe("stage 5 takes no progress (132079:B:2)", () => {
  it("132079:B:2 progress from a quest result and from a card effect stays off stage 5, with one player and with two", () => {
    for (const seats of [1, 2] as const) {
      const made = { ...inPlay({ seats }), state: table({ seats, stage: S5, staging: ["132053"] }).state };
      const placed = place(made, 4);
      expect(progressOn(placed, S5)).toBe(0);
    }
  });

  // Bolg is considered engaged with the first player, and an engaged enemy adds no Threat to the staging area (rr.engaged), as the Balrog and Dagnir do; he adds it again before stage 5, when he is not engaged.
  it("132079:B:2 Bolg, engaged with the first player in the staging area, adds no Threat to the staging area, and adds it before stage 5", () => {
    for (const seats of [1, 2] as const) {
      const five = table({ seats, stage: S5, staging: ["132053"] });
      const synced = syncConstants(five.state, five.ctx);
      expect(flagged(synced, idOf(synced, "132053"), "engagedWithFirst")).toBe(true);
      expect(flagged(synced, idOf(synced, "132053"), "noThreatContribution")).toBe(true);
      expect(stagingThreat(synced, five.ctx.cards)).toBe(0);
      const before = table({ seats, stage: S1, staging: ["132053"] });
      expect(stagingThreat(syncConstants(before.state, before.ctx), before.ctx.cards)).toBe(seats);
    }
  });

  it("132079:B:2 progress can be placed on a stage before stage 5 is reached", () => {
    const made = inPlay();
    expect(progressOn(place(made, 4), S2)).toBe(4);
  });
});

// Each behaviour above is the records' work: with the records of its line removed the table does nothing of it.
describe("the stage lines fail without their records", () => {
  const without = (...lines: string[]) => withoutLines(EFFECTS, ...lines);

  it("132076:B:2 without its records no card is discarded at the end of the round", () => {
    const made = inPlay({ hand: ["filler", "filler"] }, without("132076:B:2"));
    expect(endOfRound(made).seats[0]!.hand).toHaveLength(2);
  });

  it("132077:B:3 without its records no enemy is added to the staging area at the end of the round", () => {
    const made = inPlay({ discard: ["132055"] }, without("132077:B:3"));
    expect(endOfRound(made).staging).toEqual(made.state.staging);
  });

  it("132078:B:3 without its records the resources stay at the end of the round", () => {
    const made = inPlay({ heroResources: 2 }, without("132078:B:3"));
    expect(endOfRound(made).seats[0]!.heroes.every((id) => endOfRound(made).cards[id]?.resources === 2)).toBe(true);
  });

  it("132077:B:2 and 132078:B:2 without their records Battle and Siege do not apply", () => {
    for (const [stage, line] of [[S3, "132077:B:2"], [S4, "132078:B:2"]] as const) {
      const made = atStage(inPlay({ committed: ["dh1"] }, without(line)), stage);
      const synced = syncConstants(made.state, made.ctx);
      expect(committedWillpower(synced, made.ctx.cards)).toBe(modifiedStat(synced, synced.cards[idOf(synced, "dh1")]!, "willpower", made.ctx.cards));
    }
  });

  // Each stage in play holds the advance against the others, so the gate is the three records together: with one removed the other two still hold it.
  for (const current of STAGES) {
    it(`${current}:B:1 without the records of the three gates a full stage advances while the other two are short`, () => {
      const made = atStage(inPlay({}, without("132076:B:1", "132077:B:1", "132078:B:1")), current);
      expect(currentCode(place(made, 8))).not.toBe(current);
    });
  }

  it("132079:B:2 without its records progress is placed on stage 5", () => {
    const made = { ...inPlay({}, without("132079:B:2")), state: table({ stage: S5, staging: ["132053"] }, without("132079:B:2")).state };
    expect(progressOn(place(made, 4), S5)).toBe(4);
  });
});
