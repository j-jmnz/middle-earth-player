import { useIsFocused } from "expo-router";

import { useReduceMotion } from "../play/motion-run";

/**
 * Whether the fog drifts now: only on the screen in front (screens under it stay mounted, and would draw for nothing), and never
 * under reduced motion, where it holds where it is. A backgrounded app draws no frames, so it stops there on its own.
 */
export function useDriftRunning(): boolean {
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  return focused && !reduceMotion;
}
