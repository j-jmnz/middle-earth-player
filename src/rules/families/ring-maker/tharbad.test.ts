// Rules: rm.attacks-against-nalir, rm.threat-elimination-level, rm.time-x, rr.active-location, rr.attacks-outside-the-combat-phase, rr.cannot (data/rules/entries.json); ledger lines 08066:B:2, 08066:B:3, 08066:B:4, 08067:B:2, 08067:B:3, 08075:A:2, 08081:A:1, 08083:A:1.
// The engine Trouble in Tharbad adds: an attack made against Nalir, the elimination level check, the sweep that announces every player at 0 threat, the progress that stage 1B cancels and stage 2B sends to The Crossing, the bar on removing time counters and the condition that reads any player's threat.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { replaceStageProgress } from "../../quest/progress-replaced.ts";
import { addModifier } from "../../core/modified-stat.ts";
import { removeTimeCounterFrom } from "../angmar/time.ts";
import { idOf, run, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "trouble-in-tharbad";
const STAGE_1 = "08066";
const STAGE_2 = "08067";
const NALIR = "08068";
const BELLACH = "08070";
const CROSSING = "08071";
const SPY = "08072";
// The record's own instruction: each player's level goes down by 10 (a modifier of the seat).
const LOWER: Instruction = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "ModifyStat", stat: "eliminationReduction", amount: 10, until: "endOfGame", target: "actorSeat" }] };
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
// A modifier of the table, held while the stage is in play.
const hold = (state: ScenarioState, stat: ScenarioState["modifiers"][number]["stat"]): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: state.questStage ?? "", stat, amount: 1, until: "whileSourceInPlay" }] });
type Ctx = ReturnType<typeof table>["ctx"];
// The instructions resolve in a Forced frame of the quest stage, as a record's own do, and the table settles.
const resolve = (state: ScenarioState, ctx: Ctx, instructions: Instruction[]): ScenarioState => {
  const effect: Effect = { id: "08066:forced:9", cardCode: state.cards[state.questStage ?? ""]?.code ?? STAGE_1, lines: ["08066:B:2"], timing: "forced", trigger: "lastTimeCounterRemoved", instructions };
  const steps: EngineStep[] = [];
  return settle(pushCardEffects({ ...state, window: null, mode: "stopped" }, "forced", state.questStage ?? "", 0, false, [effect], ctx, steps), ctx, steps);
};
const heard = (state: ScenarioState, trigger: string): boolean => (state.pendingEvents ?? []).some((event) => event.trigger === trigger);

describe("AttackNalir (08067:B:2, 08083:A:1)", () => {
  const attack = (state: ScenarioState, ctx: Ctx, names: string[], staging: boolean): ScenarioState => resolve(state, ctx, [{ verb: "Pick", pick: { type: "enemy", control: "any", staging, names } }, { verb: "AttackNalir" }]);

  it("rm.attacks-against-nalir: a staged enemy attacks the player who controls Nalir and its undefended damage goes to him", () => {
    const t = table({ stage: STAGE_2, play: [NALIR], staging: [BELLACH] });
    const begun = attack(t.state, t.ctx, ["Bellach"], true);
    expect(begun.pendingAttack?.enemyId).toBe(idOf(t.state, BELLACH));
    expect(begun.pendingAttack?.onlyHeroes).toEqual([idOf(t.state, NALIR)]);
    expect(begun.pendingAttack?.seat).toBe(0);
  });

  it("an enemy engaged with another player attacks the player who controls Nalir", () => {
    const t = table({ stage: STAGE_2, seats: 2, play: [NALIR], engaged: [{ code: SPY, seat: 1 }] });
    const begun = attack(t.state, t.ctx, ["Spy from Mordor"], false);
    expect(begun.pendingAttack?.enemyId).toBe(idOf(t.state, SPY));
    expect(begun.pendingAttack?.seat).toBe(0);
  });

  it("with Nalir out of play no attack is made", () => {
    const t = table({ stage: STAGE_2, staging: [BELLACH] });
    expect(attack(t.state, t.ctx, ["Bellach"], true).pendingAttack ?? null).toBeNull();
  });
});

