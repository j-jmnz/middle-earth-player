// Rules: dcce.encounter-cards, dcce.scalable-upgradable, rr.campaign-setup-checklist, rr.player-deck (data/rules/entries.json); ledger lines 11025:A:1, 11179:A:2, 11181:A:4, 110013:A:2, 110013:B:3,
// 11033:A:2, 11034:A:1. What the scenario's cards do beyond the Uncharted deck: Calphon coming into play, the campaign card's Setup (Spyglass on Calphon, damage traded for threat), a
// resource on the campaign card, and the bottom of a deck (looked at, discarded).
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { characters } from "../../combat/combat.ts";
import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked, seatOf } from "../../interpret/player-verbs.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import { attachTo, discardFromHand, moveCard } from "../../core/zones.ts";
import { dealtFace } from "../dreamchaser/facts.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { queueFront } from "../play/refs.ts";
import { lowerThreatByEffect } from "../quest/threat.ts";
import { queueHeard } from "../quest/events.ts";
import { lastPlayer } from "../sea/players.ts";
import { stage } from "./deck.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PutSetAsideInPlay: the set-aside copy of the card with this name comes into play, ready, under the first player, on the side the campaign deals it. `actor`: under the player who used the effect. `anyPlayer`: the first player chooses which
 * player takes it (a game with one player asks nobody). */
export function putSetAsideInPlay(state: ScenarioState, instruction: Verb<"PutSetAsideInPlay">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const id = state.setAside.find((other) => printedOf(ctx.cards, state.cards[other]?.code ?? "").name === instruction.name);
  if (!id) return state;
  let seat: number | undefined;
  if (instruction.to === "anyPlayer") {
    const seats = livingSeats(state);
    const chosen = focus.chosen?.startsWith("seat:") ? Number(focus.chosen.slice("seat:".length)) : undefined;
    seat = chosen != null && seats.includes(chosen) ? chosen : seats.length === 1 ? seats[0] : undefined;
    if (seat == null) return effectData(state) ? askTarget(state, { instruction, seat: state.firstPlayer, chosen: null }, seats.map((index) => `seat:${index}`)) : state;
  }
  const holder = instruction.withCard ? Object.values(state.cards).find((card) => inPlay(card.zone) && card.controller != null && printedOf(ctx.cards, card.code).name === instruction.withCard) : undefined;
  return updateCard(moveCard(state, id, { zone: "play", seat: seat ?? holder?.controller ?? (instruction.to === "actor" ? focus.seat : instruction.to === "lastPlayer" ? lastPlayer(state) : state.firstPlayer) }), id, { face: dealtFace(state, state.cards[id]?.code ?? "", "up") });
}

/** AttachSetAside: the set-aside copy of the card with this code is attached to the card in play with that name. */
export function attachSetAsideTo(state: ScenarioState, instruction: Verb<"AttachSetAsideTo">, ctx: ReduceContext): ScenarioState {
  const id = state.setAside.find((other) => state.cards[other]?.code === instruction.code);
  const host = Object.values(state.cards).find((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).name === instruction.to);
  if (!id || !host) return state;
  const seat = host.controller ?? state.firstPlayer;
  const placed = updateCard(moveCard(state, id, { zone: "play", seat }), id, { face: dealtFace(state, instruction.code, "up") });
  return queueEvent(attachTo(placed, id, host.id), { trigger: "attached", seat, subject: id, other: host.id });
}

/** The characters in play, each seat's in player order, a seat's in the order `characters` lists them: the order the players decide a trade in. */
function inPlayCharacters(state: ScenarioState, ctx: ReduceContext): string[] {
  return livingSeats(state).flatMap((seat) => characters(state, seat, ctx.cards));
}

/** TradeDamageForThreat: in order, the controller of each character in play chooses to trade or keep; a trade deals `damage` to the character and lowers its controller's threat by
 * `threat`. `character` is the character being decided (absent: the first). */
