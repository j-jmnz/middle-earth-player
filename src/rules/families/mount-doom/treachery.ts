// Rules: rr.surge, mec109.immune-to-player-card-effects (data/rules/entries.json); ledger lines 146075:B:2, 146077:B:1. "The first treachery revealed each quest phase is immune to player card effects and gains surge": the stage's constant record FirstTreacheryImmuneSurge is the marker;
// the engine notes the reveal as the card is revealed, before its When Revealed effects and before the surge check.
import type { Instruction } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

const MARKER: Instruction["verb"] = "FirstTreacheryImmuneSurge";
const READER = '"kind":"firstTreachery"';

/**
 * A card was revealed (the `revealed` hook): the first treachery the encounter deck reveals in a quest phase, while a stage in play holds the marker, is immune to player card effects until it leaves play and gains surge. The table remembers that one was revealed until the phase ends (`treacheryRevealed`).
 * In a game with a record that reads the condition `firstTreachery` the card is also marked `firstTreachery` until the phase ends, whatever the marker does, so a Forced effect that hears the reveal can tell the first (02082:B:1).
 */
export function noteFirstTreachery(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || state.phase !== "Quest" || top?.data.kind !== "reveal" || top.data.fromDeck !== true || top.cardId !== cardId) return state;
  if (printedOf(ctx.cards, card.code).type !== "treachery" || flagged(state, "table", "treacheryRevealed")) return state;
  const immune = constantVerbCodes(ctx, MARKER).size > 0 && constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === MARKER);
  const read = gameReads(state, ctx, READER);
  if (!immune && !read) return state;
  const mark = (instanceId: string, stat: "treacheryRevealed" | "immuneToPlayerCards" | "firstTreachery", until: "endOfPhase" | "whileSourceInPlay") => ({ instanceId, sourceId: cardId, stat, amount: 1, until });
  const marked = { ...state, modifiers: [...state.modifiers, mark("table", "treacheryRevealed", "endOfPhase"), ...(read ? [mark(cardId, "firstTreachery", "endOfPhase")] : []), ...(immune ? [mark(cardId, "immuneToPlayerCards", "whileSourceInPlay")] : [])] };
  return immune ? markSurge(marked, cardId) : marked;
}
