// Rules: mec109.multiple-staging-areas, rr.first-player, rr.removed-from-game, rr.ownership-and-control (data/rules/entries.json); the stage 3 and 4 cards, the encounter cards and the
// locations of Breaking of the Fellowship (142063 to 142083).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { eliminateEmpties } from "../../core/eliminate.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { fallenBase, FALLEN_SUFFIX } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats, updateCard } from "../../core/state.ts";
import { raiseFor } from "../../interpret/verbs.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { areaOf, areaSeats, headOf, stagingDest } from "./areas.ts";
import { addTableModifier } from "../encounter/index.ts";
import { ringBearerId } from "../burden/deck.ts";

// The verbs src/catalog/families/breaking.ts adds for the stage 3 and 4 cards and the encounter cards. Null when the verb is not one of them.
export function runCards(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "RevealIfDiscarded":
      return state;
    case "RaiseThreatAtStage":
      return raiseAtStage(state, instruction.amount, focus, ctx, steps);
    case "MoveToLeftArea":
      return moveToLeft(state, focus.sourceId);
    case "MoveToFirstStaging":
      return moveToFirstStaging(state, instruction.target === "picked" ? lastPicked(state) : focus.sourceId);
    case "MoveToOtherPlayerArea":
      return moveToOtherPlayerArea(state, focus.sourceId);
    case "FallIntoEvil":
      return fallIntoEvil(state, focus.sourceId, steps);
    case "ReturnFallenHero":
      return returnFallen(state);
    case "RemoveFromGame":
      if (instruction.card) return removeCard(state, refCard(state, instruction.card, frameScope(state, focus.seat, focus.sourceId)), steps);
      return instruction.self ? (focus.sourceId ? moveCard(state, focus.sourceId, { zone: "removed" }) : state) : removeFromGame(state, lastPicked(state));
    case "LockFirstPlayer":
      return focus.sourceId ? addTableModifier(state, { stat: "firstPlayerLocked", amount: 1, until: "endOfGame" }, focus) : state;
    case "TakeRingBearer":
      return takeRingBearer(state, focus.seat, ctx, steps);
    default:
      return null;
  }
}

// "Each player at this stage raises his threat" (142077:A:1): the seat whose staging area holds the source; every living seat with one staging area.
function raiseAtStage(state: ScenarioState, amount: number, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const owner = focus.sourceId ? areaOf(state, focus.sourceId) : null;
  const seats = state.separate ? (owner == null ? [] : [owner]) : livingSeats(state);
  let next = state;
  for (const seat of seats) {
    if (state.seats[seat]?.eliminated) continue;
    next = raiseFor(next, { verb: "RaiseThreat", amount, who: "actor" }, { ...focus, seat }, ctx, steps);
  }
  return next;
}

// The staging area to the left is the next living seat's (clockwise, as the first player token passes).
function moveToLeft(state: ScenarioState, id: string | null): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  const at = id ? areaOf(state, id) : null;
  if (!id || !card || card.zone !== "staging" || at == null) return state;
  for (let step = 1; step < state.seatCount; step += 1) {
    const index = (at + step) % state.seatCount;
    if (!state.seats[index]?.eliminated) return moveCard(state, id, { zone: "staging", area: index });
  }
  return state;
}

// An enemy in a staging area or engaged goes to the first player's staging area; the enemy engaged with the first player or in no area goes to that area too.
function moveToFirstStaging(state: ScenarioState, id: string | null): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || (card.zone !== "staging" && card.zone !== "engaged")) return state;
  const moved = moveCard(state, id, stagingDest(state, state.firstPlayer));
  return updateCard(moved, id, { controller: state.separate ? state.firstPlayer : null });
}

