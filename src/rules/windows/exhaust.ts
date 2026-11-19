// Rules: rr.exhausted, rr.triggering-condition (data/rules/entries.json).
import type { GameEvent } from "./frame-types.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import type { CardInstance, ScenarioState } from "../core/state.ts";
import { updateCard } from "../core/state.ts";
import { gameReads } from "../core/game-reads.ts";
import { queueEvent } from "./queue.ts";

// Whether a card in the game answers "After ~ exhausts" (Turayn, 12166:A:2; The One Ring's Forced effect, 142084:A:2).
export function exhaustHeard(state: ScenarioState, ctx: ReduceContext): boolean {
  return gameReads(state, ctx, '"trigger":"exhausted"');
}

// A ready card exhausts by a game step (it commits to the quest, attacks, defends, pays an exhaust cost) with the rest of the
// patch, and the exhaustion is announced to "After ~ exhausts". The event is queued only in a game with a card that hears it,
// so every other game plays as before. A card that is already exhausted gets the patch and no event.
export function exhaustAnnounced(
  state: ScenarioState,
  id: string,
  ctx: ReduceContext,
  patch: Partial<CardInstance> = {},
  event: Pick<GameEvent, "occurrence"> = {},
): ScenarioState {
  const card = state.cards[id];
  if (!card) return state;
  const next = updateCard(state, id, { ...patch, exhausted: true });
  if (card.exhausted || !exhaustHeard(state, ctx)) return next;
  return queueEvent(next, { trigger: "exhausted", seat: card.controller ?? null, cardId: id, ...event });
}
