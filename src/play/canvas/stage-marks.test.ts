import { describe, expect, it } from "vitest";

import { ABOVE_FLOOR, apartPlateY, STAGE_MARK_H } from "./stage-marks.ts";

describe("the Apart plate on the Stormcaller's stage", () => {
  it("stands under the title band when the card holds the plate and the pill", () => {
    const rect = { y: 100, h: 120 };
    const pillY = rect.y + rect.h - 15 - STAGE_MARK_H - 2;
    expect(apartPlateY(rect, pillY, 1)).toBe(rect.y + 17 + 1);
  });

  it("hangs above a card too short for both, where the canvas has room above it", () => {
    const rect = { y: 78, h: 48 };
    const pillY = rect.y + rect.h - 15 - STAGE_MARK_H - 2;
    expect(apartPlateY(rect, pillY, 1)).toBe(rect.y - STAGE_MARK_H - 1);
  });

  it("never leaves the canvas or stands over the room kept at its top: near the top it stands inside the card, above the pill", () => {
    for (const top of [0, 4, 10, 16]) {
      for (const h of [40, 48, 62]) {
        const rect = { y: top, h };
        const pillY = rect.y + rect.h - 15 - STAGE_MARK_H - 2;
        const y = apartPlateY(rect, pillY, 1);
        expect(y, `y ${top} h ${h}`).toBeGreaterThanOrEqual(Math.min(rect.y, ABOVE_FLOOR));
        expect(y + STAGE_MARK_H, `y ${top} h ${h}`).toBeLessThanOrEqual(rect.y + rect.h);
      }
    }
  });

  it("scales with the UI scale", () => {
    const rect = { y: 10, h: 60 };
    const pillY = rect.y + rect.h - 15 * 1.5 - STAGE_MARK_H * 1.5 - 2 * 1.5;
    const y = apartPlateY(rect, pillY, 1.5);
    // Too near the canvas's top to hang: inside the card.
    expect(y).toBeGreaterThanOrEqual(rect.y);
    expect(y + STAGE_MARK_H * 1.5).toBeLessThanOrEqual(rect.y + rect.h);
  });
});
