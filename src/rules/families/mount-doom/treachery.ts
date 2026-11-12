// Rules: rr.surge, mec109.immune-to-player-card-effects (data/rules/entries.json); ledger lines 146075:B:2, 146077:B:1. "The first treachery revealed each quest phase is immune to player card effects and gains surge": the stage's constant record FirstTreacheryImmuneSurge is the marker;
// the engine notes the reveal as the card is revealed, before its When Revealed effects and before the surge check.
import type { Instruction } from "../../../catalog/boundary.ts";

import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

const MARKER: Instruction["verb"] = "FirstTreacheryImmuneSurge";

/** A card was revealed (the `revealed` hook): the first treachery the encounter deck reveals in a quest phase, while a stage in play holds the marker, is immune to player card effects until it leaves play and gains surge. The table remembers that one was revealed until the phase ends (`treacheryRevealed`, the marker Mount Gundabad's first treachery uses). */
export function noteFirstTreachery(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || state.phase !== "Quest" || top?.data.kind !== "reveal" || top.data.fromDeck !== true || top.cardId !== cardId) return state;
  if (printedOf(ctx.cards, card.code).type !== "treachery" || flagged(state, "table", "treacheryRevealed")) return state;
  if (constantVerbCodes(ctx, MARKER).size === 0 || !constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === MARKER)) return state;
  const mark = (instanceId: string, stat: "treacheryRevealed" | "immuneToPlayerCards", until: "endOfPhase" | "whileSourceInPlay") => ({ instanceId, sourceId: cardId, stat, amount: 1, until });
  return markSurge({ ...state, modifiers: [...state.modifiers, mark("table", "treacheryRevealed", "endOfPhase"), mark(cardId, "immuneToPlayerCards", "whileSourceInPlay")] }, cardId);
}
