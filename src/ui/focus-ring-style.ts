// The focus ring's outline (focus-ring.ts), pure so a test can pin it.
import type { ViewStyle } from "react-native";

import type { TableTokens } from "./tokens.ts";

export const RING_WIDTH = 2;
export const RING_OFFSET = 2;

/** The outline of a focused control, in points already scaled. */
export function ringStyleOf(color: string, s: number): ViewStyle {
  return { outlineStyle: "solid", outlineColor: color, outlineWidth: RING_WIDTH * s, outlineOffset: RING_OFFSET * s };
}


/** The ring's colour: accentHigh on the night and the raised surfaces, ink on paper and parchment (Paper is the same in both themes, where accentHigh on it is about 1:1). */
export function ringColorOf(t: TableTokens, onPaper: boolean): string {
  return onPaper ? t.ink : t.accentHigh;
}

/** The room a ring takes outside its control: its width and its offset, in points at the scale `s`. */
export function ringRoom(s: number): number {
  return (RING_WIDTH + RING_OFFSET) * s;
}

/**
 * The styles of a scroll view whose rows wear the ring: the content is padded by the ring's room on the sides and the top, so the scroll view
 * does not clip a focused first row's ring, and the view's margins take the same room back, so the rows stand where they stood.
 */
export function ringScroll(s: number): { style: ViewStyle; content: ViewStyle } {
  const room = ringRoom(s);
  return { style: { marginTop: -room, marginHorizontal: -room }, content: { paddingTop: room, paddingHorizontal: room } };
}
