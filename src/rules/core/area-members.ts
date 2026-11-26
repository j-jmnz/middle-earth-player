// Rules: dcce.stormcallers-area-stages, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage (data/rules/entries.json). The one reading of the cards of a quest area (the Stormcaller's area, the Orcs' area): which of its
// members still stand in it, where each stands, and the move between the area zone and the staging area that the players' stage decides. Each family keeps its own area record and says its zone and whether the players are at its stage.
import type { CardInstance, ScenarioState } from "./state.ts";
import { moveCard } from "./zones.ts";

/** The zones a quest area's cards stand in while they belong to it: the area's own zone, or the staging area at the area's stage. */
export type AreaZone = "stormcallerArea" | "orcsArea";

/** The members of an area that still stand in it (its zone or the staging area), in the area's order: a member that left for another zone (engaged, active, discarded) is no longer one. */
export function membersStanding(game: { readonly cards: Readonly<Record<string, CardInstance>> }, members: readonly string[], zone: AreaZone): string[] {
  return members.filter((id) => game.cards[id]?.zone === zone || game.cards[id]?.zone === "staging");
}

/** Where a member of an area stands: `apart` in the area zone (the players are at another stage), `together` in the staging area, null for a card that is not a member or has left. */
export function memberPlace(game: { readonly cards: Readonly<Record<string, CardInstance>> }, members: readonly string[], zone: AreaZone, id: string): "apart" | "together" | null {
  const card = game.cards[id];
  if (!card || !members.includes(id)) return null;
  return card.zone === zone ? "apart" : card.zone === "staging" ? "together" : null;
}

/** Moves each member to where the players' stage says (the staging area at the area's stage, its zone otherwise) and returns the state with the members that still stand in the area. The caller writes `kept` back to its record. */
export function syncMembers(state: ScenarioState, members: readonly string[], zone: AreaZone, same: boolean): { state: ScenarioState; kept: string[] } {
  let next = state;
  const kept: string[] = [];
  for (const id of members) {
    const at = next.cards[id]?.zone;
    if (at === zone) {
      kept.push(id);
      if (same) next = moveCard(next, id, { zone: "staging" });
    } else if (at === "staging") {
      kept.push(id);
      if (!same) next = moveCard(next, id, { zone });
    }
  }
  return { state: next, kept };
}

/** True when `kept` is the area's member list as it stands, so a sync that moved nothing returns the same state object. */
export function sameMembers(kept: readonly string[], members: readonly string[]): boolean {
  return kept.length === members.length && kept.every((id, at) => id === members[at]);
}
