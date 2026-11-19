// Rules: dwd.revealing-enemies, rr.surge, rr.reveal (data/rules/entries.json); ledger line 04095:A:1. "Each enemy revealed from the encounter deck gains surge": the constant marker EnemiesGainSurge on an attachment in play, read as an enemy is revealed (the `revealed` hook, before its When Revealed
// effects and the surge check). One instance of surge for each marker in force. Only an enemy the encounter deck itself revealed gains it: not one dealt as a shadow card or added to the staging area by an effect.
import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

/** An enemy was revealed: it gains surge once for each EnemiesGainSurge marker in force. */
export function enemyGainsSurge(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || top?.data.kind !== "reveal" || top.cardId !== cardId || top.data.fromDeck !== true || constantVerbCodes(ctx, "EnemiesGainSurge").size === 0 || printedOf(ctx.cards, card.code).type !== "enemy") return state;
  let next = state;
  for (const { instruction } of constantInstructions(state, ctx)) if (instruction.verb === "EnemiesGainSurge") next = markSurge(next, cardId);
  return next;
}
