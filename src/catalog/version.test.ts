import { describe, expect, it } from "vitest";

import { shouldReplaceCatalog } from "./version.ts";

describe("shouldReplaceCatalog", () => {
  it("replaces when the applied version is absent", () => {
    expect(shouldReplaceCatalog(1, null)).toBe(true);
  });

  it("leaves an equal bundle in place", () => {
    expect(shouldReplaceCatalog(1, 1)).toBe(false);
  });

  it("replaces when the bundled version is greater", () => {
    expect(shouldReplaceCatalog(2, 1)).toBe(true);
  });

  it("leaves an older bundle in place", () => {
    expect(shouldReplaceCatalog(1, 2)).toBe(false);
  });
});
