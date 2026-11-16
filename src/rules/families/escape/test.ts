// Rules: sotm.escape-test, sotm.escape-test-example, rr.running-out-of-cards (data/rules/entries.json); ledger lines 02107:A:2, 02109:A:1. The escape test: a frame like the Fortitude test's. The players commit characters (each seat asked in order for a party test), take actions once, then the
// cards are dealt from the encounter deck and the committed characters' stat is read against the Escape counted: higher passes. The cards dealt all go to the encounter discard pile once they are counted.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { shuffleEncounterDeck } from "../../interpret/verbs.ts";
import { gameReads } from "../../core/game-reads.ts";
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { EscapeData, Frame, ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { openFrameActions } from "../../windows/pass.ts";
import { fireForced } from "../../windows/triggers.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "../../windows/windows.ts";
import { lastPickedSeat } from "../play/refs.ts";
import type { Focus } from "../index.ts";
import { escapeCommitters } from "./commit.ts";
import { noteEffectEscape } from "./results.ts";
import { committedTotal, escapePassed, escapeTotal } from "./value.ts";

type Verb = Extract<Instruction, { verb: "EscapeTest" }>;

/** EscapeTest: the frame is pushed for the player who makes the test (every living player, first player first, for the party); the running effect goes on when it pops. */
export function pushEscape(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const tester = instruction.who === "firstPlayer" ? state.firstPlayer : instruction.who === "picked" ? lastPickedSeat(state) : focus.seat;
  const seats = instruction.who === "party" ? livingSeats(state) : tester != null && state.seats[tester] && !state.seats[tester]?.eliminated ? [tester] : [];
  const first = seats[0];
  if (first == null) return state;
  const cards = Math.max(0, resolveAmount(state, instruction.cards, frameScope(state, first, focus.sourceId), ctx));
  const data: EscapeData = { kind: "escape", stat: instruction.stat ?? "willpower", cards, seats, asked: 0, fresh: [], committedIds: [], dealtIds: [], escape: 0, result: null };
  return pushFrame(state, { frame: "escape", cardId: focus.sourceId, seat: first, peril: topFrame(state)?.peril ?? false, data }, steps);
}

export function escapeStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = frame.data;
  if (data.kind !== "escape") throw new Error("Escape frame lost its data");
  switch (frame.step) {
    case 0:
      return commitStep(state, data, ctx, steps);
    case 1:
      return dealStep(state, frame, data, ctx, steps);
    case 2:
      return afterTest(state, frame, data, ctx, steps);
    default:
      return finish(state, data, steps);
  }
}

// Each seat in order is asked once, the first player first; a player with no ready character is not asked. The characters just committed have their "after a character commits" Forced effects resolve before the next seat is asked, and before the action window.
function commitStep(state: ScenarioState, data: EscapeData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (data.fresh.length > 0) return committedForced(state, data, ctx, steps);
  const seat = data.seats[data.asked];
  if (seat == null) return openFrameActions(patchTop(state, { step: 1 }));
  if (escapeCommitters(state, seat, ctx).length === 0) return patchTop(state, { data: { ...data, asked: data.asked + 1 } });
  return { ...state, window: { kind: "escapeCommit", seat }, activeSeat: seat };
}

function committedForced(state: ScenarioState, data: EscapeData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = patchTop(state, { data: { ...data, fresh: [] } });
  if (!gameReads(next, ctx, '"committedToEscape"')) return next;
  const seat = data.seats[data.asked - 1] ?? state.firstPlayer;
  // Each fireForced goes on top of the one before, so the characters are announced last to first to resolve in the order they were committed.
  for (const id of [...data.fresh].reverse()) next = fireForced(next, { trigger: "committedToEscape", seat, subject: id }, ctx, steps);
  return next;
}

// An empty encounter deck is refilled from the discard pile without the cards already dealt for this test (sotm.escape-test, rr.running-out-of-cards).
function refill(state: ScenarioState, held: readonly string[], steps: EngineStep[]): ScenarioState {
  const returning = state.encounterDiscard.filter((id) => !held.includes(id));
  if (returning.length === 0) return state;
  let next = state;
  for (const id of returning) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down" });
  steps.push({ kind: "resetEncounterDeck", count: returning.length, cause: ruleCause("rr.running-out-of-cards") });
  return shuffleEncounterDeck(next);
}

// The cards are dealt, not revealed: no When Revealed, no surge, no shadow, no keyword, not added to the staging area. Each counts its Escape value; then all lie in the encounter discard pile and the totals are compared.
function dealStep(state: ScenarioState, frame: Frame, data: EscapeData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  const dealt: string[] = [];
  for (let count = 0; count < data.cards; count += 1) {
    if (next.encounterDeck.length === 0) next = refill(next, dealt, steps);
    const id = next.encounterDeck[0];
    if (!id || !next.cards[id]) break;
    next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up" });
    dealt.push(id);
  }
  const escape = escapeTotal(next, dealt, ctx);
  const committed = committedTotal(next, data.committedIds, data.stat, ctx);
  const result = { success: escapePassed(committed, escape), committed, escape };
  steps.push({ kind: "escapeTest", seat: frame.seat, dealtIds: dealt, committed, escape, success: result.success });
  return patchTop(next, { step: 2, data: { ...data, dealtIds: dealt, escape, result } });
}

// The result is announced to the card whose effect made the test; the Forced effects on it resolve before the frame pops.
function afterTest(state: ScenarioState, frame: Frame, data: EscapeData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const advanced = patchTop(state, { step: 3 });
  if (!data.result || !frame.cardId) return advanced;
  return fireForced(advanced, { trigger: data.result.success ? "escapePassed" : "escapeFailed", seat: frame.seat, cardId: frame.cardId }, ctx, steps);
}

// The committed characters stay exhausted. The result waits on the effect that made the test.
function finish(state: ScenarioState, data: EscapeData, steps: EngineStep[]): ScenarioState {
  const popped = popFrame(state, steps);
  return data.result ? noteEffectEscape(popped, data.result.success) : popped;
}

/** The escape frame nearest the top of the stack, or undefined with no test going on. */
export function nearestEscape(state: ScenarioState): { frame: Frame & { data: EscapeData }; index: number } | undefined {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame && frame.data.kind === "escape") return { frame: frame as Frame & { data: EscapeData }, index };
  }
  return undefined;
}
