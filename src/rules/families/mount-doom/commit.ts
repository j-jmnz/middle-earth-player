// Rules: mec113.fortitude-tests (data/rules/entries.json). Committing heroes to a Fortitude test: only a hero the tester controls, ready, and not barred by `noFortitudeCommit` (146057:A:1) may be exhausted for it.
import type { EngineStep, PlayerIntent } from "../../core/intents.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { commitReason, commitToTest } from "../../quest/test-frame.ts";

/** The heroes the seat may commit to a Fortitude test now: ready, and not barred by `noFortitudeCommit`. */
export function fortitudeCommitters(state: ScenarioState, seat: number): string[] {
  return (state.seats[seat]?.heroes ?? []).filter((id) => state.cards[id]?.exhausted === false && !flagged(state, id, "noFortitudeCommit"));
}

/** Why the intent is not legal, or null: it is the tester's, any number of heroes, each once. */
export function fortitudeCommitReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "CommitFortitude" }>): string | null {
  return commitReason(state, "fortitude", intent, (seat) => fortitudeCommitters(state, seat));
}

/** The heroes exhaust and are committed; the test goes on with its discards. */
export function commitFortitude(state: ScenarioState, cardIds: readonly string[], steps: EngineStep[]): ScenarioState {
  return commitToTest(state, "fortitude", cardIds, steps);
}
