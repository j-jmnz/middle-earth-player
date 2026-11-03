// Rules: dcce.sailing, dcce.sailing-tests (data/rules/entries.json). What the table may do while a Sailing test is being asked: who is the tester,
// the characters that can be committed, the intents open, and what is refused. legal.ts and machine.ts ask these; sea/sailing.ts performs the test.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { characters } from "../../combat/combat.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, livingSeats } from "../../core/state.ts";

/** The first player, or the first seat still in the game, who performs the test. */
export function tester(state: ScenarioState): number {
  return livingSeats(state)[0] ?? state.firstPlayer;
}

/** The first player is being asked which characters to commit to the test (a Commit, or a Pass for none). */
export function askingToCommit(state: Pick<ScenarioState, "sea" | "window">): boolean {
  return state.sea?.sailing?.step === "ask" && state.window?.kind === "pass";
}

/** The first player is being asked whether to shift the heading on-course for one success symbol. */
export function askingToShift(state: Pick<ScenarioState, "sea" | "window">): boolean {
  return state.sea?.sailing?.step === "shift" && state.window?.kind === "choose";
}

/** The first player has seen the cards looked at and answers Done before they are discarded. */
export function askingToLook(state: Pick<ScenarioState, "sea" | "window">): boolean {
  return state.sea?.sailing?.step === "look" && state.window?.kind === "choose";
}

/** The characters that can be committed to the test: the tester's ready characters, and any ship that can be committed to any Sailing test
 * (the Dream-chaser, whoever controls it). */
export function sailingCommitters(state: ScenarioState, ctx: ReduceContext): string[] {
  const own = new Set(characters(state, tester(state), ctx.cards));
  const found = new Set(own);
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    if (state.seats[seat]?.eliminated) continue;
    for (const id of characters(state, seat, ctx.cards)) if (flagged(state, id, "sailsAnyTest")) found.add(id);
  }
  return [...found].filter((id) => {
    const instance = state.cards[id];
    return instance != null && !instance.exhausted && !instance.committed;
  });
}

/** Why a Commit to the test is refused, or null. */
export function sailingCommitReason(state: ScenarioState, ids: readonly string[], ctx: ReduceContext): string | null {
  if (!askingToCommit(state)) return "That intent is not legal in this window";
  if (ids.length === 0) return "Commit at least one character, or pass to commit none";
  const legal = new Set(sailingCommitters(state, ctx));
  const seen = new Set<string>();
  for (const id of ids) {
    if (!legal.has(id) || seen.has(id)) return "That character cannot be committed to the Sailing test";
    seen.add(id);
  }
  return null;
}

/** Why an intent is refused while the test is under way: Actions are not used during a Sailing test, but Responses may be (dcce.sailing-tests). A
 * Trigger is a Response in a response or cancel window and an Action in any other. Null for the intents the test itself takes (Commit, Pass, Choose). */
export function sailingBlocks(state: ScenarioState, intentType: string): string | null {
  if (state.sea?.sailing == null) return null;
  if (intentType === "Commit" || intentType === "Pass" || intentType === "Choose") return null;
  if (intentType === "Trigger" && (state.window?.kind === "response" || state.window?.kind === "cancelOffer")) return null;
  return "Actions cannot be used during a Sailing test";
}

/** The intents of the question the engine asks: Commit and Pass while the first player commits characters. */
export function sailingIntents(state: ScenarioState): { type: "Commit" | "Pass" }[] | null {
  return askingToCommit(state) ? [{ type: "Commit" }, { type: "Pass" }] : null;
}
