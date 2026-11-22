// Rules: docs/scenarios/standalone-scenarios.md (The Stone of Erech); ledger lines 50301:A:1, 50302:A:1, 50303:B:2, 50304:A:1, 50308:A:2, 50312:A:2, 50321:A:1, 50324:A:1. The Stone of Erech's mechanics: the Night objectives (night.ts), Derufin attached to the Stone and freed to the first player (derufin.ts),
// the hand passed to the left (hand.ts), and the table flags the quest and the encounter cards set. The flags are read where their rule is: skipPlanning (a breaking flag) and noCollect by the round (engine/machine.ts),
// cannotPlayEvents by the play hook below. (losesIcons, the Haunted Valley flag, is a costs flag: families/costs/pay.ts.)
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { freeAttachedObjective } from "./derufin.ts";
import { passHand } from "./hand.ts";
import { advanceNight, nightHolds, placeNightProgress, putNight } from "./night.ts";

/** Whether no player may play this card now: an event while a Night encounter card says so until the end of the round (50312:A:2). */
function eventsBarred(state: ScenarioState, cardId: string, ctx: ReduceContext): boolean {
  const card = state.cards[cardId];
  return card != null && state.modifiers.length > 0 && flagged(state, "table", "cannotPlayEvents") && printedOf(ctx.cards, card.code).type === "event";
}

function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PutNightObjective":
      return putNight(state, instruction.code);
    case "PlaceNightProgress":
      return placeNightProgress(state, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), ctx, steps);
    case "NightAdvance":
      return state;
    case "FreeAttachedObjective":
      return freeAttachedObjective(state, focus.sourceId);
    case "PassHand":
      return passHand(state);
    default:
      return null;
  }
}

const ERECH = "the-stone-of-erech";

export const manifest: RulesFamily = {
  name: "erech",
  verbs: ["PutNightObjective", "PlaceNightProgress", "NightAdvance", "FreeAttachedObjective", "PassHand"],
  run,
  // Only The Stone of Erech has a Night slot: any other scenario skips the scan of its cards.
  settle: { sweep: (state, ctx) => (state.scenarioId === ERECH && Object.values(state.cards).some((card) => card.zone === "nightObjective") ? advanceNight(state, ctx) : state) },
  condition: (state, condition) => {
    if (condition.kind === "night") return nightHolds(state, condition.is);
    return null;
  },
  play: (state, cardId, ctx, how) => how.putting !== true && eventsBarred(state, cardId, ctx),
  playReason: (state, cardId, ctx) => (eventsBarred(state, cardId, ctx) ? "Events cannot be played until the end of the round" : null),
};
