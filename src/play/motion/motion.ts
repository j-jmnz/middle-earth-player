// How each card moves when the table changes, so a card is seen entering, moving and leaving: drawn from the deck into the
// hand, revealed from the encounter deck into staging, played from the hand onto the table, discarded onto its pile. Pure:
// JavaScript works out where each card comes from (or goes to) once per new state; the UI thread only interpolates
// (docs/design-system-table.md, Motion). The rule is already resolved when a card moves; the motion only shows it. This file
// says what each card does (flip, wait its turn, rise on an arc, land with a squash or a pop); motion/pose.ts works out the pose
// at a moment from src/ui/motion-tokens.ts, and the UI never computes a number of its own.
import type { ZoneName } from "../../rules/core/state.ts";

import type { CardSlot, Rect, TableLayout } from "../layout/layout.ts";
import { MOTION, SHAPE } from "../../ui/motion-tokens.ts";
import { isDiscardPile, type PileId } from "../store/selectors.ts";

// A card's way into its slot: where it starts relative to the slot (its center offset and size), the turn it starts at, and
// how visible it starts. The identity motion is no motion.
//   flip: it starts face down and turns to its face at the midpoint (a drawn card, a revealed encounter card);
//   delay: ms it waits before it starts, so cards drawn together leave one after another;
//   arc: points it rises at mid-path;
//   land: how it lands: "squash" (a card played from the hand), "pop" (a revealed card), or not at all.
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
};

// The decks of the second slot a card is revealed from, and the decks that are refilled from a discard pile of their own.
const SECOND_DECK_PILES: Readonly<Record<string, true>> = { corsairDeck: true, evilCreaturesDeck: true, balrogDeck: true, cavesDeck: true, haradDeck: true, angmarOrcDeck: true, investigationDeck: true, smaugDeck: true };
const REFILLED = [["corsairDeck", "corsairDiscard"], ["evilCreaturesDeck", "evilCreaturesDiscard"], ["balrogDeck", "balrogDiscard"], ["smaugDeck", "smaugDiscard"]] as const;

// How a card that left the table goes: "shake" (destroyed or discarded from play: it shakes, then shrinks and fades to its
// pile), "glide" (to a pile from the hand or back to a deck: it eases in to the pile), "fade" (set aside: it fades where it stood).
export type Leave = "shake" | "glide" | "fade";

// A card that left the table: drawn where it was, moving toward its pile (or fading where it stood).
export type Ghost = { slot: CardSlot; dx: number; dy: number; scale: number; rot: number; leave: Leave };

/**
 * What `motionsBetween` can be told. A peek or a seat handoff has no motion: card-motion.native.tsx draws its layout at rest.
 */
export type MotionOptions = {
  // Where a card was in the state before (null when it was nowhere): a card that came from a deck of the second slot (the Corsair deck: Boarding, dcce.boarding; the Evil Creatures deck; the Caves deck) comes off that pile, not the encounter deck.
  zoneWas?: (cardId: string) => ZoneName | null;
  // The location a card was grappled with in the state before, or null: a detached enemy starts under that location, facedown, and turns over as it lands in the staging area (dcce.grapple).
  grappledFrom?: (cardId: string) => string | null;
};

/** The turn a slot is drawn at: an exhausted card lies sideways, a hand card keeps its slight fan. */
export function slotRotation(slot: CardSlot): number {
  "worklet";
  return slot.exhausted ? Math.PI / 2 : slot.tilt;
}

// Where each card a row folded into its stack stands: the stack's rectangle (row-fold.ts).
function foldedAt(layout: TableLayout): ReadonlyMap<string, Rect> {
  const at = new Map<string, Rect>();
  for (const fold of layout.folds ?? []) for (const id of fold.cards) at.set(id, fold.rect);
  return at;
}