export function tradeDamageForThreat(state: ScenarioState, instruction: Verb<"TradeDamageForThreat">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  const all = inPlayCharacters(state, ctx);
  const character = instruction.character ?? all[0];
  if (!character || !state.cards[character]) return state;
  const seat = state.cards[character]?.controller ?? focus.seat;
  const next = all[all.indexOf(character) + 1];
  const goOn = (current: ScenarioState): ScenarioState => (next ? queueFront(current, [{ instruction: { ...instruction, character: next }, seat, chosen: null, cause }]) : current);
  if (focus.chosen == null) {
    if (!effectData(state)) return { ...state, failure: "Trading damage for threat needs a choice, and no effect is asking" };
    return askTarget(state, { instruction: { ...instruction, character }, seat, chosen: null, cause }, ["trade", "keep"]);
  }
  if (focus.chosen !== "trade") return goOn(state);
  const damaged = placeDamage(state, character, instruction.damage, ctx.cards, steps, "framework", cause);
  return goOn(lowerThreatByEffect(damaged, seat, instruction.threat, focus.sourceId, ctx, steps, cause));
}

/** AddCampaignResource: the campaign card in play gains resource tokens. */
export function addCampaignResource(state: ScenarioState, instruction: Verb<"AddCampaignResource">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const card = Object.values(state.cards).find((other) => other.zone === "campaign");
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  return card && amount > 0 ? updateCard(state, card.id, { resources: card.resources + amount }) : state;
}

// The seat whose deck a verb reads: the actor's, the first player's, the player engaged with the source enemy, or the last picked player's.
function deckSeat(state: ScenarioState, focus: Focus, who: "actor" | "firstPlayer" | "engaged" | "picked" | undefined): number | null {
  if (who === "firstPlayer") return state.firstPlayer;
  if (who === "engaged") return (focus.sourceId ? state.cards[focus.sourceId]?.controller : null) ?? focus.seat;
  if (who === "picked") return seatOf(lastPicked(state));
  return focus.seat;
}

/** LookAtBottom: the bottom `count` cards of a deck are shown to the actor; they are the cards the effect looked at, the bottom card the picked one. */
export function lookAtBottom(state: ScenarioState, instruction: Verb<"LookAtBottom">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const count = instruction.count == null ? 1 : resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  const owner = deckSeat(state, focus, instruction.deck === "picked" ? "picked" : "actor");
  const ids = instruction.deck === "encounter" ? state.encounterDeck.slice(-count) : owner == null ? [] : (state.seats[owner]?.deck ?? []).slice(-count);
  const data = effectData(state);
  const noted = data ? patchTop(state, { data: { ...data, looked: ids, picked: [...(data.picked ?? []), ...ids.slice(-1)] } }) : state;
  if (ids.length === 0) return noted;
  return { ...noted, window: { kind: "look", seat: focus.seat, cardIds: ids }, activeSeat: focus.seat, passed: [] };
}

/** DiscardBottom: the bottom card of the deck goes to its owner's discard pile; the effect remembers it, for the card's printed cost. */
export function discardBottom(state: ScenarioState, instruction: Verb<"DiscardBottom">, focus: Focus): ScenarioState {
  const seat = deckSeat(state, focus, instruction.who);
  const id = seat == null ? undefined : state.seats[seat]?.deck.at(-1);
  const data = effectData(state);
  if (seat == null || !id || !data) return state;
  const discarded = queueEvent(moveCard(state, id, { zone: "discard", seat }), { trigger: "discardedFromDeck", seat, cardId: id });
  return patchTop(discarded, { data: { ...data, discarded: id } });
}

/** Whether the card DiscardBottom discarded in this effect has a printed cost: its cost, or Infinity for a card with none or when nothing was discarded (the `discardedCost` condition). */
export function discardedCost(state: ScenarioState, ctx: Pick<ReduceContext, "cards">): number {
  const id = effectData(state)?.discarded;
  return (id ? printedOf(ctx.cards, state.cards[id]?.code ?? "").cost : null) ?? Number.POSITIVE_INFINITY;
}

/** DiscardCostlier: from the hand of `who`, each card whose printed cost is higher than that of the card DiscardBottom discarded is discarded. */
export function discardCostlier(state: ScenarioState, instruction: Verb<"DiscardCostlier">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const seat = deckSeat(state, focus, instruction.who);
  const discarded = effectData(state)?.discarded;
  const base = discarded ? printedOf(ctx.cards, state.cards[discarded]?.code ?? "").cost : null;
  if (seat == null || base == null) return state;
  let next = state;
  for (const id of [...(state.seats[seat]?.hand ?? [])]) {
    const cost = printedOf(ctx.cards, state.cards[id]?.code ?? "").cost;
    if (cost != null && cost > base) next = discardFromHand(next, id, state.cards[id]?.owner ?? seat, seat);
  }
  return next;
}

