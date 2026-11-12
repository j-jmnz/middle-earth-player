// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests (data/rules/entries.json); ledger line 146043:A:3. The Fortitude test: a frame like the Hide test's (rules/quest/hide.ts). The tester commits heroes, discards the top X cards of the encounter deck (X the tens digit of
// their threat dial, plus what the verb adds), the Sauron's Eye icons on them are counted, the players take actions, and the committed heroes' Willpower must be greater than the icons.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import { heldStat, NO_COUNTS } from "../../interpret/constants.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { reshuffleDiscard } from "../../interpret/verbs.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { Frame, FortitudeData, ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { committedWillpower } from "../../quest/test-frame.ts";
import { openFrameActions } from "../../windows/pass.ts";
import { fireForced } from "../../windows/triggers.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "../../windows/windows.ts";
import type { Focus } from "../index.ts";
import { fortitudeCommitters } from "./commit.ts";
import { noteEffectFortitude, noteFortitudeFailure } from "./failures.ts";

type Verb = Extract<Instruction, { verb: "FortitudeTest" }>;

/** FortitudeTest: the frame is pushed for the player who makes the test; the running effect goes on when it pops. */
export function pushFortitude(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat;
  if (state.seats[seat]?.eliminated) return state;
  const extra = instruction.extraCards == null ? 0 : Math.max(0, resolveAmount(state, instruction.extraCards, frameScope(state, seat, focus.sourceId), ctx));
  const eyes = instruction.extraEyes && holds(state, instruction.extraEyes.when, { actor: seat, sourceId: focus.sourceId, returned: 0 }, ctx) ? instruction.extraEyes.amount : 0;
  const data: FortitudeData = { kind: "fortitude", extraCards: extra, extraEyes: eyes, committedIds: [], discardedIds: [], ignored: [], eyes: 0, result: null };
  return pushFrame(state, { frame: "fortitude", cardId: focus.sourceId, seat, peril: topFrame(state)?.peril ?? false, data }, steps);
}

export function fortitudeStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = frame.data;
  if (data.kind !== "fortitude") throw new Error("Fortitude frame lost its data");
  switch (frame.step) {
    case 0:
      return openCommit(state, frame);
    case 1:
      return discardCards(state, data, frame.seat, ctx, steps);
    case 2:
      return countEyes(state, data, frame.seat, ctx);
    case 3:
      return measure(state, frame, data, ctx, steps);
    case 4:
      return afterTest(state, frame, data, ctx, steps);
    default:
      return finish(state, data, steps);
  }
}

// A player with no hero to commit is not asked.
function openCommit(state: ScenarioState, frame: Frame): ScenarioState {
  const advanced = patchTop(state, { step: 1 });
  if (fortitudeCommitters(state, frame.seat).length === 0) return advanced;
  return { ...advanced, window: { kind: "fortitudeCommit", seat: frame.seat }, activeSeat: frame.seat };
}

/** X, the tens digit of the seat's threat dial (0 below 10). */
export function fortitudeCards(state: ScenarioState, seat: number): number {
  return Math.floor((state.seats[seat]?.threat ?? 0) / 10);
}

// The cards are discarded, not revealed: no When Revealed, no Forced. An empty encounter deck is refilled from the discard pile (mec113.fortitude-tests). A card with a Forced effect that hears it
// (Gollum) hears it once they are all discarded, before the icons are counted.
function discardCards(state: ScenarioState, data: FortitudeData, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  const discardedIds: string[] = [];
  for (let count = 0; count < fortitudeCards(state, seat) + data.extraCards; count += 1) {
    next = reshuffleDiscard(next, steps, "mec113.fortitude-tests");
    const id = next.encounterDeck[0];
    if (!id || !next.cards[id]) break;
    next = moveCard(next, id, { zone: "encounterDiscard" });
    discardedIds.push(id);
  }
  // The last discard may have emptied the deck: it is refilled at once, as it would be for one more card (mec113.fortitude-tests: "if the encounter deck is ever empty during a Fortitude test").
  next = reshuffleDiscard(next, steps, "mec113.fortitude-tests");
  next = patchTop(next, { step: 2, data: { ...data, discardedIds } });
  if (!gameReads(next, ctx, '"discardedInFortitude"')) return next;
  for (const id of discardedIds) next = fireForced(next, { trigger: "discardedInFortitude", seat, subject: id }, ctx, steps);
  return next;
}

