// Rules: rr.attachment-cards, rr.ownership-and-control, rr.in-play-and-out-of-play, rr.initial-threat-level (data/rules/entries.json); ledger lines 145016:A:1, 145016:A:3, 145022:A:2, 145063:A:1, 145065:A:1.
//
// A card attached to a player's threat dial (Overcome by Fear): it is in that seat's play area, under its control, attached to no card (the way PlayInto `threatDial` puts one there, play.ts). "Limit 1 per threat dial": a dial holds no
// second copy of a code. The copies the scenario sets aside wait in `state.setAside`; one is attached to a dial, and detached back to the set-aside cards, where any player may attach it again.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import { queueEvent } from "../../windows/queue.ts";
import { moveCard } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import type { Focus } from "../index.ts";

type Verb<V extends Instruction["verb"]> = Extract<Instruction, { verb: V }>;

/** The copy of the code on the seat's threat dial: in play, controlled by the seat, attached to no card. */
export function dialCopy(state: ScenarioState, seat: number, code: string): string | undefined {
  return Object.values(state.cards).find((card) => card.code === code && card.zone === "play" && card.host == null && card.controller === seat)?.id;
}

/** The copy of the code the scenario holds aside, out of play: the first one set aside. */
function setAsideCopy(state: ScenarioState, code: string): string | undefined {
  return state.setAside.find((id) => state.cards[id]?.code === code);
}

/** The code the verb names, or the source card's own. */
function codeOf(state: ScenarioState, instruction: { code?: string | undefined }, focus: Focus): string | undefined {
  return instruction.code ?? (focus.sourceId ? state.cards[focus.sourceId]?.code : undefined);
}

/** AttachToDial: a copy of the card goes onto the actor's threat dial, announced as entering play. With `code` it is a set-aside copy; without, the source card itself (Overcome by Fear's own Setup). Nothing happens when the dial
 * already holds a copy (Limit 1 per threat dial), or no copy is left. */
export function attachToDial(state: ScenarioState, instruction: Verb<"AttachToDial">, focus: Focus): ScenarioState {
  const code = codeOf(state, instruction, focus);
  const seat = focus.seat;
  if (!code || state.seats[seat]?.eliminated || dialCopy(state, seat, code)) return state;
  const id = instruction.code ? setAsideCopy(state, code) : focus.sourceId && state.cards[focus.sourceId] && !inPlay(state.cards[focus.sourceId]?.zone ?? "removed") ? focus.sourceId : undefined;
  if (!id) return state;
  const placed = updateCard(moveCard(state, id, { zone: "play", seat }), id, { face: "up", exhausted: false, host: null, controller: seat });
  return queueEvent(placed, { trigger: "enteredPlay", seat, cardId: id });
}

/** DetachFromDial: the copy on the actor's threat dial (of this code, or the source itself) goes back to the set-aside cards, facedown. Nothing happens with no copy on the dial. */
export function detachFromDial(state: ScenarioState, instruction: Verb<"DetachFromDial">, focus: Focus): ScenarioState {
  const code = codeOf(state, instruction, focus);
  const id = code ? dialCopy(state, focus.seat, code) : undefined;
  if (!id) return state;
  return updateCard(moveCard(state, id, { zone: "setAside" }), id, { face: "down" });
}

/** RemoveSetAside: every set-aside copy of the code leaves the game ("Remove each unattached copy of Overcome by Fear from the game", 145063:A:1). */
export function removeSetAside(state: ScenarioState, instruction: Verb<"RemoveSetAside">): ScenarioState {
  let next = state;
  for (const id of state.setAside) if (state.cards[id]?.code === instruction.code) next = moveCard(next, id, { zone: "removed" });
  return next;
}

/** The conditions `onDial` (the actor's dial holds a copy) and `canAttachToDial` (a copy is set aside and the dial holds none): null for any other condition. */
export function dialCondition(state: ScenarioState, condition: Condition, seat: number): boolean | null {
  if (condition.kind === "onDial") return dialCopy(state, seat, condition.code) != null;
  if (condition.kind === "canAttachToDial") return dialCopy(state, seat, condition.code) == null && setAsideCopy(state, condition.code) != null;
  return null;
}
