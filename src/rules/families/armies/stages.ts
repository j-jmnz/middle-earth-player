// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, rr.quest-advancement, faq.progress-without-advancing (data/rules/entries.json); ledger lines 132075:B:1, 132076:B:1, 132077:B:1, 132078:B:1.
// The Battle of Five Armies' quest stages 2, 3 and 4 in play together. `state.questStage` is the current quest stage, so everything that reads the current quest (progress, Battle and Siege, the active location first) reads it; `state.armies.stages` lists the three.
import type { Instruction } from "../../../catalog/boundary.ts";

import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { takeProgressOff } from "../../core/progress.ts";
import type { PrintedCard } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { questPointsOf } from "../../quest/quest.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The quest stages in play: stages 2 to 4 once they are in play together, else the one stage the quest is at. */
export function stagesInPlay(state: ScenarioState): string[] {
  return state.armies ? state.armies.stages.filter((id) => state.cards[id] != null) : state.questStage ? [state.questStage] : [];
}

/** The stage in play with this code, or undefined. */
export function stageWithCode(state: ScenarioState, code: string): string | undefined {
  return stagesInPlay(state).find((id) => state.cards[id]?.code === code);
}

/** The stage holds at least its quest points in progress (a stage that prints none is never complete). */
export function stageComplete(state: ScenarioState, id: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const stage = state.cards[id];
  const points = stage ? questPointsOf(state, stage, cards) : null;
  return stage != null && points != null && stage.progress >= points;
}

/**
 * PutStagesIntoPlay (132075:B:1): the stages with these codes leave the quest deck and lie in play with side B up, no progress on them; the first is the current quest stage until the first player chooses at the start of round 1. The stage that says it is removed from play.
 * A game whose quest deck lacks one of them changes nothing.
 */
export function putStagesIntoPlay(state: ScenarioState, instruction: Verb<"PutStagesIntoPlay">, focus: Focus): ScenarioState {
  const ids = instruction.codes.map((code) => state.questDeck.find((id) => state.cards[id]?.code === code));
  if (ids.some((id) => id == null)) return state;
  const found = ids.filter((id): id is string => id != null);
  let next = focus.sourceId && state.cards[focus.sourceId]?.zone === "questStage" ? moveCard(state, focus.sourceId, { zone: "setAside" }) : state;
  for (const id of found) next = updateCard(moveCard(next, id, { zone: "questStage" }), id, { face: "B", progress: 0 });
  return { ...next, questStage: found[0] ?? null, armies: { stages: found } };
}

/** SetCurrentStage: the stage is the current quest stage (hob.current-quest-stage). */
export function setCurrentStage(state: ScenarioState, instruction: Verb<"SetCurrentStage">): ScenarioState {
  return state.armies?.stages.includes(instruction.card) && state.cards[instruction.card] ? { ...state, questStage: instruction.card } : state;
}

/** RemoveProgressFromStages: up to `amount` progress comes off the stage with the code, or off each stage in play; a stage left under its quest points is no longer complete. */
export function removeProgressFromStages(state: ScenarioState, instruction: Verb<"RemoveProgressFromStages">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const ids = instruction.code ? stagesInPlay(state).filter((id) => state.cards[id]?.code === instruction.code) : stagesInPlay(state);
  return amount > 0 ? ids.reduce((next, id) => takeProgressOff(next, id, amount, steps), state) : state;
}

/**
 * The beginning of each round, before resources are collected (hob.current-quest-stage): the first player chooses which of the stages in play is the current quest stage, in a frame of its own. Null when it was asked this round or the stages are not in play together;
 * the marked state when there is nothing to choose.
 */
export function askCurrentStage(state: ScenarioState, steps: EngineStep[]): ScenarioState | null {
  const armies = state.armies;
  if (!armies || armies.asked === state.round) return null;
  const marked: ScenarioState = { ...state, armies: { ...armies, asked: state.round } };
  const stages = stagesInPlay(marked);
  const first = stages[0];
  if (first == null || stages.length < 2) return marked;
  const choose: Instruction = { verb: "Choose", who: "firstPlayer", options: stages.map((id) => ({ id, instructions: [{ verb: "SetCurrentStage" as const, card: id }] })) };
  return pushEffectFrame(marked, { frame: "forced", sourceId: first, actor: marked.firstPlayer, peril: false, effectId: "armies:current", instructions: [choose], cancel: null, blockCancel: null, cause: ruleCause("hob.current-quest-stage") }, steps);
}
