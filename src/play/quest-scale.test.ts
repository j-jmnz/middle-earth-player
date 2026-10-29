import { describe, expect, it } from "vitest";

import { scaleMarker } from "./quest-scale.ts";

describe("scaleMarker", () => {
  it("says Ahead in green when willpower beats the threat, Short in red when it falls short, Even otherwise", () => {
    expect(scaleMarker(2)).toEqual({ value: "+2", word: "Ahead", tone: "ok" });
    expect(scaleMarker(-1)).toEqual({ value: "−1", word: "Short", tone: "danger" });
    expect(scaleMarker(0)).toEqual({ value: "0", word: "Even", tone: "muted" });
  });
});