function center(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** A slot with no motion, for one the map has no entry for. */
export const AT_REST: Motion = { dx: 0, dy: 0, scale: 1, fromRot: 0, toRot: 0, fromOpacity: 1, flip: false, delay: 0, arc: 0, land: null };

const STILL = (slot: CardSlot): Motion => ({ dx: 0, dy: 0, scale: 1, fromRot: slotRotation(slot), toRot: slotRotation(slot), fromOpacity: 1, flip: false, delay: 0, arc: 0, land: null });

function from(slot: CardSlot, origin: { x: number; y: number; w: number; h: number }, rot: number, opacity: number): Motion {
  const a = center(origin);
  const b = center(slot);
  return { ...STILL(slot), dx: a.x - b.x, dy: a.y - b.y, scale: origin.w / Math.max(1, slot.w), fromRot: rot, fromOpacity: opacity };
}

/** True when nothing about the slot moves. */
export function still(motion: Motion): boolean {
  return motion.dx === 0 && motion.dy === 0 && motion.scale === 1 && motion.fromRot === motion.toRot && motion.fromOpacity === 1 && !motion.flip && motion.land == null;
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
  // A card that left a fold stack comes out of it; a card that folded glides into it (row-fold.ts).
  const stackedBefore = foldedAt(prev);
  const stackedNow = foldedAt(next);
  // The cards that come off the deck this state, in hand order: each leaves MOTION.stagger after the one before.
  let drawn = 0;
  // The cards that come off the Corsair deck (Boarding) or are looked at in a Sailing test, each MOTION.stagger after the one before (docs/design-system-table.md, Motion).
  let boarded = 0;
  let looked = 0;
  // The pile of the second slot's deck a card came off in the state before, or null.
  const secondSource = (cardId: string) => {
    const wasZone = options.zoneWas?.(cardId) ?? null;
    return wasZone != null && wasZone in SECOND_DECK_PILES ? (next.piles[wasZone as PileId] ?? null) : null;
  };
  for (const slot of next.slots) {
    const was = before.get(slot.id);
    if (slot.kind === "pile") {
      motions.set(slot.id, STILL(slot));
      continue;
    }
    if (was) {
      // A card that was in the hand and is not any more is played: it lifts, glides and lands with a squash.
      const played = was.zone === "hand" && slot.zone !== "hand";
      // The one enemy of a grappled stack that showed under its location turns over as it is detached.
      const turned = was.kind === "attachment" && was.faceDown && !slot.faceDown && slot.kind === "card";
      motions.set(slot.id, { ...from(slot, was, slotRotation(was), 1), flip: turned, land: played ? "squash" : turned ? "pop" : null });
      continue;
    }
    // A detached enemy comes out from under the location it was grappled with and turns over.
    const holder = options.grappledFrom?.(slot.id);
    const under = holder ? before.get(holder) : undefined;
    if (under && slot.zone === "staging") {
      motions.set(slot.id, { ...from(slot, under, 0, 1), flip: slot.kind === "card" && !slot.faceDown, land: "pop" });
      continue;
    }
    // A card that left the fold stack (the moment now asks about it) starts at the stack, as it was, and is not revealed again.
    const stack = stackedBefore.get(slot.id);
    if (stack) {
      motions.set(slot.id, from(slot, stack, 0, 1));
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
    } else if (slot.success != null) {
      // A card of a Sailing test's look comes off the encounter deck face up, one after another: the Eye, the turn, the pop.
      const delay = Math.min(looked, SHAPE.maxStagger) * MOTION.stagger.ms;
      looked += 1;
      motions.set(slot.id, { ...from(slot, next.piles.encounterDeck, 0, 0.4), flip: true, land: "pop", delay });
    } else if (slot.stormcaller === "stage") {
      // The Stormcaller's stage advance (dcce.stormcallers-area-stages): the new stage grows in where the last one stood and lands with a pop, as the quest card's does; the last one fades out.
      motions.set(slot.id, { ...STILL(slot), scale: 0.82, fromOpacity: 0, land: "pop" });
    } else if (slot.zone === "staging" || slot.zone === "engaged" || (secondSource(slot.id) != null && (slot.zone === "activeLocation" || slot.zone === "secondActiveLocation"))) {
      const reveal = slot.kind === "card" && !slot.faceDown;
      // A card that came off a deck of the second slot (Boarding's Corsair cards, an Evil Creature or a Cave revealed, or a Cave placed at the active location) comes off that pile, not the encounter deck.
      const source = secondSource(slot.id);
      // A Lost Island comes off the Uncharted deck, and a Grotto location off the Grotto deck, as a reveal does.
      const island = options.zoneWas?.(slot.id) === "unchartedDeck" ? (next.piles.unchartedDeck ?? next.piles.grottoDeck ?? null) : null;
      // Boarding: each Corsair card comes off the Corsair deck as a reveal does, then moves into the engagement row, the cards 90 ms apart.
      const delay = source ? Math.min(boarded, SHAPE.maxStagger) * MOTION.stagger.ms : 0;
      if (source) boarded += 1;
      motions.set(slot.id, { ...from(slot, source ?? island ?? next.piles.encounterDeck, 0, 0.4), flip: reveal, land: reveal ? "pop" : null, delay });
    } else motions.set(slot.id, { ...STILL(slot), scale: 0.82, fromOpacity: 0 });
  }
  const present = new Set(next.slots.map((slot) => slot.id));
  const ghosts: Ghost[] = [];
  for (const slot of prev.slots) {
    if (slot.kind === "pile" || present.has(slot.id)) continue;
    // A card that folded into the stack glides into it.
    const stacked = stackedNow.get(slot.id);
    if (stacked && !slot.faceDown) {
      const a = center(slot);
      const b = center(stacked);
      ghosts.push({ slot, dx: b.x - a.x, dy: b.y - a.y, scale: stacked.w / Math.max(1, slot.w), rot: 0, leave: "glide" });
      continue;
    }
    if (slot.faceDown) continue;
    const zone = zoneNow(slot.id);
    // The pile of that name, when the card went to one (a discard pile, a deck). The engine's Uncharted deck is the Grotto deck's pile in a Grotto game: a location shuffled back into it glides there.
    const pile = zone === "unchartedDeck" ? (next.piles.unchartedDeck ?? next.piles.grottoDeck ?? null) : zone != null && zone in next.piles ? (next.piles[zone as PileId] ?? null) : null;
    if (pile) {
      const a = center(slot);
      const b = center(pile);
      // Destroyed or discarded from the table shakes first; from the hand (an event played, a discard) or back to a deck it just glides.
      // A card of a Sailing test's look glides to the encounter discard pile; it was never played, so it does not shake.
      const discarded = zone != null && isDiscardPile(zone as PileId) && slot.zone !== "hand" && slot.success == null;
      ghosts.push({ slot, dx: b.x - a.x, dy: b.y - a.y, scale: pile.w / Math.max(1, slot.w), rot: 0, leave: discarded ? "shake" : "glide" });
    } else {
      // A place with no pile on the table (set aside, removed from the game, out of play): it fades where it stood. The victory display is a pile, so a card going there glides to it.
      ghosts.push({ slot, dx: 0, dy: 0, scale: 0.85, rot: slotRotation(slot), leave: "fade" });
    }
  }
  // A deck with a discard pile of its own (the Corsair deck, the Evil Creatures deck) ran out and the discard pile was shuffled back into it: the discard pile's cards glide to the deck, and the deck's count pops (cardDepart).
  for (const [deckId, discardId] of REFILLED) {
    const wasDiscard = prev.slots.find((slot) => slot.id === `pile:${discardId}`);
    const wasDeck = prev.slots.find((slot) => slot.id === `pile:${deckId}`);
    const nowDeck = next.slots.find((slot) => slot.id === `pile:${deckId}`);
    if (wasDiscard && wasDeck && nowDeck && wasDiscard.count > 0 && nowDeck.count > wasDeck.count && next.piles[discardId] && next.slots.find((slot) => slot.id === `pile:${discardId}`)?.count === 0) {
      const a = center(wasDiscard);
      const b = center(nowDeck);
      ghosts.push({ slot: wasDiscard, dx: b.x - a.x, dy: b.y - a.y, scale: 1, rot: 0, leave: "glide" });
    }
  }
  return { motions, ghosts };
}
