// Rules: rr.in-play-and-out-of-play, rr.removed-from-game (data/rules/entries.json). The encounter cards an effect can find or shuffle: the out-of-play copies of a card and the matches in the encounter deck and discard pile.
import { BURN_CODE } from "../families/aflame/values.ts";
import { printedOf } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import type { ReduceContext } from "./interpret.ts";

// Cards in the encounter deck, then the discard pile, that match a code, a trait and a printed type.
// The out-of-play copies of a card that "shuffle 1 out of play Ringwraith into the encounter deck" (141026:B:2, 141051:A:2,
// 141053:A:1, 141054:A:2) can take. "Out of play" is the Rules Reference's list (rr.in-play-and-out-of-play): of the zones an
// encounter card can be in, cards set aside, the encounter discard pile and the victory display; a card under Weather Hills
// is out of play by that card's text (141049:A:1). Not the encounter deck itself, which the copy is shuffled into, and not a
// card removed from the game, which "has no further interaction with the game in any manner" (rr.removed-from-game). An
// encounter card is never in a player's hand, deck or discard pile.
export function outOfPlayCopies(state: ScenarioState, code: string): string[] {
  // The cards facedown underneath The Havens Burn are hidden: no choice among copies lists them (dcce.aflame).
  const under = Object.values(state.cards).filter((card) => card.zone === "under" && !(card.host != null && state.cards[card.host]?.code === BURN_CODE)).map((card) => card.id);
  return [...state.setAside, ...state.encounterDiscard, ...state.victory, ...under].filter((id) => state.cards[id]?.code === code);
}

// The out-of-play copies the first player chooses among when one is shuffled into the encounter deck. Copies in one pile are
// the same choice; copies in different zones are not (one under Weather Hills would come back to staging, one in the discard
// pile is found by a search, one set aside is not), so there is one per zone, and one per location for cards under one.
export function outOfPlayChoices(state: ScenarioState, code: string): string[] {
  const seen = new Set<string>();
  return outOfPlayCopies(state, code).filter((id) => {
    const card = state.cards[id];
    const key = `${card?.zone ?? id}:${card?.host ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function searchable(
  state: ScenarioState,
  selector: { code?: string; trait?: string; type?: string; nonUnique?: boolean },
  ctx: ReduceContext,
  zones: readonly ("encounterDeck" | "encounterDiscard")[] = ["encounterDeck", "encounterDiscard"],
): string[] {
  const found: string[] = [];
  for (const zone of zones) {
    for (const id of state[zone]) {
      const instance = state.cards[id];
      if (!instance) continue;
      const printed = printedOf(ctx.cards, instance.code);
      if (selector.code != null && printed.code !== selector.code) continue;
      if (selector.trait != null && !printed.traits.includes(selector.trait)) continue;
      if ((selector.type != null && printed.type !== selector.type) || (selector.nonUnique === true && printed.isUnique)) continue;
      found.push(id);
    }
  }
  return found;
}
