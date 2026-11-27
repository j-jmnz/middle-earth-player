// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.guarded, rr.attachment-cards, rr.ownership-and-control, rr.in-play-and-out-of-play, rr.player-elimination (data/rules/entries.json); ledger lines 17119:A:1 to 17119:A:3, 17120:A:1, 17121:A:1, 17121:A:2, 17122:A:1, 17122:A:2, 17125:A:2, 17125:A:3, 17128:A:1, 17129:A:1, 17131:A:1, 17131:A:2, 17132:A:1, 17134:A:1.
//
// The captives of The Dungeons of Cirith Gurat. A character attached to an encounter card is a Captive (families/captives): a hero or an ally in the captive zone, in play, faceup, controlled by nobody, hosted by the encounter card that guards it, still
// its owner's (`owner`; a hero also remembers its place, `heroSlot`). Abaan, an objective with no owner, lies the same way under Dungeon Cell. The Captives objective's records blank each one and strip it; the encounter card leaving play announces `leftPlay`
// (core/zones.ts), which RescueCaptured answers: a hero returns among its owner's heroes (families/captives releaseCaptive, the code Lost in Mirkwood's Carried Away uses), an ally to its owner's play area, both exhausted; an owner who left the game takes the card to its discard pile.
import type { Instruction, PickSpec } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { destroyCard, releaseAttachments } from "../../core/destroy.ts";
import { uniqueBlocked } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, livingSeats, updateCard, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { frameScope, refCard, type AmountScope } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { PickContext } from "../../interpret/pick.ts";
import { queueEvent } from "../../windows/queue.ts";
import { holdCaptive, releaseCaptive } from "../captives/index.ts";
import { captivesOf } from "../captives/values.ts";
import { pushPicked } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The captives the encounter card holds, in card order: Captives lying in the captive zone under it. */
export function captivesHeldBy(state: ScenarioState, hostId: string): CardInstance[] {
  return captivesOf(state).filter((card) => card.host === hostId);
}

// The seat a card belongs to: its owner, the seat that controls it, or the seat whose discard pile holds it. Undefined for a card no seat has (Abaan).
function seatOf(state: ScenarioState, card: CardInstance): number | undefined {
  if (card.owner != null) return card.owner;
  if (card.controller != null) return card.controller;
  const found = state.seats.findIndex((seat) => seat.discard.includes(card.id));
  return found >= 0 ? found : undefined;
}

/** The character is attached to the encounter card as a Captive. A hero keeps the place it had among its owner's heroes (holdCaptive); an ally leaves its owner's play area or discard pile and stays its owner's. `attached` is queued about it. */
export function captureCharacter(state: ScenarioState, id: string, hostId: string): ScenarioState {
  const card = state.cards[id];
  if (!card || !state.cards[hostId] || id === hostId) return state;
  const queued = (next: ScenarioState) => queueEvent(next, { trigger: "attached", seat: state.firstPlayer, subject: id, other: hostId });
  if (card.zone === "captive" && card.captive === true) return card.host === hostId ? state : updateCard(state, id, { host: hostId });
  if (card.zone === "heroes") return queued(updateCard(holdCaptive(state, id, hostId), id, { guardedHero: true }));
  const seat = seatOf(state, card);
  const moved = moveCard(state, id, { zone: "captive", hostId });
  return queued(updateCard(moved, id, { face: "up", captive: true, committed: false, ...(seat != null ? { owner: seat } : {}) }));
}

/** AttachCaptive: the character (`card`, or the set-aside card with `code`) is attached to `to`; with `discardCopies` each other card in play with its title is discarded. */
export function attachCaptive(state: ScenarioState, instruction: Verb<"AttachCaptive">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const hostId = refCard(state, instruction.to ?? "self", scope);
  const id = instruction.code != null ? state.setAside.find((setAside) => state.cards[setAside]?.code === instruction.code) : refCard(state, instruction.card ?? "picked", scope);
  const card = id ? state.cards[id] : undefined;
  if (!id || !hostId || !card || !state.cards[hostId]) return state;
  const captured = captureCharacter(state, id, hostId);
  if (instruction.discardCopies !== true) return captured;
  const title = printedOf(ctx.cards, card.code).name;
  let next = captured;
  for (const other of Object.values(captured.cards)) {
    if (other.id !== id && inPlay(other.zone) && printedOf(ctx.cards, other.code).name === title) next = destroyCard(next, other.id, ctx.cards, steps);
  }
  return next;
}

/** StripCaptive: the character loses its damage, resource and progress tokens, and each attachment on it is discarded. */
export function stripCaptive(state: ScenarioState, instruction: Verb<"StripCaptive">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, instruction.target ?? "subject", frameScope(state, focus.seat, focus.sourceId));
  if (!id || !state.cards[id]) return state;
  return updateCard(releaseAttachments(state, id, ctx.cards, steps), id, { damage: 0, resources: 0, progress: 0 });
}

