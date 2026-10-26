// Rules: rr.setup, rr.card-types, rr.in-play-and-out-of-play, rr.play-restrictions-and-permissions (data/rules/entries.json).
// The Rules Reference in data/rules has no contract span; this follows the printed contract cards: a player's contract begins the
// game in their play area (it is no part of the deck they draw from), shows its side A, and is flipped over by its own abilities.
// Each side's abilities are records whose line ids name the side (`21074:B:1`) and which carry a `faceUp` condition for it.
import type { Condition, PickSpec } from "../../catalog/boundary.ts";
import { constantInstructions } from "../constant-records.ts";
import type { ReduceContext } from "../interpret.ts";
import { matchesPick } from "../pick.ts";
import { printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { Modifier, ScenarioState } from "../state.ts";
import { heldAmount, updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";
import { lootUnder } from "./sidequests-loot.ts";

// The `faceUp` condition: the card shows this side. A card dealt face up shows its side A.
export function faceUp(state: ScenarioState, sourceId: string | null, side: "A" | "B"): boolean {
  const face = sourceId ? state.cards[sourceId]?.face : undefined;
  return face === side || (side === "A" && face === "up");
}

// The `flag` condition: the actor's seat or the source card holds a modifier of this stat that is in force.
export function flagHeld(state: ScenarioState, condition: Extract<Condition, { kind: "flag" }>, sourceId: string | null, actor: number): boolean {
  const holder = condition.holder === "seat" ? `seat:${actor}` : (sourceId ?? "");
  return (heldAmount(state, holder, condition.stat as Modifier["stat"]) > 0) === (condition.is !== false);
}

// Setup: a contract in a player's deck is placed in their play area instead, showing its side A, before the deck is shuffled and
// the opening hand is drawn.
export function placeContracts(state: ScenarioState, seat: number, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const id of state.seats[seat]?.deck ?? []) {
    const card = next.cards[id];
    if (!card || printedOf(ctx.cards, card.code).type !== "contract") continue;
    next = updateCard(moveCard(next, id, { zone: "play", seat }), id, { face: "A" });
  }
  return next;
}

// FlipCard: the source card turns over, side A to side B and back, and the card hears that it was flipped.
export function flipCard(state: ScenarioState, sourceId: string | null): ScenarioState {
  const card = sourceId ? state.cards[sourceId] : undefined;
  if (!card) return state;
  const side = card.face === "B" ? "A" : "B";
  return queueEvent(updateCard(state, card.id, { face: side }), { trigger: "flipped", seat: card.controller, cardId: card.id });
}

// How many of the cards attached to this holder match the filter (the `eachAttached` of a constant ModifyStat).
export function attachedCount(state: ScenarioState, holderId: string, pick: PickSpec, sourceId: string, ctx: ReduceContext): number {
  const holder = state.cards[holderId];
  const seat = state.cards[sourceId]?.controller ?? state.firstPlayer;
  // A guarded objective counts as attached to the location it guards (The Burglar's Turn).
  const attached = [...(holder?.attachments ?? []), ...lootUnder(state, holderId)];
  return attached.filter((id) => matchesPick(state, id, pick, { seat, sourceId, counting: true }, ctx)).length;
}

// ReduceFirstOnEachHero: how much less the card costs to play on this host, a hero of the seat, when it is the first card that
// matches played on that hero this round.
export function hostDiscount(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, hostId: string | null | undefined): number {
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || !host || host.controller !== seat || printedOf(ctx.cards, host.code).type !== "hero") return 0;
  let total = 0;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "ReduceFirstOnEachHero" || (source.controller ?? state.firstPlayer) !== seat) continue;
    const at = { seat, sourceId: source.id, counting: true };
    if (!matchesPick(state, cardId, instruction.pick, at, ctx)) continue;
    const spent = (state.played ?? []).some(
      (entry) => entry.round === state.round && entry.seat === seat && entry.id !== cardId && state.cards[entry.id]?.host === hostId && matchesPick(state, entry.id, instruction.pick, at, ctx),
    );
    if (!spent) total += instruction.amount;
  }
  return total;
}

// Whether a card in play its controller has forbids this seat to play the card or put it into play (`CannotPlay`).
export function playBlocked(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext): boolean {
  if (!state.cards[cardId]) return false;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "CannotPlay" || (source.controller ?? state.firstPlayer) !== seat) continue;
    if (matchesPick(state, cardId, instruction.pick, { seat, sourceId: source.id, counting: true }, ctx)) return true;
  }
  return false;
}
