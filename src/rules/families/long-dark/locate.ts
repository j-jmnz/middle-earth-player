// Rules: dwd.locate-test, dwd.locate-test-example, rr.running-out-of-cards (data/rules/entries.json); ledger lines 04087:B:1, 04092:A:1, 04094:A:1, 04096:A:1, 901605:A:1, 901607:A:2.
//
// The locate test: the tester discards 1 card from his hand to discard the top card of the encounter deck, over and over, until a discarded encounter card prints PASS (passed), or he will not discard more or has no card to discard (failed). Each try is a choice of the tester's, asked as a target
// (askTarget: the verb runs again with the answer), so the test needs no frame of its own: no action window opens between tries (it is not a quest test or a Fortitude test). The cards go to their discard piles one at a time. An empty encounter deck is refilled from the discard pile in the
// quest phase, the test's own discards included (rr.running-out-of-cards; agent recommendation, docs/brief.md, The Long Dark); in any other phase no card can be discarded and the test is failed at once. The result is noted on the running effect for `lastLocateFailed` and `lastLocatePassed`.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { resetEncounterDeck } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { discardFromHand, moveCard, turnedUp } from "../../core/zones.ts";
import { askTarget } from "../../windows/choices.ts";
import { patchTop } from "../../windows/windows.ts";
import { effectData } from "../encounter/moves.ts";
import { barredFromPlayerDiscard } from "../wilderland/pick.ts";
import type { Focus } from "../index.ts";

type Verb = Extract<Instruction, { verb: "LocateTest" }>;

/** The option that stops the test: it is failed. */
export const STOP = "stop";

/** The card prints PASS in its text box (dwd.locate-test): whatever its type, wherever it lies. */
export function printsPass(state: ScenarioState, id: string | null | undefined, ctx: ReduceContext): boolean {
  const card = id ? state.cards[id] : undefined;
  return card != null && printedOf(ctx.cards, card.code).keywords.pass === true;
}

// The test is over: the result is noted on the running effect and the table is told which cards were discarded.
function finish(state: ScenarioState, seat: number, passed: boolean, handIds: readonly string[], dealtIds: readonly string[], steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  steps.push({ kind: "locateTest", seat, handIds, dealtIds, success: passed });
  return data ? patchTop(state, { data: { ...data, locate: passed ? "passed" : "failed" } }) : state;
}

// A card can be discarded from the encounter deck: it holds one, or the quest phase refills it from the discard pile.
function dealable(state: ScenarioState, ctx: ReduceContext): boolean {
  return state.encounterDeck.length > 0 || resetEncounterDeck(state, [], ctx).encounterDeck.length > 0;
}

/** LocateTest: the tester is asked for a hand card to discard, or to stop; the verb comes back with the answer. */
export function locateTest(state: ScenarioState, instruction: Verb, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const tester = instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat;
  const seat = state.seats[tester];
  if (!seat || seat.eliminated || !effectData(state)) return state;
  const handIds = instruction.handIds ?? [];
  const dealtIds = instruction.dealtIds ?? [];
  let next = state;
  let hands = handIds;
  let dealt = dealtIds;
  if (focus.chosen === STOP) return finish(next, tester, false, handIds, dealtIds, steps);
  if (focus.chosen != null && seat.hand.includes(focus.chosen)) {
    next = discardFromHand(next, focus.chosen, next.cards[focus.chosen]?.owner ?? tester);
    hands = [...handIds, focus.chosen];
    next = resetEncounterDeck(next, steps, ctx);
    const top = next.encounterDeck[0];
    if (!top) return finish(next, tester, false, hands, dealtIds, steps);
    next = updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: turnedUp(next, top) });
    dealt = [...dealtIds, top];
    if (printsPass(next, top, ctx)) return finish(next, tester, true, hands, dealt, steps);
  }
  // Another try: the tester must have a card to discard and the encounter deck a card to lose.
  const options = (next.seats[tester]?.hand ?? []).filter((held) => !barredFromPlayerDiscard(next, ctx, held, focus.sourceId));
  if (options.length === 0 || !dealable(next, ctx)) return finish(next, tester, false, hands, dealt, steps);
  return askTarget(next, { instruction: { ...instruction, handIds: hands, dealtIds: dealt }, seat: tester, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, [...options, STOP]);
}
