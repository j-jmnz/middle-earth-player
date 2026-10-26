// Rules: mec109.stage-4, rr.ownership-and-control, rr.in-play-and-out-of-play (data/rules/entries.json).
//
// The Ring-bearer facedown under the Watcher in the Water. While it is there, it and each card attached to it are still in play,
// but no player controls them: the hero leaves its owner's list of heroes, its attachments leave the play area, and nothing
// that asks "you control" finds them. The Watcher's Forced effect gives them to the first player, who takes control of the
// Ring-bearer exhausted with damage on it.
import type { Instruction } from "../../catalog/boundary.ts";

import type { ReduceContext } from "../interpret.ts";
import { fromEncounterDeck, printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";
import { updateCard } from "../state.ts";
import { attachTo, moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";
import { ringBearerId } from "./burden-deck.ts";

// The hero facedown under the card, or null. Its attachments are not in the captive zone: they stay attached to it.
export function captiveUnder(state: ScenarioState, hostId: string): string | null {
  return Object.values(state.cards).find((card) => card.zone === "captive" && card.host === hostId)?.id ?? null;
}

// CaptureRingBearer: discards every token on the Ring-bearer (its life is its own number, not a token), and places it and each
// card attached to it facedown under the source. Nothing happens when no player controls a Ring-bearer.
export function captureRingBearer(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const heroId = ringBearerId(state, ctx);
  const hostId = focus.sourceId;
  if (!heroId || !hostId || !state.cards[hostId]) return state;
  const attachments = [...(state.cards[heroId]?.attachments ?? [])];
  let next = updateCard(moveCard(state, heroId, { zone: "captive", hostId }), heroId, { damage: 0, resources: 0, progress: 0 });
  for (const id of attachments) {
    const moved = updateCard(moveCard(next, id, { zone: "attached" }), id, { damage: 0, resources: 0, progress: 0, face: "down" });
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
  const seat = state.firstPlayer;
  const attachments = [...(state.cards[heroId]?.attachments ?? [])];
  let next = updateCard(moveCard(state, heroId, { zone: "heroes", seat }), heroId, { exhausted: true, damage: instruction.damage, face: "up" });
  for (const id of attachments) {
    const card = next.cards[id];
    if (!card) continue;
    const placed = fromEncounterDeck(printedOf(ctx.cards, card.code)) ? next : moveCard(next, id, { zone: "play", seat });
    next = attachTo(updateCard(placed, id, { face: "up" }), id, heroId);
  }
  return next;
}
