// Rules: mec113.phantom, rr.effects, rr.play-and-put-into-play (data/rules/entries.json). The verbs and hooks src/catalog/families/grey-company.ts adds: the hand a player discards whole (hand.ts), the play bar of a seat (hand.ts), the
// two threat amounts (amounts.ts). Phantom's cancel is in phantom.ts, called by the combat damage step.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { printedOf } from "../../core/printed.ts";
import type { Focus } from "../index.ts";
import { seatsFor } from "../../interpret/player-verbs.ts";
import { highestThreat, playersAtThreat } from "./amounts.ts";
import { discardHand, playsBarred, playsBarredReason } from "./hand.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, _ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  return instruction.verb === "DiscardHand" ? discardHand(state, instruction.who === "eventSeat" ? seatsFor(state, "eventSeat", focus.seat) : [focus.seat]) : null;
}

export const manifest: RulesFamily = {
  name: "grey-company",
  verbs: ["DiscardHand"],
  run,
  amount: (state, amount) => {
    if (amount.highestThreat) return highestThreat(state);
    if (amount.playersAtThreat != null) return playersAtThreat(state, amount.playersAtThreat);
    return null;
  },
  play: (state, _cardId, _ctx, how) => playsBarred(state, how.seat ?? state.activeSeat, how.putting),
  playReason: (state, cardId, ctx) => {
    const card = state.cards[cardId];
    return card && playsBarred(state, state.activeSeat, false) ? playsBarredReason(state, printedOf(ctx.cards, card.code).name) : null;
  },
};
