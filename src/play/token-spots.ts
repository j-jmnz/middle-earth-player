// Where the token art sits on a card's upright rectangle (resources bottom left, damage top right, progress bottom right), shared
// by the tokens on the canvas (canvas-pieces.native.tsx) and the pop and floating number that mark their change (token-fx.native.tsx).
import type { Rect } from "./layout.ts";
import type { TokenKind } from "./token-deltas.ts";

/** The token art's size in points. */
export const TOKEN = 18;

/** The center of a card's token of this kind; `rect` is the card on screen, so an exhausted card's tokens stay upright. */
export function tokenSpot(rect: Rect, token: TokenKind): { cx: number; cy: number } {
  const { x, y, w, h } = rect;
  if (token === "resources") return { cx: x + TOKEN / 2 + 1, cy: y + h - TOKEN / 2 - 1 };
  if (token === "damage") return { cx: x + w - TOKEN / 2 - 1, cy: y + TOKEN / 2 + 1 };
  return { cx: x + w - TOKEN / 2 - 1, cy: y + h - TOKEN / 2 - 1 };
}
