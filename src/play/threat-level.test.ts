// Rules: rr.threat-elimination-level, rr.player-elimination (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { ELIMINATION_THREAT, threatDelta, threatDeltaWords, threatLevel, threatMeter } from "./threat-level.ts";

describe("threat dial", () => {
  it("fills toward the elimination level, 50", () => {
    expect(ELIMINATION_THREAT).toBe(50);
    expect(threatMeter(25)).toBe(0.5);
    expect(threatMeter(0)).toBe(0);
    expect(threatMeter(57)).toBe(1);
  });

  it("warms near elimination: tinted from 40, critical from 45", () => {
    expect(threatLevel(39)).toBe("calm");
    expect(threatLevel(40)).toBe("near");
    expect(threatLevel(44)).toBe("near");
    expect(threatLevel(45)).toBe("critical");
  });

  it("says what changed, with a true minus sign", () => {
    expect(threatDelta(30, 24)).toEqual({ text: "−6", lowered: true });
    expect(threatDelta(28, 30)).toEqual({ text: "+2", lowered: false });
    expect(threatDelta(30, 30)).toBeNull();
    expect(threatDeltaWords("Threat", 30, 24)).toBe("Threat lowered by 6, now 24");
    expect(threatDeltaWords("Player 2 threat", 28, 30)).toBe("Player 2 threat raised by 2, now 30");
  });
});
