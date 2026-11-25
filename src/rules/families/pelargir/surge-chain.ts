// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json); ledger lines 06130:A:1, 06131:A:1, 06160:A:1.
// A game of The Blood of Gondor can drain its encounter deck into the hidden cards until a surging card (Mordor Looms; Conflict at the Crossroads when it gains surge) is the only card the game has. The core's reset would shuffle that card back and reveal it inside its own surge for ever.
// No card of this deck raises threat or deals damage on a pass of such a chain, so a pass that repeats changes nothing and the chain ends. The Morgul Vale has the same state: The Dead City Looms gains surge while no token lies on To the Tower, and a pass of it changes nothing. Terror Drives Them (06159) places a token on each pass, so
// its chain changes the game and ends by itself at the tenth token (06147:A:3): the rules to the letter apply there. The hook answers false in every other game: the core's reset is as the rules read.
import type { ScenarioState } from "../../core/state.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

const TERROR_DRIVES_THEM = "06159";

/** The deck is empty and every card of the discard pile is a card whose reveal is past its staging and still open (a surge chain, rr.surge): the surge finds no card, the chain ends, and the reset that follows the last reveal (faq.last-encounter-card) runs as usual. Only in a game with a record that takes a hidden card, or one whose To the Tower is in play (its record removes Faramir), and with no Terror Drives Them in the chain. */
export function inOwnSurgeChain(state: ScenarioState, ctx: ReduceContext): boolean {
  if (state.encounterDeck.length > 0 || state.encounterDiscard.length === 0) return false;
  if (!gameReads(state, ctx, '"TakeHiddenCard"') && !gameReads(state, ctx, '"RemoveAllNamedFromGame"')) return false;
  const open = new Set(state.stack.filter((frame) => frame.frame === "reveal" && frame.step >= 6).map((frame) => frame.cardId));
  return state.encounterDiscard.every((id) => open.has(id) && state.cards[id]?.code !== TERROR_DRIVES_THEM);
}
