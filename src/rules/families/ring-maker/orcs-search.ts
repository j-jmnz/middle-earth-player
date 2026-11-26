// Rules: rm.the-orcs-search (data/rules/entries.json); ledger lines 08124:A:1, 08125:A:1, 08134:A:1, 08134:A:2. The cards facedown underneath The Orcs' Search: the locations whose damage has reached their printed quest points, a card from each hand and a character a Shadow effect
// destroyed. They are out of play, and only a card that names them reads them (the amount `facedownUnder`).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { nextUint } from "../../core/seed.ts";
import { gameReads } from "../../core/game-reads.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import { placeUnderHost } from "../encounter/moves.ts";
import { heldInHand } from "./hand.ts";
import type { Focus } from "../index.ts";

/** The card in play with this code, the host of the facedown cards (null in a game without it). */
function hostOf(state: ScenarioState, code: string): string | null {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone))?.id ?? null;
}

/** The host of the card whose record holds BuryDamagedLocations, in play. */
function searchOf(state: ScenarioState, ctx: ReduceContext): string | null {
  const host = Object.values(state.cards).find((card) => inPlay(card.zone) && ctx.effects.some((effect) => effect.cardCode === card.code && effect.instructions.some((instruction) => instruction.verb === "BuryDamagedLocations")));
  return host?.id ?? null;
}

/** The settle sweep (08125:A:1): a location in play, in the staging area or active, whose damage has reached its printed quest points goes facedown underneath the objective; a game without one looks at nothing. */
export function buryDamaged(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost || state.stageCleared || !gameReads(state, ctx, '"BuryDamagedLocations"')) return state;
  const host = searchOf(state, ctx);
  if (!host) return state;
  let next = state;
  for (const id of [...state.staging, state.activeLocation, state.secondActiveLocation]) {
    const card = id ? next.cards[id] : undefined;
    if (!id || !card || !inPlay(card.zone)) continue;
    const printed = printedOf(ctx.cards, card.code);
    if (printed.type !== "location" || printed.questPoints == null || printed.questPoints <= 0 || card.damage < printed.questPoints) continue;
    next = placeUnderHost(next, id, host, ctx, steps);
  }
  return next;
}

/** PlaceRandomHandUnder: each living player in turn, the first player first, puts one card of his hand, chosen by the game's seed, facedown underneath the card in play with the code, out of play and still his own. */
export function placeRandomHandUnder(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceRandomHandUnder" }>): ScenarioState {
  const host = hostOf(state, instruction.code);
  if (!host) return state;
  let next = state;
  for (const seat of livingSeats(state)) {
    const hand = (next.seats[seat]?.hand ?? []).filter((held) => !heldInHand(next, held));
    const id = hand.length === 0 ? undefined : hand[nextUint(next.seed, next.seedCursor) % hand.length];
    if (!id) continue;
    const placed = updateCard(moveCard({ ...next, seedCursor: next.seedCursor + 1 }, id, { zone: "under", locationId: host }), id, { owner: next.cards[id]?.owner ?? seat });
    next = queueEvent(placed, { trigger: "placedUnder", seat: null, subject: id });
  }
  return next;
}

/** PlaceDestroyedUnder: the character the attack destroyed, in its owner's discard pile, goes facedown underneath the card in play with the code and stays its owner's. A card still in play, or one no longer in a discard pile, is left alone. */
export function placeDestroyedUnder(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceDestroyedUnder" }>, focus: Focus): ScenarioState {
  const host = hostOf(state, instruction.code);
  const id = refCard(state, instruction.card ?? "other", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  if (!host || !id || !card || card.zone !== "discard") return state;
  const placed = updateCard(moveCard(state, id, { zone: "under", locationId: host }), id, { owner: card.owner ?? card.controller ?? undefined });
  return queueEvent(placed, { trigger: "placedUnder", seat: null, subject: id });
}
