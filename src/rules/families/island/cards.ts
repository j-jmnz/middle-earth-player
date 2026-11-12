// Rules: dcce.island-map, dcce.exploration, rr.guarded, rr.attachment-cards (data/rules/entries.json); ledger lines 12067:A:1, 11197:A:2, 11197:A:3, 12068:A:1, 110078:B:3. What the scenario does beyond the map: the Gate
// Key attached to the Temple Guardian, the secrets under the Temple locations, and the Temple Guardian coming back into play.
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../windows/choices.ts";
import { frameScope } from "../../interpret/amounts.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import { progressRoom } from "../south/locations.ts";
import { raiseThreat } from "../../core/keywords.ts";
import { queueEvent } from "../../windows/queue.ts";
import { queueFront } from "../play/refs.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { engageWith, stagingLocations } from "../../quest/quest.ts";
import { seatThreat } from "../play/hooks.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard, withSeat } from "../../core/state.ts";
import { attachTo, cardsUnder, moveCard, turnedUp, turnedUpCode } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { effectData } from "../encounter/moves.ts";
import { templeCells } from "./map.ts";

/** A choice of a seat is offered as `seat:N` (askTarget); the seat a made choice names, or undefined while nothing is chosen. */
const seatOption = (seat: number): string => `seat:${seat}`;
const chosenSeat = (chosen: string | undefined): number | undefined => (chosen == null ? undefined : Number(chosen.slice("seat:".length)));

/** The option that keeps the progress on the stage instead of placing it. */
export const KEEP = "keep";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AttachGuarded: the set-aside card with this title is attached to the card in play with this title, as a claimed objective does: it returns to the staging area, uncontrolled, when that card leaves play
 * (rr.guarded: the objective stays in the staging area until it is claimed). */
export function attachGuarded(state: ScenarioState, instruction: Verb<"AttachGuarded">, ctx: ReduceContext): ScenarioState {
  const id = state.setAside.find((other) => printedOf(ctx.cards, state.cards[other]?.code ?? "").name === instruction.name);
  const host = Object.values(state.cards).find((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).name === instruction.to);
  if (!id || !host) return state;
  // A card the campaign log upgraded is dealt on its Upgraded side (dcce.scalable-upgradable).
  const placed = updateCard(moveCard(state, id, { zone: "attached" }), id, { face: turnedUp(state, id), controller: null, claimed: true });
  return attachTo(placed, id, host.id);
}

/** PlaceSecrets: the set-aside copies of these cards (one for each code listed) are shuffled and lie facedown under the Temple locations, one each, from the top (11197:A:2). */
export function placeSecrets(state: ScenarioState, instruction: Verb<"PlaceSecrets">): ScenarioState {
  const taken = new Set<string>();
  const ids = instruction.codes.flatMap((code) => {
    const found = state.setAside.find((other) => state.cards[other]?.code === code && !taken.has(other));
    if (found) taken.add(found);
    return found ? [found] : [];
  });
  const cells = templeCells(state);
  if (ids.length === 0 || cells.length === 0) return state;
  const shuffled = shuffleIds(ids, state.seed, state.seedCursor);
  let next: ScenarioState = { ...state, seedCursor: shuffled.cursor };
  shuffled.ids.forEach((id, at) => {
    const cell = cells[at];
    if (cell) next = moveCard(next, id, { zone: "under", locationId: cell });
  });
  return next;
}

/** The secret under the active location, if it has one (the cards under a location, facedown). */
export function secretHere(state: ScenarioState): string | null {
  return state.activeLocation ? (cardsUnder(state, state.activeLocation)[0] ?? null) : null;
}

/** FlipSecret: the secret under the active location turns faceup. An enemy engages the actor; an ally comes into play ready under the actor's control (11197:A:3). */
export function flipSecret(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = secretHere(state);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card) return state;
  steps.push({ kind: "reveal", seat: focus.seat, cardId: id, cause: currentCause(steps, UNATTRIBUTED) });
  const shown = updateCard(state, id, { face: "up" });
  if (printedOf(ctx.cards, card.code).type === "enemy") return engageWith(shown, focus.seat, id, steps);
  return updateCard(moveCard(shown, id, { zone: "play", seat: focus.seat }), id, { face: "up", exhausted: false });
}

/** LookAtSecret: the actor sees the picked secret; it stays facedown (110078:B:3). */
export function lookAtSecret(state: ScenarioState, focus: Focus): ScenarioState {
  const id = lastPicked(state);
  if (!id || state.cards[id]?.zone !== "under") return state;
  return { ...state, window: { kind: "look", seat: focus.seat, cardIds: [id], side: "A" }, activeSeat: focus.seat, passed: [] };
}

