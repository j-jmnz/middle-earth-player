// How tall the outcome banner is while it is up (moment-banner.tsx), so the list table keeps its rows clear of it: a focused row is never
// under the banner (WCAG 2.4.11). One module store, read through useSyncExternalStore (docs/architecture.md, Performance); 0 when no banner shows.
import { useSyncExternalStore } from "react";

let current = 0;
const listeners = new Set<() => void>();

/** The banner reports its height as it lays out, and 0 when it leaves. */
export function setBannerHeight(height: number): void {
  if (height === current) return;
  current = height;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const read = () => current;
const none = () => 0;

/** The banner's height now, in screen points; 0 while there is none. */
export function useBannerHeight(): number {
  return useSyncExternalStore(subscribe, read, none);
}

/** The height now, for a test. */
export function bannerHeightNow(): number {
  return current;
}
