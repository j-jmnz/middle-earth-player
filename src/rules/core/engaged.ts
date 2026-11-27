// Rules: rr.engaged, dwd.durins-bane (data/rules/entries.json).
//
// "Engaged with" as the cards that count, choose or attack through it read it: an enemy in an engagement area, or one in the staging area
// that is considered engaged with a player (the Watcher in the Water with each player, the Balrog and Bolg with the first player, Durin's Bane
// with each player whose threat is 1 or greater, The Black Serpent with each player who controls an objective). FAQ 1.50 says such an enemy does not engage anyone, so no engagement event is made for it.
import { flagged, livingSeats, type ScenarioState } from "./state.ts";

// The seats a staging enemy is considered engaged with, as the immediate attacks of an encounter card read them ("each enemy engaged with a player", 132064:A:1; rr.engaged): every seat for the Watcher, the first player for the Balrog and Bolg, the seats with a threat of 1 or more for Durin's Bane. An enemy that only attacks through a relay (viaRelay) is not engaged with anyone.
export function consideredEngagedSeats(state: ScenarioState, id: string, among: number[]): number[] {
  if (state.cards[id]?.zone !== "staging") return [];
  return among.filter((seat) => flagged(state, id, "engagedWithAll") || (flagged(state, id, "engagedWithFirst") && seat === state.firstPlayer) || engagedWithThreatening(state, id, seat) || engagedWithClaimers(state, id, seat));
}

// The seat an enemy is engaged with, or null while it is in the staging area, gone or no enemy (rr.engaged). Only an enemy in an engagement area has one: `considered` engagement of a staging enemy names no seat here.
export function engagedSeat(state: ScenarioState, id: string): number | null {
  const card = state.cards[id];
  return card?.zone === "engaged" ? card.controller : null;
}

// An enemy engaged with the seat (`you`) or with another player (`other`): one in an engagement area, or one in the staging area that is considered engaged with that player (rr.engaged; a pick's and a condition's `engaged`).
export function engagedAs(state: ScenarioState, id: string, engaged: "you" | "other", seat: number): boolean {
  const card = state.cards[id];
  if (!card) return false;
  if (card.zone === "engaged") return engaged === "you" ? card.controller === seat : card.controller !== seat;
  return consideredEngagedSeats(state, id, engaged === "you" ? [seat] : livingSeats(state).filter((other) => other !== seat)).length > 0;
}

// Durin's Bane: considered engaged with a seat while its threat is 1 or greater, read live (04150:A:2, dwd.durins-bane).
export function engagedWithThreatening(state: ScenarioState, id: string, seat: number): boolean {
  return state.cards[id]?.zone === "staging" && flagged(state, id, "engagedWithThreatening") && (state.seats[seat]?.threat ?? 0) >= 1 && state.seats[seat]?.eliminated !== true;
}

// The Black Serpent on stage 2B: considered engaged with a seat while that player controls an objective (claimed, attached to a hero), read live (17107:B:2, rr.engaged). Its stage has no other objective than the Harad ones.
export function engagedWithClaimers(state: ScenarioState, id: string, seat: number): boolean {
  return state.cards[id]?.zone === "staging" && flagged(state, id, "engagedWithClaimers") && state.seats[seat]?.eliminated !== true && Object.values(state.cards).some((card) => card.claimed === true && card.zone === "attached" && card.controller === seat);
}