/** EngageFromVictory: the card with this title in the victory display is put into play engaged with the player with the highest threat; the first player chooses among those tied (12068:A:1). */
export function engageFromVictory(state: ScenarioState, instruction: Verb<"EngageFromVictory">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.victory.find((other) => printedOf(ctx.cards, state.cards[other]?.code ?? "").name === instruction.name);
  if (!id) return state;
  const seats = livingSeats(state);
  const top = Math.max(...seats.map((seat) => seatThreat(state, seat)));
  const tied = seats.filter((seat) => seatThreat(state, seat) === top);
  const chosen = chosenSeat(focus.chosen) ?? (tied.length === 1 ? tied[0] : undefined);
  if (chosen == null || !tied.includes(chosen)) {
    if (!effectData(state)) return { ...state, failure: "Putting the Temple Guardian into play needs a choice, and no effect is asking" };
    return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied.map(seatOption));
  }
  return engageWith(updateCard(state, id, { face: "up" }), chosen, id, steps);
}

/** ShuffleIntoPlayerDeck: the source card goes into a player's deck and the deck is shuffled; the first player chooses whose when there is more than one player (11199:A:2). */
export function shuffleIntoPlayerDeck(state: ScenarioState, instruction: Verb<"ShuffleIntoPlayerDeck">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || inPlay(card.zone)) return state;
  const seats = livingSeats(state);
  const chosen = chosenSeat(focus.chosen) ?? (seats.length === 1 ? seats[0] : instruction.seat);
  if (chosen == null || !seats.includes(chosen)) {
    if (!effectData(state)) return { ...state, failure: "Shuffling a card into a deck needs a choice, and no effect is asking" };
    return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, seats.map(seatOption));
  }
  const placed = updateCard(moveCard(state, id, { zone: "deck", seat: chosen }), id, { face: "up", exhausted: false });
  const seat = placed.seats[chosen];
  if (!seat) return placed;
  const shuffled = shuffleIds(seat.deck, placed.seed, placed.seedCursor);
  return { ...withSeat(placed, chosen, { ...seat, deck: shuffled.ids }), seedCursor: shuffled.cursor };
}

/** RaiseThreatToAttach: each player in turn may raise their threat to attach the set-aside card to a hero; the first to say yes chooses the hero, and no one is asked after that (11197:A:2). */
export function raiseThreatToAttach(state: ScenarioState, instruction: Verb<"RaiseThreatToAttach">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  const seats = livingSeats(state);
  const seat = instruction.seat ?? seats[0];
  if (seat == null) return state;
  const id = state.setAside.find((other) => state.cards[other]?.code === instruction.code);
  if (!id) return state;
  const heroes = seats.flatMap((index) => state.seats[index]?.heroes ?? []);
  // The player who said yes chooses the hero.
  if (instruction.accepted) {
    if (focus.chosen == null) {
      if (!effectData(state)) return { ...state, failure: "Attaching a card to a hero needs a choice, and no effect is asking" };
      return askTarget(state, { instruction: { ...instruction, seat }, seat, chosen: null, cause }, heroes);
    }
    const host = state.cards[focus.chosen];
    if (!host) return state;
    const placed = updateCard(moveCard(state, id, { zone: "play", seat: host.controller ?? seat }), id, { face: turnedUpCode(state, instruction.code) });
    return queueEvent(attachTo(placed, id, host.id), { trigger: "attached", seat: host.controller ?? seat, subject: id, other: host.id });
  }
  const next = seats[seats.indexOf(seat) + 1];
  const goOn = (current: ScenarioState): ScenarioState => (next != null ? queueFront(current, [{ instruction: { ...instruction, seat: next }, seat: next, chosen: null, cause }]) : current);
  if (focus.chosen == null) {
    // A player whose threat would reach the elimination level by the raise is not offered it.
    if (seatThreat(state, seat) + instruction.amount >= 50) return goOn(state);
    if (!effectData(state)) return { ...state, failure: "Raising threat to attach a card needs a choice, and no effect is asking" };
    return askTarget(state, { instruction: { ...instruction, seat }, seat, chosen: null, cause }, ["attach", "keep"]);
  }
  if (focus.chosen !== "attach") return goOn(state);
  const raised = raiseThreat(state, seat, instruction.amount, steps, cause);
  return queueFront(raised, [{ instruction: { ...instruction, seat, accepted: true }, seat, chosen: null, cause }]);
}

/** PlaceProgressInStaging: the first player chooses a location in the staging area that can take progress and it takes all it can of what is left, again and again, until none is left or they keep the rest. */
export function placeProgressInStaging(state: ScenarioState, instruction: Verb<"PlaceProgressInStaging">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const left = instruction.left ?? frameScope(state, focus.seat, focus.sourceId).x ?? 0;
  if (left <= 0) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const open = stagingLocations(state, ctx.cards).filter((id) => progressRoom(state, id, ctx.cards) > 0);
  if (focus.chosen == null) {
    if (open.length === 0) return state;
    if (!effectData(state)) return { ...state, failure: "Placing progress in the staging area needs a choice, and no effect is asking" };
    return askTarget(state, { instruction: { ...instruction, left }, seat: state.firstPlayer, chosen: null, cause }, [...open, KEEP]);
  }
  if (focus.chosen === KEEP || !open.includes(focus.chosen)) return state;
  const placed = Math.min(left, progressRoom(state, focus.chosen, ctx.cards));
  const next = placeProgress(state, focus.chosen, placed, ctx, steps);
  return left - placed > 0 ? queueFront(next, [{ instruction: { ...instruction, left: left - placed }, seat: state.firstPlayer, chosen: null, cause }]) : next;
}
