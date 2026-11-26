// Rules: rr.the-word-choose, rr.effects, rr.printed (data/rules/entries.json); ledger lines 10107:A:1, 10100:A:1. Dark Covenant's X and its first option: X is the total printed Threat of the cards the effect discarded from the encounter deck, and the first player removes X progress from among the quests in
// play, one token at a time from the quest card they choose; with fewer than X on them all of it comes off. Traitorous Wight's removal comes off every quest card in play.
import type { Amount, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { takeProgressOff } from "../../core/progress.ts";
import { effectData } from "../encounter/moves.ts";
import { distributeOneAtATime } from "./distribute.ts";
import { questCardPool } from "../quest/quest-card.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The amount `discardedThreat`: the total printed Threat of the cards the running effect's DiscardEncounterTop discarded (a card with no printed Threat counts 0). */
export function discardedThreatAmount(state: ScenarioState, found: Exclude<Amount, number>, ctx: ReduceContext): number | null {
  if (!found.discardedThreat) return null;
  return (effectData(state)?.looked ?? []).reduce((sum, id) => sum + (printedOf(ctx.cards, state.cards[id]?.code ?? "").threat ?? 0), 0);
}

/** The quest cards in play that hold progress, for the seat. */
function loaded(state: ScenarioState, seat: number, ctx: ReduceContext): string[] {
  return questCardPool(state, seat, ctx).filter((id) => (state.cards[id]?.progress ?? 0) > 0);
}

/** RemoveProgressAmong: the actor removes `amount` progress from among the quest cards in play, a token at a time from the card they choose, until `amount` is gone or none is left. A single card is taken without asking. */
export function removeProgressAmong(state: ScenarioState, instruction: Verb<"RemoveProgressAmong">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const left = instruction.left ?? resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  return distributeOneAtATime(state, { instruction, left, seat: focus.seat, options: loaded(state, focus.seat, ctx), focus, steps, takeOne: (from, id) => takeProgressOff(from, id, 1, steps) });
}
