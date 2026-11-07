// How large the whole UI draws (docs/design-system.md, Settings; user request, 2026-10-28). The setting is
// Small, Medium, Large or Extra large. Each size is multiplied by the factor, so text stays crisp and the layout reflows; nothing is transformed.
// NativeWind's rem carries the classes (the root layout sets it to 14 times the factor), and this file carries the numbers in code.
// Hairlines: an RN `borderWidth` hairline (1, 1.5) stays unscaled, while a Skia `strokeWidth` scales with the drawing it outlines.
import { createContext, useContext } from "react";

import type { UiScaleOption } from "./table-settings.ts";

/** The factor each option multiplies a size by. Medium is today's size. */
export const UI_SCALES: Readonly<Record<UiScaleOption, number>> = { small: 0.875, medium: 1, large: 1.15, xlarge: 1.3 };

/**
 * The line cap a text keeps at the phone's default text size: `lines` at a font scale of 1 or less, none (undefined) above it. The list
 * table, the dock, the choice's rows and the card preview follow the phone's text size up to 2 (docs/design-system.md, Type), so a cap
 * that only kept Medium's rows tidy is lifted and the row grows with its words.
 */
export function capLines(lines: number, fontScale: number): number | undefined {
  return fontScale > 1 ? undefined : lines;
}

/** The smallest a hit target gets, in points, whatever the scale. */
export const TOUCH_FLOOR = 44;

/** The base size of one rem in points. The root layout sets NativeWind's rem to this times the factor. */
export const REM_BASE = 14;

/** The factor for a setting; Medium's 1 for anything else. */
export function uiFactor(option: UiScaleOption): number {
  return UI_SCALES[option] ?? 1;
}

/** A size in points at scale `s`. Pass the Medium value, the one the design system names. */
export function scaled(s: number, n: number): number {
  return n * s;
}

/** A hit target's size at scale `s`: scaled, but never under 44 pt, so Small does not shrink a control below a thumb. */
export function touch(s: number, n: number): number {
  return Math.max(TOUCH_FLOOR, n * s);
}

/** The hit slop on each side that makes a visible `size` (points, already scaled) reach a 44 pt target at scale `s`; 0 when it already does. */
export function touchSlop(s: number, size: number): number {
  return Math.max(0, (touch(s, TOUCH_FLOOR) - size) / 2);
}

/** The factor, provided once at the root so a list row pays one context read, not a store selector. Without a provider (tests, isolated renders) it is 1. */
export const UiScaleContext = createContext<number>(1);

/** The scale factor `s`. Read it once per component and multiply the sizes that component draws. */
export function useUiScale(): number {
  return useContext(UiScaleContext);
}
