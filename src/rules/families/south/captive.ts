// Rules: mec109.stage-4, rr.ownership-and-control, rr.in-play-and-out-of-play (data/rules/entries.json).
//
// The Ring-bearer facedown under the Watcher in the Water. While it is there, it and each card attached to it are still in play,
// but no player controls them: the hero leaves its owner's list of heroes, its attachments leave the play area, and nothing
// that asks "you control" finds them. The Watcher's Forced effect gives them to the first player, who takes control of the
// Ring-bearer exhausted with damage on it.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { ringBearerId } from "../burden/deck.ts";

// The hero facedown under the card, or null. Its attachments are not in the captive zone: they stay attached to it.
export function captiveUnder(state: ScenarioState, hostId: string): string | null {
  return Object.values(state.cards).find((card) => card.zone === "captive" && card.host === hostId)?.id ?? null;
}

// Every hero held under the card: The Uruk-hai's To Isengard! holds one for each player (families/uruk/captive.ts), the other holders one.
export function captivesUnder(state: ScenarioState, hostId: string): string[] {
  return Object.values(state.cards).filter((card) => card.zone === "captive" && card.host === hostId).map((card) => card.id);
}

// CaptureRingBearer: discards every token on the Ring-bearer (its life is its own number, not a token), and places it and each
// card attached to it facedown under the source. Nothing happens when no player controls a Ring-bearer.
export function captureRingBearer(state: ScenarioState, instruction: Extract<Instruction, { verb: "CaptureRingBearer" }>, ctx: ReduceContext): ScenarioState {
  const heroId = ringBearerId(state, ctx);
  const hostId = Object.values(state.cards).find((card) => card.code === instruction.under && inPlay(card.zone))?.id;
  if (!heroId || !hostId || !state.cards[hostId]) return state;
  return captureHero(state, heroId, hostId);
}

// What a held hero remembers of where it came from: the seat that controls it (its owner) and its place among that seat's heroes. Read before the capture takes the control away.
export function heldFrom(state: ScenarioState, heroId: string): Pick<CardInstance, "owner" | "heroSlot"> {
  const seat = state.cards[heroId]?.controller ?? null;
  const slot = seat != null ? (state.seats[seat]?.heroes.indexOf(heroId) ?? -1) : -1;
  return { ...(seat != null ? { owner: seat } : {}), ...(slot >= 0 ? { heroSlot: slot } : {}) };
}

// The hero and each card attached to it go facedown into the captive zone, under the card `hostId` (the Watcher) or under no card
// (`prisoner`: the prisoner of Escape from Dol Guldur, families/prisoner.ts, whose cards are also flagged as the prisoner's and whose
// hero remembers the seat it came from). Every token on them is discarded. `attachmentsDown`: the attached cards are turned facedown too (the
// Ring-bearer's always are; the prisoner's only when the campaign card says so, 01131:A:3).
export function captureHero(state: ScenarioState, heroId: string, hostId: string | null, prisoner = false, attachmentsDown = true): ScenarioState {
  const attachments = [...(state.cards[heroId]?.attachments ?? [])];
  let next = updateCard(moveCard(state, heroId, { zone: "captive", hostId }), heroId, { damage: 0, resources: 0, progress: 0, ...(prisoner ? { prisoner: true as const, ...heldFrom(state, heroId) } : {}) });
  for (const id of attachments) {
    // A card a player played keeps its owner, so the release knows to give it to the first player (a Condition an encounter card
    // attached has no controller and no owner).
    const controller = next.cards[id]?.controller;
    const moved = updateCard(moveCard(next, id, { zone: "attached" }), id, { damage: 0, resources: 0, progress: 0, face: attachmentsDown ? "down" : "up", ...(controller != null ? { owner: controller } : {}), ...(prisoner ? { prisoner: true as const } : {}) });
    next = attachTo(moved, id, heroId);
  }
  return next;
}

// ReleaseRingBearer: the first player takes control of the hero under the source and of the cards attached to it, face up. The
// hero comes back exhausted with `damage` damage on it. A card the players played goes back to the play area of the first player;
// a Condition an encounter card attached stays controlled by nobody.
export function releaseRingBearer(state: ScenarioState, instruction: Extract<Instruction, { verb: "ReleaseRingBearer" }>, focus: Focus, ctx: ReduceContext): ScenarioState {
  const hostId = focus.sourceId;
  const heroId = hostId ? captiveUnder(state, hostId) : null;
  if (!heroId) return state;
  return releaseHero(state, heroId, state.firstPlayer, { exhausted: true, damage: instruction.damage, face: "up" });
}

// The hero comes back among the heroes of `seat` with `patch`, and the cards attached to it come back faceup with `attachmentPatch`: a card a player
// played goes to the play area of `seat` (of its own owner when `toOwner`); a card nobody owns stays controlled by nobody. Shared by the Ring-bearer's
// release and the prisoner's rescue (families/prisoner.ts).
export function releaseHero(state: ScenarioState, heroId: string, seat: number, patch: Partial<CardInstance>, attachmentPatch: Partial<CardInstance> = {}, toOwner = false): ScenarioState {
  const attachments = [...(state.cards[heroId]?.attachments ?? [])];
  let next = updateCard(moveCard(state, heroId, { zone: "heroes", seat }), heroId, patch);
  for (const id of attachments) {
    const card = next.cards[id];
    if (!card) continue;
    const to = toOwner ? card.owner : seat;
    const placed = card.owner == null || to == null ? next : moveCard(next, id, { zone: "play", seat: to });
    next = attachTo(updateCard(placed, id, { face: "up", ...attachmentPatch }), id, heroId);
  }
  return next;
}
