// Rules: mec112.setup-journey-to-the-cross-roads, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 144027:A:1, 144027:A:2, 144036:A:2, 144037:A:2, 144038:A:2, 144039:A:2.
// The enemies facedown under The Black Gate: placing one there (out of play, as a card under another is), and the count the loss line reads.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import type { ScenarioState } from "../../core/state.ts";
import { hostOf, inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { isPlayerType, printedOf } from "../../core/printed.ts";
import { placeUnderHost } from "../encounter/moves.ts";
import { facedownCount, facedownWithin } from "../misc/amounts.ts";
import type { Focus } from "../index.ts";

/** The code of The Black Gate (144027): the card the Harad enemies lie facedown under. */
export const BLACK_GATE = "144027";

/** PlaceFacedownUnder: the card goes facedown under the host, out of play, and `placedUnder` is queued about it. */
export function placeFacedownUnder(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceFacedownUnder" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // Once the attack in progress has ended, with the attacking enemy as the source (as AfterAttack queues its instructions, combat/attack-verbs.ts).
  const attack = state.pendingAttack;
  if (instruction.afterAttack && attack) {
    const later: Instruction = { verb: "PlaceFacedownUnder", ...(instruction.code != null ? { code: instruction.code } : {}), ...(instruction.host != null ? { host: instruction.host } : {}), target: "self" };
    return { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), later], afterCause: currentCause(steps, UNATTRIBUTED) } };
  }
  const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  const host = instruction.host === "self" ? focus.sourceId : instruction.code != null ? hostOf(state, instruction.code) : null;
  if (!id || !card || host == null || host === id || !inPlay(card.zone)) return state;
  // A player card placed under a card stays its owner's (it returns to his hand when the host is explored), though its controller is cleared as it leaves play.
  const owner = isPlayerType(printedOf(ctx.cards, card.code)) ? (card.owner ?? card.controller) : null;
  const placed = placeUnderHost(state, id, host, ctx, steps);
  return owner != null && placed.cards[id]?.zone === "under" ? updateCard(placed, id, { owner }) : placed;
}

/** The `facedownUnder` condition: the cards facedown under the card in play with this code number at least `min` and at most `max`, each plus the number of players with `players` (144027:A:2). */
export function facedownUnderHolds(state: ScenarioState, condition: Extract<Condition, { kind: "facedownUnder" }>): boolean {
  return facedownWithin(state, hostOf(state, condition.code), condition);
}

/** The cards facedown under the card in play with this code (The Black Gate, BLACK_GATE) and the number that loses the game, read from its own record (144027:constant:1, a LoseGame under `facedownUnder` with `min` and `players`): the one place the number lives. Null in a game without one. */
export function gateTally(state: ScenarioState, ctx: ReduceContext, code: string): { count: number; limit: number } | null {
  const host = hostOf(state, code);
  if (!host) return null;
  const loses = effectsOf(ctx, code).find((effect) => effect.condition?.kind === "facedownUnder" && effect.instructions.some((instruction) => instruction.verb === "LoseGame"));
  const condition = loses?.condition;
  if (condition?.kind !== "facedownUnder" || condition.min == null) return null;
  return { count: facedownCount(state, host), limit: condition.min + (condition.players ? livingSeats(state).length : 0) };
}
