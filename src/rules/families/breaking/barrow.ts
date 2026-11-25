// Rules: mec108.create-staging-area, mec109.multiple-staging-areas (data/rules/entries.json); Fog on the Barrow-downs, ledger lines 148007:A:2 (Great Barrow), 148004:A:1 and 148004:B:2 (stage 4A and 4B), 148003:B:3 (stage 3B).
//
// A partial split. A player who reveals a Great Barrow leaves the stage the players share (3B) for a stage 4A of his own, with a staging area of his own; the others stay at 3B, whose staging area keeps every encounter card it had, the Great Barrow included.
// The shape it uses is Breaking of the Fellowship's (areas.ts): `ScenarioState.separate`, one `Seat.staging`, `Seat.stage` and `Seat.active` for each seat that has an area, with `ScenarioState.isolated` set so each area resolves as if only its players were in the game (`isolatedAreas`).
// - A seat that still holds the shared stage keeps 3B in its own `Seat.stage`; a seat that is trapped holds a copy of stage 4A.
// - While no player is at 3B it is parked: its stage is `ScenarioState.questStage` (null while separate otherwise), its staging cards are in `ScenarioState.staging` and in no seat's list, and its active location is back in that staging area. No seat is at it, so no phase resolves for it.
// - A seat that returns (its 4B was defeated) takes the parked stage, or joins the seat that holds 3B; once every living seat shares one area the state folds back to the shared shape (`foldAreas`), and the ordinary code runs again.
import type { ScenarioState } from "../../core/state.ts";
import { flagged, livingSeats, updateCard, withSeat } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { headOf, mirrorActive, parkedStage, sharedStaging } from "./areas.ts";
import { noteBypassedStage } from "../quest/branch.ts";

// The quest deck's card with the printed code.
function inDeck(state: ScenarioState, code: string): string | undefined {
  return state.questDeck.find((id) => state.cards[id]?.code === code);
}

// A seat's area ends up in nobody's list: the cards stay in the staging area, the stage is the parked one, the active location goes back to the staging area.
function park(state: ScenarioState, seat: number): ScenarioState {
  const owner = state.seats[seat];
  if (!owner) return state;
  let next = state;
  if (owner.active) next = moveCard(next, owner.active, { zone: "staging" });
  const left = next.seats[seat];
  if (left) next = withSeat(next, seat, { ...left, staging: [] });
  const stage = owner.stage;
  if (stage) next = updateCard(moveCard(next, stage, { zone: "questStage" }), stage, { controller: null });
  return mirrorActive(next);
}

// The acting seat leaves the stage the players share. Not separate yet: the other living seat (if any) takes the shared stage, staging area and active location as its own, and the areas are isolated from now on; separate already: the seat holds the
// shared stage and parks it. A card of the shared staging area stays with the stage, not with the seat.
function leaveShared(state: ScenarioState, seat: number, keepActive = false): ScenarioState {
  if (state.separate) return park(state, seat);
  const other = livingSeats(state).find((index) => index !== seat);
  const separate: ScenarioState = { ...state, separate: true, isolated: true };
  const shared = state.questStage;
  const active = [state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null);
  if (other == null) {
    // Alone: the stage is parked as it is, the active location back in the staging area (`keepActive`: the seat keeps it as its own).
    const own = state.seats[seat];
    const kept = keepActive ? active[0] : undefined;
    let next = kept && own ? withSeat(separate, seat, { ...own, active: kept }) : separate;
    for (const id of active) if (id !== kept) next = moveCard(next, id, { zone: "staging" });
    return mirrorActive(next);
  }
  const holder = state.seats[other];
  if (!holder) return separate;
  let next = withSeat(separate, other, { ...holder, staging: [...state.staging], ...(shared ? { stage: shared } : {}), ...(active[0] ? { active: active[0] } : {}) });
  next = { ...next, questStage: null };
  if (shared) next = updateCard(next, shared, { controller: other });
  return mirrorActive(next);
}

// SplitToOwnStage (148007:A:2): the stage 4A copy is the acting seat's own stage, side B up; the caller resolves its When Revealed effects for the seat (breaking/index.ts). Null when the seat is not at the shared stage, is eliminated, or no copy is left in the quest deck.
export function splitOff(state: ScenarioState, code: string, seat: number, keepActive = false): { state: ScenarioState; stageId: string } | null {
  const id = inDeck(state, code);
  const owner = state.seats[seat];
  if (!id || !owner || owner.eliminated) return null;
  if (state.separate) {
    const stage = owner.stage ? state.cards[owner.stage] : undefined;
    if (!stage || stage.code === code) return null;
  }
  const shared = state.separate ? owner.stage : state.questStage;
  const left = leaveShared(state, seat, keepActive);
  const placed = mirrorActive(updateCard(moveCard(left, id, { zone: "questStage", seat }), id, { face: "B", controller: seat, progress: 0 }));
  // The stage it left is not defeated: it stays in play for the others, so no "when this stage is defeated" effect hears the advance (emce.bypassing).
  return { state: shared ? noteBypassedStage(placed, id, shared) : placed, stageId: id };
}

