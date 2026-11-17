// Rules: sotm.escape-test (data/rules/entries.json); ledger lines 02107:A:2, 900807:A:1. Committing characters to an escape test: a ready character (hero or ally) the tester controls is exhausted to commit, up to the most `escapeCommitLimit` allows the tester.
import { characters } from "../../combat/combat.ts";
import type { EngineStep, PlayerIntent } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { modifierActive, updateCards } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";

/** The characters the seat may commit to an escape test now: those it controls that are in play and ready. */
export function escapeCommitters(state: ScenarioState, seat: number, ctx: ReduceContext): string[] {
  return characters(state, seat, ctx.cards).filter((id) => state.cards[id]?.exhausted === false);
}

/** The most characters the seat may commit to an escape test (the tightest `escapeCommitLimit` held for it), or null with no limit (900807:A:1). */
export function escapeCommitLimit(state: ScenarioState, seat: number): number | null {
  let limit: number | null = null;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "escapeCommitLimit" || modifier.instanceId !== `seat:${seat}` || !modifierActive(state, modifier)) continue;
    limit = limit == null ? modifier.amount : Math.min(limit, modifier.amount);
  }
  return limit;
}

/** Why the intent is not legal, or null: the window is an escape commit, the seat is the one asked, each character is a ready one it controls, named once, and no more than the limit. */
export function escapeCommitReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "CommitEscape" }>, ctx: ReduceContext): string | null {
  const window = state.window;
  if (window?.kind !== "escapeCommit") return "That intent is not legal in this window";
  if (window.seat !== state.activeSeat) return "Only the player asked commits to the escape test";
  const limit = escapeCommitLimit(state, window.seat);
  if (limit != null && intent.cardIds.length > limit) return `No more than ${limit} ${limit === 1 ? "character" : "characters"} can commit to an escape test`;
  const legal = new Set(escapeCommitters(state, window.seat, ctx));
  const seen = new Set<string>();
  for (const id of intent.cardIds) {
    if (seen.has(id)) return "That character cannot commit twice";
    seen.add(id);
    if (!legal.has(id)) return "That character cannot commit to an escape test";
  }
  return null;
}

/** The characters exhaust and join the test frame on top; the seat's turn to commit is over and the test goes on (its "after a character commits" Forced effects resolve first). */
export function commitEscape(state: ScenarioState, cardIds: readonly string[], steps: EngineStep[]): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "escape") return state;
  for (const id of cardIds) steps.push({ kind: "escapeCommit", cardId: id });
  const exhausted = updateCards(state, cardIds.map((id) => [id, { exhausted: true }]));
  return { ...patchTop(exhausted, { data: { ...top.data, committedIds: [...top.data.committedIds, ...cardIds], fresh: [...cardIds], asked: top.data.asked + 1 } }), window: null };
}
