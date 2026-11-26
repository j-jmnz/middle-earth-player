// Elimination (rr.player-elimination): a seat out of heroes or at the threat elimination level leaves the game, and the cards it held go with it.
import { runAtEnd } from "../combat/attack-end.ts";
import { threatSaved } from "../families/quest/threat.ts";
import { GOLLUM, SMEAGOL, isGollum } from "../families/gollum/index.ts";
import { DIRE_ELIMINATION_LEVEL } from "../families/black-gate/dire.ts";
import { heroWaiting } from "../families/deck/hero.ts";
import { discardArea } from "../families/breaking/areas.ts";
import { discardIsolated } from "../families/breaking/barrow.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { queueEvent } from "../windows/queue.ts";
import { gameReads } from "./game-reads.ts";
import type { EngineStep } from "./intents.ts";
import { fromEncounterDeck, printedOf, type PrintedCard } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { flagged, heldAmount, heldHero, livingSeats, updateCard, withSeat } from "./state.ts";
import { inPlay, moveCard, type Destination } from "./zones.ts";

/** The threat at which a player is eliminated (rr.player-elimination); a Dire quest raises it (`DIRE_ELIMINATION_LEVEL`). */
export const ELIMINATION_LEVEL = 50;

export function markLoss(state: ScenarioState, reason: string): ScenarioState {
  if (state.lost) return state;
  return { ...state, lost: true, lossReason: reason };
}

