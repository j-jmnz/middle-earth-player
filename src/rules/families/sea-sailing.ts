// Rules: dcce.sailing, dcce.sailing-tests (data/rules/entries.json). At the beginning of each quest phase, before characters are committed to the
// quest, if the main quest has the Sailing keyword the first player performs a Sailing test: shift the heading off-course; exhaust any number of
// characters, committing them to the test; look at that many cards from the top of the encounter deck (shuffling the discard pile into the deck first
// when it holds too few); for each Sailing success symbol among them, shift the heading on-course if the player chooses; discard the cards looked at.
// Players may use Actions before and after the test, but not during it. The Dream-chaser can be committed to any test and counts as more than one
// character (the flags sailsAnyTest and sailingExtra). The symbols are the ledger's `sailingSuccess`, a keyword flag of the card.
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import { stepWindow } from "../step-window.ts";
import type { ScenarioState } from "../state.ts";
import { heldAmount, markReached, reached, updateCard } from "../state.ts";
import { ruleCause } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import { shuffleDiscardIn } from "./encounter-moves.ts";
import { moveCard } from "../zones.ts";
import { headingIs, shiftHeading } from "./sea-heading.ts";
import { tester } from "./sea-sailing-legal.ts";
import type { SailingTest } from "./sea-types.ts";

/** The main quest has the Sailing keyword (dcce.sailing). */
export function sailingDue(state: ScenarioState, ctx: ReduceContext): boolean {
  const quest = state.questStage ? state.cards[state.questStage] : undefined;
  return state.sea != null && quest != null && printedOf(ctx.cards, quest.code).keywords.sailing;
}

/** The Sailing test the table is waiting on, or null. */
export function sailingTest(state: Pick<ScenarioState, "sea">): SailingTest | null {
  return state.sea?.sailing ?? null;
}

/** The step of the quest phase before characters commit to the quest: the Actions window before the test, the first player's commitment, the
 * test, the Actions window after it. Returns the state moved on, or null when no Sailing test is due this round or it is done (machine.ts
 * opens the quest commitment then). Each step is marked for the round, so the engine moves on whenever a window closes. */
export function sailingStep(state: ScenarioState, ctx: ReduceContext): ScenarioState | null {
  if (!sailingDue(state, ctx) || state.sea?.sailing) return null;
  if (!reached(state, "sailing-before")) return stepWindow(state, ctx, "sailing-before") ?? markReached(state, "sailing-before");
  if (!reached(state, "sailing-test")) {
    const asking = markReached(state, "sailing-test");
    return { ...asking, sea: { ...(asking.sea ?? { heading: null, headingCard: null, routes: {} }), sailing: { step: "ask" } }, window: { kind: "pass" }, passed: [], activeSeat: tester(state) };
  }
  if (!reached(state, "sailing-after")) return stepWindow(state, ctx, "sailing-after") ?? markReached(state, "sailing-after");
  return null;
}

// How many characters a committed card counts as: itself and what it counts as beyond one ("counts as 2 characters": 1 extra).
function weight(state: ScenarioState, id: string): number {
  return 1 + Math.max(0, heldAmount(state, id, "sailingExtra"));
}

/** Step 4 done, or not needed: the looked-at cards are discarded and the test is over. */
function finish(state: ScenarioState, looked: readonly string[]): ScenarioState {
  let next = state;
  for (const id of looked) if (next.cards[id]?.zone === "encounterDeck") next = moveCard(next, id, { zone: "encounterDiscard" });
  const { sailing: _done, ...sea } = next.sea ?? { heading: null, headingCard: null, routes: {} };
  return { ...next, sea, window: null, passed: [] };
}

/** The test, from the committed characters (an empty list commits none): steps 1 to 3 at once, then the first player's answers to step 4. */
export function performSailing(state: ScenarioState, ids: readonly string[], ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // 1. The winds shift: off-course one step.
  let next = shiftHeading(state, "offCourse");
  // 2. The characters are exhausted, committed to the test.
  let count = 0;
  for (const id of ids) {
    count += weight(next, id);
    next = updateCard(next, id, { exhausted: true });
  }
  // 3. As many cards from the top of the encounter deck as characters; a deck too short is first shuffled with its discard pile.
  if (count > next.encounterDeck.length && next.encounterDiscard.length > 0) {
    steps.push({ kind: "resetEncounterDeck", count: next.encounterDiscard.length, cause: ruleCause("dcce.sailing-tests") });
    next = shuffleDiscardIn(next);
  }
  const looked = next.encounterDeck.slice(0, count);
  // 4. Each Sailing success symbol allows one shift on-course.
  const symbols = looked.reduce((sum, id) => sum + (printedOf(ctx.cards, next.cards[id]?.code ?? "").keywords.sailingSuccess ?? 0), 0);
  if (symbols === 0 || headingIs(next, "onCourse") || next.sea?.heading == null) return finish(next, looked);
  return askShift(next, looked, symbols);
}

function askShift(state: ScenarioState, looked: readonly string[], left: number): ScenarioState {
  const sea = state.sea;
  if (!sea) return state;
  return { ...state, sea: { ...sea, sailing: { step: "shift", looked, left } }, window: { kind: "choose", seat: tester(state), options: ["shift", "keep"] }, activeSeat: tester(state), passed: [] };
}

/** The first player's answer to one success symbol: shift on-course, or keep the heading for that symbol. The next symbol asks again. */
export function chooseShift(state: ScenarioState, optionId: string): ScenarioState {
  const test = state.sea?.sailing;
  if (test?.step !== "shift") return state;
  const shifted = optionId === "shift" ? shiftHeading(state, "onCourse") : state;
  const left = test.left - 1;
  if (left <= 0 || headingIs(shifted, "onCourse")) return finish(shifted, test.looked);
  return askShift(shifted, test.looked, left);
}
