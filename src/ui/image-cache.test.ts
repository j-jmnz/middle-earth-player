import { describe, expect, it } from "vitest";

import { cachePolicyFor } from "./image-cache.ts";

describe("cachePolicyFor", () => {
  it("never disk-caches a bundled file, whose Android resource id moves between builds", () => {
    expect(cachePolicyFor(42)).toBe("memory");
    expect(cachePolicyFor(42, "memory-disk")).toBe("memory");
    expect(cachePolicyFor(42, "disk")).toBe("memory");
    expect(cachePolicyFor(42, "none")).toBe("none");
  });

  it("keeps the asked policy for a downloaded file", () => {
    expect(cachePolicyFor({ uri: "file:///images/141001.jpg" }, "memory-disk")).toBe("memory-disk");
    expect(cachePolicyFor({ uri: "file:///images/141001.jpg" })).toBe("disk");
  });
});
