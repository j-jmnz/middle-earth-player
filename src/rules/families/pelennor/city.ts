// Rules: mec113.minas-tirith, rr.damage (data/rules/entries.json); ledger lines 145043:A:1, 145043:A:2, 145046:A:1.
// What Minas Tirith can still take before it is destroyed: its hit points less its damage, plus what City Wall can take first while it is the active location.
import type { PrintedCard } from "../../core/printed.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { minasTirithId, wallRoom } from "./wall.ts";

/** What stands out of play, Minas Tirith takes no damage: a number no damage reaches. */
export const NEVER = Number.MAX_SAFE_INTEGER;

/** The damage that destroys Minas Tirith: its hit points less its damage, plus the room of the active City Wall (damage meant for the city is placed there first, 145046:A:1). NEVER while Minas Tirith is not in play. */
export function cityLeft(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): number {
  const id = minasTirithId(state);
  const city = id ? state.cards[id] : undefined;
  if (!id || !city) return NEVER;
  return Math.max(0, modifiedStat(state, city, "hitPoints", cards) - city.damage) + (wallRoom(state, id, cards)?.room ?? 0);
}
