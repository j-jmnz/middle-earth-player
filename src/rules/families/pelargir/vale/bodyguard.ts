// Rules: rr.damage, rr.in-play-and-out-of-play, ats.captain-enemies (data/rules/entries.json); ledger line 06148:A:1.
// "Any damage that would be dealt to a Captain enemy is dealt to 1 Morgul Bodyguard instead": each Captain enemy holds `shieldedByBodyguard` while a Bodyguard is in play (the Bodyguard's constant). The damage is aimed again before the Captain's own limits apply,
// so the Nazgûl's reduction to 1 never touches what a Bodyguard takes (Readings, 06148:A:1). The engine picks the Bodyguard that holds the most damage, the first in play on a tie; what passes its hit points is lost.
import type { ScenarioState } from "../../../core/state.ts";
import { flagged, inPlay } from "../../../core/state.ts";

const BODYGUARD = "06148";

/** The card that takes the damage assigned to `id`: the Bodyguard in play with the most damage while `id` holds `shieldedByBodyguard`, or null (the damage stays where it was assigned). */
export function bodyguardTarget(state: ScenarioState, id: string): string | null {
  if (state.modifiers.length === 0 || !flagged(state, id, "shieldedByBodyguard")) return null;
  let best: string | null = null;
  for (const card of Object.values(state.cards)) {
    if (card.code !== BODYGUARD || !inPlay(card.zone)) continue;
    const held = best == null ? undefined : state.cards[best];
    if (held == null || card.damage > held.damage || (card.damage === held.damage && card.enteredPlay < held.enteredPlay)) best = card.id;
  }
  return best;
}