// One captive returns to its owner (the owner is still in the game) or goes to the owner's discard pile (the owner left it).
function release(state: ScenarioState, card: CardInstance, ctx: ReduceContext): ScenarioState {
  const seat = card.owner;
  const printed = printedOf(ctx.cards, card.code);
  if (seat == null) return updateCard(moveCard(state, card.id, { zone: "staging" }), card.id, { face: "up" });
  if (state.seats[seat]?.eliminated) return updateCard(moveCard(state, card.id, { zone: "discard", seat }), card.id, { face: "up", guardedHero: undefined, heroSlot: undefined });
  if (printed.type === "hero") return releaseCaptive(state, card.id, { exhausted: true });
  // The ally is controlled by its owner again: it does not enter play, so no "enters play" Response is heard (docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Readings).
  return updateCard(moveCard(state, card.id, { zone: "play", seat }), card.id, { face: "up", exhausted: true, controller: seat });
}

/** RescueCaptured: each captive the encounter card holds (the source with `host: self`, the card the event is about otherwise) is rescued; once for the whole batch `charactersRescued` is queued about the main quest stage. */
export function rescueCaptured(state: ScenarioState, instruction: Verb<"RescueCaptured">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const hostId = instruction.host === "self" ? focus.sourceId : refCard(state, "subject", frameScope(state, focus.seat, focus.sourceId));
  const held = hostId ? captivesHeldBy(state, hostId) : [];
  if (held.length === 0) return state;
  const next = held.reduce((current, card) => release(current, card, ctx), state);
  return next.questStage ? queueEvent(next, { trigger: "charactersRescued", seat: null, subject: next.questStage }) : next;
}

/** DiscardUntilAlly: the actor's top cards are discarded until an ally is; with `notInPlay`, one whose title a unique ally in play holds is skipped. It is the last picked card ("" when the deck holds none). */
export function discardUntilAlly(state: ScenarioState, instruction: Verb<"DiscardUntilAlly">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const seat = focus.seat;
  let next = state;
  for (;;) {
    const top = next.seats[seat]?.deck[0];
    const card = top ? next.cards[top] : undefined;
    if (!top || !card) return pushPicked(next, "");
    next = queueEvent(moveCard(next, top, { zone: "discard", seat }), { trigger: "discardedFromDeck", seat, cardId: top });
    const printed = printedOf(ctx.cards, card.code);
    if (printed.type === "ally" && !(instruction.notInPlay === true && uniqueBlocked(next, printed, ctx.cards))) return pushPicked(next, top);
  }
}

// A card in hand that costs more than the printed Threat (0 with none) of the card last discarded from the encounter deck.
function costsMoreThanDiscarded(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const top = state.encounterDiscard.at(-1);
  const threat = top ? (printedOf(ctx.cards, state.cards[top]?.code ?? "").threat ?? 0) : 0;
  return (printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0) > threat;
}

// No card is attached to it: no attachment of any kind and no captive.
function unattached(state: ScenarioState, id: string): boolean {
  const card = state.cards[id];
  return card != null && card.attachments.length === 0 && !Object.values(state.cards).some((other) => other.host === id && inPlay(other.zone));
}

/** The haradrim pick filters of the captives: `guardsCaptive`, `heldBySource`, `ownedByActor`, `unattached`, `costAboveDiscardedThreat`. True leaves the other filters to decide. */
export function capturedPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  if (spec.guardsCaptive != null && (captivesHeldBy(state, id).length > 0) !== spec.guardsCaptive) return false;
  if (spec.heldBySource && (at.sourceId == null || state.cards[id]?.host !== at.sourceId)) return false;
  if (spec.ownedByActor && state.cards[id]?.owner !== at.seat) return false;
  if (spec.unattached && !unattached(state, id)) return false;
  return !spec.costAboveDiscardedThreat || costsMoreThanDiscarded(state, id, ctx);
}

/** The amount `heldPrinted`: the printed Willpower or cost of the captive the source holds (of the acting seat's own with `ownedByActor`), 0 with none. */
export function heldPrintedAmount(state: ScenarioState, found: { stat: "willpower" | "cost"; ownedByActor?: true }, scope: AmountScope, ctx: ReduceContext): number {
  const held = scope.sourceId ? captivesHeldBy(state, scope.sourceId).filter((card) => !found.ownedByActor || card.owner === scope.actor) : [];
  const first = held[0];
  return first ? (printedOf(ctx.cards, first.code)[found.stat] ?? 0) : 0;
}

/** The amount `seatsWithoutCaptives`: the living players that own no captive. */
export function seatsWithoutCaptives(state: ScenarioState): number {
  return livingSeats(state).filter((seat) => !captivesOf(state).some((card) => card.owner === seat)).length;
}
