// Rules: rr.engagement-check, rr.optional-engagement (data/rules/entries.json). The engagement check of one seat against one enemy: what the encounter phase's checks (quest.ts qualifyingEnemies), an effect's (MakeEngagementChecks) and an ambush check
// (families/encounter/ambush.ts) share.
import type { PrintedCard } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { flagged, heldAmount } from "../core/state.ts";
import { checkCost } from "../families/costs/stats.ts";
import { seatThreat } from "../families/play/hooks.ts";
import { engagementBarred } from "../families/quest/engage.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// The Threat a seat counts in an engagement check: its own, and what a card adds for checks only (`engagementThreat`, Vicious Trackers 901406:A:2). Optional engagement reads seatThreat alone.
export function checkThreat(state: ScenarioState, seat: number): number {
  return seatThreat(state, seat) + (state.modifiers.length > 0 ? heldAmount(state, `seat:${seat}`, "engagementThreat") : 0);
}

// Whether an engagement check by this seat engages the enemy, which stands wherever the caller reads it: its engagement cost, as it checks against this seat, is at most the Threat the seat counts. An enemy that "does not make engagement checks" is passed over (it can still be engaged optionally).
export function checkEngages(state: ScenarioState, id: string, seat: number, cards: Cards): boolean {
  const instance = state.cards[id];
  if (!instance || flagged(state, id, "cannotBeEngaged") || flagged(state, id, "noEngagementChecks") || engagementBarred(state, id, seat, "checks")) return false;
  // With what the enemy gets while checking against this seat (Orc Disguise, families/costs/stats.ts).
  const cost = checkCost(state, instance, seat, cards);
  return cost != null && cost <= checkThreat(state, seat);
}
