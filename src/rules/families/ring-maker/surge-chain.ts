// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json); ledger line 07041:A:1.
// A long game can drain the encounter deck into the staging area and the engaged rows until Orc Hunting Party, which gains surge while no Orc enemy is staged, is the only card the game has left. The core's reset would shuffle it back and reveal it inside its own surge for ever.
// A pass of it deals a shadow card to each Orc in play (none is left in the deck) and lowers an engagement cost until the end of the round, so a pass that repeats changes nothing that matters and the chain ends, as in The Blood of Gondor (families/pelargir/surge-chain.ts).
// The hold keys on the Orc Hunting Party record, so it holds in every game that deals the card (To Catch an Orc, Trouble in Tharbad, Celebrimbor's Secret) and answers false in every other game.
import { gameReads } from "../../core/game-reads.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { inSurgeChain } from "../../quest/surge-chain.ts";

const ORC_HUNTING_PARTY = "07041";

/** The discard pile holds only reveals still open (the shared chain check, quest/surge-chain.ts; Orc Hunting Party's surge is what chains them, and an Orc Territory or a location revealed in the chain is open with it): the surge finds no card and the chain ends. */
export function inOwnSurgeChain(state: ScenarioState, ctx: ReduceContext): boolean {
  if (!gameReads(state, ctx, `"cardCode":"${ORC_HUNTING_PARTY}"`)) return false;
  return inSurgeChain(state);
}
