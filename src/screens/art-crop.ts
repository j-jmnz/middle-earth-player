// Where a picture sits inside a box so that one region of it fills the box (docs/design-system.md, Card art): a hero's face in a
// round portrait, the painting of a hero card above its text box, the scene of a quest card between its title banners and its
// text. The card pictures are printed cards, so each crop is a region of the printed layout, the same on every card of a kind.
// Pure, so a test reads it; art.tsx draws the picture at the size and offset this returns.

/** A region of a picture, as fractions of its width and height. */
export type Region = { x: number; y: number; w: number; h: number };

/** The face on a hero card: above the stat column's right, where every RingsDB hero's portrait sits. Square on a 429×600 card. */
export const FACE: Region = { x: 0.47, y: 0.04, w: 0.3, h: 0.215 };
/** The painting of a player card: right of the stat column, above the name banner. */
export const PAINTING: Region = { x: 0.2, y: 0.03, w: 0.78, h: 0.55 };
/** The scene of a quest card: under its two title banners, above its text box and clear of the encounter-set badge. */
export const SCENE: Region = { x: 0.02, y: 0.21, w: 0.8, h: 0.36 };

/** A RingsDB player card, 429×600. */
export const PLAYER_CARD_ASPECT = 429 / 600;
/** A Hall of Beorn quest card, 700×494. */
export const QUEST_CARD_ASPECT = 700 / 494;

export type Crop = { width: number; height: number; left: number; top: number };

/**
 * The size and offset of a picture of `aspect` (width over height) that make `region` cover a box of `box`, centred on the
 * region, and never leave a gap at the box's edge.
 */
export function cropFrame(box: { width: number; height: number }, aspect: number, region: Region): Crop {
  // Scale so the region covers the box; the picture's own height is 1 unit before scaling.
  const regionWidth = region.w * aspect;
  const regionHeight = region.h;
  const scale = Math.max(box.width / regionWidth, box.height / regionHeight);
  const height = scale;
  const width = scale * aspect;
  const centreX = (region.x + region.w / 2) * width;
  const centreY = (region.y + region.h / 2) * height;
  const clamp = (value: number, least: number) => Math.min(0, Math.max(least, value));
  return {
    width: Math.round(width),
    height: Math.round(height),
    left: Math.round(clamp(box.width / 2 - centreX, box.width - width)),
    top: Math.round(clamp(box.height / 2 - centreY, box.height - height)),
  };
}
