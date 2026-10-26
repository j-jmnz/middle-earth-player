// Rules: rr.active-location, rr.travel, rr.explored, mec109.stage-4 (data/rules/entries.json).
//
// The second active location of The Ring Goes South stage 4 and what limits progress on a location. The table holds
// `extraActiveLocation` while a card in play says there can be 2 active locations; `mustTravel` while the players must travel if
// able. A location holds `progressAfterOthers` / `progressNeedsRingBearer` (Doors of Durin), and `progressCap` (Snowdrifts) with the
// progress it took this round in `progressPlaced`. These are flags the constant records set, so they are read from the state alone.
import type { EngineStep } from "../intents.ts";
import { ruleCause } from "../cause.ts";
import { destroyCard } from "../keywords.ts";
import { printedOf, type PrintedCard } from "../printed.ts";
import { questPointsOf } from "../quest.ts";
import type { ScenarioState } from "../state.ts";
import { flagged, heldAmount, updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";

type Cards = ReadonlyMap<string, PrintedCard>;
export type Slot = "activeLocation" | "secondActiveLocation";

// The slot a location traveled to, or made active by an effect, goes in; null when both are taken (or the one is, with no second).
export function freeSlot(state: ScenarioState): Slot | null {
  if (!state.activeLocation) return "activeLocation";
  if (heldAmount(state, "table", "extraActiveLocation") > 0 && !state.secondActiveLocation) return "secondActiveLocation";
  return null;
}

// The players must travel to a location if able (mec109.stage-4).
export function mustTravel(state: ScenarioState): boolean {
  return heldAmount(state, "table", "mustTravel") > 0;
}

// The active locations, the first slot first.
export function activeLocations(state: ScenarioState): string[] {
  return [state.activeLocation, state.secondActiveLocation].filter((id): id is string => id != null);
}

// The location becomes an active location in the free slot. With none free the one in the last slot goes back to the staging area
// and the new one takes its place (rr.active-location): an active location is replaced, never added to, without a second slot.
export function makeActiveIn(state: ScenarioState, id: string): ScenarioState {
  const slot = freeSlot(state);
  if (slot) return moveCard(state, id, { zone: slot });
  const target: Slot = state.secondActiveLocation ? "secondActiveLocation" : "activeLocation";
  const old = state[target];
  const cleared = old && old !== id ? moveCard(state, old, { zone: "staging" }) : state;
  return moveCard(cleared, id, { zone: target });
}

// The hero with the Ring-bearer trait a player controls, or null when it is facedown under the Watcher.
export function controlledRingBearer(state: ScenarioState, cards: Cards): string | null {
  for (const seat of state.seats) {
    for (const id of seat.heroes) {
      const code = state.cards[id]?.code;
      if (code && printedOf(cards, code).traits.includes("Ring-bearer")) return id;
    }
  }
  return null;
}

// How much more progress the location can take now: what it still needs (all of it when it has no quest points) less what a
// cap leaves out, and nothing while a gate holds it back (142030:A:2, 142036:A:1).
export function progressRoom(state: ScenarioState, id: string, cards: Cards): number {
  const location = state.cards[id];
  if (!location) return 0;
  const points = questPointsOf(state, location, cards);
  let room = points == null ? Number.MAX_SAFE_INTEGER : Math.max(0, points - location.progress);
  const cap = heldAmount(state, id, "progressCap");
  if (cap > 0) room = Math.min(room, Math.max(0, cap - heldAmount(state, id, "progressPlaced")));
  if (flagged(state, id, "progressNeedsRingBearer")) {
    const bearer = controlledRingBearer(state, cards);
    if (bearer == null || state.cards[bearer]?.controller !== state.firstPlayer) return 0;
  }
  if (flagged(state, id, "progressAfterOthers") && activeLocations(state).some((other) => other !== id && printedOf(cards, state.cards[other]?.code ?? "").questPoints != null)) return 0;
  return room;
}

// A card that holds `loseAtDamage` damage tokens loses the game (142030:A:3: "If there are 9 damage tokens here, the players lose the
// game"). Read each time the engine settles.
export function damageLoss(state: ScenarioState, cards: Cards): ScenarioState {
  if (state.lost || state.stageCleared) return state;
  for (const card of Object.values(state.cards)) {
    const limit = heldAmount(state, card.id, "loseAtDamage");
    if (limit > 0 && card.damage >= limit) return { ...state, lost: true, lossReason: `${printedOf(cards, card.code).name} holds ${card.damage} damage`, window: null };
  }
  return state;
}

// Notes progress placed on a location this round, for a cap.
export function notePlaced(state: ScenarioState, id: string, amount: number): ScenarioState {
  if (heldAmount(state, id, "progressCap") <= 0 || amount <= 0) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "progressPlaced", amount, until: "endOfRound" }] };
}

// Progress from questing goes on the active locations first (rr.active-location): each takes what it can, a location that is held
// back goes after the ones that are not, and a full one is explored. Returns the progress left for the quest card.
export function placeOnActive(state: ScenarioState, amount: number, cards: Cards, steps: EngineStep[]): { state: ScenarioState; remaining: number } {
  let next = state;
  let remaining = amount;
  for (let guard = 0; guard < 4 && remaining > 0; guard += 1) {
    const id = activeLocations(next).find((candidate) => printedOf(cards, next.cards[candidate]?.code ?? "").questPoints != null && progressRoom(next, candidate, cards) > 0);
    const location = id ? next.cards[id] : undefined;
    if (!id || !location) break;
    const placed = Math.min(remaining, progressRoom(next, id, cards));
    next = notePlaced(updateCard(next, id, { progress: location.progress + placed }), id, placed);
    steps.push({ kind: "progress", targetId: id, amount: placed, cause: ruleCause("rr.step-3-4") });
    remaining -= placed;
    const points = questPointsOf(next, location, cards);
    if (points != null && location.progress + placed >= points) next = destroyCard(next, id, cards, steps, true);
  }
  return { state: next, remaining };
}
