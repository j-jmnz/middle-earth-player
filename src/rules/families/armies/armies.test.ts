// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, rr.quest-advancement, faq.progress-without-advancing, rr.reveal (data/rules/entries.json); ledger lines 132075:B:1, 132076:B:1, 132077:B:1, 132078:B:1, 132053:A:4, 132056:A:1, 132059:A:1.
// The armies family on a table of The Battle of Five Armies: the stages in play together, the first player's choice of the current stage, the joint advance, the stages with no progress and the first Goblin revealed each round.
import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { answer, fightEnemy, first, resolveRecords, revealedTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { askCurrentStage, stagesInPlay } from "./stages.ts";

const [S1, S2, S3, S4, S5] = ["132075", "132076", "132077", "132078", "132079"] as const;
const table = (layout: Layout = {}) => tableFromLayout("the-battle-of-five-armies", { stage: S1, ...layout });
// Stage 1's When Revealed has put stages 2, 3 and 4 into play.
function inPlay(layout: Layout = {}) {
  const made = table(layout);
  const run = resolveRecords(made.state, made.ctx, S1, "whenRevealed", first(made.state, S1));
  return { ...made, state: run.state };
}
const idOf = (state: ScenarioState, code: string): string => Object.values(state.cards).find((card) => card.code === code)?.id ?? "";
const progressOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
const withProgress = (state: ScenarioState, code: string, progress: number): ScenarioState => ({ ...state, cards: { ...state.cards, [idOf(state, code)]: { ...state.cards[idOf(state, code)]!, progress } } });

describe("stages in play together (132075:B:1)", () => {
  it("132075:B:1 stages 2, 3 and 4 enter play with side B up, stage 1 is set aside and stage 2 is the current stage", () => {
    const { state } = inPlay();
    expect(stagesInPlay(state).map((id) => state.cards[id]?.code)).toEqual([S2, S3, S4]);
    expect(state.cards[idOf(state, S1)]?.zone).toBe("setAside");
    expect(stagesInPlay(state).every((id) => state.cards[id]?.zone === "questStage" && state.cards[id]?.face === "B")).toBe(true);
    expect(state.cards[state.questStage ?? ""]?.code).toBe(S2);
  });

  it("132075:B:1 the first player chooses the current stage at the start of a round, and the choice is asked once a round", () => {
    const made = inPlay();
    const asked = askCurrentStage({ ...made.state, round: 1 }, []);
    expect(asked?.stack.length).toBeGreaterThan(0);
    const settled = settle({ ...asked!, window: null }, made.ctx, []);
    expect(settled.window?.kind).toBe("choose");
    const stage3 = idOf(settled, S3);
    const chosen = answer({ state: settled, steps: [] }, made.ctx, () => stage3);
    expect(chosen.state.cards[chosen.state.questStage ?? ""]?.code).toBe(S3);
    expect(askCurrentStage(chosen.state, [])).toBeNull();
  });
});

describe("progress and the joint advance (132076:B:1, 132077:B:1, 132078:B:1)", () => {
  const place = (state: ScenarioState, ctx: ReturnType<typeof inPlay>["ctx"], current: string, amount: number): ScenarioState => {
    const on = { ...state, questStage: idOf(state, current) };
    const placed = runInstruction(on, { verb: "ProgressQuest", amount }, { seat: 0, sourceId: null }, ctx, []);
    return settle({ ...placed, window: null }, ctx, []);
  };

  it("132076:B:1 progress goes on the current stage only, and a full stage waits while the others are not complete", () => {
    const { state, ctx } = inPlay();
    const after = place(state, ctx, S2, 9);
    expect(progressOn(after, S2)).toBe(9);
    expect(progressOn(after, S3)).toBe(0);
    expect(after.cards[idOf(after, S2)]?.zone).toBe("questStage");
    expect(after.armies).toBeDefined();
  });

  it("132077:B:1 the players advance to stage 5 at once when the three stages are complete, and the others leave play", () => {
    const { state, ctx } = inPlay();
    const ready = withProgress(withProgress(state, S2, 8), S4, 8);
    const after = place(ready, ctx, S3, 8);
    expect(after.cards[after.questStage ?? ""]?.code).toBe(S5);
    expect(after.armies).toBeUndefined();
    for (const code of [S2, S3, S4]) expect(after.cards[idOf(after, code)]?.zone).toBe("setAside");
  });

  it("132078:B:1 a stage left under its quest points by a progress removal is not complete again", () => {
    const { state, ctx } = inPlay();
    const ready = withProgress(withProgress(state, S2, 8), S3, 8);
    const removed = runInstruction(ready, { verb: "RemoveProgressFromStages", amount: 2, code: S3 }, { seat: 0, sourceId: null }, ctx, []);
    expect(progressOn(removed, S3)).toBe(6);
    const after = place(removed, ctx, S4, 8);
    expect(after.cards[after.questStage ?? ""]?.code).toBe(S4);
    expect(after.armies).toBeDefined();
  });
});

describe("stages with no progress (132057:A:1)", () => {
  it("132057:A:1 the Vanguard of Bolg gets +1 Threat for each stage in play with no progress on it", () => {
    const made = inPlay({ staging: ["132057"] });
    const threat = (raw: ScenarioState) => {
      const state = syncConstants(raw, made.ctx);
      return modifiedStat(state, state.cards[idOf(state, "132057")]!, "threat", made.ctx.cards);
    };
    const none = threat(made.state);
    const some = threat(withProgress(made.state, S3, 1));
    expect(none - some).toBe(1);
  });

  it("132056:A:1 each stage in play loses 1 progress, 2 with three players or more", () => {
    const made = inPlay({ staging: ["132056"] });
    const ready = withProgress(withProgress(made.state, S2, 3), S3, 1);
    const run = resolveRecords(ready, made.ctx, "132056", "whenRevealed", idOf(ready, "132056"));
    expect(progressOn(run.state, S2)).toBe(2);
    expect(progressOn(run.state, S3)).toBe(0);
  });
});

describe("the first Goblin revealed each round (132053:A:4)", () => {
  it("132053:A:4 the first Goblin revealed surges, the second does not", () => {
    const made = inPlay({ staging: ["132053"], deck: ["132055", "132055", "132058", "f0", "f0"] });
    const state = revealedTop(made, "132055");
    // The first Goblin surged and revealed the next card of the deck, a second copy; that one did not surge, so the deck keeps the cards after it.
    expect(state.staging.filter((id) => state.cards[id]?.code === "132055")).toHaveLength(2);
    expect(state.encounterDeck.some((id) => state.cards[id]?.code === "132055")).toBe(true);
  });

  it("132053:A:4 without Bolg in play nothing surges", () => {
    const made = table({ staging: [], deck: ["132055", "132055", "132058", "f0", "f0"] });
    const state = revealedTop(made, "132055");
    expect(state.staging.filter((id) => state.cards[id]?.code === "132055")).toHaveLength(1);
  });
});

describe("the character with the most damage defends (132059:A:1)", () => {
  const damaged = (exhausted: boolean) => (state: ScenarioState, made: { hero2: string }): ScenarioState => ({ ...state, cards: { ...state.cards, [made.hero2]: { ...state.cards[made.hero2]!, damage: 1, exhausted } } });
  const tableOf = (layout: Layout) => table({ ...layout, stage: S2 });

  it("132059:A:1 a character with less damage cannot be declared as the defender", () => {
    expect(() => fightEnemy(tableOf, "f0", "132059", {}, { tweak: damaged(false) })).toThrow();
  });

  it("132059:A:1 the character with the most damage defends even when it is exhausted", () => {
    const fought = fightEnemy(tableOf, "f0", "132059", {}, { tweak: damaged(true), defender: (made) => made.hero2 });
    expect(fought.run.state.pendingAttack).toBeNull();
    expect(fought.run.state.cards[fought.made.hero2]?.exhausted).toBe(true);
  });

  it("132059:A:1 the attack cannot be left undefended while a character can defend it", () => {
    expect(() => fightEnemy(tableOf, "f0", "132059", {}, { tweak: damaged(false), undefended: true })).toThrow();
  });
});

describe("the topmost enemy of the discard pile (132077:B:3)", () => {
  it("132077:B:3 the last enemy discarded is added to the staging area, put and not revealed", () => {
    const made = inPlay({ discard: ["132055", "132058"] });
    const run = runInstruction(made.state, { verb: "StageTopmostFromDiscard", type: "enemy" }, { seat: 0, sourceId: null }, made.ctx, []);
    expect(run.staging.filter((id) => run.cards[id]?.code === "132058")).toHaveLength(1);
    expect(run.encounterDiscard.map((id) => run.cards[id]?.code)).toEqual(["132055"]);
  });
});
