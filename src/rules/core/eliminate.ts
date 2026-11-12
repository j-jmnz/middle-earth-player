// Elimination (rr.player-elimination): a seat out of heroes or at the threat elimination level leaves the game, and the cards it held go with it.
import { threatSaved } from "../families/quest/threat.ts";
import { GOLLUM, SMEAGOL, isGollum } from "../families/gollum/index.ts";
import { discardArea } from "../families/breaking/areas.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { queueEvent } from "../windows/queue.ts";
import { gameReads } from "./game-reads.ts";
import type { EngineStep } from "./intents.ts";
import { fromEncounterDeck, printedOf, type PrintedCard } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { flagged, heldAmount, heldHero, livingSeats, updateCard, withSeat } from "./state.ts";
import { inPlay, moveCard, type Destination } from "./zones.ts";

export function markLoss(state: ScenarioState, reason: string): ScenarioState {
  if (state.lost) return state;
  return { ...state, lost: true, lossReason: reason };
}

// An eliminated seat leaves the game (rr.player-elimination): its hand, its deck and every card it controls go to their
// owners' discard piles, and the enemies engaged with it return to the staging area with their damage. An attack on
// that seat ends, and a Peril lock it held is released. If it held the first player token, the token passes clockwise at once (rr.first-player,
// faq.first-player-elimination). Nothing is cleared once the game is lost. With `ctx`, an enemy that returns to the staging area queues "returnedToStaging" in a game whose records name it (146017:A:1).
export function clearEliminated(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, ctx?: ReduceContext): ScenarioState {
  if (state.lost) return state;
  let next = state;
  // Gollum is engaged with the first player and Sméagol is controlled by them (144075:A:1, 144076:A:1): when that seat leaves they pass to the new first player, keeping their exhaustion and damage (agent recommendation, docs/brief.md, The Two Towers).
  const heir = livingSuccessor(next);
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat?.eliminated) continue;
    const controlled = Object.values(next.cards).filter(
      (card) => !(heir != null && isGollum(card.code)) && card.controller === index && (inPlay(card.zone) || card.zone === "hand" || card.zone === "deck") && card.zone !== "engaged" && card.zone !== "staging" && card.zone !== "questStage",
    );
    const smeagol = heir == null ? undefined : Object.values(next.cards).find((card) => card.code === SMEAGOL && card.controller === index && card.zone === "play");
    if (controlled.length === 0 && seat.engaged.length === 0 && !smeagol) continue;
    for (const enemyId of seat.engaged) {
      if (heir != null && next.cards[enemyId]?.code === GOLLUM) {
        next = moveCard(next, enemyId, { zone: "engaged", seat: heir });
        continue;
      }
      next = moveCard(next, enemyId, { zone: "staging" });
      next = updateCard(next, enemyId, { controller: null });
      if (ctx && gameReads(next, ctx, '"trigger":"returnedToStaging"')) next = queueEvent(next, { trigger: "returnedToStaging", seat: index, cardId: enemyId });
    }
    if (smeagol && heir != null) next = moveCard(next, smeagol.id, { zone: "play", seat: heir });
    for (const card of controlled) {
      const current = next.cards[card.id];
      if (!current || current.controller !== index) continue;
      const printed = printedOf(cards, card.code);
      const wasInPlay = inPlay(current.zone);
      const dest: Destination = fromEncounterDeck(printed) ? { zone: "encounterDiscard" } : { zone: "discard", seat: current.owner ?? index };
      next = moveCard(next, card.id, dest);
      if (wasInPlay && (printed.leavesPlayLoses || flagged(state, card.id, "lossOnLeavingPlay"))) next = markLoss(next, `${printed.name} left play`);
    }
    // The action window between two steps of that attack closes with it.
    if (next.pendingAttack?.seat === index) {
      const between = next.pendingAttack.awaiting != null && next.window?.kind === "frameAction";
      next = { ...next, pendingAttack: null, window: next.window?.kind === "defense" || between ? null : next.window };
    }
    if (next.window?.kind === "chooseEnemy" && next.window.seat === index) next = { ...next, window: null };
    if (next.pendingStrike?.seat === index) {
      const between = next.pendingStrike.awaiting != null && next.window?.kind === "frameAction";
      next = { ...next, pendingStrike: null, window: next.window?.kind === "playerAttack" || between ? null : next.window };
    }
    // A Peril card the seat was resolving locks no one now (mec109.peril).
    if (next.perilSeat === index) next = { ...next, perilSeat: null };
  }
  // Stages that are separate: the stage of an eliminated seat is discarded with the encounter cards at it (mec109.multiple-staging-areas). The
  // enemies that were engaged with it returned to its staging area above.
  if (next.separate) for (let index = 0; index < next.seatCount; index += 1) if (next.seats[index]?.eliminated) next = discardArea(next, index);
  if (heir != null && heir !== next.firstPlayer) next = { ...next, firstPlayer: heir };
  return next;
}

// The seat that holds the first player token: the current one, or the next living seat clockwise when it is eliminated (null with none).
function livingSuccessor(state: ScenarioState): number | null {
  for (let step = 0; step <= state.seatCount; step += 1) {
    const candidate = (state.firstPlayer + step) % state.seatCount;
    if (!state.seats[candidate]?.eliminated) return candidate;
  }
  return null;
}

// A seat leaves the game (rr.player-elimination): the step is recorded and the seat marked eliminated; settle moves its cards (clearEliminated). With no seat left the game is lost. Every elimination goes through here.
export function eliminateSeat(state: ScenarioState, index: number, steps: EngineStep[]): ScenarioState {
  const seat = state.seats[index];
  if (!seat || seat.eliminated) return state;
  steps.push({ kind: "eliminate", seat: index });
  const next = withSeat(state, index, { ...seat, eliminated: true });
  return livingSeats(next).length === 0 ? markLoss(next, "No seats remain") : next;
}

// `final`: the play sweep has already let an ally gain the hero card type, so a seat in heroSavers with no heroes is eliminated now.
export function eliminateEmpties(state: ScenarioState, steps: EngineStep[], final = false): ScenarioState {
  let next = state;
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat || seat.eliminated) continue;
    // The elimination level, lowered by a card the seat holds (The One Ring, families/misc.ts).
    const level = 50 - Math.max(0, heldAmount(next, `seat:${index}`, "eliminationReduction"));
    if (!final && seat.threat < level && seat.heroes.length === 0 && (state.heroSavers ?? []).includes(index)) continue;
    // A hero an enemy guards is in play, not killed (Carried Away, 18074:B:1; rr.player-elimination): its owner is not out of heroes while it is held.
    const held = seat.threat < level && seat.heroes.length === 0 && Object.values(next.cards).some((card) => heldHero(card) && card.owner === index);
    if (held) continue;
    if (seat.threat >= level || seat.heroes.length === 0) {
      // A card that keeps the seat in the game at its threat elimination level is asked instead (10124:A:2).
      const saved = seat.heroes.length > 0 ? threatSaved(next, index) : null;
      if (saved) {
        next = saved;
        continue;
      }
      next = eliminateSeat(next, index, steps);
    }
  }
  if (!next.lost && livingSeats(next).length === 0) next = markLoss(next, "No seats remain");
  return next;
}
