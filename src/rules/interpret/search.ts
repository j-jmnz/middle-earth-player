// Rules: rr.in-play-and-out-of-play, rr.removed-from-game (data/rules/entries.json). The encounter cards an effect can find or shuffle: the out-of-play copies of a card and the matches in the encounter deck and discard pile.
import { BURN_CODE } from "../families/aflame/values.ts";
import { isSafeLocation } from "../families/angmar/safe.ts";
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
  selector: { code?: string; trait?: string; traits?: readonly string[]; type?: string; nonUnique?: boolean; safe?: boolean; deckOnly?: boolean; discardOnly?: boolean; victory?: boolean; maxCost?: number; maxCostMulti?: number; types?: readonly string[]; top?: number },
  ctx: ReduceContext,
  // `deckOnly`: the encounter deck alone, not its discard pile ("search the encounter deck for a Harad enemy", 144037:A:1).
  // `discardOnly`: the encounter discard pile alone ("Put each copy of Cursed Dead in the discard pile into play", 09061:A:1).
  zones: readonly ("encounterDeck" | "encounterDiscard")[] = selector.deckOnly === true || selector.top != null ? ["encounterDeck"] : selector.discardOnly === true ? ["encounterDiscard"] : ["encounterDeck", "encounterDiscard"],
): string[] {
  const found: string[] = [];
  // The Wizard's Quest (51003:A:1): "cost 2 or less (3 or less if there are two or more players)" and "the top 5 cards" of the encounter deck.
  const costLimit = selector.maxCost == null ? null : state.seatCount >= 2 && selector.maxCostMulti != null ? selector.maxCostMulti : selector.maxCost;
  // `victory`: the victory display is searched too ("search the encounter deck, discard pile, and victory display for a Nazgûl enemy", 146036:A:2).
  const piles = [...zones.map((zone) => (selector.top != null && zone === "encounterDeck" ? state[zone].slice(0, selector.top) : state[zone])), ...(selector.victory === true ? [state.victory] : [])];
  for (const pile of piles) {
    for (const id of pile) {
      const instance = state.cards[id];
      if (!instance) continue;
      const printed = printedOf(ctx.cards, instance.code);
      if (selector.code != null && printed.code !== selector.code) continue;
      if (selector.trait != null && !printed.traits.includes(selector.trait)) continue;
      if (selector.traits != null && !selector.traits.some((trait) => printed.traits.includes(trait))) continue;
      if ((selector.type != null && printed.type !== selector.type) || (selector.nonUnique === true && printed.isUnique)) continue;
      if (selector.safe === true && !isSafeLocation(state, id, ctx)) continue;
      if (costLimit != null && (printed.cost ?? Infinity) > costLimit) continue;
      if (selector.types != null && !selector.types.includes(printed.type)) continue;
      found.push(id);
    }
  }
  return found;
}

/**
 * The card "the opposing team" finds when it searches (docs/scenarios/standalone-scenarios.md, The Wizard's Quest, reading 3): of enemies and locations the highest printed Threat (an enemy: the highest Attack when Threat is level), then the one nearest the top of the deck;
 * of any other card the one nearest the top. `found` lists them in deck order, the discard pile after the deck. Null when nothing was found.
 */
export function greatestChallenge(state: ScenarioState, found: readonly string[], ctx: ReduceContext): string | null {
  const score = (id: string): [number, number] => {
    const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
    return printed.type === "enemy" || printed.type === "location" ? [printed.threat ?? 0, printed.type === "enemy" ? (printed.attack ?? 0) : 0] : [0, 0];
  };
  let best: string | null = null;
  for (const id of found) {
    if (best == null) {
      best = id;
      continue;
    }
    const [threat, attack] = score(id);
    const [bestThreat, bestAttack] = score(best);
    if (threat > bestThreat || (threat === bestThreat && attack > bestAttack)) best = id;
  }
  return best;
}
