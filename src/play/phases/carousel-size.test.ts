import { describe, expect, it } from "vitest";

import { carouselHeight, carouselNeeds, CAROUSEL_MAX, PHASE_ROW, phaseSlop } from "./carousel-size.ts";
import { TOP_BAR } from "../chrome/top-bar-layout.ts";

describe("the phase carousel's height", () => {
  // The bar sits 8 pt under the top inset's floor: the panel hangs from BAR_TOP + TOP_BAR.
  const barBottom = 8 + TOP_BAR;

  it("holds the round's label and all seven phase rows at 844x390 (with a landscape phone's 21 pt foot inset) and at 667x375", () => {
    for (const [height, inset] of [[390, 21], [390, 0], [375, 0]] as const) {
      const panel = carouselHeight({ screenHeight: height, barBottom, insetBottom: inset }, 1);
      expect(panel, `${height} tall, inset ${inset}`).toBeGreaterThanOrEqual(carouselNeeds(1));
    }
  });

  it("is at most 340 pt on a tall table", () => {
    expect(carouselHeight({ screenHeight: 834, barBottom, insetBottom: 0 }, 1)).toBe(CAROUSEL_MAX);
  });

  it("keeps a 44 pt target on a row shorter than 44", () => {
    expect(PHASE_ROW + 2 * phaseSlop(1)).toBe(44);
    expect(PHASE_ROW * 0.85 + 2 * phaseSlop(0.85)).toBeCloseTo(44, 5);
  });
});
