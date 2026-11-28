// Rules: rr.guarded, rr.victory (data/rules/entries.json); ledger line 21036:A:3.
// VictoryWhenFreeAddsResource: an objective in the staging area that nothing guards any more goes to the victory display and puts resources on the main quest.
import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { ScenarioState } from "../../core/state.ts";
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { moveEncounter } from "../encounter/moves.ts";
import { addResourceTokens } from "../nightmare/dungeon.ts";
import { freeOfEncounters } from "../objectives/free.ts";

const MARKER = "VictoryWhenFreeAddsResource";

/** The settle sweep: each marked card in the staging area free of encounters is added to the victory display, then the main quest gets the marker's resources. Nothing resolves while a frame is open, so a card just revealed has its Guarded resolved first. Only a game that has the marker looks. */
export function victoryWhenFreeAddsResource(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || state.staging.length === 0 || !gameReads(state, ctx, `"${MARKER}"`)) return state;
  let next = state;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== MARKER || source.zone !== "staging" || next.cards[source.id]?.zone !== "staging" || !freeOfEncounters(next, source.id)) continue;
    next = addResourceTokens(moveEncounter(next, source.id, "victory", state.firstPlayer, ctx, steps), next.questStage, instruction.amount);
  }
  return next;
}
