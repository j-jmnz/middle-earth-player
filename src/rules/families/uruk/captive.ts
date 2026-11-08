// Rules: rr.in-play-and-out-of-play, rr.ownership-and-control, rr.player-elimination, mec112.setup-the-uruk-hai (data/rules/entries.json); ledger lines 143069:A:1, 143022:A:1, 143024:A:1.
//
// The Captives of The Uruk-hai: heroes in play, faceup, under To Isengard! or attached to Grishnákh, controlled by no player (the captive zone the Ring-bearer under the Watcher uses, families/south/captive.ts). A Captive keeps its tokens and the cards
// attached to it (user ruling, 2026-11-08); it leaves its owner's heroes, so the owner is not out of heroes while it is held (core/keywords.ts eliminateEmpties), and a Captive destroyed by damage goes to its owner's discard pile
// (core/keywords.ts defeatedDestination). To Isengard!'s constant blanks its text box (143022:A:1).
import type { Instruction } from "../../../catalog/boundary.ts";

import { lastPicked } from "../../interpret/player-verbs.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlayByCode, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { backInPlace, captivesUnder, heldFrom, releaseHero } from "../south/captive.ts";

/** The Captives in play, in the order their cards were made; with `heldBy`, only those the enemy with that id holds. */
export function captivesOf(state: ScenarioState, heldBy?: string): string[] {
  const held = heldBy != null ? captivesUnder(state, heldBy) : Object.keys(state.cards).filter((id) => state.cards[id]?.zone === "captive");
  return held.filter((id) => state.cards[id]?.captive === true);
}

// The hero, and each card attached to it, goes into the captive zone under the card `hostId`, faceup, with its tokens kept. The hero remembers the seat it came from and its place among that seat's heroes; its attachments leave the
// players' play areas (nobody controls them while the hero is held) but stay attached, their owners noted.
export function holdCaptive(state: ScenarioState, heroId: string, hostId: string): ScenarioState {
  const attachments = [...(state.cards[heroId]?.attachments ?? [])];
  const held = heldFrom(state, heroId);
  let next = updateCard(moveCard(state, heroId, { zone: "captive", hostId }), heroId, { face: "up", captive: true, committed: false, ...held });
  for (const id of attachments) {
    const controller = next.cards[id]?.controller;
    const moved = updateCard(moveCard(next, id, { zone: "attached" }), id, { face: "up", ...(controller != null ? { owner: controller } : {}) });
    next = attachTo(moved, id, heroId);
  }
  return next;
}

// TakeCaptive: the hero the actor picked last (with `logged`, the hero the Campaign Log names as the actor's captive), one of the actor's own, becomes a Captive under the card with this code.
function takeCaptive(state: ScenarioState, instruction: Extract<Instruction, { verb: "TakeCaptive" }>, focus: Focus): ScenarioState {
  const heroId = instruction.logged === true ? (state.seats[focus.seat]?.heroes.find((id) => loggedCaptiveMatches(state, id, true)) ?? "") : lastPicked(state);
  const hero = state.cards[heroId];
  const host = inPlayByCode(state, instruction.under);
  if (!hero || !host || hero.zone !== "heroes" || hero.controller !== focus.seat) return state;
  return holdCaptive(state, heroId, host.id);
}

// AttachCaptive: the Captive picked last is held by the source enemy.
function attachCaptive(state: ScenarioState, focus: Focus): ScenarioState {
  const id = lastPicked(state);
  const card = state.cards[id];
  if (!card || card.captive !== true || card.zone !== "captive" || !focus.sourceId || card.host === focus.sourceId) return state;
  return updateCard(moveCard(state, id, { zone: "captive", hostId: focus.sourceId }), id, { face: "up" });
}

// ReturnCaptive: each Captive the source enemy holds goes under the card with this code, faceup. With no such card in play it stays where it is.
function returnCaptive(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReturnCaptive" }>, focus: Focus): ScenarioState {
  const under = inPlayByCode(state, instruction.under);
  if (!under || !focus.sourceId) return state;
  let next = state;
  for (const id of captivesOf(state, focus.sourceId)) next = updateCard(moveCard(next, id, { zone: "captive", hostId: under.id }), id, { face: "up" });
  return next;
}

/**
 * The players win: each Captive is rescued (143070:A:1, "rescued each Captive"; 143071:B:1 reads the rescued heroes). It returns among its owner's heroes, in the place it held, controlled by its owner again, with its tokens kept, and
 * the cards attached to it return to its owner's play area. No event: the scenario is won, and its text box is no longer blank once no Captive is held.
 */
export function rescueCaptives(state: ScenarioState): ScenarioState {
  let next = state;
  for (const id of captivesOf(state)) {
    const hero = next.cards[id];
    if (!hero || hero.owner == null) continue;
    const seat = hero.owner;
    const released = releaseHero(next, id, seat, { face: "up", captive: undefined, owner: undefined, heroSlot: undefined, host: null }, { owner: undefined }, true);
    next = hero.heroSlot == null ? released : backInPlace(released, seat, id, hero.heroSlot);
  }
  return next;
}

/** The verbs of the Captives (src/catalog/families/uruk.ts): null when the verb is not one of them. */
export function runCaptive(state: ScenarioState, instruction: Instruction, focus: Focus): ScenarioState | null {
  switch (instruction.verb) {
    case "TakeCaptive":
      return takeCaptive(state, instruction, focus);
    case "AttachCaptive":
      return attachCaptive(state, focus);
    case "ReturnCaptive":
      return returnCaptive(state, instruction, focus);
    default:
      return null;
  }
}

/** The `loggedCaptive` filter: the hero is one the Campaign Log names as a captive of the seat that controls it. Without the filter every card passes. */
export function loggedCaptiveMatches(state: ScenarioState, id: string, logged: true | undefined): boolean {
  if (logged !== true) return true;
  const card = state.cards[id];
  return card != null && (state.campaignFacts?.heroLog?.captives ?? []).some((entry) => entry.hero === card.code && entry.seat === card.controller);
}
