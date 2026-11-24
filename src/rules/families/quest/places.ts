// Rules: rr.active-location, rr.travel, rr.step-4-2, rr.explored, rr.modifiers, rr.lasting-effects (data/rules/entries.json).
// Locations and progress for the quest family: making a location the active location (not traveling), traveling without the
// Travel effect, moving progress, and a Threat reduction that reports whether it reached 0.
import { immuneToSource } from "../misc/guards.ts";
import type { Instruction, SimpleInstruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { takeProgressOff } from "../../core/progress.ts";
import { placeProgress, progressPlacer } from "../../interpret/effect-verbs.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { addModifier, modifiedStat } from "../../core/keywords.ts";
import { pickedList } from "../../interpret/player-verbs.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { isLocationId } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { fireForced } from "../../windows/triggers.ts";
import { effectsOfCard } from "../misc/text.ts";
import { playerSource } from "./threat.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { Focus } from "../index.ts";
import { removeProgressFromEachQuest } from "../angmar/excess.ts";
import { makeActiveIn } from "../south/locations.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The location becomes the active location; another active location goes back to the staging area with its progress. This is
// not traveling, so no Travel cost or effect resolves and nothing hears "traveled"; a Forced effect "after it becomes the active
// location" does (131013:A:2, 19034:A:1, 02121:A:1).
export function makeActive(state: ScenarioState, instruction: Verb<"MakeActive">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // With `random` the location is one of the staging area's, chosen with the game's seed (the seed moves only when there is a location to choose).
  const staged = instruction.random === true ? state.staging.filter((candidate) => isLocationId(state, candidate, ctx.cards)) : [];
  const rolled = staged.length > 0 ? shuffleIds(staged, state.seed, state.seedCursor) : null;
  const id = instruction.random === true ? rolled?.ids[0] : refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  if (!id || !isLocationId(state, id, ctx.cards) || state.cards[id]?.zone !== "staging") return state;
  const next = makeActiveIn(rolled ? { ...state, seedCursor: rolled.cursor } : state, id);
  return fireForced(next, { trigger: "becameActive", seat: null, cardId: id }, ctx, steps);
}

// A location a scenario's Setup makes the active location ("Make Brake of Thorns the active location", 146075:A:1) becomes the active location then: its own Forced effect "after it becomes the active location" resolves (146047:A:2). Only a card with such a record
// hears it, so a Setup whose active location has none is as it was.
export function announceSetupActive(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.activeLocation;
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || !effectsOfCard(state, ctx, card).some((effect) => effect.timing === "forced" && effect.trigger === "becameActive" && effect.subject === "self")) return state;
  return fireForced(state, { trigger: "becameActive", seat: null, cardId: id }, ctx, steps);
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
  if (!from || !fromId || !toId || !isLocationId(state, toId, ctx.cards) || fromId === toId) return state;
  const limit = instruction.amount == null ? from.progress : Math.min(from.progress, resolveAmount(state, instruction.amount, scope, ctx));
  const moved = instruction.all ? from.progress : limit;
  if (moved <= 0) return state;
  if (instruction.choose) {
    const { choose: _ask, ...rest } = instruction;
    return askNumber(state, moved, (n) => ({ ...rest, amount: n }));
  }
  steps.push({ kind: "progress", targetId: fromId, amount: -moved, cause: currentCause(steps, UNATTRIBUTED) });
  return placeProgress(updateCard(state, fromId, { progress: from.progress - moved }), toId, moved, ctx, steps, progressPlacer(state, ctx, focus.seat, focus.sourceId), false, playerSource(state, focus.sourceId, ctx));
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
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  return instruction.each ? removeProgressFromEachQuest(state, amount, focus.seat, ctx, steps, currentCause(steps, UNATTRIBUTED)) : takeProgressOff(state, state.questStage, amount, steps);
}

// RemoveAllProgress: every progress token comes off the card named (the picked card by default), or off each card in play that matches the filter, read from the actor's side (02023:A:2, 900409:A:1).
export function removeAllProgress(state: ScenarioState, instruction: Verb<"RemoveAllProgress">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // A card immune to card effects keeps its progress (East-gate, 03016:A:1; dwd.immune-to-card-effects).
  const ids = (instruction.pick ? pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx) : [refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId))]).filter((id) => id == null || !immuneToSource(state, id, focus.sourceId, ctx));
  return ids.reduce((current, id) => takeProgressOff(current, id, current.cards[id ?? ""]?.progress ?? 0, steps), state);
}

// RemoveProgressEach: up to `amount` progress comes off each matching card in play; the effect's X is the total taken off (02093:A:1).
export function removeProgressEach(state: ScenarioState, instruction: Verb<"RemoveProgressEach">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  let total = 0;
  for (const id of pickCandidates(state, instruction.pick, focus.seat, [], focus.sourceId, ctx)) {
    const had = next.cards[id]?.progress ?? 0;
    next = takeProgressOff(next, id, amount, steps);
    total += had - (next.cards[id]?.progress ?? 0);
  }
  const data = topFrame(next)?.data;
  return data?.kind === "effect" ? patchTop(next, { data: { ...data, x: total } }) : next;
}