// "If X leaves play, the players lose the game" (printed `leavesPlayLoses`, or the flag `lossOnLeavingPlay` a card gives its host) holds however X leaves play: destroyed, discarded, eliminated with its controller,
// or returned to a hand or a deck. `before` and `after` are the state either side of one intent, the flag is read from `before` (its modifier ends with the card), and a won scenario loses nothing. A card removed from the game by a stage's own text is not
// one that left play for a player's effect: stage 2A of Breaking of the Fellowship removes the Ring-bearer with The One Ring's text blank (families/breaking/index.ts removeRingBearer), so the removed zone never loses.
export function loseWhenLeftPlay(before: ScenarioState, after: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ScenarioState {
  if (after.lost || after.stageCleared) return after;
  for (const was of Object.values(before.cards)) {
    const now = after.cards[was.id];
    if (!inPlay(was.zone) || now === was || (now && (inPlay(now.zone) || now.zone === "removed"))) continue;
    const printed = printedOf(cards, was.code);
    if (printed.leavesPlayLoses || flagged(before, was.id, "lossOnLeavingPlay")) return markLoss(after, `${printed.name} left play`);
  }
  return after;
}

// An eliminated seat leaves the game (rr.player-elimination): its hand, its deck and every card it controls go to their
// owners' discard piles (a player side quest in the staging area is one it controls, and goes to its owner's pile, not the encounter discard pile), and the enemies engaged with it
// return to the staging area with their damage. An attack on that seat ends, and a Peril lock it held is released. If it held the first player token, the token passes clockwise at once (rr.first-player,
// faq.first-player-elimination). Nothing is cleared once the game is lost. With `ctx`, an enemy that returns to the staging area queues "returnedToStaging" in a game whose records name it (146017:A:1).
export function clearEliminated(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, ctx?: ReduceContext, steps?: EngineStep[]): ScenarioState {
  if (state.lost) return state;
  let next = state;
  // Gollum is engaged with the first player and Sméagol is controlled by them (144075:A:1, 144076:A:1): when that seat leaves they pass to the new first player, keeping their exhaustion and damage (agent recommendation, docs/scenarios/the-two-towers/the-passage-of-the-marshes.md, The Passage of the Marshes).
  const heir = livingSuccessor(next);
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat?.eliminated) continue;
    const controlled = Object.values(next.cards).filter(
      (card) => !(heir != null && isGollum(card.code)) && card.controller === index && (inPlay(card.zone) || card.zone === "hand" || card.zone === "deck") && card.zone !== "engaged" && card.zone !== "questStage" && (card.zone !== "staging" || !fromEncounterDeck(printedOf(cards, card.code))),
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
      const ended = next.pendingAttack;
      next = { ...next, pendingAttack: null, window: next.window?.kind === "defense" || between ? null : next.window };
      // What waited on the attack still happens: it is an effect that resolves, not part of the attack on the seat (combat/attack-end.ts).
      if (ctx && steps) next = runAtEnd(next, ended, steps);
      // A defense window an event frame holds aside (the Forced effect that eliminated the seat ran after the attack began: Muck Adder's discard of the last hero, 02042:A:1, with a Wolf Rider shadow attack already begun) is dropped, not given back.
      next = { ...next, stack: next.stack.filter((frame) => !(frame.data.kind === "resume" && frame.data.window.kind === "defense" && frame.data.window.seat === index)) };
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
  // Fog on the Barrow-downs' areas (`isolated`): the stage that stays in play is parked and a trapped player's stage goes back to the quest deck (families/breaking/barrow.ts).
  if (next.separate) for (let index = 0; index < next.seatCount; index += 1) if (next.seats[index]?.eliminated) next = next.isolated ? discardIsolated(next, index) : discardArea(next, index);
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

/** The scenario's records say its last player's elimination is its Resolution, not a loss (the flag `endsInDefeat`, held from the campaign card). */
export function endsInDefeat(state: ScenarioState): boolean {
  return heldAmount(state, "table", "endsInDefeat") > 0;
}

/** What a run list and the end screens say of that end: the scenario was cleared by its last player's elimination and not by a win (mec113.dire, docs/scenarios/the-return-of-the-king/the-black-gate-opens.md, The Black Gate Opens). */
export const ENDED_BY_DEFEAT = "Every player fell";

/** The scenario ended on its last player's elimination, which is its Resolution (`endsInDefeat`), not on a win: every other end of every other scenario is false here. */
export function endedInDefeat(state: ScenarioState): boolean {
  return state.stageCleared && !state.lost && endsInDefeat(state);
}

// A seat leaves the game (rr.player-elimination): the step is recorded and the seat marked eliminated; settle moves its cards (clearEliminated). With no seat left the game is lost. Every elimination goes through here.
export function eliminateSeat(state: ScenarioState, index: number, steps: EngineStep[]): ScenarioState {
  const seat = state.seats[index];
  if (!seat || seat.eliminated) return state;
  // A scenario whose records hold `endsInDefeat` ends when its last player is eliminated, and the end is its Resolution (The Black Gate Opens): the seat stays as it stood and the scenario is cleared, so a win's Resolution reads that state.
  if (endsInDefeat(state) && livingSeats(state).length === 1) {
    if (state.stageCleared) return state;
    steps.push({ kind: "eliminate", seat: index });
    return { ...state, stageCleared: true, window: null, pendingAttack: null };
  }
  steps.push({ kind: "eliminate", seat: index });
  const next = withSeat(state, index, { ...seat, eliminated: true });
  return livingSeats(next).length === 0 ? markLoss(next, "No seats remain") : next;
}

/** The threat at which a seat is eliminated: 99 while the main quest is Dire (mec113.dire), lowered by a card the seat holds (The One Ring, families/misc.ts). */
export function eliminationLevel(state: ScenarioState, seat: number): number {
  return (state.dire ? DIRE_ELIMINATION_LEVEL : ELIMINATION_LEVEL) - Math.max(0, heldAmount(state, `seat:${seat}`, "eliminationReduction"));
}

// `final`: the play sweep has already let an ally gain the hero card type, so a seat in heroSavers with no heroes is eliminated now.
export function eliminateEmpties(state: ScenarioState, steps: EngineStep[], final = false): ScenarioState {
  let next = state;
  for (let index = 0; index < next.seatCount; index += 1) {
    const seat = next.seats[index];
    if (!seat || seat.eliminated) continue;
    const level = eliminationLevel(next, index);
    if (!final && seat.threat < level && seat.heroes.length === 0 && (state.heroSavers ?? []).includes(index)) continue;
    // A hero an enemy guards is in play, not killed (Carried Away, 18074:B:1; rr.player-elimination): its owner is not out of heroes while it is held.
    const held = seat.threat < level && seat.heroes.length === 0 && Object.values(next.cards).some((card) => heldHero(card) && card.owner === index);
    if (held) continue;
    // A hero in a captured deck or under a card is not killed (rr.player-elimination): a seat whose last hero in play left play stays in the game while one of its heroes is captured (families/captured/).
    const captured = seat.threat < level && seat.heroes.length === 0 && next.capture != null && Object.values(next.cards).some((card) => card.zone === "captured" && card.heroSlot != null && card.owner === index);
    if (captured) continue;
    // A hero shuffled into the deck (Lost and Alone) is not killed: its seat stays while it waits to be drawn (families/deck/hero.ts).
    if (seat.threat < level && seat.heroes.length === 0 && heroWaiting(next, index)) continue;
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

/**
 * A seat whose last hero left play in a way that did not ask (discarded by a shadow effect, Sleeping Sentry 04046:A:2) is eliminated by the settle sweep (rr.player-elimination), not at the next
 * threat raise or destruction. Only a seat that has a hero card out of play is one that lost its heroes. The state itself when every living seat has a hero.
 */
export function eliminateHeroless(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, steps: EngineStep[]): ScenarioState {
  if (state.lost || state.stageCleared) return state;
  for (let index = 0; index < state.seatCount; index += 1) {
    const seat = state.seats[index];
    if (!seat || seat.eliminated || seat.heroes.length > 0) continue;
    const fallen = Object.values(state.cards).some((card) => (card.owner ?? card.controller) === index && !inPlay(card.zone) && cards.get(card.code)?.type === "hero");
    if (fallen) return eliminateEmpties(state, steps);
  }
  return state;
}
