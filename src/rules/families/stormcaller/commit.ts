// Rules: dcce.sailing-tests, dcce.sailing (data/rules/entries.json); ledger lines 12021:A:3, 12023:A:2. What a commitment tells the cards of a game with ships: the characters a seat committed to the quest or
// to a Sailing test, once for the whole commitment ("After a player commits 4 or more characters to a Sailing test or to the quest"), and each hero committed to a Sailing test.
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";

/** The seat committed `count` characters, a ship that counts as more counting as that many: announced once, in a game with ships, when it committed any. */
export function committedTo(state: ScenarioState, seat: number, count: number): ScenarioState {
  return state.sea && count > 0 ? queueEvent(state, { trigger: "commitmentMade", seat, amount: count }) : state;
}

/** A hero the seat committed to the Sailing test (dcce.sailing-tests): the Forced effects that hear "commits a hero to a Sailing test" answer it. */
export function committedToSailing(state: ScenarioState, seat: number, id: string): ScenarioState {
  return state.sea ? queueEvent(state, { trigger: "committedToSailing", seat, cardId: id, occurrence: `sail:${state.round}:${seat}` }) : state;
}
