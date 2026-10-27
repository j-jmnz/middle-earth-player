// Whether a hand scrub is open, for Android Back (back.ts): the canvas says when one opens and closes and registers how to cancel it.
// Plain module state on the JavaScript thread; a scrub exists only while a finger is down, so there is never more than one.
import { ticksOn } from "./hand-scrub.ts";

let open = false;
let under = -1;
let dead = false;
const listeners = new Set<() => void>();

/** The card under the finger as the JavaScript side last heard (-1 for none): the canvas draws the lifted copy of that card. */
export function scrubUnder(): number {
  return under;
}

export function subscribeScrub(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed(): void {
  listeners.forEach((listener) => listener());
}
let cancel: (() => void) | null = null;

/** The canvas: a scrub opened or closed. */
export function setScrubOpen(value: boolean): void {
  open = value;
  if (!value && under !== -1) {
    under = -1;
    changed();
  }
}

/**
 * The canvas heard the card under the finger change (or the scrub close): remembers it, opens or closes the scrub, and says whether
 * the selection tick plays now.
 */
export function scrubMoved(next: number, isOpen: boolean, start = false): boolean {
  // A message sent before Back cancelled the scrub arrives after it: it must not open the scrub again. Only a real start does.
  if (isOpen && dead && !start) return false;
  if (start) dead = false;
  const tick = ticksOn(under, next);
  const before = under;
  under = isOpen ? next : -1;
  open = isOpen;
  if (under !== before) changed();
  return tick;
}

/** The canvas: how Back cancels its scrub, or null when it unmounts. */
export function onScrubCancel(handler: (() => void) | null): void {
  cancel = handler;
}

/** Whether a scrub is open now. */
export function scrubOpen(): boolean {
  return open;
}

/** Cancels the open scrub: the hand settles back, with no preview. */
export function cancelScrub(): void {
  open = false;
  dead = true;
  if (under !== -1) {
    under = -1;
    changed();
  }
  cancel?.();
}
