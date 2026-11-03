// Rules: rr.step-2-2, rr.play-and-put-into-play, rr.in-play-and-out-of-play (data/rules/entries.json).
// A player side quest is played in the planning phase like an ally (rr.step-2-2), paying its cost, and enters its player's quest
// area. A player has one side quest in their quest area at a time (the engine's decision: the Rules Reference in data/rules has
// no side quest span, and the quest area is one slot per seat, Seat.questStage).
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

// Why the active seat cannot play a side quest now, or null.
export function sideQuestPlayReason(state: ScenarioState, seat: number): string | null {
  return state.seats[seat]?.questStage ? "That player already has a side quest in their quest area" : null;
}

// Why a card with an `InPlayLimit` cannot be played: that many copies of its title are in play already ("Limit 2 copies of ~ in
// play"), or null.
export function inPlayLimitReason(state: ScenarioState, cardId: string, ctx: ReduceContext): string | null {
  const card = state.cards[cardId];
  if (!card) return null;
  let limit: number | null = null;
  for (const effect of effectsOf(ctx, card.code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "InPlayLimit") limit = Math.min(limit ?? instruction.copies, instruction.copies);
  }
  if (limit == null) return null;
  const name = printedOf(ctx.cards, card.code).name;
  const copies = Object.values(state.cards).filter((other) => other.id !== cardId && inPlay(other.zone) && printedOf(ctx.cards, other.code).name === name).length;
  return copies >= limit ? `Limit ${limit} copies of ${name} in play` : null;
}

// The side quest enters the seat's quest area and is announced as played and entered, like any card played from the hand.
export function enterQuestArea(state: ScenarioState, cardId: string, seat: number, _steps: EngineStep[]): ScenarioState {
  const placed = moveCard(state, cardId, { zone: "seatQuest", seat });
  return queueEvent(queueEvent(placed, { trigger: "played", seat, cardId }), { trigger: "enteredPlay", seat, cardId });
}
