// Rules: rm.time-x, rm.parallel-stages, rr.forced, rr.quest-advancement, rr.quest-cards-quest-deck (data/rules/entries.json); ledger lines 08095:B:1, 08096:B:1, 08096:B:2, 08096:B:4, 08097:B:1, 08097:B:2, 08097:B:4, 08098:B:1, 08099:B:1, 08099:B:2, 08100:B:1, 08100:B:2, 08101:B:1.
// The lines the eight stages print in common (Time X, the last-counter advance to a different stage and the defeat that goes to a random stage 3A), each as a line spec: the check runs on the records and must fail without the line's records (test/harness/line-spec.ts).
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { run, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const STAGE_2 = ["08095", "08096", "08097"];
const STAGE_3 = ["08098", "08099", "08100"];
const codeOf = (state: ScenarioState, id: string | null | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);
// The layout lays the stages before the current one aside; in a game the other stages of the set wait in the quest deck, as stage 1B leaves them.
const table = (effects: readonly Effect[], layout: Layout) => {
  const made = tableFromLayout("the-nin-in-eilph", layout, { effects });
  const waiting = Object.values(made.state.cards).filter((card) => card.zone === "setAside" && [...STAGE_2, ...STAGE_3].includes(card.code));
  const state = waiting.reduce((next, card) => updateCard(next, card.id, { zone: "questDeck" }), made.state);
  return { ...made, state: { ...state, questDeck: [...state.questDeck, ...waiting.map((card) => card.id)] } };
};

// "Time X": the stage has X time counters once the quest advances to it, whatever it held before.
const hasTime = (code: string, counters: number) => (effects: readonly Effect[]): void => {
  const t = table(effects, { stage: "08094" });
  const back = run(t, t.state, { verb: "AdvanceToStage", code });
  expect(codeOf(back, back.questStage)).toBe(code);
  expect(back.cards[back.questStage ?? ""]?.resources).toBe(counters);
};

// "After the last time counter is removed from this stage, advance to a different stage <n>A at random. Return this stage to the quest deck."
const returnsAfterLastCounter = (code: string, set: readonly string[]) => (effects: readonly Effect[]): void => {
  for (const seed of [1, 2, 3, 4]) {
    const t = table(effects, { stage: code, phase: "Refresh", seed });
    const stage = t.state.questStage ?? "";
    const done = settle(updateCard(t.state, stage, { resources: 1 }), t.ctx, []);
    const now = codeOf(done, done.questStage) ?? "";
    expect(set).toContain(now);
    expect(now).not.toBe(code);
    expect(done.questDeck.some((id) => done.cards[id]?.code === code)).toBe(true);
    expect(done.cards[stage]).toMatchObject({ progress: 0, resources: 0 });
  }
};

// "When the players defeat this stage, advance to a random stage 3A."
const goesToStageThree = (code: string) => (effects: readonly Effect[]): void => {
  const reached = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const t = table(effects, { stage: code, seed });
    const done = run(t, t.state, { verb: "AdvanceStage" }, { sourceId: t.state.questStage ?? "" });
    expect(STAGE_3).toContain(codeOf(done, done.questStage) ?? "");
    expect(done.questDeck.some((id) => done.cards[id]?.code === code)).toBe(false);
    reached.add(codeOf(done, done.questStage) ?? "");
  }
  // At random: the three stages are not taken in their printed order.
  expect(reached.size).toBeGreaterThan(1);
};

lineSpec("08095:B:1", "Through the Marsh: Time 3", hasTime("08095", 3));
lineSpec("08096:B:1", "Through the Marsh: Time 3", hasTime("08096", 3));
lineSpec("08097:B:1", "Through the Marsh: Time 3", hasTime("08097", 3));
lineSpec("08098:B:1", "Lost in the Swanfleet: Time 3", hasTime("08098", 3));
lineSpec("08099:B:1", "Lost in the Swanfleet: Time 3", hasTime("08099", 3));
lineSpec("08100:B:1", "Lost in the Swanfleet: Time 3", hasTime("08100", 3));
lineSpec("08101:B:1", "Out of the Swamp: Time 2", hasTime("08101", 2));

lineSpec("08096:B:2", "Through the Marsh: the last counter takes the quest to a different stage 2A and returns this stage", returnsAfterLastCounter("08096", STAGE_2));
lineSpec("08097:B:2", "Through the Marsh: the last counter takes the quest to a different stage 2A and returns this stage", returnsAfterLastCounter("08097", STAGE_2));
lineSpec("08099:B:2", "Lost in the Swanfleet: the last counter takes the quest to a different stage 3A and returns this stage", returnsAfterLastCounter("08099", STAGE_3));
lineSpec("08100:B:2", "Lost in the Swanfleet: the last counter takes the quest to a different stage 3A and returns this stage", returnsAfterLastCounter("08100", STAGE_3));

lineSpec("08096:B:4", "Through the Marsh: defeating the stage takes the quest to a random stage 3A", goesToStageThree("08096"));
lineSpec("08097:B:4", "Through the Marsh: defeating the stage takes the quest to a random stage 3A", goesToStageThree("08097"));
