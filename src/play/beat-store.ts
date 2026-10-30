// The cards the outcome banner's current line names, ringed on the table while the banner is at that line (moment-banner.tsx calls
// `onBeat` as it reaches each line; use-table-choice.ts hands it on). They live in a small store the screen creates once and only the table
// canvas reads, so a beat draws the canvas and not the whole table view or the hooks above it. Nothing here draws.
import { createStore, type StoreApi } from "zustand/vanilla";

/** The beat's cards as one string that compares by value (card ids carry no commas); "" for none. */
export type Beat = { key: string };

export type BeatStore = StoreApi<Beat>;

export function createBeats(): BeatStore {
  return createStore<Beat>()(() => ({ key: "" }));
}

/** Rings these cards (none for an empty list). The same cards again change nothing. */
export function setBeat(beats: BeatStore, cards: readonly string[]): void {
  const key = cards.join(",");
  if (beats.getState().key !== key) beats.setState({ key });
}

/** The card ids in a beat's key. */
export function beatIds(key: string): ReadonlySet<string> {
  return new Set(key === "" ? [] : key.split(","));
}
