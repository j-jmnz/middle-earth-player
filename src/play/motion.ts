// How each card moves when the table changes, so a card is seen entering, moving and leaving: drawn from the deck into the
// hand, revealed from the encounter deck into staging, played from the hand onto the table, discarded onto its pile. Pure:
// JavaScript works out where each card comes from (or goes to) once per new state; the UI thread only interpolates
// (docs/design-system-table.md, Motion). The rule is already resolved when a card moves; the motion only shows it. This file
// says what each card does (flip, wait its turn, rise on an arc, land with a squash or a pop); motion-pose.ts works out the pose
// at a moment from motion-tokens.ts, and the UI never computes a number of its own.
import type { ZoneName } from "../rules/state.ts";

import type { CardSlot, TableLayout } from "./layout.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";

// A card's way into its slot: where it starts relative to the slot (its center offset and size), the turn it starts at, and
// how visible it starts. The identity motion is no motion.
//   flip: it starts face down and turns to its face at the midpoint (a drawn card, a revealed encounter card);
//   delay: ms it waits before it starts, so cards drawn together leave one after another;
//   arc: points it rises at mid-path;
//   land: how it lands: "squash" (a card played from the hand), "pop" (a revealed card), or not at all;
//   slide: a hand sliding up into place when the acting seat changes.
export type Motion = {
  dx: number;
  dy: number;
  scale: number;
  fromRot: number;
  toRot: number;
  fromOpacity: number;
  flip: boolean;
  delay: number;
  arc: number;
  land: "squash" | "pop" | null;
  slide: boolean;
};

// How a card that left the table goes: "shake" (destroyed or discarded from play: it shakes, then shrinks and fades to its
// pile), "glide" (to a pile from the hand or back to a deck: it eases in to the pile), "fade" (set aside: it fades where it stood).
export type Leave = "shake" | "glide" | "fade";

// A card that left the table: drawn where it was, moving toward its pile (or fading where it stood).
export type Ghost = { slot: CardSlot; dx: number; dy: number; scale: number; rot: number; leave: Leave };

/**
 * What `motionsBetween` can be told: the acting seat changed (`handoff`), so the hand that appears slides up and nothing is dealt. A
 * peek at the other seat has no motion: card-motion.native.tsx draws its layout at rest.
 */
export type MotionOptions = { handoff?: boolean };

/** The turn a slot is drawn at: an exhausted card lies sideways, a hand card keeps its slight fan. */
export function slotRotation(slot: CardSlot): number {
  "worklet";
  return slot.exhausted ? Math.PI / 2 : slot.tilt;
}

