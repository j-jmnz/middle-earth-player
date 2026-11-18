// Rules: ltp.commit-characters, rr.cannot (data/rules/entries.json); ledger line 04118:B:2.
//
// "Each player cannot commit more allies to the quest than the number of heroes he is also committing": the table's flag `commitAlliesLimitByHeroes` counts the characters the seat has committed and the ones the intent adds, and refuses an intent that leaves it with more allies than heroes
// (an ally needs a committed hero, a seat committing no hero commits no ally).
import type { PrintedCard } from "../../core/printed.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { characters } from "../../combat/combat.ts";

/** Why the commitment of these cards would break the limit, or null. */
export function commitLimitReason(state: ScenarioState, seat: number, cardIds: readonly string[], cards: ReadonlyMap<string, PrintedCard>): string | null {
  if (state.modifiers.length === 0 || !flagged(state, "table", "commitAlliesLimitByHeroes")) return null;
  const counted = new Set([...cardIds, ...characters(state, seat, cards).filter((id) => state.cards[id]?.committed)]);
  let allies = 0;
  let heroes = 0;
  for (const id of counted) {
    const card = state.cards[id];
    if (!card) continue;
    if (card.zone === "heroes") heroes += 1;
    else if (printedOf(cards, card.code).type === "ally") allies += 1;
  }
  return allies > heroes ? "A player cannot commit more allies than the heroes he commits" : null;
}
