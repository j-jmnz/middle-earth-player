// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules (data/rules/entries.json); stage 2B and the stage 3 cards of Breaking of the
// Fellowship (142062:B:1, 142063:A:1 to 142066:A:1).
//
// Separate staging. From stage 2B each seat has a staging area and a quest stage of its own:
//
// - `Seat.staging` lists the encounter cards in that seat's area; `Seat.stage` is its quest stage (the stage 3 and 4 cards). `ScenarioState.separate`
//   is true from then on. Every card in an area is still in the zone `staging`, and `ScenarioState.staging` still lists every staging card in any
//   area plus the cards in no area yet (the shared staging area stage 2B empties), so the code that does not care which area reads it unchanged.
//   `ScenarioState.questStage`, the shared stage, is null while stages are separate.
// - Each seat has an active location of its own at its stage (`Seat.active`, the card in the zone activeLocation): the quest only applies to a player's own stage
//   (mec109.multiple-staging-areas), and the active location takes that quest's progress first (rr.active-location). `ScenarioState.activeLocation` and
//   `secondActiveLocation` mirror seat 0's and seat 1's active location, so code that reads them outside a seat's view still sees them; in a seat's view
//   `activeLocation` is that seat's and `secondActiveLocation` is null.
// - A game that never separates has no `separate`, empty seat lists and no `Seat.stage`, so each function here returns what the shared state holds.
// - The engine asks per seat through `viewOf`: the state as that seat sees it, with `staging` its own area and `questStage` its own stage, so
//   the threat total, the engagement checks, the travel and pick helpers and the quest's progress and advance read the seat's staging area and stage
//   without knowing about seats. `mergeView` writes what a view changed back. Nothing is cached on the view.
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import type { Destination } from "../zones.ts";
import { moveCard } from "../zones.ts";

export function isSeparate(state: ScenarioState): boolean {
  return state.separate === true;
}

// The encounter cards in the seat's staging area; the shared staging area when stages are not separate.
export function stagingOf(state: ScenarioState, seat: number): readonly string[] {
  return state.separate ? (state.seats[seat]?.staging ?? []) : state.staging;
}

// The seat whose staging area holds the card, or null when it is in no area (the shared staging area, or not in staging).
export function areaOf(state: ScenarioState, id: string): number | null {
  if (!state.separate) return null;
  const at = state.seats.findIndex((seat, index) => index < state.seatCount && seat.staging.includes(id));
  return at < 0 ? null : at;
}

// The staging cards in no seat's area: the shared staging area before stage 2B deals it out.
export function sharedStaging(state: ScenarioState): readonly string[] {
  if (!state.separate) return state.staging;
  const owned = new Set(state.seats.flatMap((seat) => seat.staging));
  return state.staging.filter((id) => !owned.has(id));
}

// The seat's quest stage, or the shared one when stages are not separate.
export function stageOf(state: ScenarioState, seat: number): string | null {
  return state.separate ? (state.seats[seat]?.stage ?? null) : state.questStage;
}

// The seat whose stage the card is, or null.
export function stageSeat(state: ScenarioState, id: string): number | null {
  if (!state.separate) return null;
  // On a seat's view its stage is the view's `questStage`, and the seat's own record is written back by mergeView.
  if (state.viewSeat != null && state.questStage === id) return state.viewSeat;
  const at = state.seats.findIndex((seat, index) => index < state.seatCount && seat.stage === id);
  return at < 0 ? null : at;
}

// Where a card the seat puts into "the staging area" goes: that seat's own area once stages are separate.
export function stagingDest(state: ScenarioState, seat: number): Destination {
  return state.separate ? { zone: "staging", area: seat } : { zone: "staging" };
}

// The state as the seat sees it: its own staging area and its own stage in the shared fields. Not separate: the state itself.
export function viewOf(state: ScenarioState, seat: number | undefined): ScenarioState {
  if (!state.separate || seat == null) return state;
  const owner = state.seats[seat];
  if (!owner) return state;
  return { ...state, staging: owner.staging, questStage: owner.stage ?? null, activeLocation: owner.active ?? null, secondActiveLocation: null, viewSeat: seat };
}

// The seat's active location, or the shared one when stages are not separate.
export function activeOf(state: ScenarioState, seat: number): string | null {
  return state.separate ? (state.seats[seat]?.active ?? null) : state.activeLocation;
}

// The shared slots mirror the seats' active locations (see the header).
function mirrored(state: ScenarioState): ScenarioState {
  const first = state.seats[0].active ?? null;
  const second = state.seats[1].active ?? null;
  return state.activeLocation === first && state.secondActiveLocation === second ? state : { ...state, activeLocation: first, secondActiveLocation: second };
}

// What a function did to a view of the seat, written back: the seat's own area and stage take the view's, the other seats' areas are the view's
// seats, and the shared fields (the stage, the union of the staging cards) are rebuilt from the original. A card the view moved out of staging
// leaves every list.
export function mergeView(state: ScenarioState, seat: number | undefined, view: ScenarioState): ScenarioState {
  if (!state.separate || seat == null || !state.seats[seat]) return view;
  const was = state.seats[seat].staging;
  const now = view.staging;
  const seats: [typeof view.seats[0], typeof view.seats[1]] = [view.seats[0], view.seats[1]];
  const owner = seats[seat];
  const { stage: _old, active: _active, ...rest } = owner;
  seats[seat] = { ...rest, staging: now, ...(view.questStage != null ? { stage: view.questStage } : {}), ...(view.activeLocation != null ? { active: view.activeLocation } : {}) };
  const kept = state.staging.filter((id) => !was.includes(id) || now.includes(id));
  const added = now.filter((id) => !state.staging.includes(id));
  const { viewSeat: _seat, ...plain } = view;
  const merged: ScenarioState = { ...plain, seats, questStage: state.questStage, staging: [...kept, ...added] };
  return mirrored({ ...merged, staging: merged.staging.filter((id) => merged.cards[id]?.zone === "staging") });
}

// Runs `act` on the seat's view and writes the result back.
export function withView(state: ScenarioState, seat: number | undefined, act: (view: ScenarioState) => ScenarioState): ScenarioState {
  if (!state.separate || seat == null) return act(state);
  return mergeView(state, seat, act(viewOf(state, seat)));
}

// An eliminated seat's stage and the encounter cards at it are discarded (mec109.multiple-staging-areas): the cards in its staging area, its active location, go to the
// encounter discard pile and its stage card to the set-aside pile, as a defeated stage does. Nothing happens when the seat has neither.
export function discardArea(state: ScenarioState, seat: number): ScenarioState {
  const owner = state.seats[seat];
  if (!state.separate || !owner) return state;
  let next = state;
  for (const id of owner.staging) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  if (owner.active) next = updateCard(moveCard(next, owner.active, { zone: "encounterDiscard" }), owner.active, { face: "up", controller: null });
  if (owner.stage) next = moveCard(next, owner.stage, { zone: "setAside" });
  return next;
}
