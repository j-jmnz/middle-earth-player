// The phase carousel's height and what its left column needs (docs/design-system.md, Table, Phase carousel). Pure, so a test reads it: the
// round's seven phases and the round's label must fit the panel on the shortest tables (667x375, 844x390) without scrolling.
import { touchSlop } from "./ui-scale.ts";

/** The panel floats this far inside the canvas, and this far under the top bar (half of it). */
export const CAROUSEL_INSET = 8;
/** A phase row as drawn; its 44 pt target is made up by a vertical hit slop of `phaseSlop` on each side. */
export const PHASE_ROW = 38;
/** The round's label above the phases: one line of label type, not a target. */
export const ROUND_HEAD = 26;
/** The column's foot padding. */
export const CAROUSEL_FOOT = 4;
/** The phases in a round. */
export const PHASES = 7;
/** The tallest the panel is, at Medium. */
export const CAROUSEL_MAX = 340;
/** The room left under the panel at the screen's foot, at Medium (a safe inset takes over when it is larger). */
export const CAROUSEL_BOTTOM = 8;

/** The panel's height: the room under the top bar less the foot, at most CAROUSEL_MAX. */
export function carouselHeight(a: { screenHeight: number; barBottom: number; insetBottom: number }, s: number): number {
  return Math.round(Math.min(CAROUSEL_MAX * s, a.screenHeight - a.barBottom - Math.max(a.insetBottom, CAROUSEL_BOTTOM * s)));
}

/** The vertical hit slop on each side of a phase row that makes up a 44 pt target at scale `s`. */
export function phaseSlop(s: number): number {
  return touchSlop(s, PHASE_ROW * s);
}

/** The height the left column needs at scale `s`: the label, seven rows and the foot (the panel also sits half an inset under the bar). */
export function carouselNeeds(s: number): number {
  return (CAROUSEL_INSET / 2 + ROUND_HEAD + PHASES * PHASE_ROW + CAROUSEL_FOOT) * s;
}
