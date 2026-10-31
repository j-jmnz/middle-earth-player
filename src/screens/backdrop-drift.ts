import { useIsFocused } from "expo-router";

import { useStore } from "zustand";

import { useReduceMotion } from "../play/motion-run";
import { tableSettings } from "../play/table-settings";

/**
 * Whether the fog drifts now: only on the screen in front (screens under it stay mounted, and would draw for nothing), never
 * under reduced motion, and not when the Moving fog setting is off, where it holds where it is. A backgrounded app draws no frames, so it stops there on its own.
 */
export function useDriftRunning(): boolean {
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const fogDrift = useStore(tableSettings, (state) => state.settings.fogDrift);
  return focused && !reduceMotion && fogDrift;
}