/** The Sauron's Eye icons a card prints. */
export function eyesOf(state: ScenarioState, id: string, ctx: ReduceContext): number {
  const instance = state.cards[id];
  return instance ? (printedOf(ctx.cards, instance.code).keywords.eyeIcons ?? 0) : 0;
}

/** The icons the test counts: those on the cards discarded for it (not the ones a Forced effect set aside), what the verb added and what the table adds to each test. The table's Fortitude sheet shows this same number. */
export function fortitudeEyes(state: ScenarioState, data: FortitudeData, seat: number, ctx: ReduceContext): number {
  const printed = data.discardedIds.filter((id) => !data.ignored.includes(id)).reduce((total, id) => total + eyesOf(state, id, ctx), 0);
  return printed + data.extraEyes + heldStat(state, seat, "fortitudeEyes", NO_COUNTS);
}

// The count is made; the players take actions before the committed Willpower is measured (mec113.player-actions-during-fortitude-tests).
function countEyes(state: ScenarioState, data: FortitudeData, seat: number, ctx: ReduceContext): ScenarioState {
  const eyes = fortitudeEyes(state, data, seat, ctx);
  return openFrameActions(patchTop(state, { step: 3, data: { ...data, eyes } }));
}

/** The committed heroes' Willpower that are still in play. The table's Fortitude sheet shows this same number. */
export function fortitudeWillpower(state: ScenarioState, committedIds: readonly string[], ctx: ReduceContext): number {
  return committedWillpower(state, committedIds, ctx).willpower;
}

// A tie fails: the Willpower must be greater than the icons (mec113.fortitude-tests).
export function fortitudePassed(willpower: number, eyes: number): boolean {
  return willpower > eyes;
}

function measure(state: ScenarioState, frame: Frame, data: FortitudeData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const willpower = fortitudeWillpower(state, data.committedIds, ctx);
  const result = { success: fortitudePassed(willpower, data.eyes), willpower, eyes: data.eyes };
  steps.push({ kind: "fortitudeTest", seat: frame.seat, discardedIds: data.discardedIds, willpower, eyes: data.eyes, success: result.success });
  return patchTop(state, { step: 4, data: { ...data, result } });
}

// The result is recorded and announced; the Forced effects on it resolve before the frame pops.
function afterTest(state: ScenarioState, frame: Frame, data: FortitudeData, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const advanced = patchTop(state, { step: 5 });
  if (!data.result) return advanced;
  const noted = data.result.success ? advanced : noteFortitudeFailure(advanced, frame.seat);
  return fireForced(noted, { trigger: data.result.success ? "fortitudePassed" : "fortitudeFailed", seat: frame.seat }, ctx, steps);
}

// The committed heroes stay exhausted. The result waits on the effect that made the test.
function finish(state: ScenarioState, data: FortitudeData, steps: EngineStep[]): ScenarioState {
  const popped = popFrame(state, steps);
  return data.result ? noteEffectFortitude(popped, data.result.success) : popped;
}

/** A Fortitude frame, its data typed. */
export type FortitudeFrame = Frame & { data: FortitudeData };

const isFortitude = (frame: Frame): frame is FortitudeFrame => frame.data.kind === "fortitude";

/** The Fortitude frame nearest the top of the stack and its place in it, or undefined with no test going on. */
export function nearestFortitude(state: ScenarioState): { frame: FortitudeFrame; index: number } | undefined {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame && isFortitude(frame)) return { frame, index };
  }
  return undefined;
}

/** IgnoreFortitudeEyes: the last card picked adds no icons to the Fortitude test in progress. */
export function ignoreEyes(state: ScenarioState, picked: string | null): ScenarioState {
  const found = nearestFortitude(state);
  if (!picked || !found || !found.frame.data.discardedIds.includes(picked)) return state;
  const stack = state.stack.map((entry, index) => (index === found.index && entry.data.kind === "fortitude" ? { ...entry, data: { ...entry.data, ignored: [...entry.data.ignored, picked] } } : entry));
  return { ...state, stack };
}
