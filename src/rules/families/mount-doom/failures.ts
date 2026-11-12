// Rules: mec113.fortitude-tests (data/rules/entries.json); ledger lines 146046:A:1, 146055:A:3, 146056:A:2. The Fortitude tests players failed this round, and the result of the last test an effect made.
import type { ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

/** A seat failed a Fortitude test: remembered until the round ends. */
export function noteFortitudeFailure(state: ScenarioState, seat: number): ScenarioState {
  return { ...state, fortitudeFailures: [...(state.fortitudeFailures ?? []), { seat, round: state.round, phase: state.phase }] };
}

/** Whether a Fortitude test was failed this round, by `seat` (the actor) or by anyone (`seat` null). */
export function failedThisRound(state: ScenarioState, seat: number | null): boolean {
  return (state.fortitudeFailures ?? []).some((failure) => failure.round === state.round && (seat == null || failure.seat === seat));
}

/** The test just finished is noted on the effect that made it, for `lastFortitudeFailed` and `lastFortitudePassed`. */
export function noteEffectFortitude(state: ScenarioState, success: boolean): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "effect") return state;
  return patchTop(state, { data: { ...top.data, fortitude: success ? "passed" : "failed" } });
}

/** The `lastFortitudeFailed` and `lastFortitudePassed` conditions: the running effect's last Fortitude test. False before it made one. */
export function lastFortitude(state: ScenarioState, result: "failed" | "passed"): boolean {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" && data.fortitude === result;
}