// MoveToOtherPlayerArea (901703:A:2): the engaged enemy goes to another player's staging area as a staging card. Players who share an area (not separate, or joined) send it to that shared area; with one player, and no other area, it stays engaged.
function moveToOtherPlayerArea(state: ScenarioState, id: string | null): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.zone !== "engaged" || card.controller == null) return state;
  const own = headOf(state, card.controller);
  const other = state.separate ? areaSeats(state).find((seat) => seat !== own) : undefined;
  if (other != null) return updateCard(moveCard(state, id, { zone: "staging", area: other }), id, { controller: other });
  // No other area: another living player at the shared area is the one it is sent to, as a card of that staging area.
  if (livingSeats(state).every((seat) => seat === card.controller)) return state;
  return updateCard(moveCard(state, id, stagingDest(state, card.controller)), id, { controller: state.separate ? own : null });
}

// Fallen Into Evil, attached to a hero: the hero is an enemy in the first player's staging area, its player no longer controlling it.
function fallIntoEvil(state: ScenarioState, sourceId: string | null, steps: EngineStep[]): ScenarioState {
  const source = sourceId ? state.cards[sourceId] : undefined;
  const hero = source?.host ? state.cards[source.host] : undefined;
  if (!source || !hero || hero.zone !== "heroes" || hero.controller == null) return state;
  const seat = hero.controller;
  const slot = Math.max(0, state.seats[seat]?.heroes.indexOf(hero.id) ?? 0);
  let next = moveCard(state, hero.id, stagingDest(state, state.firstPlayer));
  next = updateCard(next, hero.id, { code: hero.code + FALLEN_SUFFIX, owner: seat, controller: state.separate ? state.firstPlayer : null, committed: false, heroSlot: slot });
  // A seat left with no hero is eliminated (rr.player-elimination).
  return eliminateEmpties(next, steps);
}

// Every fallen hero goes back to its owner: one still in play among the owner's heroes, one defeated as an enemy to the owner's discard pile.
function returnFallen(state: ScenarioState): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (!card.code.endsWith(FALLEN_SUFFIX)) continue;
    const owner = card.owner ?? 0;
    const restored = { code: fallenBase(card.code), owner: undefined as number | undefined };
    if (card.zone === "staging" || card.zone === "engaged") {
      const back = moveCard(next, card.id, { zone: "heroes", seat: owner });
      next = updateCard(back, card.id, { ...restored, controller: owner });
    } else if (card.zone === "removed" || card.zone === "setAside") {
      next = updateCard(next, card.id, restored);
    } else {
      const back = moveCard(next, card.id, { zone: "discard", seat: owner });
      next = updateCard(back, card.id, { ...restored, controller: owner });
    }
  }
  return next;
}

// The last picked card leaves the game, and the campaign pool (142074:A:2).
// A card leaves the game where it lies (the card an event names, 02061:B:2): a character leaves play and its attachments with it; a seat left with no hero is eliminated.
function removeCard(state: ScenarioState, id: string | null, steps: EngineStep[]): ScenarioState {
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.zone === "removed") return state;
  return eliminateEmpties(moveCard(state, id, { zone: "removed" }), steps);
}

function removeFromGame(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  if (!card || card.zone === "removed") return state;
  const gone = moveCard(state, id, { zone: "removed" });
  return { ...gone, removedFromPool: [...(gone.removedFromPool ?? []), { code: card.code, seat: null }] };
}

// The Ring-bearer, when one is in play, and each card attached to it pass to the actor (142068:A:2). After stage 2A removed it there is none.
function takeRingBearer(state: ScenarioState, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const heroId = ringBearerId(state, ctx);
  const hero = heroId ? state.cards[heroId] : undefined;
  if (!heroId || !hero || hero.controller == null || hero.controller === seat || !state.seats[seat]) return state;
  const attachments = [...hero.attachments];
  let next = moveCard(state, heroId, { zone: "heroes", seat });
  for (const id of attachments) {
    next = next.cards[id]?.zone === "play" ? moveCard(next, id, { zone: "play", seat }) : updateCard(next, id, { controller: seat });
    next = attachTo(next, id, heroId);
  }
  return eliminateEmpties(next, steps);
}

