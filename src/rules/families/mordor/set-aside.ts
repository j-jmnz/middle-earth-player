// Rules: rr.in-play-and-out-of-play, rr.staging-area (data/rules/entries.json); ledger lines 21078:A:1, 21079:A:1.
// AddRandomSetAsideToStaging: one set-aside card with a Trait is drawn by the game seed and added to the staging area (a Plot objective, a Cultist enemy of Danger in Dorwinion).
import type { Instruction } from "../../../catalog/boundary.ts";

import { drawRandomSetAside, withTrait } from "../../core/set-aside-draw.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

/** The card drawn enters play in the staging area, faceup and not revealed; the seed moves on only when a card was drawn. Nothing happens with no set-aside card of the Trait. */
export function addRandomSetAsideToStaging(state: ScenarioState, instruction: Extract<Instruction, { verb: "AddRandomSetAsideToStaging" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const drawn = drawRandomSetAside(state, withTrait(state, ctx.cards, instruction.trait));
  if (!drawn) return state;
  return moveEncounter({ ...state, seedCursor: state.seedCursor + 1 }, drawn, "staging", focus.seat, ctx, steps);
}