describe("EliminateAtLevel (08066:B:2)", () => {
  it("rm.threat-elimination-level: a player at or above the lowered level is eliminated at once, one below stays", () => {
    const t = table({ stage: STAGE_1, seats: 2, threat: [40, 39] });
    const lowered = resolve(t.state, t.ctx, [LOWER]);
    expect(lowered.seats[0]?.eliminated).not.toBe(true);
    const done = run(t, lowered, { verb: "EliminateAtLevel" });
    expect(done.seats[0]?.eliminated).toBe(true);
    expect(done.seats[1]?.eliminated).not.toBe(true);
  });

  it("each later reduction adds to the earlier one (50, 40, 30)", () => {
    const t = table({ stage: STAGE_1, threat: [25, 0] });
    const reduce = (state: ScenarioState) => resolve(state, t.ctx, [LOWER, { verb: "EliminateAtLevel" }]);
    const once = reduce(t.state);
    const twice = reduce(once);
    expect(once.seats[0]?.eliminated).not.toBe(true);
    expect(twice.seats[0]?.eliminated).not.toBe(true);
    expect(reduce(twice).seats[0]?.eliminated).toBe(true);
  });
});

describe("allThreatZero (08066:B:4)", () => {
  it("it is announced once every living player is at 0 threat, while the stage in play hears it", () => {
    const t = table({ stage: STAGE_1, seats: 2, threat: [0, 3] });
    expect(heard(run(t, t.state, { verb: "ShuffleEncounterDeck" }), "allThreatZero")).toBe(false);
    const zero = table({ stage: STAGE_1, seats: 2, threat: [0, 0] });
    const settled = run(zero, zero.state, { verb: "ShuffleEncounterDeck" });
    expect(settled.questStage).not.toBe(zero.state.questStage);
  });

  it("a stage that does not hear it announces nothing", () => {
    const t = table({ stage: STAGE_2, threat: [0, 0] });
    const settled = run(t, t.state, { verb: "ShuffleEncounterDeck" });
    expect(heard(settled, "allThreatZero")).toBe(false);
    expect(settled.questStage).toBe(t.state.questStage);
  });
});

describe("progress on stage 1B and 2B (08066:B:3, 08067:B:3)", () => {
  const withFlag = (stage: string, flag: "progressCanceled" | "progressToCrossing") => {
    const t = table({ stage });
    return { t, state: addModifier(t.state, t.state.questStage ?? "", t.state.questStage ?? "", flag, 1, "whileSourceInPlay") };
  };

  it("08066:B:3 the progress is turned into an event the stage hears, with its amount, from questing and from a card alike", () => {
    const { state } = withFlag(STAGE_1, "progressCanceled");
    for (const questing of [true, false]) {
      const replaced = replaceStageProgress(state, 5, questing);
      expect(replaced.remaining).toBe(0);
      expect((replaced.state.pendingEvents ?? []).find((event) => event.trigger === "progressReplaced")?.amount).toBe(5);
    }
  });

  it("08067:B:3 progress from questing goes to The Crossing through the event; a player card's goes nowhere", () => {
    const { state } = withFlag(STAGE_2, "progressToCrossing");
    const questing = replaceStageProgress(state, 4, true);
    expect(questing.remaining).toBe(0);
    expect((questing.state.pendingEvents ?? []).find((event) => event.trigger === "progressReplaced")?.amount).toBe(4);
    const card = replaceStageProgress(state, 4, false);
    expect(card.remaining).toBe(0);
    expect(heard(card.state, "progressReplaced")).toBe(false);
  });

  it("08067:B:3 the redirected progress lands on The Crossing in the staging area", () => {
    const t = table({ stage: STAGE_2, staging: [CROSSING] });
    const done = run(t, t.state, { verb: "PlaceProgressOnNamed", name: "The Crossing at Tharbad", amount: 4 });
    expect(done.cards[idOf(done, CROSSING)]?.progress).toBe(4);
  });
});

