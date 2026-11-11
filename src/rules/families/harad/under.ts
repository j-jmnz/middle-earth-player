// Rules: mec112.setup-journey-to-the-cross-roads, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 144027:A:1, 144027:A:2, 144036:A:2, 144037:A:2, 144038:A:2, 144039:A:2.
// The enemies facedown under The Black Gate: placing one there (out of play, as a card under another is), and the count the loss line reads.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { releaseAttachments } from "../../core/keywords.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { leavePlay } from "../encounter/moves.ts";
import { facedownCount } from "../misc/amounts.ts";
import type { Focus } from "../index.ts";

/** The card in play with this code, the host of the facedown cards (null in a game without it). */
function hostOf(state: ScenarioState, code: string): string | null {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone))?.id ?? null;
}

/** PlaceFacedownUnder: the card goes facedown under the host, out of play, and `placedUnder` is queued about it. */
export function placeFacedownUnder(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceFacedownUnder" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // Once the attack in progress has ended, with the attacking enemy as the source (as AfterAttack queues its instructions, combat/attack-verbs.ts).
  const attack = state.pendingAttack;
  if (instruction.afterAttack && attack) {
    const later: Instruction = { verb: "PlaceFacedownUnder", code: instruction.code, target: "self" };
    return { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), later], afterCause: currentCause(steps, UNATTRIBUTED) } };
  }
  const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  const host = hostOf(state, instruction.code);
  if (!id || !card || host == null || host === id || !inPlay(card.zone)) return state;
  const left = leavePlay(releaseAttachments(state, id, ctx.cards, steps), id, ctx, steps);
  steps.push({ kind: "destroy", targetId: id, under: true });
  return queueEvent(moveCard(left, id, { zone: "under", locationId: host }), { trigger: "placedUnder", seat: null, subject: id });
}

/** The `facedownUnder` condition: the cards facedown under the card in play with this code number at least `min` and at most `max`, each plus the number of players with `players` (144027:A:2). */
export function facedownUnderHolds(state: ScenarioState, condition: Extract<Condition, { kind: "facedownUnder" }>): boolean {
  const extra = condition.players ? livingSeats(state).length : 0;
  const count = facedownCount(state, hostOf(state, condition.code));
  return (condition.min == null || count >= condition.min + extra) && (condition.max == null || count <= condition.max + extra);
}
