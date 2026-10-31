// Rules: dcce.uncharted, dcce.uncharted-deck, rr.explored (data/rules/entries.json); ledger lines 11025:A:1, 11025:B:2, 11026:A:1, 11027:B:3, 11027:B:4, 11035:A:2. The Uncharted deck and
// its double-sided locations: preparing the deck, adding Lost Islands to the staging area, scrambling the ones there, flipping one over, looking at its facedown side, and the
// progress the quest card's own effect adds.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../amounts.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { queueEvent } from "../queue.ts";
import { questPointsOf, advanceStage } from "../quest.ts";
import { restricted } from "../restrictions.ts";
import { shuffleIds } from "../seed.ts";
import { afterProgress } from "../stage-reveal.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";
import { addedToStaging, announceEntered } from "./encounter-reveal.ts";
import type { Focus } from "./index.ts";
import { isLostIsland } from "./uncharted-pick.ts";
import { shuffleUnchartedDeck } from "./uncharted-zone.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PrepareUnchartedDeck: the deck is shuffled (dcce.uncharted-deck); every card in it is already Lost Island side up. */
export function prepareDeck(state: ScenarioState): ScenarioState {
  return shuffleUnchartedDeck(state);
}

// A card joins the staging area without being revealed, on the side it lies on, and enters play.
export function stage(state: ScenarioState, id: string, seat: number, ctx: ReduceContext): ScenarioState {
  const staged = updateCard(moveCard(state, id, { zone: "staging" }), id, { controller: null });
  return announceEntered(addedToStaging(queueEvent(staged, { trigger: "addedToStaging", seat, cardId: id }), id, ctx), id, seat, ctx);
}

/** AddLostIslands: the top `count` cards of the Uncharted deck join the staging area, Lost Island side up. */
export function addLostIslands(state: ScenarioState, instruction: Verb<"AddLostIslands">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const count = resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (let added = 0; added < count; added += 1) {
    const top = next.uncharted?.deck[0];
    if (!top) break;
    next = stage(next, top, focus.seat, ctx);
  }
  return next;
}

/** AddSetAsideLostIsland: the set-aside card with this code joins the staging area on its Lost Island side. */
export function addSetAside(state: ScenarioState, instruction: Verb<"AddSetAsideLostIsland">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const id = state.setAside.find((other) => state.cards[other]?.code === instruction.code);
  if (!id) return state;
  return stage(updateCard(state, id, { face: "B" }), id, focus.seat, ctx);
}

/** ScrambleUncharted: each Lost Island in the staging area loses its progress and the seed shuffles their places among themselves, so that nothing the players saw of their
 * positions says which one is which. */
export function scramble(state: ScenarioState, steps: EngineStep[], ctx: ReduceContext): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  const islands = state.staging.filter((id) => state.cards[id] && isLostIsland(state.cards[id], ctx));
  if (islands.length === 0) return state;
  let next = state;
  for (const id of islands) {
    const progress = next.cards[id]?.progress ?? 0;
    if (progress > 0) steps.push({ kind: "progress", targetId: id, amount: -progress, cause });
    next = updateCard(next, id, { progress: 0 });
  }
  const shuffled = shuffleIds(islands, next.seed, next.seedCursor);
  const order = [...shuffled.ids];
  return { ...next, staging: next.staging.map((id) => (islands.includes(id) ? (order.shift() ?? id) : id)), seedCursor: shuffled.cursor };
}

/** FlipUncharted: the Lost Island turns to its other side and loses all progress; the flip is announced to the Forced effects of the side it now shows. */
export function flip(state: ScenarioState, instruction: Verb<"FlipUncharted">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "self", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || !isLostIsland(card, ctx)) return state;
  if (card.progress > 0) steps.push({ kind: "progress", targetId: id, amount: -card.progress, cause: currentCause(steps, UNATTRIBUTED) });
  return queueEvent(updateCard(state, id, { face: "A", progress: 0 }), { trigger: "flippedOver", seat: null, cardId: id });
}

/** LookAtFacedown: the actor sees the other side of a Lost Island, after `remove` progress comes off it; nothing on that side happens. */
export function lookAtFacedown(state: ScenarioState, instruction: Verb<"LookAtFacedown">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "self", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || !isLostIsland(card, ctx)) return state;
  const removed = Math.min(card.progress, instruction.remove ?? 0);
  if (removed > 0) steps.push({ kind: "progress", targetId: id, amount: -removed, cause: currentCause(steps, UNATTRIBUTED) });
  const next = removed > 0 ? updateCard(state, id, { progress: card.progress - removed }) : state;
  return { ...next, window: { kind: "look", seat: focus.seat, cardIds: [id], side: "A" }, activeSeat: focus.seat, passed: [] };
}

/** AddStageProgress: progress on the current quest card by a quest effect, which the quest card's "cannot be placed" does not stop. A stage that can advance takes what it needs;
 * a full one advances. */
export function addStageProgress(state: ScenarioState, instruction: Verb<"AddStageProgress">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const stageId = state.questStage;
  const quest = stageId ? state.cards[stageId] : undefined;
  if (!stageId || !quest || amount <= 0 || state.stageCleared) return state;
  const points = questPointsOf(state, quest, ctx.cards);
  const canAdvance = (current: ScenarioState): boolean => restricted(current, ctx, "advance").length === 0;
  const placed = points == null || !canAdvance(state) ? amount : Math.min(amount, Math.max(0, points - quest.progress));
  const before = steps.length;
  let next = state;
  if (placed > 0) {
    next = updateCard(next, stageId, { progress: quest.progress + placed });
    steps.push({ kind: "progress", targetId: stageId, amount: placed, cause: currentCause(steps, UNATTRIBUTED) });
  }
  const updated = next.cards[stageId];
  if (points != null && updated && updated.progress >= points && canAdvance(next)) next = advanceStage(next, ctx.cards, steps, canAdvance);
  return afterProgress(next, before, ctx, steps);
}
