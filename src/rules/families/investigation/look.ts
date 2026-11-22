// Rules: docs/scenarios/standalone-scenarios.md (Murder at the Prancing Pony, readings 2 to 6 and 10), rr.forced, rr.search; ledger lines 50715:A:1, 50716:A:1 to 50720:A:1, 50719:A:2, 50722:A:1, 50726:A:2, 50714:A:1. Looking at the Investigation deck: Investigate X shuffles it and looks at the top X cards; every other look (top or bottom) leaves it as it is.
// A look shows the cards to the looking seat in a window and moves nothing. The cards looked at are noted on the running effect, and once the whole effect has resolved each hears the look (`lookedAtInvestigationDeck`): Taken by Surprise resolves from the deck (50714:A:1). No step names a card.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { pileOf, shufflePile } from "../../core/piles.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { textBlank } from "../attachments/hold.ts";
import { effectsOf } from "../../windows/listen.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount, updateCards } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { ignoresKeyword } from "../wilderland/markers.ts";
import type { Focus } from "../index.ts";

const DECK = "investigationDeck" as const;

type Keyword = Extract<Instruction, { verb: "Investigate" }>;

/** The Investigate keyword a location prints (its Forced record on `activeExplored`), unless its text is blank. */
function keywordOf(state: ScenarioState, locationId: string, ctx: ReduceContext): { record: Effect; instruction: Keyword } | null {
  const card = state.cards[locationId];
  if (!card || textBlank(state, locationId, ctx.cards)) return null;
  for (const record of effectsOf(ctx, card.code)) {
    if (record.timing !== "forced" || record.trigger !== "activeExplored") continue;
    const instruction = record.instructions.find((item): item is Keyword => item.verb === "Investigate");
    if (instruction) return { record, instruction };
  }
  return null;
}

/** Whether a card in play ignores the Investigate keyword (IgnoreKeyword `investigate`, 50703:B:1). */
export function investigateIgnored(state: ScenarioState, ctx: ReduceContext): boolean {
  return ignoresKeyword(state, ctx, "investigate");
}

/** The Investigate value of the active location: its printed X as its record reads it, 0 with no active location or no keyword. Whether the keyword is ignored does not change it (reading 4: the ignore is worded for the explore only). */
export function investigateValue(state: ScenarioState, ctx: ReduceContext, actor: number): number {
  const id = state.activeLocation;
  const found = id ? keywordOf(state, id, ctx) : null;
  return id && found ? Math.max(0, resolveAmount(state, found.instruction.amount, frameScope(state, actor, id), ctx)) : 0;
}

/** Notes the cards a look showed on the running effect, to be told once it has resolved; with no effect running they hear it at once. */
function noteLooked(state: ScenarioState, ids: readonly string[]): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind === "effect") return patchTop(state, { data: { ...top.data, investigationLooked: [...(top.data.investigationLooked ?? []), ...ids] } });
  return ids.reduce((current, id) => queueEvent(current, { trigger: "lookedAtInvestigationDeck", seat: state.firstPlayer, subject: id }), state);
}

/** The window that shows the cards to the seat. */
function showing(state: ScenarioState, seat: number, ids: readonly string[]): ScenarioState {
  if (ids.length === 0) return state;
  const marked = updateCards(state, ids.map((id) => [id, { seen: true }] as const));
  return { ...marked, window: { kind: "look", seat, cardIds: ids }, activeSeat: seat, passed: [] };
}

/**
 * Investigate X (a location's Forced effect when it is explored as the active location): the first player shuffles the deck and looks at the top X cards, with the flag's additional ones, which stay on top in the same order. Nothing happens while the keyword is ignored. The location
 * hears `investigated` afterward (50720:A:2), the cards looked at hear the look when the effect is done.
 */
export function investigate(state: ScenarioState, instruction: Keyword, focus: Focus, ctx: ReduceContext): ScenarioState {
  const locationId = focus.sourceId;
  if (!locationId || !state.cards[locationId] || investigateIgnored(state, ctx)) return state;
  const value = Math.max(0, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, locationId), ctx));
  const depth = value > 0 ? value + Math.max(0, heldAmount(state, locationId, "investigateLooked")) : 0;
  const shuffled = shufflePile(state, DECK);
  const ids = pileOf(shuffled, DECK).slice(0, depth);
  const seen = showing(noteLooked(shuffled, ids), state.firstPlayer, ids);
  return queueEvent(seen, { trigger: "investigated", seat: state.firstPlayer, subject: locationId });
}

/** LookAtInvestigation: the actor sees the top or the bottom `count` cards of the deck; nothing is shuffled or moved. */
export function lookAtInvestigation(state: ScenarioState, instruction: Extract<Instruction, { verb: "LookAtInvestigation" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const count = instruction.count == null ? 1 : Math.max(0, resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx));
  const pile = pileOf(state, DECK);
  const ids = count === 0 ? [] : instruction.from === "top" ? pile.slice(0, count) : pile.slice(-count);
  return showing(noteLooked(state, ids), focus.seat, ids);
}

/** Whether a Trait is held by the top card of the deck: the card the keyword just showed when it looked at one (the condition `investigationTop`). */
export function investigationTop(state: ScenarioState, traits: readonly string[], ctx: ReduceContext): boolean {
  const id = pileOf(state, DECK)[0];
  return id !== undefined && traits.some((trait) => hasTrait(state, id, trait, ctx));
}
