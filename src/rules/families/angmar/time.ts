// Rules: mec108.time-x (data/rules/entries.json); ledger lines 09024:A:1, 09024:A:3. Time X: a card with the keyword gets X resource tokens, its time counters, when it is revealed, and loses one at the end of each refresh phase; the card hears the removal of the last.
// The keyword is a constant record with the verb `Time` (src/catalog/families/angmar.ts), found by the card's code like Deep.
import type { Effect } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { effectCause } from "../../core/cause.ts";
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectsOf } from "../../windows/listen.ts";
import { textBlank } from "../attachments/hold.ts";

/** The X of the Time X keyword the card prints, or null for a card without it. */
export function timeOf(ctx: ReduceContext, code: string): number | null {
  if (!constantVerbCodes(ctx, "Time").has(code)) return null;
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "Time") return instruction.amount;
  }
  return null;
}

/** A card with Time X was just revealed (the reveal frame's first step): the players put X resource tokens on it, its time counters (mec108.time-x). One that left play at once, or has its text blank, gets none. */
export function timeOnReveal(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone)) return state;
  const amount = timeOf(ctx, card.code);
  if (amount == null || textBlank(state, id, ctx.cards)) return state;
  return updateCard(state, id, { resources: card.resources + amount });
}

/** The cards in play that hold the Time X keyword and at least one time counter. */
function timeCards(state: ScenarioState, ctx: ReduceContext): string[] {
  if (constantVerbCodes(ctx, "Time").size === 0) return [];
  return Object.values(state.cards).filter((card) => inPlay(card.zone) && card.resources > 0 && timeOf(ctx, card.code) != null && !textBlank(state, card.id, ctx.cards)).map((card) => card.id);
}

/**
 * RemoveTimeCounters: one time counter comes off each card in play with Time X, if able; a card whose last counter is removed is announced (`lastTimeCounterRemoved`) and its Forced effect resolves ("When the last time counter is removed, there is a triggered effect that
 * resolves on that card", mec108.time-x). A card with no counter left loses none.
 */
export function removeTimeCounters(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of timeCards(state, ctx)) {
    const card = next.cards[id];
    if (!card || card.resources <= 0) continue;
    next = updateCard(next, id, { resources: card.resources - 1 });
    if (card.resources === 1) next = queueEvent(next, { trigger: "lastTimeCounterRemoved", seat: null, cardId: id, subject: id });
  }
  return next;
}

/**
 * The refresh phase ends (windows/triggers.ts crossBoundary): when a card in play holds a time counter, a frame of its own removes one from each. It goes down before the Forced effects of the end of the refresh phase, so they resolve first and the counters come off after them
 * (docs/scenarios/angmar-awakened.md, Angmar Awakened).
 */
export function timeAtRefreshEnd(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const first = timeCards(state, ctx)[0];
  const card = first ? state.cards[first] : undefined;
  if (!first || !card) return state;
  const record: Effect | undefined = effectsOf(ctx, card.code).find((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "Time"));
  if (!record) return state;
  return pushEffectFrame(state, { frame: "forced", sourceId: first, actor: state.firstPlayer, peril: false, effectId: "time:refresh", instructions: [{ verb: "RemoveTimeCounters" }], cancel: null, blockCancel: null, cause: effectCause(record) }, steps);
}
