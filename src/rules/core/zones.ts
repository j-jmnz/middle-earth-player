// Rules: rr.in-play-and-out-of-play, rr.discard-pile-and-victory-display (data/rules/entries.json).
import { queueEvent } from "../windows/queue.ts";
import { leaveWith } from "../families/play/zones.ts";
import { keptInPlay } from "../families/pelargir/vale/cannot-leave.ts";
import { heldInHand } from "../families/ring-maker/hand.ts";
import { endLastingOn } from "./lasting.ts";
import { releaseOrcGuard } from "../families/dungeon/guard.ts";
import { dealtFace } from "../families/dreamchaser/facts.ts";
import { routeDestination } from "../families/sea/routes.ts";
import { grappledWith } from "../families/grapple/values.ts";
import { captureOnEntry } from "../families/captured/entry.ts";
import { rescueUnder } from "../families/captured/rescue.ts";
import { attachmentLeaves } from "../families/angmar/reanimate/attached.ts";
import { areaHeadOf } from "../families/breaking/areas.ts";
import { discardedFromDeck, joinStormcallerArea } from "../families/stormcaller/zone.ts";
import { joinOrcsArea } from "../families/haradrim/orcs-zone.ts";
import { joinUnchartedDeck, shuffleUnchartedDeck, unchartedRoute, unchartedWon } from "../families/uncharted/zone.ts";
import { deckRoute, isDeckZone, joinPile, leavePile, shufflePile, type PileZone } from "./piles.ts";
import { isReanimatedCode, ORC_GUARD_CODE, reanimatedBase } from "./printed.ts";
import { flagged, heldHero, inPlay, updateCard, updateCards, withSeat, type CardFace, type CardInstance, type ScenarioState, type ZoneName } from "./state.ts";
import { cannotLeaveStaging } from "./staging-bar.ts";

export type Destination =
  | { zone: "deck" | "hand" | "discard" | "heroes" | "play" | "engaged" | "seatStaging"; seat: number }
  // `area`: with `staging`, once stages are separate, the seat whose staging area the card goes into (families/breaking/areas.ts); the card is in
  // `staging` and in that seat's list.
  | { zone: "staging" | "encounterDeck" | "encounterDiscard" | "burdenDeck" | "victory" | "setAside" | "removed" | "questDeck" | "corsairDeck" | "corsairDiscard" | "unchartedDeck" | "stormcallerArea" | "orcsArea" | "islandMap" | PileZone; area?: number }
  // `seat`: once stages are separate, the seat whose active location or stage the card becomes (`Seat.active`, `Seat.stage`; the shared slots mirror them).
  // Without it the card takes the state's own slot, which on a seat's view (families/breaking/areas.ts) is that seat's.
  | { zone: "activeLocation" | "secondActiveLocation" | "questStage"; seat?: number }
  | { zone: "shadow"; enemyId: string }
  | { zone: "attached" }
  | { zone: "campaign" }
  | { zone: "nightmare" }
  | { zone: "modeCard" }
  | { zone: "nightObjective" }
  | { zone: "riddleArea" }
  | { zone: "under"; locationId: string }
  // `hostId` null: a prisoner hero, held under no card (families/prisoner.ts).
  | { zone: "captive"; hostId: string | null }
  // Captured: out of play under `hostId`, or in the captured deck of `seat` (the card's owner by default) with no host (families/captured/pile.ts).
  | { zone: "captured"; hostId: string | null; seat?: number }
  // Attached facedown to a location in the staging area by Grapple (families/grapple/attach.ts).
  | { zone: "grappled"; locationId: string };

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
  // The decks beside the encounter deck (Corsair, Uncharted, Ered Mithrin's) leave through one accessor (piles.ts).
  if (isDeckZone(current.zone)) return leavePile(state, current.zone, id);
  switch (current.zone) {
    case "staging": {
      const left = { ...state, staging: without(state.staging, id) };
      if (!state.separate) return left;
      // A card in a seat's staging area leaves that seat's list too.
      let next: ScenarioState = left;
      for (let index = 0; index < state.seats.length; index += 1) {
        const seat = next.seats[index];
        if (seat?.staging.includes(id)) next = withSeat(next, index, { ...seat, staging: without(seat.staging, id) });
      }
      return next;
    }
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
    case "questStage": {
      if (state.questStage === id) return { ...state, questStage: null };
      // A seat's own stage once stages are separate (families/breaking/areas.ts).
      const at = state.separate ? state.seats.findIndex((seat) => seat.stage === id) : -1;
      const owner = at < 0 ? undefined : state.seats[at];
      if (!owner) return state;
      const { stage: _stage, ...rest } = owner;
      return withSeat(state, at, rest);
    }
    case "activeLocation":
    case "secondActiveLocation":
      return leaveActive(state, id);
    case "under":
    case "captive":
    case "grappled":
      return updateCard(state, id, { host: null });
    // A card of a captured deck leaves its owner's list; a card under a host just loses the host.
    case "captured": {
      const owner = current.host == null && current.owner != null ? state.seats[current.owner] : undefined;
      const left = owner && current.owner != null && owner.captured?.includes(id) ? withSeat(state, current.owner, { ...owner, captured: without(owner.captured, id) }) : state;
      return updateCard(left, id, { host: null });
    }
    // A shadow card that leaves its enemy is no longer attached to it, wherever it goes next (rr.shadow-effects).
    case "shadow": {
      const enemy = current.host ? state.cards[current.host] : undefined;
      const freed = updateCard(state, id, { host: null });
      if (!enemy) return freed;
      if (enemy.shadowId === id) return updateCard(freed, enemy.id, { shadowId: null });
      return withExtraShadows(freed, enemy, (enemy.extraShadowIds ?? []).filter((other) => other !== id));
    }
    default:
      return state;
  }
}

