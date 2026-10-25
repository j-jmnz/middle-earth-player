// Rules: rr.in-play-and-out-of-play, rr.discard-pile-and-victory-display (data/rules/entries.json).
import type { CardFace, CardInstance, ScenarioState, ZoneName } from "./state.ts";
import { inPlay, updateCard, withSeat } from "./state.ts";

export type Destination =
  | { zone: "deck" | "hand" | "discard" | "heroes" | "play" | "engaged" | "seatStaging"; seat: number }
  | { zone: "seatQuest"; seat: number }
  | { zone: "staging" | "encounterDeck" | "encounterDiscard" | "burdenDeck" | "victory" | "setAside" | "removed" | "questDeck" }
  | { zone: "activeLocation" | "secondActiveLocation" | "questStage" }
  | { zone: "shadow"; enemyId: string }
  | { zone: "attached" }
  | { zone: "under"; locationId: string };

type SeatList = "deck" | "hand" | "discard" | "heroes" | "play" | "engaged" | "staging";

const SEAT_LIST: Partial<Record<ZoneName, SeatList>> = {
  deck: "deck",
  hand: "hand",
  discard: "discard",
  heroes: "heroes",
  play: "play",
  engaged: "engaged",
  seatStaging: "staging",
};

function without(list: readonly string[], id: string): readonly string[] {
  const index = list.indexOf(id);
  if (index < 0) return list;
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

function append(list: readonly string[], id: string): readonly string[] {
  if (list.includes(id)) return list;
  return [...list, id];
}

function patchSeatList(
  state: ScenarioState,
  seatIndex: number,
  key: SeatList,
  list: readonly string[],
): ScenarioState {
  const seat = state.seats[seatIndex];
  if (!seat || seat[key] === list) return state;
  return withSeat(state, seatIndex, { ...seat, [key]: list });
}

function detach(state: ScenarioState, id: string): ScenarioState {
  const current = state.cards[id];
  if (!current) return state;
  const listKey = SEAT_LIST[current.zone];
  if (listKey && current.controller != null) {
    const seat = state.seats[current.controller];
    if (!seat) return state;
    return patchSeatList(state, current.controller, listKey, without(seat[listKey], id));
  }
  switch (current.zone) {
    case "seatQuest": {
      if (current.controller == null) return state;
      const seat = state.seats[current.controller];
      if (!seat || seat.questStage !== id) return state;
      return withSeat(state, current.controller, { ...seat, questStage: null });
    }
    case "staging":
      return { ...state, staging: without(state.staging, id) };
    case "encounterDeck":
      return { ...state, encounterDeck: without(state.encounterDeck, id) };
    case "encounterDiscard":
      return { ...state, encounterDiscard: without(state.encounterDiscard, id) };
    case "burdenDeck":
      return { ...state, burdenDeck: without(state.burdenDeck ?? [], id) };
    case "victory":
      return { ...state, victory: without(state.victory, id) };
    case "setAside":
      return { ...state, setAside: without(state.setAside, id) };
    case "removed":
      return { ...state, removed: without(state.removed, id) };
    case "questDeck":
      return { ...state, questDeck: without(state.questDeck, id) };
    case "questStage":
      return state.questStage === id ? { ...state, questStage: null } : state;
    case "activeLocation":
      return state.activeLocation === id ? { ...state, activeLocation: null } : state;
    case "secondActiveLocation":
      return state.secondActiveLocation === id ? { ...state, secondActiveLocation: null } : state;
    case "under":
      return updateCard(state, id, { host: null });
    case "shadow": {
      const enemy = current.host ? state.cards[current.host] : undefined;
      if (!enemy) return state;
      if (enemy.shadowId === id) return updateCard(state, enemy.id, { shadowId: null });
      return withExtraShadows(state, enemy, (enemy.extraShadowIds ?? []).filter((other) => other !== id));
    }
    default:
      return state;
  }
}

// The additional shadow cards of an enemy. The field is left off when there are none.
function withExtraShadows(state: ScenarioState, enemy: CardInstance, ids: readonly string[]): ScenarioState {
  const current = state.cards[enemy.id];
  if (!current) return state;
  const { extraShadowIds: _old, ...rest } = current;
  const next: CardInstance = ids.length > 0 ? { ...rest, extraShadowIds: ids } : rest;
  return { ...state, cards: { ...state.cards, [enemy.id]: next } };
}

// The cards facedown under a location (141049:A:1), in instance id order (the order the cards were made, not the order
// they were placed): the rules give the cards under a location no order, and the id keeps the list stable.
export function cardsUnder(state: ScenarioState, locationId: string): string[] {
  return Object.values(state.cards)
    .filter((card) => card.zone === "under" && card.host === locationId)
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
    .map((card) => card.id);
}

// Every shadow card dealt to the enemy, the first one first.
export function shadowCards(instance: CardInstance | undefined): string[] {
  if (!instance) return [];
  return [...(instance.shadowId ? [instance.shadowId] : []), ...(instance.extraShadowIds ?? [])];
}

function unhost(state: ScenarioState, id: string): ScenarioState {
  const current = state.cards[id];
  if (!current?.host) return state;
  const host = state.cards[current.host];
  let next = updateCard(state, id, { host: null });
  if (!host) return next;
  next = updateCard(next, host.id, { attachments: host.attachments.filter((attachment) => attachment !== id) });
  return next;
}

function attach(state: ScenarioState, id: string, dest: Destination): ScenarioState {
  const current = state.cards[id];
  if (!current) return state;
  if ("seat" in dest && dest.zone !== "seatQuest") {
    const key = SEAT_LIST[dest.zone];
    if (!key) return state;
    const seat = state.seats[dest.seat];
    if (!seat) return state;
    const listed = patchSeatList(state, dest.seat, key, append(seat[key], id));
    return updateCard(listed, id, { zone: dest.zone, controller: dest.seat });
  }
  if (dest.zone === "seatQuest") {
    const seat = state.seats[dest.seat];
    if (!seat) return state;
    const seated = withSeat(state, dest.seat, { ...seat, questStage: id });
    return updateCard(seated, id, { zone: "seatQuest", controller: dest.seat });
  }
  // Under a location: out of play, facedown, controlled by nobody, and not one of the location's attachments (141049:A:1).
  if (dest.zone === "under") {
    return updateCard(state, id, { zone: "under", host: dest.locationId, controller: null, face: "down", exhausted: false, committed: false });
  }
  if (dest.zone === "shadow") {
    const enemy = state.cards[dest.enemyId];
    if (!enemy) return state;
    // A second shadow card dealt to the same enemy is an additional one (141069:A:2).
    const linked =
      enemy.shadowId && enemy.shadowId !== id
        ? withExtraShadows(state, enemy, [...(enemy.extraShadowIds ?? []), id])
        : updateCard(state, dest.enemyId, { shadowId: id });
    return updateCard(linked, id, { zone: "shadow", host: dest.enemyId, controller: null });
  }
  const zone = dest.zone;
  const stamped = updateCard(state, id, { zone, controller: zone === "staging" ? current.controller : null });
  switch (zone) {
    case "staging":
      return { ...stamped, staging: append(stamped.staging, id) };
    case "encounterDeck":
      return { ...stamped, encounterDeck: append(stamped.encounterDeck, id) };
    case "encounterDiscard":
      return { ...stamped, encounterDiscard: append(stamped.encounterDiscard, id) };
    case "burdenDeck":
      return { ...stamped, burdenDeck: append(stamped.burdenDeck ?? [], id) };
    case "victory":
      return { ...stamped, victory: append(stamped.victory, id) };
    case "setAside":
      return { ...stamped, setAside: append(stamped.setAside, id) };
    case "removed":
      return { ...stamped, removed: append(stamped.removed, id) };
    case "questDeck":
      return { ...stamped, questDeck: append(stamped.questDeck, id) };
    case "questStage":
      return { ...stamped, questStage: id };
    case "activeLocation":
      return { ...stamped, activeLocation: id };
    case "secondActiveLocation":
      return { ...stamped, secondActiveLocation: id };
    default:
      return stamped;
  }
}

// Stamps the order in which a card entered play, so Forced effects can resolve oldest first.
function stampEntry(state: ScenarioState, id: string, from: ZoneName): ScenarioState {
  const now = state.cards[id];
  if (!now || inPlay(from) || !inPlay(now.zone)) return state;
  const clock = state.clock + 1;
  return updateCard({ ...state, clock }, id, { enteredPlay: clock });
}

export function moveCard(state: ScenarioState, id: string, dest: Destination): ScenarioState {
  const current = state.cards[id];
  if (!current) return state;
  const leavingPlay = current.zone === "play" || current.zone === "heroes" || current.zone === "attached";
  let next = detach(state, id);
  if (leavingPlay && current.host) next = unhost(next, id);
  const moved = stampEntry(attach(next, id, dest), id, current.zone);
  // An enemy that leaves play takes its dealt shadow cards to the encounter discard (Learn to Play p16).
  // Staging and engaged are the zones an enemy is in play.
  if (dest.zone !== "engaged" && dest.zone !== "staging") {
    let discarded = moved;
    for (const shadowId of shadowCards(current)) discarded = moveCard(discarded, shadowId, { zone: "encounterDiscard" });
    return discarded;
  }
  return moved;
}

// Links an attachment to its host. The card keeps its zone and controller.
export function attachTo(state: ScenarioState, id: string, hostId: string): ScenarioState {
  const host = state.cards[hostId];
  if (!host || !state.cards[id]) return state;
  const linked = updateCard(state, id, { host: hostId });
  return updateCard(linked, hostId, { attachments: append(host.attachments, id) });
}

export function spawn(
  state: ScenarioState,
  code: string,
  dest: Destination,
  face: CardFace = "up",
): { state: ScenarioState; id: string } {
  const id = `i${state.nextId}`;
  const instance: CardInstance = {
    id,
    code,
    zone: "removed",
    exhausted: false,
    damage: 0,
    progress: 0,
    resources: 0,
    host: null,
    attachments: [],
    committed: false,
    shadowId: null,
    face,
    controller: null,
    enteredPlay: 0,
  };
  const recorded: ScenarioState = {
    ...state,
    nextId: state.nextId + 1,
    cards: { ...state.cards, [id]: instance },
  };
  return { state: stampEntry(attach(recorded, id, dest), id, "removed"), id };
}

export { inPlay } from "./state.ts";
