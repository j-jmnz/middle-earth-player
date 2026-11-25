// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json); ledger line 07041:A:1.
// A long game of To Catch an Orc can drain the encounter deck into the staging area and the engaged rows until Orc Hunting Party, which gains surge while no Orc enemy is staged, is the only card the game has left. The core's reset would shuffle it back and reveal it inside its own surge for ever.
// A pass of it deals a shadow card to each Orc in play (none is left in the deck) and lowers an engagement cost until the end of the round, so a pass that repeats changes nothing that matters and the chain ends, as in The Blood of Gondor (families/pelargir/surge-chain.ts). The hook answers false in every other game.
import type { ScenarioState } from "../../core/state.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** The deck is empty and every card of the discard pile is a card whose reveal is past its staging and still open (a surge chain, rr.surge): the surge finds no card and the chain ends; the reset that follows the last reveal runs as usual. Only in a game that builds out-of-play decks. */
export function inOwnSurgeChain(state: ScenarioState, ctx: ReduceContext): boolean {
  if (state.encounterDeck.length > 0 || state.encounterDiscard.length === 0 || !gameReads(state, ctx, '"CreateOutOfPlayDecks"')) return false;
  const open = new Set(state.stack.filter((frame) => frame.frame === "reveal" && frame.step >= 6).map((frame) => frame.cardId));
  return state.encounterDiscard.every((id) => open.has(id));
}
