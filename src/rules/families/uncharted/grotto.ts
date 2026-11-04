// Rules: dcce.grotto-deck, rr.active-location, rr.explored (data/rules/entries.json); ledger lines 12092:A:1, 12092:B:2, 12094:A:2, 12098:A:2, 12099:A:1, 12100:A:2, 12105:A:1, 12108:A:1. The Grotto deck
// and the double-sided locations whose two sides are two catalog cards: the instance's `code` is the side it shows and `other` the side it does not, so a flip swaps them and every read of the
// card (Traits, Threat, quest points, records) sees the side faceup. The deck is the Uncharted deck's zone (uncharted/zone.ts): a Grotto location that would be discarded is shuffled back into it.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { heldAmount, updateCard } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { stage } from "./deck.ts";
import { shuffleUnchartedDeck } from "./zone.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The code of the side a double-sided card does not show: its own pairing, or the pairing of a card dealt apart from the deck (the set-aside Shrine to Morgoth). */
export function otherSideOf(state: ScenarioState, card: Pick<CardInstance, "code" | "other">): string | undefined {
  return card.other ?? state.uncharted?.pairs?.[card.code];
}

/** A double-sided location, whichever side it shows: a card of the Uncharted deck's codes (Lost Island or Grotto side) or one that has a second side to show. */
export function isDoubleSided(state: ScenarioState, card: Pick<CardInstance, "code" | "other">): boolean {
  return otherSideOf(state, card) != null || (state.uncharted?.codes.includes(card.code) ?? false);
}

/** PrepareGrottoDeck: the Grotto deck is shuffled; every card in it is already Grotto side up (dcce.grotto-deck). */
export function prepareGrottoDeck(state: ScenarioState): ScenarioState {
  return shuffleUnchartedDeck(state);
}

/** The card shows its other side, keeping or losing its progress; the flip is announced to the Forced effects of the side it now shows. A flip of the active location is refused while the table holds noFlipActive. */
export function flipSides(state: ScenarioState, id: string, keepProgress: boolean, steps: EngineStep[]): ScenarioState {
  const card = state.cards[id];
  const back = card ? otherSideOf(state, card) : undefined;
  if (!card || !back) return state;
  if ((state.activeLocation === id || state.secondActiveLocation === id) && heldAmount(state, "table", "noFlipActive") > 0) return state;
  const lost = keepProgress ? 0 : card.progress;
  if (lost > 0) steps.push({ kind: "progress", targetId: id, amount: -lost, cause: currentCause(steps, UNATTRIBUTED) });
  return queueEvent(updateCard(state, id, { code: back, other: card.code, progress: card.progress - lost }), { trigger: "flippedOver", seat: null, cardId: id });
}

/** AddFromGrottoDeck: the top cards of the Grotto deck join the staging area, Grotto side up; with `flip` each then shows its Underwater side. */
export function addFromGrottoDeck(state: ScenarioState, instruction: Verb<"AddFromGrottoDeck">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const count = resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (let added = 0; added < count; added += 1) {
    const top = next.uncharted?.deck[0];
    if (!top) break;
    next = stage(next, top, focus.seat, ctx);
    if (instruction.flip) next = flipSides(next, top, false, steps);
  }
  return next;
}

/** FlipDoubleSided: the card (the source by default) shows its other side. */
export function flipDoubleSided(state: ScenarioState, instruction: Verb<"FlipDoubleSided">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "self", frameScope(state, focus.seat, focus.sourceId));
  return id ? flipSides(state, id, instruction.keepProgress === true, steps) : state;
}

/** ResolveActiveForced: the active location hears the end of the phase now, so its Forced effects (and Responses) for that moment resolve; no other card answers. */
export function resolveActiveForced(state: ScenarioState, instruction: Verb<"ResolveActiveForced">): ScenarioState {
  return state.activeLocation ? queueEvent(state, { trigger: "endOfPhase", seat: null, phase: instruction.phase, cardId: state.activeLocation }) : state;
}
