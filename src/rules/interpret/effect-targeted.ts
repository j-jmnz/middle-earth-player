// Effect items that act on a picked or found card: ReturnToStaging, AttachSelf, the searches, ShuffleIntoDeck, DiscardRestricted, ReadyHero,
// BarAttack, PlaceProgressOnLocation. The candidates are found, one is chosen (a player chooses only among different cards), and the verb applies.
import type { Instruction } from "../../catalog/boundary.ts";
import { immuneToSource } from "../families/misc/guards.ts";
import { characters } from "../combat/combat.ts";
import { frameScope, refCard } from "./amounts.ts";
import { askTarget } from "../windows/choices.ts";
import { hasTrait } from "./conditions.ts";
import { outOfPlayChoices, searchable } from "./search.ts";
import { applyTargetVerb, targetCandidates } from "./effect-verbs.ts";
import { startReveal } from "../windows/frames.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { moveEncounter } from "../families/encounter/moves.ts";
import { activeOf, stagingDest } from "../families/breaking/areas.ts";
import { attachHeroHosts, attachHostChooser } from "../families/play/hooks.ts";
import { lastPickedSeat } from "../families/play/refs.ts";
import { familyAttached } from "./family-hooks.ts";
import { controlledShips, defendingShip } from "../families/sea/campaign.ts";
import { discardRestricted } from "../families/objectives/claimed.ts";
import { printedOf } from "../core/printed.ts";
import { attachBlocked, restrictedAttachments } from "./restrictions.ts";
import type { Frame, QueueItem, ScenarioState } from "../core/state.ts";
import { livingSeats, updateCard } from "../core/state.ts";
import { seatFor, shuffleEncounterDeck, shuffleIntoEncounterDeck } from "./verbs.ts";
import { patchTop, topFrame } from "../windows/windows.ts";
import { queueEvent } from "../windows/queue.ts";
import { gameReads } from "../core/game-reads.ts";
import { listens } from "../families/encounter/reveal.ts";
import { attachTo, inPlay, moveCard, turnedUp } from "../core/zones.ts";

function hasEnemyType(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  return instance != null && printedOf(ctx.cards, instance.code).type === "enemy";
}

