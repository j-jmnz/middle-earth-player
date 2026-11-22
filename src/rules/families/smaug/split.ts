// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town, Fisherman's Dock: the progress is split freely between the two active locations, FFG's ruling), rr.active-location, rr.step-3-4 (data/rules/entries.json); ledger line 50223:A:2.
// With two active locations, one of them Fisherman's Dock, the progress from questing goes where the players choose: quest/quest.ts places nothing but hands the progress to `askSplit`, which pushes a frame (no record: the Dock's line is a Travel line) whose `SplitProgress` asks the first player how much goes on the first
// active location (the rest goes on the second), each location taking no more than it has room for. The choice is only asked when the progress does not fill both (`splitRooms`); the options are the shares that leave neither location over its room.
import type { Instruction } from "../../../catalog/boundary.ts";
import { hasQuestPoints, printedOf, type PrintedCard } from "../../core/printed.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { openBranch } from "../../windows/choices.ts";
import type { Focus } from "../index.ts";
import { placeOn, progressRoom } from "../south/locations.ts";
import { DOCK } from "./travel.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

type Split = Extract<Instruction, { verb: "SplitProgress" }>;

/** The shares of `amount` that can go on the first location: at least what the second cannot take, at most what the first can. */
export function splitShares(amount: number, rooms: readonly [number, number]): number[] {
  const low = Math.max(0, amount - rooms[1]);
  const high = Math.min(amount, rooms[0]);
  return Array.from({ length: Math.max(0, high - low + 1) }, (_, at) => low + at);
}

/** SplitProgress: the first call (no `onFirst`) asks; the answer places `onFirst` on the first active location and the rest on the second. */
export function splitProgress(state: ScenarioState, instruction: Split, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const amount = instruction.amount ?? resolveAmount(state, { x: true }, frameScope(state, focus.seat, focus.sourceId), ctx);
  const [one, two] = [state.activeLocation, state.secondActiveLocation];
  if (instruction.onFirst == null) {
    const rooms = splitRooms(state, amount, ctx.cards);
    // No choice left (an Undo-free replay of a state the split no longer applies to): the first location takes what it can.
    if (rooms == null || one == null || two == null) return one == null ? state : placeOn(state, one, amount, ctx.cards, steps);
    const options = splitShares(amount, rooms).map((share) => ({ id: `split:${share}`, instructions: [{ verb: "SplitProgress" as const, amount, onFirst: share }] }));
    return openBranch(state, { instruction: { verb: "Choose", who: "firstPlayer", options }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, 0, ctx);
  }
  let next = state;
  if (one != null) next = placeOn(next, one, instruction.onFirst, ctx.cards, steps);
  if (two != null) next = placeOn(next, two, amount - instruction.onFirst, ctx.cards, steps);
  return next;
}

/** The room each active location has for progress now, when the players divide it between two (Fisherman's Dock is one of them): [first, second], or null when there is no choice (no Dock, a location without quest points or room, or the progress fills both). */
export function splitRooms(state: ScenarioState, amount: number, cards: Cards): readonly [number, number] | null {
  const [one, two] = [state.activeLocation, state.secondActiveLocation];
  if (one == null || two == null || (state.cards[one]?.code !== DOCK && state.cards[two]?.code !== DOCK)) return null;
  const rooms = [one, two].map((id) => (hasQuestPoints(printedOf(cards, state.cards[id]?.code ?? "")) ? progressRoom(state, id, cards) : 0));
  const [first, second] = [rooms[0] ?? 0, rooms[1] ?? 0];
  return first > 0 && second > 0 && amount < first + second ? [first, second] : null;
}

/** The progress of a quest handed to the players to divide: the state with the question pushed as a frame and nothing left over, or null when it is placed as usual. */
export function askSplit(state: ScenarioState, amount: number, cards: Cards, steps: EngineStep[]): { state: ScenarioState; remaining: number } | null {
  if (amount <= 0 || splitRooms(state, amount, cards) == null) return null;
  const dock = state.cards[state.secondActiveLocation ?? ""]?.code === DOCK ? state.secondActiveLocation : state.activeLocation;
  const asked = pushEffectFrame(state, { frame: "whenRevealed", sourceId: dock ?? "none", actor: state.firstPlayer, peril: false, effectId: "50223:split", instructions: [{ verb: "SplitProgress", amount }], cancel: null, blockCancel: null }, steps);
  return { state: asked, remaining: 0 };
}
