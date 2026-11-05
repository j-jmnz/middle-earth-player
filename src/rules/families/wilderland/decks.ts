// Rules: emce.caves-deck, emce.evil-creatures-deck, emce.setup-lost-in-mirkwood (data/rules/entries.json). The decks of Ered Mithrin beside the encounter deck (core/piles.ts NAMED_PILES): shuffled by the Setup, joined by a card, revealed
// from, and the Evil Creatures deck refilled from its own discard pile when it runs out. The deck as a zone is core/piles.ts, the refill is core/decks.ts and the reveal families/encounter/named-decks.ts (the Corsair deck shares them).
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { refillDeck } from "../../core/decks.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { DECKS, NAMED_PILES, pileDealt, pileOf, shufflePile } from "../../core/piles.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { shuffleEncounterDeck } from "../../interpret/verbs.ts";
import { moveCard } from "../../core/zones.ts";
import { revealTop } from "../encounter/named-decks.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { markPicked } from "../play/refs.ts";
import type { Focus } from "../index.ts";
import { spawnIntoPile } from "./kings.ts";

/** The Evil Creatures deck ran out: its own discard pile is shuffled back into it (emce.evil-creatures-deck). Settle keeps the game's deck refilled. */
export function refillEvilCreatures(state: ScenarioState): ScenarioState {
  return refillDeck(state, DECKS.evilCreatures);
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

/** "Shuffle the Spiders of Mirkwood encounter set into the encounter deck": every card of the deck goes into the encounter deck, facedown, and the encounter deck is shuffled. */
export function shuffleNamedIntoEncounter(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShufflePileIntoEncounterDeck" }>): ScenarioState {
  let next = state;
  for (const id of [...pileOf(state, NAMED_PILES[instruction.pile].deck)]) next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down", controller: null });
  return shuffleEncounterDeck(next);
}