/** DiscardEncounterTop: the top cards of the encounter deck go to its discard pile, face up; they are the cards the effect looked at. */
export function discardEncounterTop(state: ScenarioState, instruction: Verb<"DiscardEncounterTop">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const count = resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  const ids = state.encounterDeck.slice(0, Math.max(0, count));
  let next = state;
  for (const id of ids) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, looked: ids } }) : next;
}

/** StageLooked: each player in turn adds one card of the trait and type, among those the effect discarded, to the staging area. */
export function stageLooked(state: ScenarioState, instruction: Verb<"StageLooked">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const order = livingSeats(state);
  const seat = instruction.seat ?? order[0];
  if (seat == null || !order.includes(seat)) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const options = (effectData(state)?.looked ?? []).filter((id) => state.cards[id]?.zone === "encounterDiscard" && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === instruction.type && hasTrait(state, id, instruction.trait, ctx));
  const nextSeat = order[order.indexOf(seat) + 1];
  const goOn = (current: ScenarioState): ScenarioState => (nextSeat == null ? current : queueFront(current, [{ instruction: { ...instruction, seat: nextSeat }, seat: nextSeat, chosen: null, cause }]));
  if (options.length === 0) return state;
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return askTarget(state, { instruction: { ...instruction, seat }, seat, chosen: null, cause }, options);
  return goOn(stage(updateCard(state, chosen, { face: "up" }), chosen, seat, ctx));
}

/** RemoveWillpowerFromQuest: the first player removes committed characters one at a time until their Willpower adds up to the amount, or none is left to remove. */
export function removeWillpowerFromQuest(state: ScenarioState, instruction: Verb<"RemoveWillpowerFromQuest">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const left = instruction.left ?? resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const options = livingSeats(state).flatMap((seat) => characters(state, seat, ctx.cards).filter((id) => state.cards[id]?.committed));
  if (left <= 0 || options.length === 0) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return effectData(state) ? askTarget(state, { instruction: { ...instruction, left }, seat: state.firstPlayer, chosen: null, cause }, options) : state;
  const card = state.cards[chosen];
  if (!card) return state;
  const removed = queueHeard(updateCard(state, chosen, { committed: false }), ctx, { trigger: "removedFromQuest", seat: card.controller, subject: chosen });
  const rest = left - modifiedStat(state, card, "willpower", ctx.cards);
  return rest > 0 ? queueFront(removed, [{ instruction: { ...instruction, left: rest }, seat: focus.seat, chosen: null, cause }]) : removed;
}

/** EachExhaustsOne: each player in turn exhausts one ready character they control, choosing among them. */
export function eachExhaustsOne(state: ScenarioState, instruction: Verb<"EachExhaustsOne">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const order = livingSeats(state);
  const seat = instruction.seat ?? order[0];
  if (seat == null || !order.includes(seat)) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const options = characters(state, seat, ctx.cards).filter((id) => state.cards[id] && !state.cards[id]?.exhausted);
  const nextSeat = order[order.indexOf(seat) + 1];
  const goOn = (current: ScenarioState): ScenarioState => (nextSeat == null ? current : queueFront(current, [{ instruction: { ...instruction, seat: nextSeat }, seat: nextSeat, chosen: null, cause }]));
  if (options.length === 0) return goOn(state);
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return effectData(state) ? askTarget(state, { instruction: { ...instruction, seat }, seat, chosen: null, cause }, options) : state;
  return goOn(updateCard(state, chosen, { exhausted: true }));
}

/** MayDiscardShadow: the actor chooses to discard the shadow card dealt to the last picked enemy or to keep it. */
export function mayDiscardShadow(state: ScenarioState, instruction: Verb<"MayDiscardShadow">, focus: Focus): ScenarioState {
  const enemy = state.cards[lastPicked(state)];
  if (!enemy?.shadowId) return state;
  if (focus.chosen == null) {
    return effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause([], UNATTRIBUTED) }, ["discard", "keep"]) : state;
  }
  return focus.chosen === "discard" ? moveCard(state, enemy.shadowId, { zone: "encounterDiscard" }) : state;
}
