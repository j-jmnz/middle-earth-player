import { describe, expect, it } from "vitest";

import { cropFrame, FACE, PAINTING, PLAYER_CARD_ASPECT, QUEST_CARD_ASPECT, SCENE } from "./art-crop.ts";

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
});
