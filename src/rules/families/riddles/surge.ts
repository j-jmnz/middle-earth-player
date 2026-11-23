// Rules: rr.surge, rr.reveal (data/rules/entries.json); ledger line 131031:B:3. "Treachery cards gain surge": the constant marker TreacheriesGainSurge on the stage in play, read as a treachery is revealed (the `revealed` hook, before its When Revealed effects and the surge check). One instance of surge for each marker in force.
// Only a treachery the encounter deck itself revealed gains it: not one dealt as a shadow card or put into play by an effect.
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

/** A card was revealed: a treachery gains surge once for each TreacheriesGainSurge marker in force. */
export function treacheryGainsSurge(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || top?.data.kind !== "reveal" || top.cardId !== cardId || top.data.fromDeck !== true || printedOf(ctx.cards, card.code).type !== "treachery") return state;
  let next = state;
  for (const { instruction } of constantInstructions(state, ctx)) if (instruction.verb === "TreacheriesGainSurge") next = markSurge(next, cardId);
  return next;
}
