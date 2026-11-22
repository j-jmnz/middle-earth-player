// Rules: sotm.guarding-gollum, rr.first-player, rr.ownership-and-control (data/rules/entries.json); ledger lines 02126:A:1, 02130:A:1, 02132:A:1, 900902:A:1.
//
// The player guarding Gollum is the one who controls the Gollum objective card (02130) in play: "this player places the Gollum objective card in front of him" (sotm.guarding-gollum). Nothing else holds the seat, so a change of guard is a change of that card's control,
// and the table, a save and an Undo read it from the cards.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { flagged, heldAmount, livingSeats } from "../../core/state.ts";

export const GOLLUM_GUARD = "02130";

/** The Gollum objective card while it is in a player's play area (undefined outside a game of Return to Mirkwood, and before Setup puts it there). */
export function guardedGollum(state: ScenarioState): CardInstance | undefined {
  for (const card of Object.values(state.cards)) if (card.code === GOLLUM_GUARD && card.zone === "play" && card.controller != null) return card;
  return undefined;
}

/** The seat that guards Gollum, or null when nobody does. */
export function guardianSeat(state: ScenarioState): number | null {
  return guardedGollum(state)?.controller ?? null;
}

/** Whether a card says the guard cannot change ("While The Spider's Ring is the active location, the player guarding Gollum cannot change", 02131:A:1; Isolation, 900907:A:2). */
export function guardianLocked(state: ScenarioState): boolean {
  return state.modifiers.length > 0 && heldAmount(state, "table", "guardianLocked") > 0;
}

/** The seats other than the guard that are still in the game, in player order from the first player. */
export function otherThanGuardian(state: ScenarioState): number[] {
  const guard = guardianSeat(state);
  const living = livingSeats(state);
  const from = living.indexOf(state.firstPlayer) < 0 ? 0 : living.indexOf(state.firstPlayer);
  return [...living.slice(from), ...living.slice(0, from)].filter((seat) => seat !== guard);
}

/** The `guardianCanChange` condition: the guard may choose a new player now, because no card forbids it and another player is still in the game (sotm.guarding-gollum: "unless card text allows, or mandates a change"; "if able"). */
export function guardianCanChange(state: ScenarioState): boolean {
  return guardianSeat(state) != null && !guardianLocked(state) && otherThanGuardian(state).length > 0;
}

/**
 * The seats a ForEachPlayer with `seats: "guardian"` runs for: the guard, and, when the effect's source is a treachery card's When Revealed or Shadow effect while a card holds `treacheryHitsAll` (Dry Watercourse, 02132:A:1), or a shadow card dealt to an enemy
 * that holds `shadowHitsAll` (Ambushing Orcs, 900902:A:1), each other player after him in player order. A treachery card's Shadow effect is covered too: the printed line says "all treachery card effects" (docs/scenarios/shadows-of-mirkwood.md, Return to Mirkwood).
 */
export function guardianSeats(state: ScenarioState, ctx: ReduceContext, sourceId: string | null): number[] {
  const guard = guardianSeat(state);
  if (guard == null) return [];
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source || state.modifiers.length === 0) return [guard];
  const treachery = printedOf(ctx.cards, source.code).type === "treachery" && heldAmount(state, "table", "treacheryHitsAll") > 0;
  const widened = source.zone === "shadow" ? treachery || (source.host != null && flagged(state, source.host, "shadowHitsAll")) : treachery;
  return widened ? [guard, ...otherThanGuardian(state)] : [guard];
}
