// Rules: dwd.durins-bane, rr.hit-points, rr.cancel, rr.quest-phase (data/rules/entries.json); ledger lines 04141:A:1, 04145:A:1, 04139:B:1.
// Durin's Bane and what Shadow and Flame's cards do around it: Dark Pit's discard from play that supersedes "cannot leave the staging area" (FAQ 3.026), the hit points it has left (FAQ 3.057: damage can pass them), the event Counter-Spell cancels
// and the hero committed this round that The Rear Guard counts.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import { isPlayerType, printedOf } from "../../core/printed.ts";
import { inPlay } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { frameScope } from "../../interpret/amounts.ts";
import { hitPointsOf } from "../angmar/quest.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";

/** DiscardNamedFromPlay: the card in play with the title goes to its owner's discard pile (the encounter discard pile for an encounter card) although it cannot leave the staging area (04141:A:1, FAQ 3.026). Nothing happens with no such card in play. */
export function discardNamedFromPlay(state: ScenarioState, instruction: Extract<Instruction, { verb: "DiscardNamedFromPlay" }>, ctx: ReduceContext): ScenarioState {
  const card = Object.values(state.cards).find((other) => inPlay(other.zone) && printedOf(ctx.cards, other.code).name === instruction.name);
  if (!card) return state;
  const owned = card.owner ?? card.controller;
  const printed = printedOf(ctx.cards, card.code);
  return moveCard(state, card.id, isPlayerType(printed) && owned != null ? { zone: "discard", seat: owned } : { zone: "encounterDiscard" }, { supersedes: true });
}

/** CancelEventEffects: the effects of the event the running Forced effect heard being played do not run (04145:A:1). The event frame lies below the Forced effect's; the event is still played and goes to its owner's discard pile. */
export function cancelEventEffects(state: ScenarioState, focus: Focus): ScenarioState {
  const subject = frameScope(state, focus.seat, focus.sourceId).subject;
  const at = subject ? state.stack.findLastIndex((frame) => frame.data.kind === "effect" && frame.cardId === subject) : -1;
  if (at < 0) return state;
  return { ...state, stack: state.stack.map((frame, index) => (index === at && frame.data.kind === "effect" ? { ...frame, data: { ...frame.data, canceled: true } } : frame)) };
}

/** The amount `remaining` of `hitPoints` (the card named, in play): its hit points less its damage, never below 0 ("the remaining hit points of Durin's Bane", 04141:A:1). Null for any other amount. */
export function remainingHitPoints(state: ScenarioState, id: string | null, ctx: ReduceContext): number {
  const card = id ? state.cards[id] : undefined;
  return card ? Math.max(0, hitPointsOf(state, card, ctx) - card.damage) : 0;
}

/** The condition `committedThisRound`: a hero was committed to the quest this round (the commit step's heroes stay counted after a card removes one, 04139:B:1). Null for any other condition. */
export function committedThisRound(state: ScenarioState, condition: Condition, ctx: ReduceContext): boolean | null {
  if (condition.kind !== "committedThisRound") return null;
  const now = state.quested;
  return now?.round === state.round && now.committed.some((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "hero");
}
