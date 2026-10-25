// How each card moves when the table changes, so a card is seen entering, moving and leaving: drawn from the deck into the
// hand, revealed from the encounter deck into staging, played from the hand onto the table, discarded onto its pile. Pure:
// JavaScript works out where each card comes from (or goes to) once per new state; the UI thread only interpolates
// (docs/design-system.md, Table). The rule is already resolved when a card moves; the motion only shows it.
import type { ZoneName } from "../rules/state.ts";

import type { CardSlot, TableLayout } from "./layout.ts";

// A card's way into its slot: where it starts relative to the slot (its center offset and size), the turn it starts at, and
// how visible it starts. The identity motion is no motion.
export type Motion = { dx: number; dy: number; scale: number; fromRot: number; toRot: number; fromOpacity: number };

// A card that left the table: drawn where it was, moving toward its pile (or fading where it stood).
export type Ghost = { slot: CardSlot; dx: number; dy: number; scale: number; rot: number };

/** The turn a slot is drawn at: an exhausted card lies sideways, a hand card keeps its slight fan. */
export function slotRotation(slot: CardSlot): number {
  return slot.exhausted ? Math.PI / 2 : slot.tilt;
}

function center(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

const STILL = (slot: CardSlot): Motion => ({ dx: 0, dy: 0, scale: 1, fromRot: slotRotation(slot), toRot: slotRotation(slot), fromOpacity: 1 });

function from(slot: CardSlot, origin: { x: number; y: number; w: number; h: number }, rot: number, opacity: number): Motion {
  const a = center(origin);
  const b = center(slot);
  return { dx: a.x - b.x, dy: a.y - b.y, scale: origin.w / Math.max(1, slot.w), fromRot: rot, toRot: slotRotation(slot), fromOpacity: opacity };
}

/** True when nothing about the slot moves. */
export function still(motion: Motion): boolean {
  return motion.dx === 0 && motion.dy === 0 && motion.scale === 1 && motion.fromRot === motion.toRot && motion.fromOpacity === 1;
}

/**
 * The motion of each slot of `next` (by slot id) and the cards of `prev` that left the table. `zoneNow` says where a card
 * is in the new state, so a card that left goes to its pile. With no previous layout (the first draw) nothing moves.
 */
export function motionsBetween(prev: TableLayout | null, next: TableLayout, zoneNow: (cardId: string) => ZoneName | null): { motions: ReadonlyMap<string, Motion>; ghosts: readonly Ghost[] } {
  const motions = new Map<string, Motion>();
  if (!prev) {
    for (const slot of next.slots) motions.set(slot.id, STILL(slot));
    return { motions, ghosts: [] };
  }
  const before = new Map(prev.slots.map((slot) => [slot.id, slot]));
  for (const slot of next.slots) {
    const was = before.get(slot.id);
    if (slot.kind === "pile") {
      motions.set(slot.id, STILL(slot));
      continue;
    }
    if (was) {
      motions.set(slot.id, from(slot, was, slotRotation(was), 1));
      continue;
    }
    // New on the table: a hand card comes off the deck, an encounter card off the encounter deck, anything else grows in.
    if (slot.zone === "hand") motions.set(slot.id, from(slot, next.piles.deck, 0, 0.4));
    else if (slot.kind === "shadow" || slot.zone === "staging" || slot.zone === "engaged") motions.set(slot.id, from(slot, next.piles.encounterDeck, 0, 0.4));
    else motions.set(slot.id, { ...STILL(slot), scale: 0.82, fromOpacity: 0 });
  }
  const present = new Set(next.slots.map((slot) => slot.id));
  const ghosts: Ghost[] = [];
  for (const slot of prev.slots) {
    if (slot.kind === "pile" || present.has(slot.id) || slot.faceDown) continue;
    const zone = zoneNow(slot.id);
    const pile =
      zone === "discard" ? next.piles.discard : zone === "encounterDiscard" ? next.piles.encounterDiscard : zone === "deck" ? next.piles.deck : zone === "encounterDeck" ? next.piles.encounterDeck : null;
    if (pile) {
      const a = center(slot);
      const b = center(pile);
      ghosts.push({ slot, dx: b.x - a.x, dy: b.y - a.y, scale: pile.w / Math.max(1, slot.w), rot: 0 });
    } else {
      // The victory display, set aside, out of play: it fades where it stood.
      ghosts.push({ slot, dx: 0, dy: 0, scale: 0.85, rot: slotRotation(slot) });
    }
  }
  return { motions, ghosts };
}
