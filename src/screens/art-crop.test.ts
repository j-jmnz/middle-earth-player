import { describe, expect, it } from "vitest";

import { cropFrame, FACE, MAX_UPSCALE, MAX_ZOOM, PAINTING, PLAYER_CARD_ASPECT, QUEST_CARD_ASPECT, SCENE, sceneBand } from "./art-crop.ts";

describe("art crop", () => {
  it("covers the box with the region, with no gap at any edge", () => {
    for (const [box, aspect, region] of [
      [{ width: 40, height: 40 }, PLAYER_CARD_ASPECT, FACE],
      [{ width: 80, height: 118 }, PLAYER_CARD_ASPECT, PAINTING],
      [{ width: 390, height: 300 }, QUEST_CARD_ASPECT, SCENE],
      [{ width: 358, height: 200 }, QUEST_CARD_ASPECT, SCENE],
    ] as const) {
      const crop = cropFrame(box, aspect, region);
      expect(crop.left).toBeLessThanOrEqual(0);
      expect(crop.top).toBeLessThanOrEqual(0);
      expect(crop.left + crop.width).toBeGreaterThanOrEqual(box.width - 1);
      expect(crop.top + crop.height).toBeGreaterThanOrEqual(box.height - 1);
      // The region fills the box on its tighter side.
      expect(Math.min(crop.width * region.w - box.width, crop.height * region.h - box.height)).toBeLessThanOrEqual(1);
    }
  });

  it("centres a round portrait on the face", () => {
    const crop = cropFrame({ width: 40, height: 40 }, PLAYER_CARD_ASPECT, FACE);
    const faceCentreX = crop.left + (FACE.x + FACE.w / 2) * crop.width;
    const faceCentreY = crop.top + (FACE.y + FACE.h / 2) * crop.height;
    expect(Math.abs(faceCentreX - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(faceCentreY - 20)).toBeLessThanOrEqual(1);
  });

  it("keeps the picture's own proportions", () => {
    const crop = cropFrame({ width: 390, height: 300 }, QUEST_CARD_ASPECT, SCENE);
    expect(Math.abs(crop.width / crop.height - QUEST_CARD_ASPECT)).toBeLessThan(0.01);
  });

  it("draws a scene large only as far as it stays sharp, as a band at the box's top (user report, 2026-10-30)", () => {
    // A tablet's Campaigns art: the 1542 px scene spread over at most twice its pixels on a 2x screen, 482 pt of the 760 pt box.
    expect(sceneBand({ width: 900, height: 760 }, 3.2, 1542, 2)).toBeCloseTo((1542 * MAX_UPSCALE) / 2 / 3.2);
    // A narrow pane shows at least half the scene: 2 × 430 pt wide, not the 1542 pt that would still be sharp.
    expect(sceneBand({ width: 430, height: 584 }, 3.2, 1542, 2)).toBeCloseTo((430 * MAX_ZOOM) / 3.2);
    // A box the scene covers sharp is filled.
    expect(sceneBand({ width: 390, height: 120 }, 3.2, 1542, 3)).toBe(120);
    // Never narrower than the box: a small picture still spans it.
    expect(sceneBand({ width: 1194, height: 760 }, 3.2, 700, 2)).toBeCloseTo(1194 / 3.2);
  });
});
