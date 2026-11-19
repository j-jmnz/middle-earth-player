// Rules: rr.step-2-2, rr.play-and-put-into-play, rr.in-play-and-out-of-play, mec108.side-quests-in-play (data/rules/entries.json).
// A player side quest is played in the planning phase like an ally (rr.step-2-2), paying its cost. "When a player side quest is played or enters play, it is placed in the staging area" (The Lost Realm rules): there it works like an encounter side quest (families/wilderland/night.ts).
// It has no slot of its own: a player can have several in play and the first player may choose any one of them as the current quest.
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

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

// The one way a player side quest enters play, however it got there (played from the hand, put into play by an effect): it lies in the staging area (of the seat that put it there, once the staging areas are separate), which is a game with side quests from then on.
export function placeSideQuest(state: ScenarioState, cardId: string, seat: number): ScenarioState {
  return { ...moveCard(state, cardId, { zone: "staging", area: seat }), sideQuests: true };
}

// A side quest played from the hand is announced as played and entered, like any card played from the hand.
export function enterStaging(state: ScenarioState, cardId: string, seat: number, _steps: EngineStep[]): ScenarioState {
  return queueEvent(queueEvent(placeSideQuest(state, cardId, seat), { trigger: "played", seat, cardId }), { trigger: "enteredPlay", seat, cardId });
}
