// Rules: dcce.island-map, dcce.exploration, dcce.gaining-xp (data/rules/entries.json); ledger lines 12067:A:1, 12067:B:2, 12071:A:2, 110078:B:3, 12078:A:1, 12077:A:1, 11197:B:5, 11197:B:6. What the island family's filters, amounts
// and conditions read of the map: the locations a Pick may offer (the starting corners, the Temple column, the secrets), the Threat of the locations to the left of the active one, the way the last
// travel went, and how many locations are flipped or still lie Uncharted side up.
import type { Condition, PickSpec } from "../../../catalog/boundary.ts";

import { modifiedStat } from "../../keywords.ts";
import type { ReduceContext } from "../../interpret.ts";
import type { ScenarioState } from "../../state.ts";
import { cardsUnder } from "../../zones.ts";
import { cellOf, islandOf, leftOf, neighbors, startCells, templeCells } from "./map.ts";

/** The cards an `island` filter starts from. `start`: the faceup left corners, before one is the active location; `temple`: the Temple
 * column's locations that lie facedown (their Temple of the Deceived side up); `secret`: the cards facedown under those locations. */
export function islandPool(state: ScenarioState, spec: PickSpec): string[] | null {
  const island = islandOf(state);
  if (!island || !spec.island) return null;
  if (spec.island === "start") return startCells(state);
  const temple = templeCells(state);
  if (spec.island === "temple") return temple.filter((id) => state.cards[id]?.face === "B");
  if (spec.island === "secret") return temple.flatMap((id) => cardsUnder(state, id));
  if (spec.island === "here") return state.activeLocation ? cardsUnder(state, state.activeLocation) : [];
  if (spec.island === "adjacent") return state.activeLocation ? neighbors(island, state.activeLocation).filter((id) => state.cards[id]?.face === "B" && !temple.includes(id)) : [];
  return null;
}

/** The amount `islandLeft`: the total Threat of the locations to the left of the active location, in its row (12078:A:1). A facedown location counts the Threat its facedown side prints. */
export function leftThreat(state: ScenarioState, ctx: Pick<ReduceContext, "cards">): number {
  const island = islandOf(state);
  const active = state.activeLocation;
  if (!island || !active) return 0;
  return leftOf(island, active).reduce((total, id) => {
    const card = state.cards[id];
    return total + (card ? modifiedStat(state, card, "threat", ctx.cards) : 0);
  }, 0);
}

/** How many locations of the map have been flipped over, so they show the location they really are (side A), with this code when one is named: "each faceup Temple Halls" (11197:B:5). */
export function flippedCount(state: ScenarioState, code?: string): number {
  const island = islandOf(state);
  if (!island) return 0;
  return island.cells.filter((id) => state.cards[id]?.face === "A" && (code == null || state.cards[id]?.code === code)).length;
}

/** The `island` condition: at most this many double-sided locations are flipped (11197:B:6, the short-route bonus), the last travel went to the right, to a column right of the one it left (12077:A:1), or this many copies of a card are no secret (11197:B:1). */
export function islandHolds(state: ScenarioState, condition: Extract<Condition, { kind: "island" }>): boolean {
  if (condition.revealed) {
    const { code, min } = condition.revealed;
    if (Object.values(state.cards).filter((card) => card.code === code && card.zone !== "under" && card.zone !== "setAside").length < min) return false;
  }
  if (condition.flippedAtMost != null && flippedCount(state) > condition.flippedAtMost) return false;
  if (condition.movedRight) {
    const island = islandOf(state);
    const moved = island?.moved;
    const from = island && moved ? cellOf(island, moved.from) : null;
    const to = island && moved ? cellOf(island, moved.to) : null;
    if (!from || !to || to.col <= from.col) return false;
  }
  return true;
}

/** The locations of the map that are neither the active location nor in the staging area: still in play, so "a location" may be one (Spyglass, Starla). */
export function outsideCells(state: ScenarioState): string[] {
  const island = islandOf(state);
  return island ? island.cells.filter((id) => state.cards[id]?.zone === "islandMap") : [];
}
