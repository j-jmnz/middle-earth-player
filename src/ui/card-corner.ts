// A card picture's rounded corners (user request, 2026-10-29: every card picture rounded like the card screen's). The card screen
// draws its picture 236 pt wide at Medium with a 10 pt corner, about a printed card's own; every other card picture takes the same
// share of its shorter side, never under 2 pt so a thumbnail still reads as rounded. Pure.

/** The corner as a share of a card picture's shorter side: the card screen's 10 pt on 236. */
export const CARD_CORNER = 10 / 236;

/** The smallest corner a card picture gets, in points. */
export const CARD_CORNER_MIN = 2;

/** The corner radius of a card picture `w` by `h` points. */
export function cardCorner(w: number, h: number): number {
  return Math.max(CARD_CORNER_MIN, Math.min(w, h) * CARD_CORNER);
}

/** The rectangle a picture `source` big takes when contained in a box `w` by `h`: its own shape, as large as fits, centered. */
export function containIn(source: { width: number; height: number } | null, w: number, h: number): { x: number; y: number; w: number; h: number } {
  if (!source || source.width <= 0 || source.height <= 0) return { x: 0, y: 0, w, h };
  const scale = Math.min(w / source.width, h / source.height);
  const fw = source.width * scale;
  const fh = source.height * scale;
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
}
