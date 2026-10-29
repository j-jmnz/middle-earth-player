import { describe, expect, it } from "vitest";

import { arcSpans } from "./arc-spans.ts";

describe("arcSpans", () => {
  it("lays each arc after the one before it and never past the ring", () => {
    const spans = arcSpans([
      { key: "a", share: 0.25, color: "#000000" },
      { key: "b", share: 0.5, color: "#111111" },
      { key: "c", share: 0.5, color: "#222222" },
    ]);
    expect(spans.map((span) => [span.from, span.to])).toEqual([[0, 0.25], [0.25, 0.75], [0.75, 1]]);
  });
});
