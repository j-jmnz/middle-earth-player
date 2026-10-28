// Rules: rr.active-location, rr.travel, rr.step-4-2, rr.explored, rr.modifiers, rr.lasting-effects (data/rules/entries.json).
// Locations and progress for the quest family: making a location the active location (not traveling), traveling without the
// Travel effect, moving progress, and a Threat reduction that reports whether it reached 0.
import type { Instruction, SimpleInstruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../amounts.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import { placeProgress } from "../effect-verbs.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { addModifier, modifiedStat } from "../keywords.ts";
import { pickedList } from "../player-verbs.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { fireForced } from "../triggers.ts";
import { patchTop, topFrame } from "../windows.ts";
import type { Focus } from "./index.ts";
import { makeActiveIn } from "./south-locations.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

function isLocation(state: ScenarioState, id: string | null, ctx: ReduceContext): id is string {
  const card = id ? state.cards[id] : undefined;
  return card != null && printedOf(ctx.cards, card.code).type === "location";
}

// The location becomes the active location; another active location goes back to the staging area with its progress. This is
// not traveling, so no Travel cost or effect resolves and nothing hears "traveled"; a Forced effect "after it becomes the active
// location" does (131013:A:2, 19034:A:1, 02121:A:1).
export function makeActive(state: ScenarioState, instruction: Verb<"MakeActive">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  if (!isLocation(state, id, ctx) || state.cards[id]?.zone !== "staging") return state;
  const next = makeActiveIn(state, id);
  return fireForced(next, { trigger: "becameActive", seat: null, cardId: id }, ctx, steps);
}

// Where moved progress comes from: the source card, the current quest card, or the card picked before the last.
function progressSource(state: ScenarioState, from: Verb<"MoveProgress">["from"], sourceId: string | null): string | null {
  if (from === "self") return sourceId;
  if (from === "quest") return state.questStage;
  return pickedList(state).at(-2) || null;
}

// Progress moves to the last picked location: it comes off the source (a removal only) and is placed on the location, which it
// can explore (rr.explored). `choose` asks how many, 1 to the most that can move, through `askNumber`.
export function moveProgress(
  state: ScenarioState,
  instruction: Verb<"MoveProgress">,
  focus: Focus,
  ctx: ReduceContext,
  steps: EngineStep[],
  askNumber: (state: ScenarioState, max: number, option: (n: number) => SimpleInstruction) => ScenarioState,
): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const fromId = progressSource(state, instruction.from, focus.sourceId);
  const toId = refCard(state, "picked", scope);
  const from = fromId ? state.cards[fromId] : undefined;
  if (!from || !fromId || !isLocation(state, toId, ctx) || fromId === toId) return state;
  const limit = instruction.amount == null ? from.progress : Math.min(from.progress, resolveAmount(state, instruction.amount, scope, ctx));
  const moved = instruction.all ? from.progress : limit;
  if (moved <= 0) return state;
  if (instruction.choose) {
    const { choose: _ask, ...rest } = instruction;
    return askNumber(state, moved, (n) => ({ ...rest, amount: n }));
  }
  steps.push({ kind: "progress", targetId: fromId, amount: -moved, cause: currentCause(steps, UNATTRIBUTED) });
  return placeProgress(updateCard(state, fromId, { progress: from.progress - moved }), toId, moved, ctx, steps);
}

// The card gets -amount Threat until the phase or round ends, and the effect's X records whether that took its Threat from above
// 0 to 0 ("If this effect reduces the location's Threat to 0, place 1 progress on it", 22137:A:2, 12082:A:2).
export function lowerCardThreat(state: ScenarioState, instruction: Verb<"LowerCardThreat">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const id = refCard(state, instruction.target ?? "picked", scope);
  const card = id ? state.cards[id] : undefined;
  const amount = resolveAmount(state, instruction.amount, scope, ctx);
  if (!id || !card || !focus.sourceId) return state;
  const before = modifiedStat(state, card, "threat", ctx.cards);
  const lowered = amount > 0 ? addModifier(state, id, focus.sourceId, "threat", -amount, instruction.until) : state;
  const after = modifiedStat(lowered, lowered.cards[id] ?? card, "threat", ctx.cards);
  const data = topFrame(lowered)?.data;
  return data?.kind === "effect" ? patchTop(lowered, { data: { ...data, x: before > 0 && after === 0 ? 1 : 0 } }) : lowered;
}

// Progress comes off the current quest card: `amount`, or all of it when the card holds fewer ("If there are fewer than 4 progress
// tokens on the quest, remove all progress tokens from that quest", 01086:A:1). The step records it as a negative amount.
export function removeProgressFromQuest(state: ScenarioState, instruction: Verb<"RemoveProgressFromQuest">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.questStage;
  const stage = id ? state.cards[id] : undefined;
  if (!id || !stage) return state;
  const removed = Math.min(stage.progress, Math.max(0, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx)));
  if (removed <= 0) return state;
  steps.push({ kind: "progress", targetId: id, amount: -removed, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, id, { progress: stage.progress - removed });
}
