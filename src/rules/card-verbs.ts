// Rules: rr.engaged, rr.play-and-put-into-play, rr.unique-cards, rr.removed-from-game, rr.cancel, rr.reveal, rr.lasting-effects,
// rr.ownership-and-control (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { answeredEvent } from "./damage-verbs.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { uniqueBlocked } from "./keywords.ts";
import { lastPicked, seatOf } from "./player-verbs.ts";
import { printedOf } from "./printed.ts";
import { engageEnemy, engageWith } from "./quest.ts";
import { queueEvent } from "./queue.ts";
import { shuffleIds } from "./seed.ts";
import type { ScenarioState } from "./state.ts";
import { flagged, updateCard, withSeat } from "./state.ts";
import { moveCard } from "./zones.ts";

// Verbs of the core-set player cards that move cards or change who an enemy attacks (user request, 2026-10-26).
export type CardFocus = { seat: number; sourceId: string | null };

// Returns the new state when the instruction is one of these verbs, otherwise null.
export function runCardVerb(state: ScenarioState, instruction: Instruction, focus: CardFocus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "EngagePicked": {
      // "Choose an enemy card in the staging area or currently engaged with another player. Engage that enemy." (01015:A:1):
      // it enters the actor's play area from where it is, so the actor has engaged it (rr.engaged).
      const id = lastPicked(state);
      const enemy = state.cards[id];
      if (!enemy || flagged(state, id, "cannotBeEngaged")) return state;
      if (enemy.zone === "staging") return engageEnemy(state, focus.seat, id, steps);
      return enemy.zone === "engaged" && enemy.controller !== focus.seat ? engageWith(state, focus.seat, id, steps) : state;
    }
    case "PutSelfIntoPlay": {
      // Put into play from the hand: no cost is paid, and a unique card still cannot join a copy in play (rr.unique-cards).
      const card = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      if (!card || card.zone !== "hand" || card.controller == null || uniqueBlocked(state, printedOf(ctx.cards, card.code), ctx.cards)) return state;
      const entered = updateCard(moveCard(state, card.id, { zone: "play", seat: card.controller }), card.id, { exhausted: false });
      return queueEvent(entered, { trigger: "enteredPlay", seat: card.controller, cardId: card.id });
    }
    case "BarEngagedAttacks": {
      // A player card's lasting effect holds for the enemies engaged with that player when it resolves (rr.lasting-effects).
      const seat = seatOf(lastPicked(state));
      if (seat == null || !focus.sourceId) return state;
      const sourceId = focus.sourceId;
      const barred = (state.seats[seat]?.engaged ?? []).map((id) => ({ instanceId: id, sourceId, stat: "cannotAttack" as const, amount: 1, until: instruction.until, seat }));
      return { ...state, modifiers: [...state.modifiers, ...barred] };
    }
    case "RemoveSourceFromGame":
      return focus.sourceId && state.cards[focus.sourceId] ? moveCard(state, focus.sourceId, { zone: "removed" }) : state;
    case "ShuffleDiscardIntoDeck": {
      const seat = seatOf(lastPicked(state));
      const pile = seat == null ? [] : (state.seats[seat]?.discard ?? []);
      if (seat == null || pile.length === 0) return state;
      let next = state;
      for (const id of pile) next = moveCard(next, id, { zone: "deck", seat });
      const owner = next.seats[seat];
      if (!owner) return next;
      const shuffled = shuffleIds(owner.deck, next.seed, next.seedCursor);
      return { ...withSeat(next, seat, { ...owner, deck: shuffled.ids }), seedCursor: shuffled.cursor };
    }
    case "EncounterTopToBottom": {
      const [top, ...rest] = state.encounterDeck;
      return top ? { ...state, encounterDeck: [...rest, top] } : state;
    }
    case "ReplaceRevealed": {
      // The card whose "when revealed" effects the Response canceled: once it is discarded, the same player reveals the next
      // card of the encounter deck in its place (01008:A:1, frames.ts).
      const subject = answeredEvent(state)?.subject;
      const stack = state.stack.map((frame) => (frame.frame === "reveal" && frame.cardId === subject && frame.data.kind === "reveal" ? { ...frame, data: { ...frame.data, replaced: true } } : frame));
      return subject ? { ...state, stack } : state;
    }
    case "TakeAttackDamage": {
      const attack = state.pendingAttack;
      const id = lastPicked(state);
      return attack && state.cards[id] ? { ...state, pendingAttack: { ...attack, damageTo: id } } : state;
    }
    case "LookAtShadow": {
      const shadowId = state.cards[lastPicked(state)]?.shadowId;
      return shadowId ? { ...state, window: { kind: "look", seat: focus.seat, cardIds: [shadowId] }, activeSeat: focus.seat, passed: [] } : state;
    }
    default:
      return null;
  }
}
