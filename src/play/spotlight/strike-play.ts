// Plays the attacks' sounds (strike-sounds.ts says which): at each hit stop on the spotlight's clock (use-spotlight.ts), and once for
// the attacks a skipped gate jumped past (useSkippedStrikes, mounted beside the table view: src/play/chrome/table-music.tsx).
import { useEffect } from "react";
import { useStore } from "zustand";

import { playSound } from "../../ui/sound/sound.ts";
import type { SoundSlot } from "../../ui/sound/slots.ts";
import type { TableStore } from "../store/store.ts";
import { skippedSounds } from "./strike-sounds.ts";

// How many of each gate's attacks have played their sound at the hit stop, by the gate's seq. Kept for the last few gates only.
const struck = new Map<number, number>();
const KEPT = 8;

/** An attack's sounds at its hit stop, counted, so a skip after it does not play them again. */
export function playStrike(seq: number, index: number, slot: SoundSlot): void {
  struck.set(seq, Math.max(struck.get(seq) ?? 0, index + 1));
  for (const old of [...struck.keys()].slice(0, Math.max(0, struck.size - KEPT))) struck.delete(old);
  playSound(slot);
}

/** Plays a skipped gate's sounds once (the table's audio, mounted beside the table view: src/play/chrome/table-music.tsx). */
export function useSkippedStrikes(store: TableStore): void {
  const gate = useStore(store, (state) => state.spotlight);
  useEffect(() => {
    if (gate.ended !== "skipped") return;
    const from = struck.get(gate.seq) ?? 0;
    if (from >= gate.clashes.length) return;
    struck.set(gate.seq, gate.clashes.length);
    for (const slot of skippedSounds(gate, from)) playSound(slot);
  }, [gate]);
}