// Every living seat shares one area (`head` holds it): the stage, the staging cards and the active location are the shared ones again and the ordinary code runs.
export function foldAreas(state: ScenarioState, head: number): ScenarioState {
  const owner = state.seats[head];
  if (!owner) return state;
  const seats: [typeof state.seats[0], typeof state.seats[1]] = [state.seats[0], state.seats[1]];
  for (const index of [0, 1] as const) {
    const { stage: _stage, active: _active, joined: _joined, ...rest } = seats[index];
    seats[index] = { ...rest, staging: [] };
  }
  const { separate: _separate, isolated: _isolated, travelDone: _travel, ...plain } = state;
  return { ...plain, seats, questStage: owner.stage ?? null, activeLocation: owner.active ?? null, secondActiveLocation: null };
}

// The state folded when the living seats all share one area and no stage is parked; otherwise as it is.
export function foldIfShared(state: ScenarioState): ScenarioState {
  if (!state.separate || !state.isolated || parkedStage(state) != null) return state;
  const heads = new Set(livingSeats(state).map((index) => headOf(state, index)));
  const only = [...heads][0];
  return heads.size === 1 && only != null && state.seats[only]?.stage != null ? foldAreas(state, only) : state;
}

// ReturnToSharedStage (148004:B:2): the acting seat's stage (4B) goes back to the quest deck with no progress, the enemies, locations and active location of its area join the staging area of the stage with the printed code, and the seat is at that stage
// again: the seat that holds it is joined, or the seat takes the parked stage. Engaged enemies stay engaged. The state folds back to the shared one once every living seat is at the stage. Nothing happens when the seat is not at another stage or the stage is gone.
export function returnToSharedStage(state: ScenarioState, code: string, seat: number): ScenarioState {
  const owner = state.seats[seat];
  const mine = owner?.stage ? state.cards[owner.stage] : undefined;
  if (!state.separate || !owner || owner.eliminated || !mine || mine.code === code) return state;
  const holder = livingSeats(state).find((index) => index !== seat && state.cards[state.seats[index]?.stage ?? ""]?.code === code);
  const parked = parkedStage(state);
  if (holder == null && !(parked != null && state.cards[parked]?.code === code)) return state;
  let next = state;
  if (next.stageHeld === mine.id) {
    const { stageHeld: _held, ...rest } = next;
    next = rest;
  }
  // What joins 3B's staging area: its own unlisted cards (parked), and this area's cards and active location.
  const unlisted = holder == null ? sharedStaging(next) : [];
  const area = holder ?? seat;
  for (const id of [...(owner.active ? [owner.active] : []), ...owner.staging]) next = moveCard(next, id, { zone: "staging", area });
  next = updateCard(moveCard(next, mine.id, { zone: "questDeck" }), mine.id, { face: "A", controller: null, progress: 0 });
  if (holder != null) {
    const left = next.seats[seat];
    return foldIfShared(left ? withSeat(next, seat, { ...left, joined: holder }) : next);
  }
  const taker = next.seats[seat];
  if (taker && parked) {
    next = withSeat(next, seat, { ...taker, staging: [...taker.staging, ...unlisted] });
    next = updateCard(moveCard(next, parked, { zone: "questStage", seat }), parked, { controller: seat });
  }
  return foldIfShared(mirrorActive(next));
}

// Whether the stage stays in play when the player at it is eliminated (a stage that holds the flag `staysInPlay`, 148003:B:2): it is parked, not discarded with its area.
export function staysInPlay(state: ScenarioState, stageId: string): boolean {
  return flagged(state, stageId, "staysInPlay");
}

// An eliminated seat's area while the areas are isolated: the stage that stays in play (3B) is parked with its cards; any other stage (a 4A copy) goes back to the quest deck, and its staging cards and active location to the encounter discard pile. The
// state folds when the living seats then share one area.
export function discardIsolated(state: ScenarioState, seat: number): ScenarioState {
  const owner = state.seats[seat];
  if (!owner) return state;
  let next = state;
  if (owner.stage && staysInPlay(state, owner.stage)) next = park(state, seat);
  else {
    for (const id of owner.staging) next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
    if (owner.active) next = updateCard(moveCard(next, owner.active, { zone: "encounterDiscard" }), owner.active, { face: "up", controller: null });
    if (owner.stage) next = updateCard(moveCard(next, owner.stage, { zone: "questDeck" }), owner.stage, { face: "A", controller: null, progress: 0 });
    // A defeated stage 4B still held for its Forced effect leaves with it, so the copy, used again, is held anew.
    if (owner.stage && next.stageHeld === owner.stage) {
      const { stageHeld: _held, ...rest } = next;
      next = rest;
    }
  }
  return foldIfShared(mirrorActive(next));
}
