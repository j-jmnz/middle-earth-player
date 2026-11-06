// Rules: rr.effects (data/rules/entries.json).
//
// Progress taken off a card: up to `amount` comes off (never more than the card holds) and the step log records the loss as it records progress, with a negative amount.
import { currentCause, UNATTRIBUTED } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import type { ScenarioState } from "./state.ts";
import { updateCard } from "./state.ts";

/** Takes up to `amount` progress off the card and logs it as a negative progress step. The state itself when the card is missing or holds none. */
export function takeProgressOff(state: ScenarioState, cardId: string | null | undefined, amount: number, steps: EngineStep[]): ScenarioState {
  const card = cardId ? state.cards[cardId] : undefined;
  if (!cardId || !card) return state;
  const removed = Math.min(card.progress, Math.max(0, amount));
  if (removed <= 0) return state;
  steps.push({ kind: "progress", targetId: cardId, amount: -removed, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, cardId, { progress: card.progress - removed });
}