// A location leaves an active slot: the shared ones, and once stages are separate the seat's own (`Seat.active`, families/breaking/areas.ts).
function leaveActive(state: ScenarioState, id: string): ScenarioState {
  let next = state;
  if (next.activeLocation === id) next = { ...next, activeLocation: null };
  if (next.secondActiveLocation === id) next = { ...next, secondActiveLocation: null };
  if (!next.separate) return next;
  for (let index = 0; index < next.seats.length; index += 1) {
    const seat = next.seats[index];
    if (seat?.active !== id) continue;
    const { active: _active, ...rest } = seat;
    next = withSeat(next, index, rest);
  }
  return next;
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

// The attachments on a card with the loot guarding it, for the readers of this file's zones (attached.ts).
export { attachmentsOn } from "./attached.ts";

// The facedown player cards under a location (Truly Lost, 18075:A:1): the cards under it that a player owns, in instance id order.
export function playerCardsUnder(state: ScenarioState, locationId: string): string[] {
  // Poison under a character is a facedown player card too, but not one a card of the scenario holds under a location (families/poison).
  return cardsUnder(state, locationId).filter((id) => state.cards[id]?.owner != null && state.cards[id]?.poison !== true);
}

// Every shadow card dealt to the enemy, the first one first.
export function shadowCards(instance: CardInstance | undefined): string[] {
  if (!instance) return [];
  return [...(instance.shadowId ? [instance.shadowId] : []), ...(instance.extraShadowIds ?? [])];
}

export function unhost(state: ScenarioState, id: string): ScenarioState {
  const current = state.cards[id];
  if (!current?.host) return state;
  const host = state.cards[current.host];
  const freed: Partial<CardInstance> = current.guard ? { host: null, guard: undefined } : { host: null };
  if (!host) return updateCards(state, [[id, freed]]);
  return updateCards(state, [
    [id, freed],
    [host.id, { attachments: host.attachments.filter((attachment) => attachment !== id) }],
  ]);
}

// A destination that is one of a seat's own lists.
function seatList(dest: Destination): dest is Extract<Destination, { zone: "deck" | "hand" | "discard" | "heroes" | "play" | "engaged" | "seatStaging" }> {
  return "seat" in dest && dest.zone !== "captured" && dest.zone !== "activeLocation" && dest.zone !== "secondActiveLocation" && dest.zone !== "questStage";
}

function attach(state: ScenarioState, id: string, dest: Destination): ScenarioState {
  const current = state.cards[id];
  if (!current) return state;
  if (seatList(dest)) {
    const key = SEAT_LIST[dest.zone];
    if (!key) return state;
    const seat = state.seats[dest.seat];
    if (!seat) return state;
    const listed = patchSeatList(state, dest.seat, key, append(seat[key], id));
    return updateCard(listed, id, { zone: dest.zone, controller: dest.seat });
  }
  // Under a location: out of play, facedown, controlled by nobody, and not one of the location's attachments (141049:A:1).
  if (dest.zone === "under") {
    return updateCard(state, id, { zone: "under", host: dest.locationId, controller: null, face: "down", exhausted: false, committed: false });
  }
  // Facedown under an enemy, still in play and controlled by nobody (the Ring-bearer under the Watcher in the Water).
  if (dest.zone === "captive") {
    return updateCard(state, id, { zone: "captive", host: dest.hostId, controller: null, face: "down" });
  }
  // Captured: out of play, facedown, controlled by nobody, its tokens gone and its owner remembered; in a captured deck (no host) the owner's list takes it (mec108.captured-cards).
  if (dest.zone === "captured") {
    const owner = dest.seat ?? current.owner ?? current.controller;
    const stamped = updateCard(state, id, { zone: "captured", host: dest.hostId, controller: null, face: "down", exhausted: false, committed: false, damage: 0, progress: 0, resources: 0, ...(owner != null ? { owner } : {}) });
    const seat = owner != null ? stamped.seats[owner] : undefined;
    return dest.hostId == null && owner != null && seat ? withSeat(stamped, owner, { ...seat, captured: append(seat.captured ?? [], id) }) : stamped;
  }
  // Facedown on a location in the staging area, in play, not in the staging area (dcce.grapple).
  if (dest.zone === "grappled") {
    return updateCard(state, id, { zone: "grappled", host: dest.locationId, controller: null, face: "down" });
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
  // A claimed objective (families/objectives.ts) that returns to the staging area is controlled by nobody again.
  const stamped = updateCard(state, id, { zone, controller: zone === "staging" && !current.claimed ? current.controller : null, ...(current.claimed ? { claimed: undefined } : {}) });
  if (zone === "unchartedDeck") return joinUnchartedDeck(stamped, id);
  if (isDeckZone(zone)) return joinPile(stamped, zone, id);
  switch (zone) {
    case "staging": {
      const listed = { ...stamped, staging: append(stamped.staging, id) };
      // Once stages are separate a card goes into a seat's staging area: the one named, or the seat an enemy that returns from being engaged
      // was engaged with.
      const area = "area" in dest ? dest.area : current.zone === "engaged" ? current.controller : null;
      const owner = area != null && listed.separate ? listed.seats[area] : undefined;
      return area != null && owner ? withSeat(listed, area, { ...owner, staging: append(owner.staging, id) }) : listed;
    }
    case "encounterDeck":
      return { ...stamped, encounterDeck: append(stamped.encounterDeck, id) };
    case "encounterDiscard":
      return { ...stamped, encounterDiscard: append(stamped.encounterDiscard, id) };
    case "burdenDeck":
      return { ...stamped, burdenDeck: append(stamped.burdenDeck ?? [], id) };
    case "stormcallerArea":
      return joinStormcallerArea(stamped, id);
    case "orcsArea":
      return joinOrcsArea(stamped, id);
    case "victory":
      return { ...unchartedWon(stamped, id), victory: append(stamped.victory, id) };
    case "setAside":
      return { ...stamped, setAside: append(stamped.setAside, id) };
    case "removed":
      return { ...stamped, removed: append(stamped.removed, id) };
    case "questDeck":
      return { ...stamped, questDeck: append(stamped.questDeck, id) };
    case "questStage": {
      const owner = stamped.separate && "seat" in dest && dest.seat != null ? stamped.seats[dest.seat] : undefined;
      return owner && "seat" in dest && dest.seat != null ? withSeat(stamped, dest.seat, { ...owner, stage: id }) : { ...stamped, questStage: id };
    }
    case "activeLocation":
    case "secondActiveLocation": {
      const owner = stamped.separate && "seat" in dest && dest.seat != null ? stamped.seats[dest.seat] : undefined;
      if (!owner || !("seat" in dest) || dest.seat == null) return zone === "activeLocation" ? { ...stamped, activeLocation: id } : { ...stamped, secondActiveLocation: id };
      // The seat's own slot; the shared slots mirror seat 0's and seat 1's.
      const seated = withSeat(stamped, dest.seat, { ...owner, active: id });
      return { ...seated, activeLocation: seated.seats[0].active ?? null, secondActiveLocation: seated.seats[1].active ?? null };
    }
    default:
      return stamped;
  }
}

// The enemies grappled with the location are detached, flipped faceup and added to the staging area, each hearing that it was detached (dcce.grapple, 12052:A:3).
export function releaseGrappled(state: ScenarioState, locationId: string): ScenarioState {
  let next = state;
  for (const arm of grappledWith(state, locationId)) {
    next = queueEvent(updateCard(moveCard(next, arm, { zone: "staging" }), arm, { face: "up" }), { trigger: "grappleDetached", seat: null, cardId: arm, subject: arm, other: locationId });
  }
  return next;
}

// The enemies grappled with a location that leaves the staging area any other way than becoming the active location or being explored are attached to it, so they are discarded with it, all at
// once, faceup, and are never detached (rr.attachment-cards; Mariner's Compass 11008, Saruman 07003 and Heirs of Eärendil 17115 are the ways a location leaves the staging area).
function discardGrappled(state: ScenarioState, locationId: string): ScenarioState {
  let next = state;
  for (const arm of grappledWith(state, locationId)) next = updateCard(moveCard(next, arm, { zone: "encounterDiscard" }), arm, { face: "up", controller: null });
  return next;
}

// An encounter card attached to a guarded objective (rr.guarded) stays in the staging area, engaged or active while it is dealt with;
// it is unlinked from the objective when it leaves play (defeated, explored, discarded).
function guardLeaves(current: CardInstance, dest: Destination): boolean {
  const there = current.zone === "staging" || current.zone === "engaged" || current.zone === "activeLocation" || current.zone === "secondActiveLocation";
  return current.guard === true && there && !inPlay(dest.zone);
}

// Stamps the order in which a card entered play, so Forced effects can resolve oldest first. A card enters play ready
// (rr.ready), not committed to the quest, and carries no tokens from an earlier time in play: an ally destroyed with 3 damage comes back with none,
// and one destroyed while it was committed and put into play again in the same quest phase (Stand and Fight, 01051) adds no Willpower.
function stampEntry(state: ScenarioState, id: string, from: ZoneName): ScenarioState {
  const now = state.cards[id];
  if (!now || inPlay(from) || !inPlay(now.zone)) return state;
  const clock = state.clock + 1;
  // Tokens placed on a card while it was set aside stay on it as it enters play ("add 1 resource to each of them", 12039:B:2).
  // The damage a card was set aside with stays too when the card says so (keepsDamage, 19024:A:1).
  const keeps = from === "setAside" && now.keepsDamage === true;
  return updateCard({ ...state, clock }, id, { enteredPlay: clock, damage: keeps ? now.damage : 0, progress: 0, resources: from === "setAside" ? now.resources : 0, exhausted: false, committed: false, ...(keeps ? { keepsDamage: undefined } : {}) });
}

export type MoveOptions = { readonly released?: readonly string[]; readonly defeated?: boolean; readonly supersedes?: boolean; readonly destroyed?: boolean };

// `released` (option): the attachments destroyCard discarded just before the card itself (keywords.ts), named with its leaving.
// `supersedes` (option): an effect that overrides "cannot leave the staging area" moves the card (Dark Pit's discard of Durin's Bane, FAQ 3.026, families/flame/bane.ts).
// `destroyed` (option): the card is leaving because it was destroyed (destroyCard); a card that holds `cannotLeaveUnlessDestroyed` leaves play by no other move ("Murzag cannot leave play unless destroyed", 06144:B:1).
// `defeated` (option): the card is leaving because damage destroyed it; a card that holds `leavesStagingWhenDefeated` then leaves the staging area although it cannot leave it any other way (Thaurdir on stage 2B, 10126:B:1, 10126:B:3).
export function moveCard(state: ScenarioState, id: string, requested: Destination, options: MoveOptions = {}): ScenarioState {
  const dead = state.cards[id];
  // A Reanimated Dead stays an enemy in an engaged row or the staging area; by any other exit it is its owner's card again, faceup in the owner's discard pile (mec108.reanimated-dead, rules/core/printed.ts DEAD_SUFFIX).
  if (!dead || !isReanimatedCode(dead.code) || requested.zone === "engaged" || requested.zone === "staging") return moveCardTo(state, id, requested, options);
  const seat = dead.owner ?? dead.controller ?? 0;
  return updateCard(moveCardTo(state, id, { zone: "discard", seat }, options), id, { code: reanimatedBase(dead.code), face: "up", owner: undefined, damage: 0 });
}

function moveCardTo(state: ScenarioState, id: string, requested: Destination, options: MoveOptions): ScenarioState {
  const { released = [], defeated = false, supersedes = false, destroyed = false } = options;
  const current = state.cards[id];
  if (!current) return state;
  // A temporary card leaves the game when it leaves play, whether it is defeated, returned to a hand or a deck or discarded ("If those heroes leave play, they are removed from the game", 11212:A:2).
  const wanted: Destination = current.temporary && inPlay(current.zone) && !inPlay(requested.zone) ? { zone: "removed" } : requested;
  // A card with a route of its own never reaches the encounter deck or discard pile (families/sea/routes.ts); one that has no place there stays put.
  const routed = routeDestination(state, current, unchartedRoute(state, current, wanted));
  if (!routed) return state;
  // A card dealt into a deck with a discard pile of its own goes back to that pile, even with Victory (core/piles.ts, emce.evil-creatures-deck).
  const dest = current.deck === undefined ? routed : deckRoute(current, routed, inPlay(current.zone));
  // A card that cannot enter the staging area stays where it is ("Shrine to Morgoth ... cannot enter the staging area", 12094:A:1).
  if (dest.zone === "staging" && flagged(state, id, "cannotEnterStaging")) return state;
  // A card that cannot leave the staging area stays in it, whatever moves it (Uglúk, 143069:B:2).
  if (current.zone === "staging" && dest.zone !== "staging" && cannotLeaveStaging(state, id) && !supersedes && !(defeated && flagged(state, id, "leavesStagingWhenDefeated"))) return state;
  // A card that cannot leave play unless destroyed stays where it is, with its damage, tokens, attachments and shadow cards, whatever else moves it out of play (families/pelargir/vale/cannot-leave.ts).
  if (!destroyed && !defeated && inPlay(current.zone) && !inPlay(dest.zone) && keptInPlay(state, id)) return state;
  if (current.zone === "hand" && heldInHand(state, id)) return state; // a card that cannot leave the hand stays in it, whatever moves it (Ill Tidings, 07023:A:1)
  const leavingPlay = current.zone === "play" || current.zone === "heroes" || current.zone === "attached";
  let next = detach(state, id);
  if ((leavingPlay || guardLeaves(current, dest)) && current.host) next = unhost(next, id);
  let moved = stampEntry(attach(next, id, dest), id, current.zone);
  // A Captive that leaves the captive zone is a Captive no more, and no seat holds it (families/captives): the discard pile it went to was read above.
  if (current.captive === true && dest.zone !== "captive") moved = updateCard(moved, id, { captive: undefined, owner: undefined, heroSlot: undefined });
  // A captured card that leaves the zone is no one's but its owner's again (mec108.captured-cards); a card that enters play from out of play with Capture X captures (families/captured/entry.ts).
  if (current.zone === "captured" && dest.zone !== "captured") moved = updateCard(moved, id, { owner: undefined });
  if (moved.capture && !inPlay(current.zone) && inPlay(dest.zone)) moved = captureOnEntry(moved, id, dest);
  // An enemy lying as an attachment (Wraith of Carn Dûm) and an attachment that takes its host with it (Possession) change as they leave that role (families/angmar/reanimate/attached.ts).
  moved = attachmentLeaves(moved, id, current, dest, state);
  // A host that leaves play rescues every card captured underneath it (mec108.captured-cards).
  // A card captured with a hero that is itself put into a captured deck stays with it (the boons set aside with it, mec108.captured-deck).
  if (moved.capture && inPlay(current.zone) && !inPlay(dest.zone) && dest.zone !== "captured") moved = rescueUnder(moved, id, areaHeadOf(state, id));
  // A card placed in the encounter discard pile is announced where the table asks for it (`noteEncounterDiscards`, 900601:A:4).
  if (dest.zone === "encounterDiscard" && current.zone !== "encounterDiscard" && state.modifiers.length > 0 && flagged(state, "table", "noteEncounterDiscards")) moved = queueEvent(moved, { trigger: "encounterDiscarded", seat: null, subject: id });
  // A card that goes from the encounter deck to its discard pile is announced in a game with ships (families/stormcaller/zone.ts).
  if (current.zone === "encounterDeck" && dest.zone === "encounterDiscard") moved = discardedFromDeck(moved, id);
  // A card shuffled back into the Uncharted deck is shuffled into it (families/uncharted/zone.ts).
  if (dest.zone === "unchartedDeck") moved = shuffleUnchartedDeck(moved);
  // A card that goes back into the Sack deck shuffles it (hob.sack-deck, families/sack/).
  if (dest.zone === "sackDeck" && current.zone !== "sackDeck") moved = shufflePile(moved, "sackDeck");
  // The enemies grappled with a location that leaves the staging area: detached as it becomes the active location, discarded with it on every other exit (an explored location released them first, destroyCard).
  if (current.zone === "staging" && dest.zone !== "staging") moved = dest.zone === "activeLocation" || dest.zone === "secondActiveLocation" ? releaseGrappled(moved, id) : discardGrappled(moved, id);
  // The lasting modifiers it held end with its time in play (rr.in-play-and-out-of-play, core/lasting.ts).
  if (inPlay(current.zone) && !inPlay(dest.zone)) moved = endLastingOn(moved, id);
  // A card that goes back to a hand or a deck has left play: it is no longer exhausted or committed and holds no tokens (rr.in-play-and-out-of-play: Sneak Attack returns an exhausted Halfling Bounder to the hand, and he is ready when played again).
  if (inPlay(current.zone) && (dest.zone === "hand" || dest.zone === "deck" || dest.zone === "encounterDeck")) moved = updateCard(moved, id, { exhausted: false, committed: false, damage: 0, progress: 0, resources: 0 });
  // Its attachments leave play with it, however it left (rr.attachment-cards, families/play/zones.ts).
  if (inPlay(current.zone) && !inPlay(dest.zone)) moved = leaveWith(moved, current, released);
  // An Orc Guard that leaves play takes the deck card it is made of to its owner's discard pile and leaves the game (families/dungeon/guard.ts).
  if (current.code === ORC_GUARD_CODE && inPlay(current.zone) && !inPlay(dest.zone)) moved = releaseOrcGuard(moved, id);
  // A player card that leaves play is announced to the abilities that hear it ("After ~ leaves play", "After a character
  // leaves play"). An encounter card's leaving is announced where it happens (stage-reveal.ts).
  // An ally a guard holds in the staging area (Arwen under Goblin Gate, `guardedAlly`) leaves play the same way.
  // An attachment announces it like any card in play (rr.in-play-and-out-of-play): Fallen into Evil, discarded while a hero is fallen, returns the hero ("If Fallen into Evil is discarded, return attached hero to its owner's control", 142083:A:1).
  if ((current.zone === "play" || current.zone === "heroes" || current.zone === "attached" || (current.zone === "staging" && state.modifiers.length > 0 && flagged(state, id, "guardedAlly"))) && !inPlay(dest.zone)) moved = queueEvent(moved, { trigger: "leftPlay", seat: current.controller, cardId: id });
  // A card that holds the sponge (Forbidden Descent, 10101:A:2) leaves play from the staging area: announced to its own Forced effect, whether it was explored there by progress or discarded.
  if (current.zone === "staging" && !inPlay(dest.zone) && flagged(state, id, "progressSponge")) moved = queueEvent(moved, { trigger: "leftStagingArea", seat: null, cardId: id });
  // An enemy that guards a hero (Carried Away, 18074:B:2) is announced when it leaves play in any way; only a game that holds such a hero asks.
  if ((current.zone === "engaged" || current.zone === "staging") && !inPlay(dest.zone) && Object.values(moved.cards).some((card) => heldHero(card) && card.host === id)) moved = queueEvent(moved, { trigger: "leftPlay", seat: null, cardId: id });
  // A card a player card put out of play under itself "while ~ is in play" comes back to the staging area when it leaves (07003:A:3).
  if ((current.zone === "play" || current.zone === "heroes") && !inPlay(dest.zone)) for (const under of cardsUnder(moved, id)) moved = updateCard(moveCard(moved, under, { zone: "staging" }), under, { face: "up" });
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
  const card = state.cards[id];
  if (!host || !card) return state;
  // A card moves from the card it was attached to (an encounter card that guarded an objective, then attached itself to a hero).
  const was = card.guard === true && card.host != null && card.host !== hostId ? state.cards[card.host] : undefined;
  return updateCards(state, [
    ...(was ? [[was.id, { attachments: was.attachments.filter((other) => other !== id) }] as const] : []),
    [id, was ? { host: hostId, guard: undefined } : { host: hostId }],
    [hostId, { attachments: append(host.attachments, id) }],
  ]);
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
    face: dealtFace(state, code, face),
    controller: null,
    enteredPlay: 0,
  };
  const recorded: ScenarioState = {
    ...state,
    nextId: state.nextId + 1,
    cards: { ...state.cards, [id]: instance },
  };
  // A card dealt straight into play enters it like a moved one: it joins the cards in every area and captures (families/captured/entry.ts).
  const entered = stampEntry(attach(recorded, id, dest), id, "removed");
  return { state: entered.capture && inPlay(dest.zone) ? captureOnEntry(entered, id, dest) : entered, id };
}

/** The face a card shows when it is turned faceup from a deck, the encounter discard pile or the set-aside cards: its Upgraded side, side B, in a campaign that has upgraded it (dcce.scalable-upgradable), else faceup. */
export function turnedUp(state: Pick<ScenarioState, "campaignFacts" | "cards">, id: string): CardFace {
  return turnedUpCode(state, state.cards[id]?.code ?? "");
}

/** `turnedUp` for a card named by its code. */
export function turnedUpCode(state: Pick<ScenarioState, "campaignFacts">, code: string): CardFace {
  return dealtFace(state, code, "up");
}

/**
 * A card goes into the encounter deck facedown, held by no one. A card that cannot leave the staging area stays where it is and keeps the face it has (a revealed location
 * that Frodo's cancel shuffles back, 141001:A:1, on a stage that holds its locations there, 146066:B:1): `moved` tells whether it went.
 */
export function moveToEncounterDeckDown(state: ScenarioState, id: string): { state: ScenarioState; moved: boolean } {
  const placed = moveCard(state, id, { zone: "encounterDeck" });
  if (placed.cards[id]?.zone !== "encounterDeck") return { state: placed, moved: false };
  return { state: updateCard(placed, id, { face: "down", controller: null }), moved: true };
}

export { inPlay } from "./state.ts";

/** A card of a hand goes to `owner`'s discard pile and "discarded from your hand" is queued for `eventSeat` (the owner unless a card's own wording says otherwise). */
export function discardFromHand(state: ScenarioState, id: string, owner: number, eventSeat: number = owner): ScenarioState {
  return queueEvent(moveCard(state, id, { zone: "discard", seat: owner }), { trigger: "discardedFromHand", seat: eventSeat, cardId: id });
}
