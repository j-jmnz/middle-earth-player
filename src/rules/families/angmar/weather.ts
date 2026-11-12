// Rules: rr.surge, rr.reveal (data/rules/entries.json); ledger line 09069:B:1. "The first Weather treachery card revealed each round gains surge": the stage's constant record FirstTraitSurge is the marker; the engine notes the reveal as the card is revealed, before its When Revealed
// effects and before the surge check. A card is revealed from the staging step, by an effect or by Surge alike; the table remembers one was revealed until the round ends (`traitRevealed`).
import type { Instruction } from "../../../catalog/boundary.ts";

import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

const MARKER = "FirstTraitSurge" as const satisfies Instruction["verb"];

/** A card was revealed (the `revealed` hook): the first treachery with the Trait the marker names revealed in a round, while a stage in play holds the marker, gains surge. */
export function noteFirstTrait(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || top?.data.kind !== "reveal" || top.cardId !== cardId || constantVerbCodes(ctx, MARKER).size === 0) return state;
  if (printedOf(ctx.cards, card.code).type !== "treachery" || flagged(state, "table", "traitRevealed")) return state;
  const marker = constantInstructions(state, ctx).find(({ instruction }) => instruction.verb === "FirstTraitSurge" && hasTrait(state, cardId, instruction.trait, ctx));
  if (!marker) return state;
  const mark = { instanceId: "table", sourceId: cardId, stat: "traitRevealed" as const, amount: 1, until: "endOfRound" as const };
  return markSurge({ ...state, modifiers: [...state.modifiers, mark] }, cardId);
}
