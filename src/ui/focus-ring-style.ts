// The focus ring's outline (focus-ring.ts), pure so a test can pin it.
import type { ViewStyle } from "react-native";

export const RING_WIDTH = 2;
export const RING_OFFSET = 2;

/** The outline of a focused control, in points already scaled. */
export function ringStyleOf(color: string, s: number): ViewStyle {
  return { outlineStyle: "solid", outlineColor: color, outlineWidth: RING_WIDTH * s, outlineOffset: RING_OFFSET * s };
}

