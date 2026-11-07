// Rules: mec112.setup-the-uruk-hai, mec112.setup-helms-deep, mec112.setup-the-road-to-isengard, mec112.setup-the-passage-of-the-marshes, mec112.setup-journey-to-the-cross-roads, mec112.setup-shelobs-lair,
// rr.campaign-setup-checklist, rr.burdens (data/rules/entries.json). The Two Towers' campaign card Setup lines the Campaign Setup Checklist deals at step 6 (src/catalog/families/campaign.ts): cards removed from the
// pool, burden sets left out of the decks, a copy shuffled into each deck, and the choice between a copy and a resource. checklist.ts calls these on its working seats and pool. Pure.
import type { Instruction } from "../catalog/boundary.ts";

import type { PoolCard } from "./log.ts";

// The part of a seat these lines change.
export type SeatDeal = { deck: string[]; attachments: { host: string; code: string }[]; chosen?: string[]; resources?: number };

type Verb<V extends Instruction["verb"]> = Extract<Instruction, { verb: V }>;

/** RemovePoolCards: every pool entry with one of the codes leaves the pool (in place), and with it any copy already put on a hero. Returns the codes removed, once for each entry. */
export function removePoolCards(pool: PoolCard[], seats: SeatDeal[], instruction: Verb<"RemovePoolCards">): string[] {
  const removed: string[] = [];
  for (let at = pool.length - 1; at >= 0; at -= 1) {
    const card = pool[at];
    if (card && instruction.codes.includes(card.code)) {
      pool.splice(at, 1);
      removed.unshift(card.code);
    }
  }
  for (const seat of seats) seat.attachments = seat.attachments.filter((item) => !instruction.codes.includes(item.code));
  return removed;
}

/** The burden sets a scenario's Setup leaves out of the decks, and whether a player's deck is among them. */
export type BurdenRemoval = { sets: readonly string[]; playerDecks: boolean };

/** Whether a pool card is a burden of a removed set that the deal it is headed for leaves out: an encounter-backed one always, a player-deck one (backed by the player's side, or shuffled in after the starting hand) only when the line names each player's deck. */
export function burdenLeftOut(removals: readonly BurdenRemoval[], card: PoolCard): boolean {
  if (card.burdenSet == null) return false;
  const set = card.burdenSet;
  const forPlayer = card.back === "player" || card.afterHand === true;
  return removals.some((removal) => removal.sets.includes(set) && (!forPlayer || removal.playerDecks));
}

/** ShuffleIntoEachDeck: one copy of the card goes into every seat's deck. */
export function shuffleIntoEachDeck(seats: SeatDeal[], instruction: Verb<"ShuffleIntoEachDeck">): void {
  for (const seat of seats) seat.deck.push(instruction.code);
}

/**
 * ChooseCopyOrResources: each seat in turn answers the card's code (a copy goes into its deck and is recorded as chosen at Setup) or `resources` (each of its heroes starts with that many more resources).
 * `take` asks for the answer and says null when the step needs one; the lines describe what was done.
 */
export function chooseCopyOrResources(seats: SeatDeal[], instruction: Verb<"ChooseCopyOrResources">, take: (legal: readonly string[], seat: number) => string | null, name: (code: string) => string): string[] {
  const did: string[] = [];
  for (const [index, seat] of seats.entries()) {
    const answer = take([instruction.code, "resources"], index);
    if (answer == null) return did;
    if (answer === "resources") {
      seat.resources = (seat.resources ?? 0) + instruction.resources;
      did.push(`Seat ${index + 1} adds ${instruction.resources} resource${instruction.resources === 1 ? "" : "s"} to each of its heroes' pools.`);
      continue;
    }
    seat.deck.push(instruction.code);
    seat.chosen = [...(seat.chosen ?? []), instruction.code];
    did.push(`Seat ${index + 1} shuffles a copy of ${name(instruction.code)} into its deck.`);
  }
  return did;
}
