// Rules: mec109.hide-tests, mec113.fortitude-tests (data/rules/entries.json). What the Hide test (quest/hide.ts) and the Fortitude test (families/mount-doom/fortitude.ts) share: committing characters to the test frame, why a commit is refused, the Willpower of the ones committed, and the failures kept for the round.
import type { EngineStep, PlayerIntent } from "../core/intents.ts";
import { modifiedStat } from "../core/keywords.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import type { ScenarioState } from "../core/state.ts";
import { inPlay, updateCards } from "../core/state.ts";
import { patchTop, topFrame } from "../windows/windows.ts";

export type TestKind = "hide" | "fortitude";

// What differs between the two tests in a refusal and in the step the log reads.
const KINDS = {
  hide: { window: "hideCommit", step: "hideCommit", seat: "Only the revealing seat commits to a Hide test", noun: "character", test: "Hide test" },
  fortitude: { window: "fortitudeCommit", step: "fortitudeCommit", seat: "Only the player making the Fortitude test commits to it", noun: "hero", test: "Fortitude test" },
} as const;

/** The characters exhaust and are committed to the test frame on top; the window closes and the test goes on. A state whose top frame is not that test is returned as it is. */
export function commitToTest(state: ScenarioState, kind: TestKind, cardIds: readonly string[], steps: EngineStep[]): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== kind) return state;
  for (const id of cardIds) steps.push({ kind: KINDS[kind].step, cardId: id });
  const exhausted = updateCards(state, cardIds.map((id) => [id, { exhausted: true }]));
  return { ...patchTop(exhausted, { data: { ...top.data, committedIds: [...cardIds] } }), window: null };
}

/** Why the commit is not legal, or null: the window is the test's, the seat is the one asked, and each card is a legal committer (`legalFor` the seat) named once. `limit` is the most that may commit. */
export function commitReason(state: ScenarioState, kind: TestKind, intent: Extract<PlayerIntent, { type: "CommitHide" | "CommitFortitude" }>, legalFor: (seat: number) => readonly string[], limit?: number | null): string | null {
  const words = KINDS[kind];
  const window = state.window;
  if (window?.kind !== words.window) return "That intent is not legal in this window";
  if (window.seat !== state.activeSeat) return words.seat;
  const legal = new Set(legalFor(window.seat));
  if (limit != null && intent.cardIds.length > limit) return `No more than ${limit} characters can commit to a ${words.test}`;
  const seen = new Set<string>();
  for (const id of intent.cardIds) {
    if (seen.has(id)) return `That ${words.noun} cannot commit twice`;
    seen.add(id);
    if (!legal.has(id)) return `That ${words.noun} cannot commit to a ${words.test}`;
  }
  return null;
}

/** The Willpower of the committed characters still in play, and how many of them are. */
export function committedWillpower(state: ScenarioState, committedIds: readonly string[], ctx: ReduceContext): { willpower: number; committed: number } {
  let willpower = 0;
  let committed = 0;
  for (const id of committedIds) {
    const instance = state.cards[id];
    if (!instance || !inPlay(instance.zone)) continue;
    willpower += modifiedStat(state, instance, "willpower", ctx.cards);
    committed += 1;
  }
  return { willpower, committed };
}

/** A failure only matters during its own round, so older ones go when the round advances (a state with none, or none older, is returned as it is). */
export function pruneFailures(state: ScenarioState, kind: TestKind): ScenarioState {
  const key = kind === "hide" ? "hideFailures" : "fortitudeFailures";
  const failures = state[key];
  if (!failures) return state;
  const kept = failures.filter((failure) => failure.round === state.round);
  return kept.length === failures.length ? state : { ...state, [key]: kept };
}
