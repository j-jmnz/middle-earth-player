// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json).
// The check the families that stop a surge chain share (pelargir/surge-chain.ts, ring-maker/surge-chain.ts). A game can drain its encounter deck into the staging area, the engaged rows and the hidden cards until a surging card is the only card it has left. The core's reset would
// shuffle that card back and reveal it inside its own surge for ever. Each family decides in which game and for which cards the chain is cut, then asks this check whether the state is such a chain.
import type { ScenarioState } from "../core/state.ts";

/** The deck is empty and every card of the discard pile is a card whose reveal is past its staging and still open (a surge chain, rr.surge) and that `counts` accepts: the surge finds no card and the chain ends; the reset that follows the last reveal (faq.last-encounter-card) runs as usual. */
export function inSurgeChain(state: ScenarioState, counts: (code: string) => boolean = () => true): boolean {
  if (state.encounterDeck.length > 0 || state.encounterDiscard.length === 0) return false;
  const open = new Set(state.stack.filter((frame) => frame.frame === "reveal" && frame.step >= 6).map((frame) => frame.cardId));
  return state.encounterDiscard.every((id) => open.has(id) && counts(state.cards[id]?.code ?? ""));
}
