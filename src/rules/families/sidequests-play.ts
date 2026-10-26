// Rules: rr.step-2-2, rr.play-and-put-into-play, rr.in-play-and-out-of-play (data/rules/entries.json).
// A player side quest is played in the planning phase like an ally (rr.step-2-2), paying its cost, and enters its player's quest
// area. A player has one side quest in their quest area at a time (the engine's decision: the Rules Reference in data/rules has
// no side quest span, and the quest area is one slot per seat, Seat.questStage).
import type { EngineStep } from "../intents.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState } from "../state.ts";
import { moveCard } from "../zones.ts";

// Why the active seat cannot play a side quest now, or null.
export function sideQuestPlayReason(state: ScenarioState, seat: number): string | null {
  return state.seats[seat]?.questStage ? "That player already has a side quest in their quest area" : null;
}

// The side quest enters the seat's quest area and is announced as played and entered, like any card played from the hand.
export function enterQuestArea(state: ScenarioState, cardId: string, seat: number, _steps: EngineStep[]): ScenarioState {
  const placed = moveCard(state, cardId, { zone: "seatQuest", seat });
  return queueEvent(queueEvent(placed, { trigger: "played", seat, cardId }), { trigger: "enteredPlay", seat, cardId });
}