function center(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** A slot with no motion, for one the map has no entry for. */
export const AT_REST: Motion = { dx: 0, dy: 0, scale: 1, fromRot: 0, toRot: 0, fromOpacity: 1, flip: false, delay: 0, arc: 0, land: null, slide: false };

const STILL = (slot: CardSlot): Motion => ({ dx: 0, dy: 0, scale: 1, fromRot: slotRotation(slot), toRot: slotRotation(slot), fromOpacity: 1, flip: false, delay: 0, arc: 0, land: null, slide: false });

function from(slot: CardSlot, origin: { x: number; y: number; w: number; h: number }, rot: number, opacity: number): Motion {
  const a = center(origin);
  const b = center(slot);
  return { ...STILL(slot), dx: a.x - b.x, dy: a.y - b.y, scale: origin.w / Math.max(1, slot.w), fromRot: rot, fromOpacity: opacity };
}

/** True when nothing about the slot moves. */
export function still(motion: Motion): boolean {
  return motion.dx === 0 && motion.dy === 0 && motion.scale === 1 && motion.fromRot === motion.toRot && motion.fromOpacity === 1 && !motion.flip && motion.land == null && !motion.slide;
}

/**
 * The motion of each slot of `next` (by slot id) and the cards of `prev` that left the table. `zoneNow` says where a card
 * is in the new state, so a card that left goes to its pile. With no previous layout (the first draw) nothing moves.
 */
export function motionsBetween(
  prev: TableLayout | null,
  next: TableLayout,
  zoneNow: (cardId: string) => ZoneName | null,
  options: MotionOptions = {},
): { motions: ReadonlyMap<string, Motion>; ghosts: readonly Ghost[] } {
  const motions = new Map<string, Motion>();
  if (!prev) {
    for (const slot of next.slots) motions.set(slot.id, STILL(slot));
    return { motions, ghosts: [] };
  }
  const before = new Map(prev.slots.map((slot) => [slot.id, slot]));
  const handoff = options.handoff === true;
  // The cards that come off the deck this state, in hand order: each leaves MOTION.stagger after the one before.
  let drawn = 0;
  for (const slot of next.slots) {
    const was = before.get(slot.id);
    if (slot.kind === "pile") {
      motions.set(slot.id, STILL(slot));
      continue;
    }
    if (was) {
      // A card that was in the hand and is not any more is played: it lifts, glides and lands with a squash.
      const played = !handoff && was.zone === "hand" && slot.zone !== "hand";
      motions.set(slot.id, { ...from(slot, was, slotRotation(was), 1), land: played ? "squash" : null });
      continue;
    }
    if (handoff) {
      // The acting seat changed: nothing is dealt. Its hand slides up into place and the rest fades in over the same time, so the two
      // seats cross-fade (the old seat's cards leave as ghosts).
      motions.set(slot.id, { ...STILL(slot), dy: slot.zone === "hand" ? slot.h * SHAPE.seatHandRise : 0, fromOpacity: 0, slide: true });
      continue;
    }
    // New on the table: a hand card comes off the deck, an encounter card off the encounter deck, anything else grows in.
    // A face-up card starts face down and turns over; a shadow card is dealt face down and stays so.
    if (slot.zone === "hand") {
      const delay = Math.min(drawn, SHAPE.maxStagger) * MOTION.stagger.ms;
      drawn += 1;
      motions.set(slot.id, { ...from(slot, next.piles.deck, 0, 0.4), flip: !slot.faceDown, delay, arc: SHAPE.arc });
    } else if (slot.kind === "shadow") {
      motions.set(slot.id, from(slot, next.piles.encounterDeck, 0, 0.4));
    } else if (slot.zone === "staging" || slot.zone === "engaged") {
      const reveal = slot.kind === "card" && !slot.faceDown;
      motions.set(slot.id, { ...from(slot, next.piles.encounterDeck, 0, 0.4), flip: reveal, land: reveal ? "pop" : null });
    } else motions.set(slot.id, { ...STILL(slot), scale: 0.82, fromOpacity: 0 });
  }
  const present = new Set(next.slots.map((slot) => slot.id));
  const ghosts: Ghost[] = [];
  for (const slot of prev.slots) {
    if (slot.kind === "pile" || present.has(slot.id)) continue;
    if (slot.faceDown) continue;
    const zone = zoneNow(slot.id);
    const pile =
      zone === "discard" ? next.piles.discard : zone === "encounterDiscard" ? next.piles.encounterDiscard : zone === "deck" ? next.piles.deck : zone === "encounterDeck" ? next.piles.encounterDeck : null;
    if (pile) {
      const a = center(slot);
      const b = center(pile);
      // Destroyed or discarded from the table shakes first; from the hand (an event played, a discard) or back to a deck it just glides.
      const discarded = (zone === "discard" || zone === "encounterDiscard") && slot.zone !== "hand";
      ghosts.push({ slot, dx: b.x - a.x, dy: b.y - a.y, scale: pile.w / Math.max(1, slot.w), rot: 0, leave: discarded ? "shake" : "glide" });
    } else {
      // The victory display, set aside, out of play: it fades where it stood.
      ghosts.push({ slot, dx: 0, dy: 0, scale: 0.85, rot: slotRotation(slot), leave: "fade" });
    }
  }
  return { motions, ghosts };
}
