// Rules: dcce.exploration, rr.travel, rr.active-location (data/rules/entries.json); ledger lines 12067:B:1, 12073:A:2, 12068:B:3. Traveling on the Island Map: the active location stays where it lies, and the
// players may travel from it once it has progress equal to its quest points, to a location in the staging area (an adjacent one) or, from Winding Caverns, to one up to 3 locations away. All the progress
// leaves the location they traveled from, which is "explored" and stays in place. This file holds what Exploration changes about traveling; the Travel intent itself is rules/quest/travel.ts.
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { PrintedCard } from "../../core/printed.ts";
import { questPointsOf } from "../../quest/quest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { exploring, islandOf, setActive, within } from "./map.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

/** The active location has progress equal to its quest points, so the players have the option to travel from it (dcce.exploration). False with no active location, and in a game with no map. */
export function islandMayTravel(state: ScenarioState, cards: Cards): boolean {
  if (!exploring(state) || !state.activeLocation) return false;
  const active = state.cards[state.activeLocation];
  if (!active) return false;
  const points = questPointsOf(state, active, cards);
  return points != null && active.progress >= points;
}

/** The locations the active location lets the players reach beyond the staging area: up to its `islandReach` locations away (12073:A:2). Their Travel cost is still paid. */
export function islandReach(state: ScenarioState): string[] {
  const island = islandOf(state);
  const active = state.activeLocation;
  if (!island || !active) return [];
  const reach = heldAmount(state, active, "islandReach");
  return reach > 0 ? within(island, active, reach).filter((id) => state.cards[id]?.zone === "islandMap") : [];
}

/** The travel to a location of the map, when the game has one: the old active location loses its progress and stays where it is, the new one becomes the active location without leaving its place, and
 * the move is kept for "when you travel to the right". Undefined for a game with no Island Map (the ordinary travel); null when the players cannot travel there. */
export function islandTravelTo(state: ScenarioState, locationId: string, cards: Cards, steps: EngineStep[]): ScenarioState | null | undefined {
  const island = islandOf(state);
  if (!island || !exploring(state)) return undefined;
  const instance = state.cards[locationId];
  const old = state.activeLocation;
  if (!instance || !old || !islandMayTravel(state, cards)) return null;
  const reachable = instance.zone === "staging" || islandReach(state).includes(locationId);
  if (!reachable || !island.cells.includes(locationId) || locationId === old) return null;
  const left = state.cards[old]?.progress ?? 0;
  if (left > 0) steps.push({ kind: "progress", targetId: old, amount: -left, cause: ruleCause("dcce.exploration") });
  const cleared = updateCard(state, old, { progress: 0 });
  const moved = setActive(moveCard(cleared, locationId, { zone: "islandMap" }), locationId);
  const uncharted = moved.uncharted;
  const explored = uncharted?.island?.explored ?? [];
  return uncharted?.island ? { ...moved, uncharted: { ...uncharted, island: { ...uncharted.island, moved: { from: old, to: locationId }, explored: explored.includes(old) ? explored : [...explored, old] } } } : moved;
}
