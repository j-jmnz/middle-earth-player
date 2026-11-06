import { describe, expect, it } from "vitest";

import { endGate, NO_SPOTLIGHT, openGate } from "./gate.ts";
import { readerGateEnds } from "./reader-gate.ts";
import type { Clash } from "../store/clash.ts";

const clash = {} as Clash;

describe("readerGateEnds", () => {
  it("ends a gate that has attacks and has not ended", () => {
    expect(readerGateEnds(openGate(3, [clash]))).toBe(true);
  });
  it("leaves a table with no spotlight, a moment without attacks and an ended gate alone", () => {
    expect(readerGateEnds(NO_SPOTLIGHT)).toBe(false);
    expect(readerGateEnds(openGate(4, []))).toBe(false);
    expect(readerGateEnds(endGate(openGate(5, [clash]), "skipped"))).toBe(false);
  });
});
