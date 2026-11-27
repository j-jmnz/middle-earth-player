// Rules: docs/scenarios/standalone-scenarios/the-stone-of-erech.md (The Stone of Erech); ledger lines 50301:A:1, 50302:A:1, 50303:B:2, 50304:A:1, 50308:A:2, 50312:A:2, 50321:A:1, 50324:A:1. The Stone of Erech's mechanics: the Night objectives (night.ts), Derufin attached to the Stone and freed to the first player (derufin.ts),
// the hand passed to the left (hand.ts), and the table flags the quest and the encounter cards set. The flags are read where their rule is: skipPlanning (a breaking flag) and noCollect by the round (engine/machine.ts),
// cannotPlayEvents by the play hook below. (losesIcons, the Haunted Valley flag, is a costs flag: families/costs/pay.ts.)
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

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

const NIGHT_STAGES = new WeakMap<readonly Effect[], ReadonlySet<string>>();

// The codes of the cards whose records put a Night objective in play. Which cards do depends on the effect list only, which is never changed after the reducer is handed it.
function nightStageCodes(ctx: ReduceContext): ReadonlySet<string> {
  let codes = NIGHT_STAGES.get(ctx.effects);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => effect.instructions.some((instruction) => instruction.verb === "PutNightObjective")).map((effect) => effect.cardCode));
    NIGHT_STAGES.set(ctx.effects, codes);
  }
  return codes;
}

// The settle sweep: only a game whose quest stages hold the card that puts a Night objective in play (The Stone of Erech) can have one lie in its slot, so every other game skips the scan of its cards.
function sweepNight(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const codes = nightStageCodes(ctx);
  if (!state.stages.some((stage) => codes.has(stage.code))) return state;
  return Object.values(state.cards).some((card) => card.zone === "nightObjective") ? advanceNight(state, ctx) : state;
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

export const manifest: RulesFamily = {
  name: "erech",
  verbs: ["PutNightObjective", "PlaceNightProgress", "NightAdvance", "FreeAttachedObjective", "PassHand"],
  run,
  // Only The Stone of Erech puts a card in the Night slot (PutNightObjective): the sweep does nothing in another game, or while no card lies there.
  settle: { sweep: sweepNight },
  condition: (state, condition) => {
    if (condition.kind === "night") return nightHolds(state, condition.is);
    return null;
  },
  play: (state, cardId, ctx, how) => how.putting !== true && eventsBarred(state, cardId, ctx),
  playReason: (state, cardId, ctx) => (eventsBarred(state, cardId, ctx) ? "Events cannot be played until the end of the round" : null),
};
