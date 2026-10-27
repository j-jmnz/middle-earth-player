// Whether a hand scrub is open, for Android Back (back.ts): the canvas says when one opens and closes and registers how to cancel it.
// Plain module state on the JavaScript thread; a scrub exists only while a finger is down, so there is never more than one.
import { ticksOn } from "./hand-scrub.ts";

let open = false;
let under = -1;
let cancel: (() => void) | null = null;

/** The canvas: a scrub opened or closed. */
export function setScrubOpen(value: boolean): void {
  open = value;
  if (!value) under = -1;
}

/**
 * The canvas heard the card under the finger change (or the scrub close): remembers it, opens or closes the scrub, and says whether
 * the selection tick plays now.
 */
export function scrubMoved(next: number, isOpen: boolean): boolean {
  const tick = ticksOn(under, next);
  under = isOpen ? next : -1;
  open = isOpen;
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
  under = -1;
  cancel?.();
}