function candidates(state: ScenarioState, item: QueueItem, sourceId: string | null, ctx: ReduceContext): string[] {
  const instruction = item.instruction;
  switch (instruction.verb) {
    case "ReturnToStaging": {
      const target = instruction.target;
      const source = sourceId ? state.cards[sourceId] : undefined;
      if (target.kind === "self") return sourceId ? [sourceId] : [];
      if (target.kind === "host") return source?.host ? [source.host] : [];
      if (target.kind === "activeLocation") {
        // The acting seat's own active location once stages are separate.
        const active = activeOf(state, item.seat);
        // An active location immune to card effects stays where it is (East-gate, 03016:A:1; dwd.immune-to-card-effects).
        return active && active !== sourceId && !immuneToSource(state, active, sourceId, ctx) ? [active] : [];
      }
      if (target.kind === "picked" || target.kind === "previous" || target.kind === "subject" || target.kind === "attacker" || target.kind === "other") {
        const id = refCard(state, target.kind, frameScope(state, item.seat, sourceId));
        return id && hasEnemyType(state, id, ctx) && state.cards[id]?.zone === "engaged" ? [id] : [];
      }
      const seats = target.who === "actor" ? [item.seat] : livingSeats(state);
      return seats
        .flatMap((seat) => state.seats[seat]?.engaged ?? [])
        .filter((id) => hasEnemyType(state, id, ctx))
        .filter((id) => !target.trait || hasTrait(state, id, target.trait, ctx));
    }
    case "AttachSelf": {
      const code = sourceId ? state.cards[sourceId]?.code : undefined;
      const unlimited = (instruction.to.kind === "character" || instruction.to.kind === "hero") && instruction.to.unlimited === true;
      const free = (id: string): boolean => (unlimited || !(state.cards[id]?.attachments ?? []).some((other) => state.cards[other]?.code === code)) && (code == null || !attachBlocked(state, ctx, id, code));
      if (instruction.to.kind === "character") {
        const { trait, name } = instruction.to;
        return livingSeats(state).flatMap((seat) => characters(state, seat, ctx.cards)).filter((id) => (trait == null || hasTrait(state, id, trait, ctx)) && (name == null || printedOf(ctx.cards, state.cards[id]?.code ?? "").name === name) && free(id));
      }
      if (instruction.to.kind === "hero") {
        const seat = attachSeat(state, instruction, item.seat, sourceId);
        const hosts = seat == null ? [] : attachHeroHosts(state, instruction.to, seat, ctx.cards).filter(free);
        // "The hero with the most attachments" (18027:A:1): among the heroes the card is not on, those holding the most.
        const most = Math.max(0, ...hosts.map((id) => state.cards[id]?.attachments.length ?? 0));
        return instruction.to.control === "mostAttachments" ? hosts.filter((id) => (state.cards[id]?.attachments.length ?? 0) === most) : hosts;
      }
      // A Ship objective: the Limit-1 check of a hero or enemy host does not apply (a ship may carry more than one Taking on Water).
      if (instruction.to.kind === "ship") return instruction.to.defender ? defendingShip(state, ctx) : controlledShips(state, ctx);
      // An attackingEnemy host is attached inline by the wilderland family (18018:A:2), never offered here.
      if (instruction.to.kind !== "enemy") return [];
      const trait = instruction.to.trait;
      return [...state.staging, ...livingSeats(state).flatMap((seat) => state.seats[seat]?.engaged ?? [])].filter((id) => hasEnemyType(state, id, ctx) && hasTrait(state, id, trait, ctx) && free(id));
    }
    case "SearchMove":
    case "SearchReveal": {
      const found = searchable(state, instruction, ctx);
      const data = topFrame(state)?.data;
      // "One of those enemies must be Corsair Captain, if able" (145030:A:3): the requirement is met once an earlier search of this effect has found a card with that code (the frame's picked cards, kept by applyTargeted).
      const met = instruction.verb === "SearchMove" && instruction.require != null && data?.kind === "effect" && (data.picked ?? []).some((id) => state.cards[id]?.code === instruction.require);
      const picked = instruction.verb === "SearchMove" && instruction.requireFor === "picked" ? lastPickedSeat(state) : null;
      const required = instruction.verb === "SearchMove" && instruction.require && !met && (picked == null || picked === item.seat) ? searchable(state, { code: instruction.require }, ctx) : [];
      if (required.length > 0) return required;
      if (instruction.verb !== "SearchMove" || !instruction.different) return found;
      // A different title: not one an earlier search of this effect has found.
      const taken = new Set((data?.kind === "effect" ? (data.picked ?? []) : []).map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").name));
      return found.filter((id) => !taken.has(printedOf(ctx.cards, state.cards[id]?.code ?? "").name));
    }
    case "ShuffleIntoDeck":
      return searchable(state, instruction, ctx, ["encounterDiscard"]);
    case "DiscardRestricted":
      return sourceId ? restrictedAttachments(state, sourceId, ctx) : [];
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return outOfPlayChoices(state, instruction.code);
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
      return targetCandidates(state, instruction, item.seat, ctx);
    default:
      return [];
  }
}

// Different copies of one card are the same choice. Only different cards make the player pick.
export function distinctByCode(state: ScenarioState, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const code = state.cards[id]?.code ?? id;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function picksOne(instruction: Instruction): boolean {
  if (instruction.verb === "ReturnToStaging") return instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose";
  // "Add each Nazgûl enemy found": every match goes, and nobody chooses.
  if (instruction.verb === "SearchMove" || instruction.verb === "ShuffleIntoDeck") return instruction.each !== true;
  return true;
}

export function targeted(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const found = candidates(state, item, frame.cardId, ctx);
  let ids = found;
  if (item.chosen) {
    ids = [item.chosen];
  } else if (item.instruction.verb === "ShuffleOutOfPlayIntoEncounterDeck") {
    // On an encounter or quest effect the first player picks among the choices (rr.first-player).
    if (found.length > 1) return askTarget(state, { ...item, seat: state.firstPlayer }, found);
    ids = found.slice(0, 1);
  } else if (picksOne(item.instruction)) {
    const distinct = distinctByCode(state, found);
    const chooser = attachHostChooser(state, item.instruction, attachSeat(state, item.instruction, item.seat, frame.cardId) ?? item.seat);
    if (distinct.length > 1) return askTarget(state, { ...item, seat: chooser }, distinct);
    ids = found.slice(0, 1);
  }
  return applyTargeted(state, item, ids, frame.cardId, ctx, steps);
}

function applyTargeted(
  state: ScenarioState,
  item: QueueItem,
  ids: readonly string[],
  sourceId: string | null,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const instruction = item.instruction;
  const first = ids[0];
  switch (instruction.verb) {
    case "ReturnToStaging": {
      let next = state;
      let count = 0;
      for (const id of ids) {
        if (!next.cards[id]) continue;
        const engaged = next.cards[id]?.zone === "engaged";
        next = updateCard(moveCard(next, id, { zone: "staging" }), id, { controller: null });
        // "After an enemy enters the staging area" hears an engaged enemy that comes back (146017:A:1); only a game with such a record queues it.
        if (engaged && gameReads(next, ctx, '"trigger":"returnedToStaging"')) next = queueEvent(next, { trigger: "returnedToStaging", seat: item.seat, cardId: id });
        count += 1;
      }
      const data = topFrame(next)?.data;
      return data?.kind === "effect" ? patchTop(next, { data: { ...data, returned: data.returned + count } }) : next;
    }
    case "AttachSelf":
      return first && sourceId ? attachSelf(state, sourceId, first, ctx) : state;
    case "SearchMove": {
      let next = state;
      for (const id of instruction.each ? ids : ids.slice(0, 1)) {
        // "Put it into play engaged with you" (41013:A:1): the searching player engages it as it enters play (rr.engaged), so Forced effects
        // that hear an engagement hear this one.
        if (instruction.to === "engaged") {
          next = moveEncounter(next, id, "engaged", (instruction.engagedSeat === "picked" ? lastPickedSeat(next) : null) ?? item.seat, ctx, steps);
          continue;
        }
        // Into the Stormcaller's area (dcce.stormcallers-area).
        if (instruction.to === "stormcallerArea") {
          next = updateCard(moveCard(next, id, { zone: "stormcallerArea" }), id, { face: "up" });
          continue;
        }
        // Into the searching seat's own staging area once stages are separate (families/breaking/areas.ts). A card found facedown is turned faceup: one the
        // encounter discard pile was shuffled back into the deck with lies facedown (rr.running-out-of-cards, resetEncounterDeck). A side it shows (A or B) stays.
        const facedown = next.cards[id]?.face === "down";
        const wasInPlay = inPlay(next.cards[id]?.zone ?? "removed");
        next = instruction.to === "staging" ? moveCard(next, id, stagingDest(next, item.seat)) : moveCard(next, id, { zone: "engaged", seat: state.firstPlayer });
        if (instruction.each || facedown) next = updateCard(next, id, { face: turnedUp(next, id) });
        // A card found out of play enters play: the cards that hear a search put a card into play hear it (Quiet the Spirits, 10109:A:1); `encounterEnteredPlay` is left to the other ways in.
        if (!wasInPlay && listens(next, ctx, "searchedIntoPlay")) next = queueEvent(next, { trigger: "searchedIntoPlay", seat: item.seat, subject: id });
      }
      // A `different` search tells the next one which titles are taken.
      const data = topFrame(next)?.data;
      const moved = instruction.each ? ids : ids.slice(0, 1);
      return (instruction.different || instruction.remember || instruction.require) && data?.kind === "effect" ? patchTop(next, { data: { ...data, picked: [...(data.picked ?? []), ...moved] } }) : next;
    }
    case "SearchReveal":
      return first ? startReveal(state, seatFor(state, instruction.who, item.seat), ctx, steps, first, undefined, instruction.to === "engaged", state.cards[first]?.zone === "encounterDiscard") : state;
    case "ShuffleIntoDeck":
      // Every copy goes into the deck, which is shuffled once.
      if (instruction.each === true) return ids.length > 0 ? shuffleEncounterDeck(ids.reduce((next, id) => (next.cards[id] ? updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down" }) : next), state)) : state;
      return first ? shuffleIntoEncounterDeck(state, first) : state;
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return first ? shuffleIntoEncounterDeck(state, first) : state;
    case "DiscardRestricted":
      return first ? discardRestricted(state, first) : state;
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
      return applyTargetVerb(state, instruction, first, sourceId, item.seat, ctx, steps);
    default:
      return state;
  }
}

/** The card attaches to its host, faceup, and the families hear it (the Ship objective a Taking on Water attaches to is noted by the sea family). */
export function attachSelf(state: ScenarioState, id: string, host: string, ctx: ReduceContext): ScenarioState {
  if (!state.cards[id]) return state;
  const attached = attachTo(moveCard(state, id, { zone: "attached" }), id, host);
  return familyAttached(updateCard(attached, id, { face: "up" }), id, host, ctx);
}

// The seat whose heroes an AttachSelf to a hero offers and who chooses among them: the player the effect picked for `control: "picked"`
// ("attach this card to one of that player's heroes", 900106:A:1: the last player picked, though cards were picked since; null when no
// player is picked), otherwise the seat the item runs for.
function attachSeat(state: ScenarioState, instruction: Instruction, itemSeat: number, sourceId: string | null): number | null {
  if (instruction.verb !== "AttachSelf" || instruction.to.kind !== "hero" || instruction.to.control !== "picked") return itemSeat;
  const player = (frameScope(state, itemSeat, sourceId).picked ?? []).findLast((entry) => entry.startsWith("seat:"));
  return player ? Number(player.slice("seat:".length)) : null;
}
