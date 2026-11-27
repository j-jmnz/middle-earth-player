// Where the token art sits on a card's upright rectangle (resources bottom left, damage top right, progress bottom right), shared
// by the tokens on the canvas (canvas/pieces.native.tsx) and the pop and floating number that mark their change (token-fx.native.tsx).
import type { Rect } from "../layout/layout.ts";
import type { TokenKind } from "../motion/token-deltas.ts";

/** The token art's size in points at Medium; the canvas draws it times the UI scale (ui-scale.ts). */
export const TOKEN = 18;

/** The center of a card's token of this kind at the UI scale `s`; `rect` is the card on screen, so an exhausted card's tokens stay upright. */
export function tokenSpot(rect: Rect, token: TokenKind, s = 1): { cx: number; cy: number } {
  const { x, y, w, h } = rect;
  const half = (TOKEN / 2 + 1) * s;
  if (token === "resources") return { cx: x + half, cy: y + h - half };
  if (token === "damage") return { cx: x + w - half, cy: y + half };
  return { cx: x + w - half, cy: y + h - half };
}

/** How far the damage token reaches in from a card's top-right corner (its left edge, from the right edge), so a line of the name keeps clear of it. */
export function damageReach(s = 1): number {
  const spot = tokenSpot({ x: 0, y: 0, w: 0, h: 0 }, "damage", s);
  return -spot.cx + (TOKEN / 2) * s;
}
