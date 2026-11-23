// Rules: rr.immune, mec109.immune-to-player-card-effects, hob.immune-to-player-card-effects, dwd.immune-to-card-effects, faq.legolas-immune-location (data/rules/entries.json).
// A card immune to an effect "cannot be chosen as the target for or affected by" it (rr.immune). A pick never offers such a card (pick.ts), and damage
// skips it (placeDamage); this guards the cards an instruction names without a pick: the active location, the subject of the event, the other card of it,
// the attacking enemy. An immune card there ignores the instruction (Lórien Guide's progress on Bucklebury Ferry, Fastred returning Revenant).
import type { Instruction } from "../../catalog/boundary.ts";
import { isPlayerCardEffect, playerCardEffectCanChoose, sourcePrinted } from "../core/keywords.ts";
import { hasQuestPoints, printedOf } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { inPlay } from "../core/zones.ts";
import { immuneToSource } from "../families/misc/guards.ts";
import { activeLocations, progressRoom } from "../families/south/locations.ts";
import { frameScope, refCard } from "./amounts.ts";
import type { ReduceContext } from "./interpret.ts";

type Focus = { seat: number; sourceId: string | null };

// The refs that name one card with no pick. "self" and "host" name the source's own card or its host, which an effect of the source can always reach.
const NAMED = new Set(["activeLocation", "subject", "other", "attacker"]);

// Instructions whose target is not the card they affect: a shadow card dealt to, looked at or discarded from the attacker is the shadow card's business, not the
// enemy's (rr.immune: immunity protects only the card itself).
const PERIPHERAL = new Set(["DealShadowTo", "DiscardShadowOf", "LookAtShadow"]);

/** Whether the effect of the source may not affect this card in play: it is immune to player card effects (or to this player card), or to the source. */
export function immuneTo(state: ScenarioState, id: string, sourceId: string | null, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card || !sourceId || id === sourceId || !inPlay(card.zone)) return false;
  if (isPlayerCardEffect(state, ctx.cards, sourceId) && !playerCardEffectCanChoose(printedOf(ctx.cards, card.code), state, id, sourcePrinted(state, ctx.cards, sourceId))) return true;
  return immuneToSource(state, id, sourceId, ctx);
}

/** The card the instruction names without a pick is immune to its source, so the instruction does nothing. */
export function namedTargetImmune(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext): boolean {
  if (!focus.sourceId || PERIPHERAL.has(instruction.verb) || !("target" in instruction)) return false;
  const target = instruction.target;
  const ref = typeof target === "string" ? target : target != null && typeof target === "object" && "kind" in target && typeof target.kind === "string" ? target.kind : null;
  if (ref == null || !NAMED.has(ref)) return false;
  const id = refCard(state, ref as Parameters<typeof refCard>[1], frameScope(state, focus.seat, focus.sourceId));
  return id != null && immuneTo(state, id, focus.sourceId, ctx);
}

/** The active location that would take a player card effect's progress on the current quest first (placeOnActive, families/south/locations.ts) is
 * immune to that effect: the location ignores it, and the quest takes none either (faq.legolas-immune-location). */
export function immuneBuffer(state: ScenarioState, sourceId: string | null, ctx: ReduceContext): boolean {
  // The rulings are about a player card's progress: the progress of an encounter or quest card goes on as rr.active-location says.
  if (!sourceId || !isPlayerCardEffect(state, ctx.cards, sourceId)) return false;
  const id = activeLocations(state).find((candidate) => hasQuestPoints(printedOf(ctx.cards, state.cards[candidate]?.code ?? "")) && progressRoom(state, candidate, ctx.cards) > 0);
  return id != null && immuneTo(state, id, sourceId, ctx);
}
