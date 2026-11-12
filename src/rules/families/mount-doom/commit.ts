// Rules: mec113.fortitude-tests (data/rules/entries.json). Committing heroes to a Fortitude test: only a hero the tester controls, ready, and not barred by `noFortitudeCommit` (146057:A:1) may be exhausted for it.
import type { EngineStep, PlayerIntent } from "../../core/intents.ts";
import { flagged, updateCards, type ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

/** The heroes the seat may commit to a Fortitude test now: ready, and not barred by `noFortitudeCommit`. */
export function fortitudeCommitters(state: ScenarioState, seat: number): string[] {
  return (state.seats[seat]?.heroes ?? []).filter((id) => state.cards[id]?.exhausted === false && !flagged(state, id, "noFortitudeCommit"));
}

/** Why the intent is not legal, or null: it is the tester's, any number of heroes, each once. */
export function fortitudeCommitReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "CommitFortitude" }>): string | null {
  const window = state.window;
  if (window?.kind !== "fortitudeCommit") return "That intent is not legal in this window";
  if (window.seat !== state.activeSeat) return "Only the player making the Fortitude test commits to it";
  const legal = new Set(fortitudeCommitters(state, window.seat));
  const seen = new Set<string>();
  for (const id of intent.cardIds) {
    if (seen.has(id)) return "That hero cannot commit twice";
    seen.add(id);
    if (!legal.has(id)) return "That hero cannot commit to a Fortitude test";
  }
  return null;
}

/** The heroes exhaust and are committed; the test goes on with its discards. */
export function commitFortitude(state: ScenarioState, cardIds: readonly string[], steps: EngineStep[]): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "fortitude") return state;
  for (const id of cardIds) steps.push({ kind: "fortitudeCommit", cardId: id });
  const exhausted = updateCards(state, cardIds.map((id) => [id, { exhausted: true }]));
  return { ...patchTop(exhausted, { data: { ...top.data, committedIds: [...cardIds] } }), window: null };
}
