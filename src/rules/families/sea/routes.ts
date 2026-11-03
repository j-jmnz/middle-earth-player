// Rules: dcce.corsair-deck, dcce.stormcaller-elite (data/rules/entries.json). Cards that do not go to the encounter discard pile when they leave
// play or would be discarded: a non-ship enemy goes to the Corsair discard pile (while a Corsair deck is in the game), and a Stormcaller Elite card,
// which has no encounter card back and so can never be added to the encounter deck or discard pile, goes to the victory display as an enemy and out
// of the game as an objective ally. moveCard (zones.ts) asks routeDestination for every move; the routes are stamped once, when the game is dealt.
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import type { PrintedCard } from "../../core/printed.ts";
import type { Destination } from "../../core/zones.ts";
import type { SeaRoute, SeaState } from "./types.ts";

/** The encounter set of the two double-sided cards that have no encounter card back (dcce.stormcaller-elite). */
export const ELITE_SET = "The Stormcaller Elite";
/** The encounter set of the six ship-objectives and the Heading card (dcce.prepare-your-fleet). */
export const FLEET_SET = "The Dream-chaser's Fleet";

/** A Stormcaller Elite card, on either of its sides. */
export function isElite(printed: PrintedCard): boolean {
  return printed.encounterSet === ELITE_SET;
}

/** The sea state of a new game: the routes of every card of the world that has one, or none when the world holds no ship and no Elite card (every
 * other game keeps a state without `sea`). */
export function stampRoutes(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  if (state.sea) return state;
  const routes: Record<string, SeaRoute> = {};
  let sea = false;
  for (const printed of cards.values()) {
    if (printed.ship != null) sea = true;
    if (isElite(printed)) {
      sea = true;
      if (printed.type === "enemy") routes[printed.code] = "victory";
      else if (printed.type === "objective") routes[printed.code] = "removed";
    } else if (printed.type === "enemy" && printed.ship == null) {
      routes[printed.code] = "corsair";
    }
  }
  if (!sea) return state;
  const stamped: SeaState = { heading: null, headingCard: null, routes };
  return { ...state, sea: stamped };
}

/** Where a card that is moving to `dest` really goes (dcce.corsair-deck, dcce.stormcaller-elite), or null when the move does not happen: an Elite card
 * has no encounter card back, so it can never be added to or shuffled into the encounter deck or discard pile, and a copy that is out of play stays
 * where it is. One that leaves play goes to the victory display (an enemy) or out of the game (an objective ally). */
export function routeDestination(state: ScenarioState, current: Pick<CardInstance, "code" | "zone">, dest: Destination): Destination | null {
  const route = state.sea?.routes[current.code];
  if (!route || (dest.zone !== "encounterDiscard" && dest.zone !== "encounterDeck")) return dest;
  if (route === "corsair") return dest.zone === "encounterDiscard" && state.corsairDeck !== undefined ? { zone: "corsairDiscard" } : dest;
  return inPlay(current.zone) ? { zone: route } : null;
}
