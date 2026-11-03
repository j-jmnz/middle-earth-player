// Rules: mec109.burden-deck, mec109.ringbearers-life, rr.burdens (data/rules/entries.json).
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { immediateAttackEach } from "./attack.ts";
import { attachSelfToRingBearer, moveBurden, revealBurden, shuffleBurdenDeck } from "./deck.ts";
import { endQuestPhase, passFirstPlayer, removeAllQuestProgress, setStatUntil } from "./effects.ts";
import { reduceLife } from "./life.ts";

// The verbs src/catalog/families/burden.ts adds, for the burden deck, the Ring-bearer's life and the other encounter effects of
// Flight to the Ford. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "SetLife":
      return { ...state, life: instruction.value };
    case "ReduceLife":
      return reduceLife(state, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), steps, currentCause(steps, UNATTRIBUTED));
    case "ShuffleBurdenDeck":
      return shuffleBurdenDeck(state);
    case "RevealBurden":
      return revealBurden(state, focus.seat, ctx, steps);
    case "MoveBurden":
      return moveBurden(state, instruction.to, focus.seat, ctx, steps);
    case "AttachSelfToRingBearer":
      return attachSelfToRingBearer(state, focus, ctx);
    case "ImmediateAttackEach":
      return immediateAttackEach(state, instruction, focus, ctx, steps);
    case "PassFirstPlayer":
      return passFirstPlayer(state);
    case "EndQuestPhase":
      return endQuestPhase(state);
    case "SetStatUntil":
      return setStatUntil(state, instruction, focus, ctx);
    case "RemoveAllQuestProgress":
      return removeAllQuestProgress(state, steps);
    default:
      return null;
  }
}
