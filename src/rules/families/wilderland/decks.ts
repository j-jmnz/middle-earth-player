// Rules: emce.caves-deck, emce.evil-creatures-deck, emce.setup-lost-in-mirkwood (data/rules/entries.json). The decks of Ered Mithrin beside the encounter deck (core/piles.ts NAMED_PILES): shuffled by the Setup, joined by a card, revealed
// from, and the Evil Creatures deck refilled from its own discard pile when it runs out. The deck as a zone is core/piles.ts, the refill and reveal are core/decks.ts (the Corsair deck shares them).
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { refillDeck, revealTop } from "../../core/decks.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { DECKS, NAMED_PILES, pileOf, shufflePile } from "../../core/piles.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { shuffleEncounterDeck } from "../../interpret/verbs.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

/** The Evil Creatures deck ran out: its own discard pile is shuffled back into it (emce.evil-creatures-deck). Settle keeps the game's deck refilled. */
export function refillEvilCreatures(state: ScenarioState): ScenarioState {
  return refillDeck(state, DECKS.evilCreatures, state.piles?.evilCreaturesDeck !== undefined);
}

/** "Create the Caves deck" and its like: the dealt cards shuffled together. A deck the scenario did not deal is left alone. */
export function shuffleNamed(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShufflePile" }>): ScenarioState {
  const zone = NAMED_PILES[instruction.pile].deck;
  return state.piles?.[zone] === undefined ? state : shufflePile(state, zone);
}

/** "Shuffle Abandoned Ruin into the Caves deck": a new copy joins the deck, which is shuffled. */
export function shuffleIntoNamed(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShuffleIntoPile" }>): ScenarioState {
  const zone = NAMED_PILES[instruction.pile].deck;
  return shufflePile(spawn(state, instruction.code, { zone }).state, zone);
}

/** "Add the top card of the Evil Creatures deck to the staging area" (emce.evil-creatures-deck): `count` cards for each seat the verb names, each entering play. */
export function addFromNamed(state: ScenarioState, instruction: Extract<Instruction, { verb: "AddFromPile" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const zones = NAMED_PILES[instruction.pile];
  const count = instruction.count == null ? 1 : resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  const seats = instruction.to === "staging" ? [focus.seat] : instruction.who === "eachSeat" ? livingSeats(state) : [instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat];
  let next = state;
  for (const seat of seats) {
    for (let revealed = 0; revealed < count; revealed += 1) {
      const one = revealTop(next, zones, next.piles?.[zones.deck] !== undefined, instruction.to, seat, ctx, steps);
      next = one.state;
      if (one.id == null) break;
    }
  }
  return next;
}

/** "Shuffle the Spiders of Mirkwood encounter set into the encounter deck": every card of the deck goes into the encounter deck, facedown, and the encounter deck is shuffled. */
export function shuffleNamedIntoEncounter(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShufflePileIntoEncounterDeck" }>): ScenarioState {
  let next = state;
  for (const id of [...pileOf(state, NAMED_PILES[instruction.pile].deck)]) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return shuffleEncounterDeck(next);
}
