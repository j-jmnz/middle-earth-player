// Where a picture sits inside a box so that one region of it fills the box (docs/design-system.md, Card art): the painting of a hero card above its text box, the scene of a quest card between its title banners and its
// text. The card pictures are printed cards, so each crop is a region of the printed layout, the same on every card of a kind.
// Pure, so a test reads it; art.tsx draws the picture at the size and offset this returns.

/** A region of a picture, as fractions of its width and height. */
export type Region = { x: number; y: number; w: number; h: number };

/** The painting of a player card: right of the stat column, above the name banner. */
export const PAINTING: Region = { x: 0.2, y: 0.03, w: 0.78, h: 0.55 };
/** The heart of the painting, clear of the stat column and the gold border: a deck cover's slice, often wider than it is tall. */
export const COVER: Region = { x: 0.3, y: 0.06, w: 0.62, h: 0.45 };
/** The scene of a quest card: under its two title banners, above its text box and clear of the encounter-set badge. */
export const SCENE: Region = { x: 0.02, y: 0.21, w: 0.8, h: 0.36 };

/**
 * The scene bundled on its own for each scenario (scripts/pack-scans.ts, sceneOf), cut from the laid-down quest picture at the
 * source's size: SCENE, starting under the stage number's medallion, which reaches a little lower on a printed card's scan.
 */
export const SCENE_PICTURE: Region = { x: 0.02, y: 0.235, w: 0.8, h: 0.335 };
/** The whole of a picture: a bundled scene is drawn entire. */
export const WHOLE: Region = { x: 0, y: 0, w: 1, h: 1 };
// A scene drawn large across a page (user report, 2026-10-30: grainy and zoomed in): at most this many device pixels to one of its
// pixels, and at most this many times the box's width, so the box shows at least half the scene.
export const MAX_UPSCALE = 2;
export const MAX_ZOOM = 2;

/**
 * How tall a scene of `aspect` (width over height) is drawn across a box: it covers the box's width, and it covers the box's height
 * too only while that spreads none of the picture's `sourceWidth` pixels over more than MAX_UPSCALE device pixels and draws it no
 * wider than MAX_ZOOM boxes. Shorter than the box, the scene is a band at its top that the caller fades into the ground, rather than
 * a few of its pixels blown up to fill it.
 */
export function sceneBand(box: { width: number; height: number }, aspect: number, sourceWidth: number, pixelRatio: number): number {
  const cover = Math.max(box.width, box.height * aspect);
  const widest = Math.min(cover, (sourceWidth * MAX_UPSCALE) / pixelRatio, box.width * MAX_ZOOM);
  return Math.min(box.height, Math.max(box.width, widest) / aspect);
}

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
