// Rules: rr.setup, rr.card-types, rr.in-play-and-out-of-play, rr.play-restrictions-and-permissions (data/rules/entries.json).
// The Rules Reference in data/rules has no contract span; this follows the printed contract cards: a player's contract begins the
// game in their play area (it is no part of the deck they draw from), shows its side A, and is flipped over by its own abilities.
// Each side's abilities are records whose line ids name the side (`21074:B:1`) and which carry a `faceUp` condition for it.
import type { Condition, PickSpec } from "../../../catalog/boundary.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Modifier, ScenarioState } from "../../core/state.ts";
import { heldAmount, updateCard } from "../../core/state.ts";
import { moveCard, playerCardsUnder } from "../../core/zones.ts";
import { familyPlayBarred } from "../../interpret/family-hooks.ts";
import { lootUnder } from "./loot.ts";

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
    // A code the card map does not know (a test deck) is not a contract.
    if (!card || ctx.cards.get(card.code)?.type !== "contract") continue;
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
  // "+1 quest point for each facedown player card under it" (18075:B:1): the cards counted lie under the holder, not on it.
  if (pick.facedownUnder) return playerCardsUnder(state, holderId).length;
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

// Whether a card in play its controller has forbids this seat to play the card or put it into play (`CannotPlay`). A card that bars every player (`anyPlayer`) bars
// playing only: a card put into play is not played (rr.play-and-put-into-play), and "cannot" is absolute (rr.cannot). `putting`: the question is about putting the card into play.
export function playBlocked(state: ScenarioState, cardId: string, seat: number, ctx: ReduceContext, putting = false): boolean {
  if (!state.cards[cardId]) return false;
  // A family's bar on playing and putting into play alike (the allies-a-round limit of LimitEntries, families/sea/entries.ts).
  if (familyPlayBarred(state, cardId, ctx, undefined, putting)) return true;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "CannotPlay") continue;
    if (instruction.anyPlayer ? putting : (source.controller ?? state.firstPlayer) !== seat) continue;
    if (matchesPick(state, cardId, instruction.pick, { seat, sourceId: source.id, counting: true }, ctx)) return true;
  }
  return false;
}
