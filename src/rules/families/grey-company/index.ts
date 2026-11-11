// Rules: mec113.phantom, rr.effects, rr.play-and-put-into-play, rr.travel (data/rules/entries.json). The verbs and hooks src/catalog/families/grey-company.ts adds: the hand a player discards whole (hand.ts), the play bar of a seat (hand.ts), the
// two threat amounts (amounts.ts), the Travel cost of removing progress from the quest (index.ts). Phantom's cancel is in phantom.ts, called by the combat damage step.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { highestThreat, playersAtThreat } from "./amounts.ts";
import { discardHand, playsBarred, playsBarredReason } from "./hand.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, _ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  return instruction.verb === "DiscardHand" ? discardHand(state, focus, steps) : null;
}

/** "Remove 5 progress from stage 3B to travel here" (145017:A:3, rr.travel): the players cannot pay it, and so cannot travel, while the current quest holds fewer progress than that. */
function removeProgressUnpayable(state: ScenarioState, instruction: Instruction): boolean {
  return instruction.verb === "RemoveProgressFromQuest" && typeof instruction.amount === "number" && (state.questStage ? (state.cards[state.questStage]?.progress ?? 0) : 0) < instruction.amount;
}

export const manifest: RulesFamily = {
  name: "grey-company",
  travel: { unpayable: removeProgressUnpayable },
  verbs: ["DiscardHand"],
  run,
  amount: (state, amount) => (amount.highestThreat ? highestThreat(state) : amount.playersAtThreat != null ? playersAtThreat(state, amount.playersAtThreat) : null),
  play: (state, _cardId, _ctx, how) => playsBarred(state, how.seat ?? state.activeSeat, how.putting),
  playReason: (state, cardId) => (playsBarred(state, state.activeSeat, false) && state.cards[cardId]?.zone === "hand" ? playsBarredReason(state) : null),
};
