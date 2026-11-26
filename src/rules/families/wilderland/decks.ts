// Rules: emce.caves-deck, emce.evil-creatures-deck, emce.setup-lost-in-mirkwood (data/rules/entries.json). The decks of Ered Mithrin beside the encounter deck (core/piles.ts NAMED_PILES): shuffled by the Setup, joined by a card, revealed
// from, and the Evil Creatures deck refilled from its own discard pile when it runs out. The deck as a zone is core/piles.ts, the refill is core/decks.ts and the reveal families/encounter/named-decks.ts (the Corsair deck shares them).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { moveIntoDeck, refillDeck, reshuffleIntoDeck } from "../../core/decks.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { DECKS, NAMED_PILES, pileDealt, pileOf, shufflePile, topOf, withPile } from "../../core/piles.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { shuffleEncounterDeck } from "../../interpret/verbs.ts";
import { moveCard } from "../../core/zones.ts";
import { startReveal } from "../../windows/frames.ts";
import { revealTop } from "../encounter/named-decks.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { markPicked } from "../play/refs.ts";
import type { Focus } from "../index.ts";
import { spawnIntoPile } from "./kings.ts";

/** The Evil Creatures deck ran out: its own discard pile is shuffled back into it (emce.evil-creatures-deck). Settle keeps the game's deck refilled. */
export function refillEvilCreatures(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  return refillDeck(state, DECKS.evilCreatures, steps);
}

/** The Raven deck ran out: its own discard pile is shuffled back into it, whenever it is empty (rm.raven-deck). A game that did not deal it is left alone. */
export function refillRaven(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  return refillDeck(state, DECKS.raven, steps);
}

/** "Create the Raven deck" (rm.raven-deck): each set-aside copy of the codes goes facedown into the pile's deck, and the pile's discard pile starts empty. */
export function formPile(state: ScenarioState, instruction: Extract<Instruction, { verb: "FormPile" }>): ScenarioState {
  const zones = NAMED_PILES[instruction.pile];
  let next = withPile(state, zones.deck, pileOf(state, zones.deck));
  if (zones.discard) next = withPile(next, zones.discard, pileOf(state, zones.discard));
  return moveIntoDeck(next, zones, state.setAside.filter((id) => instruction.codes.includes(state.cards[id]?.code ?? "")));
}

/** "Shuffle the Raven deck discard pile into the Raven deck" (08148:A:1): the pile's discard pile joins its deck, which is shuffled; an empty discard pile still shuffles the deck, and what follows goes on (rr.then). */
export function shuffleDiscardIntoPile(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShuffleDiscardIntoPile" }>, steps: EngineStep[]): ScenarioState {
  const zones = NAMED_PILES[instruction.pile];
  if (!pileDealt(state, zones.deck)) return state;
  return reshuffleIntoDeck(state, zones, zones.discard ? pileOf(state, zones.discard) : [], steps, currentCause(steps, UNATTRIBUTED));
}

/** "Create the Caves deck" and its like: the dealt cards shuffled together. A deck the scenario did not deal is left alone. */
export function shuffleNamed(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShufflePile" }>): ScenarioState {
  const zone = NAMED_PILES[instruction.pile].deck;
  return state.piles?.[zone] === undefined ? state : shufflePile(state, zone);
}

/** "Shuffle Abandoned Ruin into the Caves deck, if able. Otherwise, remove it from the game." (12174:A:1): the card the game already has (dealt into the encounter deck, or set aside) joins the deck, which is shuffled; with no such deck
 * it leaves the game. A game with no copy of the card is left alone. */
export function shuffleIntoNamed(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShuffleIntoPile" }>): ScenarioState {
  const zone = NAMED_PILES[instruction.pile].deck;
  const id = [...state.encounterDeck, ...state.setAside].find((other) => state.cards[other]?.code === instruction.code);
  if (id === undefined) return instruction.placed && pileDealt(state, zone) ? shufflePile(spawnIntoPile(state, instruction.code, instruction.pile), zone) : state;
  if (!pileDealt(state, zone)) return moveCard(state, id, { zone: "removed" });
  return shufflePile(updateCard(moveCard(state, id, { zone }), id, { face: "down", controller: null }), zone);
}

/**
 * "Add the top card of the Evil Creatures deck to the staging area" (emce.evil-creatures-deck): `count` cards for each seat the verb names, each entering play. The last one added is the picked card of the running effect; with `attachSource`
 * the source card is attached to each (18018:A:1: the Condition goes on the enemy it adds).
 */
export function addFromNamed(state: ScenarioState, instruction: Extract<Instruction, { verb: "AddFromPile" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const zones = NAMED_PILES[instruction.pile];
  const count = instruction.count == null ? 1 : resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  const seats = instruction.to === "staging" ? [focus.seat] : instruction.who === "eachSeat" ? livingSeats(state) : [instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat];
  // `reveal` (the Harad deck, 144068:B:1, 144032:A:2, 144036:A:2): the top card is revealed (rr.reveal), so its Surge and When Revealed effects resolve, and then enters the staging area or is engaged with the seat; the effect goes on once it is resolved.
  if (instruction.reveal) {
    const seat = seats[0] ?? focus.seat;
    // The deck refills from its discard pile first, as the other reveals do (revealTop); the refusal in pileTravelUnpayable counts that pile too.
    const filled = refillDeck(state, zones, steps);
    const top = topOf(filled, zones.deck);
    if (top === undefined || filled.seats[seat]?.eliminated) return filled;
    return startReveal(markPicked(filled, top), seat, ctx, steps, top, undefined, instruction.to === "engaged");
  }
  let next = state;
  for (const seat of seats) {
    for (let revealed = 0; revealed < count; revealed += 1) {
      const one = revealTop(next, zones, instruction.to, seat, ctx, steps);
      next = one.state;
      if (one.id == null) break;
      next = markPicked(next, one.id);
      if (instruction.attachSource && focus.sourceId != null) next = attachSelf(next, focus.sourceId, one.id, ctx);
    }
  }
  return next;
}

/** "The first player reveals the top facedown card under The Cross-roads and adds it to the staging area to travel here" (144032:A:2, rr.travel): a deck beside the encounter deck with no card to reveal, nor a discard pile to refill it from, cannot pay the cost. */
export function pileTravelUnpayable(state: ScenarioState, instruction: Instruction): boolean {
  if (instruction.verb !== "AddFromPile") return false;
  const zones = NAMED_PILES[instruction.pile];
  return pileOf(state, zones.deck).length + (zones.discard ? pileOf(state, zones.discard).length : 0) === 0;
}

/** "Shuffle the Spiders of Mirkwood encounter set into the encounter deck": every card of the deck goes into the encounter deck, facedown, and the encounter deck is shuffled. */
export function shuffleNamedIntoEncounter(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShufflePileIntoEncounterDeck" }>): ScenarioState {
  let next = state;
  for (const id of [...pileOf(state, NAMED_PILES[instruction.pile].deck)]) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return shuffleEncounterDeck(next);
}
