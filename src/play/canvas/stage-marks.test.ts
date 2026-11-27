import { describe, expect, it } from "vitest";

import { apartPlateY, STAGE_MARK_H } from "./stage-marks.ts";

describe("the Apart plate on the Stormcaller's stage", () => {
  it("stands under the title band when the card holds the plate and the pill", () => {
    const rect = { y: 100, h: 120 };
    const pillY = rect.y + rect.h - 15 - STAGE_MARK_H - 2;
    expect(apartPlateY(rect, pillY, 1)).toBe(rect.y + 17 + 1);
  });

  it("stands just above the pill, inside the card, when the card is too short for both: never above its top edge", () => {
    for (const top of [0, 4, 60]) {
      for (const h of [40, 62, 80]) {
        const rect = { y: top, h };
        const pillY = rect.y + rect.h - 15 - STAGE_MARK_H - 2;
        const y = apartPlateY(rect, pillY, 1);
        expect(y, `y ${top} h ${h}`).toBeGreaterThanOrEqual(rect.y);
        expect(y + STAGE_MARK_H).toBeLessThanOrEqual(rect.y + rect.h);
        // Clear of the pill when the card has room for both, else the plate keeps inside the card.
        if (pillY - rect.y >= STAGE_MARK_H + 2) expect(y + STAGE_MARK_H).toBeLessThanOrEqual(pillY);
      }
    }
  });

  it("scales with the UI scale", () => {
    const rect = { y: 10, h: 60 };
    const pillY = rect.y + rect.h - 15 * 1.5 - STAGE_MARK_H * 1.5 - 2 * 1.5;
    const y = apartPlateY(rect, pillY, 1.5);
    expect(y).toBeGreaterThanOrEqual(rect.y);
    expect(y + STAGE_MARK_H * 1.5).toBeLessThanOrEqual(rect.y + rect.h);
  });
});
