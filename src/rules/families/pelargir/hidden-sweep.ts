// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives, rr.player-elimination, rr.first-player (data/rules/entries.json); ledger lines 06118:A:1, 06118:B:3, 06132:A:1, 06133:A:1.
// What keeps the hidden cards and the two objective allies of The Blood of Gondor in order: the settle sweep that turns the cards of a player who holds 5 (Captured!, the flag `turnsAtFiveHidden` of the current stage) and discards those of a player who left the game, the two allies placed
// under Captured!, and the first player's control of them. Inert in a game with no record that takes a hidden card.
import type { Instruction } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";
import { hiddenIds, unhide } from "./hidden.ts";
import { turnAll } from "./hidden-turn.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The windows a player acts in: the turn at 5 cards does not wait for the players to pass in one of them.
const ACTION_WINDOWS: ReadonlySet<string> = new Set(["pass", "travel", "optionalEngage", "playerAttack"]);
const FIVE = 5;

/**
 * The settle sweep. A player who left the game has his hidden cards discarded (hidden.owner). While the current stage holds `turnsAtFiveHidden`, a player who holds 5 hidden cards turns them faceup, one at a time, once whatever took the fifth is done: an effect on the stack, an attack or a strike
 * being resolved and a window other than an action window hold it back (06118:B:3). A card the turn takes (Evil Crow) stays facedown, and a player who holds 5 again after it turns again.
 */
export function hiddenSweep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.lost || state.failure || state.setAside.length === 0 || !gameReads(state, ctx, '"TakeHiddenCard"')) return state;
  let next = state;
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    if (!state.seats[seat]?.eliminated) continue;
    for (const id of hiddenIds(next, seat)) next = moveCard(unhide(next, id), id, { zone: "encounterDiscard" });
  }
  const stage = next.questStage;
  if (!stage || next.modifiers.length === 0 || !flagged(next, stage, "turnsAtFiveHidden") || next.stack.length > 0 || next.pendingAttack || next.pendingStrike || (next.window != null && !ACTION_WINDOWS.has(next.window.kind))) return next;
  for (let pass = 0; pass < 10; pass += 1) {
    const seat = livingSeats(next).find((index) => hiddenIds(next, index).length >= FIVE);
    if (seat == null) break;
    next = turnAll(next, seat, hiddenIds(next, seat), ctx, steps);
  }
  return next;
}

/** HoldUnderStage: each card in play with one of these codes (Faramir and Lord Alcaron) lies under the stage that names it, still in play and controlled by nobody. It keeps its damage and exhaustion and is committed to nothing. */
export function holdUnderStage(state: ScenarioState, instruction: Verb<"HoldUnderStage">, focus: Focus): ScenarioState {
  if (!focus.sourceId || !state.cards[focus.sourceId]) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.zone !== "play" || !instruction.codes.includes(card.code)) continue;
    next = updateCard(moveCard(next, card.id, { zone: "captive", hostId: focus.sourceId }), card.id, { face: "up", committed: false, exhausted: card.exhausted });
  }
  return next;
}

/** GainControlOfSelf: the first player gains control of the source card: it passes to his play area when it is in play under another player's control. A card under a stage, or out of play, stays where it is. */
export function gainControlOfSelf(state: ScenarioState, focus: Focus): ScenarioState {
  const card = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!card || card.zone !== "play" || card.controller === state.firstPlayer) return state;
  return updateCard(moveCard(state, card.id, { zone: "play", seat: state.firstPlayer }), card.id, { face: "up", exhausted: card.exhausted });
}
