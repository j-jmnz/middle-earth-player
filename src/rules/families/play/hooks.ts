// Rules: rr.doomed-x, rr.destroy, rr.in-play-and-out-of-play, rr.triggering-condition (data/rules/entries.json).
//
// The small reads the shared engine files make into the play family: which events a trigger hears, the threat a seat is
// treated as having, and the events a doomed raise and a discard from play announce. Only state types and the event queue are
// imported here, so the lowest engine files (zones.ts, keywords.ts, listen.ts) can call it.
import type { Instruction, Trigger } from "../../../catalog/boundary.ts";

import type { Cause } from "../../core/cause.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { livingSeats, modifierActive } from "../../core/state.ts";

// Whether an effect's trigger hears an event: its own trigger, or either half of "enters or leaves play" (Gwaihir, 22108:A:3).
export function triggerHears(trigger: Trigger | undefined, heard: Trigger): boolean {
  return trigger === heard || (trigger === "enteredOrLeftPlay" && (heard === "enteredPlay" || heard === "leftPlay"));
}

// The threat a seat is treated as having: its dial, or less while a `threatCeiling` it holds is lower ("Until the end of the
// phase, if your threat is higher than 20, treat your threat as if it is 20", 12011:A:2). The dial itself does not move.
export function seatThreat(state: ScenarioState, seat: number): number {
  const threat = state.seats[seat]?.threat ?? 0;
  let ceiling = threat;
  for (const modifier of state.modifiers) {
    if (modifier.stat === "threatCeiling" && modifier.instanceId === `seat:${seat}` && modifierActive(state, modifier)) ceiling = Math.min(ceiling, modifier.amount);
  }
  return ceiling;
}

// The seats still in the game that share the highest threat (rr.threat-threat-dial, 01080:A:1: "the player with the highest threat level").
export function highestThreatSeats(state: ScenarioState): number[] {
  const living = livingSeats(state);
  const top = Math.max(...living.map((seat) => seatThreat(state, seat)));
  return living.filter((seat) => seatThreat(state, seat) === top);
}

// The heroes an AttachSelf card to a hero may go to, before the ones that already hold a copy are left out: those of the seats the card names
// ("the hero with the highest threat cost", 41043:A:2: the printed threat cost is the greatest among every player's heroes, a tie keeps each).
export function attachHeroHosts(state: ScenarioState, to: Extract<Instruction, { verb: "AttachSelf" }>["to"], itemSeat: number, cards: ReadonlyMap<string, PrintedCard>): string[] {
  if (to.kind !== "hero") return [];
  // `picked`: the caller passes the picked player as `itemSeat` (effect-frames.ts attachSeat).
  const seats = to.control === "any" || to.control === "highestThreatCost" ? livingSeats(state) : to.control === "highestThreat" ? highestThreatSeats(state) : [itemSeat];
  const printed = (id: string): PrintedCard => printedOf(cards, state.cards[id]?.code ?? "");
  const heroes = seats.flatMap((seat) => state.seats[seat]?.heroes ?? []);
  const top = to.control === "highestThreatCost" ? Math.max(...heroes.map((id) => printed(id).threat ?? 0)) : null;
  return heroes.filter((id) => (top == null || (printed(id).threat ?? 0) === top) && (to.exceptSphere == null || printed(id).sphere !== to.exceptSphere));
}

// The seat that chooses the host of an AttachSelf card that goes to a hero: the first player when it may go to any player's hero, the
// player with the highest threat when the card says so (a tie is the first player's to settle), and otherwise the seat the effect runs for.
export function attachHostChooser(state: ScenarioState, instruction: Instruction, itemSeat: number): number {
  if (instruction.verb !== "AttachSelf" || instruction.to.kind !== "hero") return itemSeat;
  if (instruction.to.control === "any" || instruction.to.control === "highestThreatCost") return state.firstPlayer;
  if (instruction.to.control !== "highestThreat") return itemSeat;
  const highest = highestThreatSeats(state);
  return highest.length === 1 ? (highest[0] ?? itemSeat) : highest.length > 1 ? state.firstPlayer : itemSeat;
}

// A threat raise the doomed keyword caused is announced to "After a player raises his threat from the doomed keyword"
// (22057:A:2).
export function doomedRaised(state: ScenarioState, seat: number, cause: Cause): ScenarioState {
  return !state.lost && "rule" in cause && cause.rule === "rr.doomed-x" ? queueEvent(state, { trigger: "doomedRaised", seat }) : state;
}

// A player card that was in play and is now in its owner's discard pile, not destroyed by damage, was discarded from play by
// a card effect ("After a Rohan ally is discarded from play by a card effect", 10141:A:1, 144007:A:1): a card destroyed is not
// discarded (rr.destroy). Every card hears it (the event's subject).
export function discardedFromPlay(state: ScenarioState, before: CardInstance, byDamage: boolean): ScenarioState {
  const after = state.cards[before.id];
  // A lost game is over: nothing answers any more.
  if (byDamage || state.lost || before.controller == null || after?.zone !== "discard" || (before.zone !== "play" && before.zone !== "heroes")) return state;
  return queueEvent(state, { trigger: "discardedFromPlay", seat: before.controller, subject: before.id });
}