describe("time counters barred (08075:A:2)", () => {
  it("08075:A:2 no counter comes off the current quest while the table holds timeBarred", () => {
    const t = table({ stage: STAGE_1 });
    const stage = t.state.questStage ?? "";
    const counted = updateCard(t.state, stage, { resources: 3 });
    expect(removeTimeCounterFrom(counted, stage, t.ctx).cards[stage]?.resources).toBe(2);
    const barred = hold(counted, "timeBarred");
    expect(removeTimeCounterFrom(barred, stage, t.ctx).cards[stage]?.resources).toBe(3);
    const instruction = runInstruction({ ...barred, mode: "stopped" }, { verb: "RemoveTimeFromQuest", amount: 2 }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(instruction.cards[stage]?.resources).toBe(3);
  });

  it("08075:A:2 Tharbad Hideout holds the bar only while it is the active location", () => {
    const active = table({ stage: STAGE_1, active: "08075" });
    expect(active.state.modifiers.some((modifier) => modifier.stat === "timeBarred")).toBe(true);
    const staged = table({ stage: STAGE_1, staging: ["08075"] });
    expect(staged.state.modifiers.some((modifier) => modifier.stat === "timeBarred")).toBe(false);
    expect(where(staged.state, "08075")).toBe("staging");
  });
});

describe("anyThreat (08081:A:1)", () => {
  it("holds when some living player's threat is at most the number", () => {
    const low = table({ stage: STAGE_1, seats: 2, threat: [30, 20] });
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(holds(low.state, { kind: "anyThreat", max: 20 }, scope, low.ctx)).toBe(true);
    const high = table({ stage: STAGE_1, seats: 2, threat: [30, 21] });
    expect(holds(high.state, { kind: "anyThreat", max: 20 }, scope, high.ctx)).toBe(false);
  });
});

describe("The Empty Mug (08069:A:1, 08069:A:2)", () => {
  const ALLY = "ally";
  // The ally's effect lowers the first player's threat by 2.
  const lower = (state: ScenarioState, ctx: Ctx, source: string): ScenarioState => {
    const effect: Effect = { id: "ally:action:9", cardCode: ALLY, lines: ["ally:A:1"], timing: "action", instructions: [{ verb: "LowerThreat", amount: 2, who: "actor" }] };
    const steps: EngineStep[] = [];
    return settle(pushCardEffects({ ...state, window: null, mode: "stopped" }, "forced", source, 0, false, [effect], ctx, steps), ctx, steps);
  };

  it("08069:A:1 no player lowers his threat while it is in play, by a player card or the stage", () => {
    const t = table({ stage: STAGE_1, active: "08069", play: [ALLY], threat: [10, 10] });
    const ally = idOf(t.state, ALLY);
    expect(lower(t.state, t.ctx, ally).seats[0]?.threat).toBe(10);
    expect(resolve(t.state, t.ctx, [{ verb: "LowerThreat", amount: 2, who: "eachSeat" }]).seats[0]?.threat).toBe(10);
  });

  it("08069:A:2 in the victory display it removes the player card whose effect lowered a threat from the game", () => {
    const t = table({ stage: STAGE_1, victory: ["08069"], play: [ALLY], threat: [10, 10] });
    const ally = idOf(t.state, ALLY);
    const done = lower(t.state, t.ctx, ally);
    expect(done.seats[0]?.threat).toBe(8);
    expect(done.cards[ally]?.zone).toBe("removed");
  });

  it("08069:A:2 the stage's own lowering is no player card effect, so nothing is removed", () => {
    const t = table({ stage: STAGE_1, victory: ["08069"], play: [ALLY], threat: [10, 10] });
    const done = resolve(t.state, t.ctx, [{ verb: "LowerThreat", amount: 2, who: "eachSeat" }]);
    expect(done.seats[0]?.threat).toBe(8);
    expect(done.cards[idOf(done, ALLY)]?.zone).toBe("play");
  });

  it("08069:A:2 without the Mug in the victory display nothing is removed", () => {
    const t = table({ stage: STAGE_1, play: [ALLY], threat: [10, 10] });
    const done = lower(t.state, t.ctx, idOf(t.state, ALLY));
    expect(done.seats[0]?.threat).toBe(8);
    expect(done.cards[idOf(done, ALLY)]?.zone).toBe("play");
  });
});
