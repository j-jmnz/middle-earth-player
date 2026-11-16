// Rules: sotm.reset-the-quest-deck (data/rules/entries.json); ledger line 02013:B:1.
//
// "If there are ever no heroes with Clue objectives attached in play, reset the quest deck to stage 2B" (02013:B:1): the constant verb ReturnToStage on a quest card holds while its condition holds. The settle sweep carries it out as soon as no effect
// is resolving, no Response window is open and no event waits (a Response to the quest just resolved may still claim the Clue that keeps the stage), by returning the players to that stage (nightmare/dungeon.ts returnToStage: the stage comes back as if just
// beginning, with no progress; the progress on the active location and every other card stay as they are, and no When Revealed or Setup resolves again).
import { gameReads } from "../../core/game-reads.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { returnToStage } from "../nightmare/dungeon.ts";

export function resetSweep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // Only a game with a card that resets the quest deck reads the constants here.
  if (!gameReads(state, ctx, '"verb":"ReturnToStage"')) return state;
  if (state.stack.length > 0 || state.window || (state.pendingEvents?.length ?? 0) > 0 || state.lost || state.failure || state.stageCleared) return state;
  for (const { instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "ReturnToStage") continue;
    const reset = returnToStage(state, instruction.stage, ctx, steps);
    if (reset !== state) return reset;
  }
  return state;
}
