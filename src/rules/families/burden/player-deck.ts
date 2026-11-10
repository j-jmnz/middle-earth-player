// Rules: mec112.poisoned-counsels-searching-eye, rr.forced (data/rules/entries.json); ledger lines 143072:A:1, 143021:A:1, 143021:A:2.
//
// A burden that functions like a player card (Poisoned Counsels, The Searching Eye): an encounter card with a player card back that sits in a player's deck. It is drawn, held in the hand and discarded
// from the hand or the deck like any player card, and never played (it prints no cost, rr.cost). Its Forced effect hears the draw (`enteredHand`, families/island/hand.ts).
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, withSeat } from "../../core/state.ts";
import { shuffleIds } from "../../core/seed.ts";
import { spawn } from "../../core/zones.ts";

// ShuffleCopyIntoEachDeck: one copy of the card joins each living seat's deck, and the deck is shuffled.
export function shuffleCopyIntoEachDeck(state: ScenarioState, code: string): ScenarioState {
  let next = state;
  for (const seat of livingSeats(state)) {
    next = spawn(next, code, { zone: "deck", seat }).state;
    const held = next.seats[seat];
    if (!held) continue;
    const shuffled = shuffleIds(held.deck, next.seed, next.seedCursor);
    next = { ...withSeat(next, seat, { ...held, deck: shuffled.ids }), seedCursor: shuffled.cursor };
  }
  return next;
}
