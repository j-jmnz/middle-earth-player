import { describe, expect, it } from "vitest";

import { catalogFileIsCurrent, catalogStamp, shouldReplaceCatalog } from "./version.ts";

describe("shouldReplaceCatalog", () => {
  it("replaces when the applied version is absent", () => {
    expect(shouldReplaceCatalog(1, null)).toBe(true);
  });

  it("leaves an equal bundle in place", () => {
    expect(shouldReplaceCatalog(1, 1)).toBe(false);
  });

  it("replaces when the bundled version differs, newer or older", () => {
    expect(shouldReplaceCatalog(2, 1)).toBe(true);
    expect(shouldReplaceCatalog(1, 2)).toBe(true);
  });
});

describe("catalogFileIsCurrent", () => {
  it("folds a version above 2^31 into SQLite's signed user_version", () => {
    expect(catalogStamp(2430632767)).toBe(2430632767 - 2 ** 32);
    expect(catalogStamp(586328339)).toBe(586328339);
  });

  it("accepts a file stamped with this version", () => {
    expect(catalogFileIsCurrent(catalogStamp(2430632767), 2430632767)).toBe(true);
  });

  it("replaces an unstamped or differently stamped file even when user.db records the version as applied", () => {
    expect(catalogFileIsCurrent(0, 2430632767)).toBe(false);
    expect(catalogFileIsCurrent(null, 2430632767)).toBe(false);
    expect(catalogFileIsCurrent(catalogStamp(586328339), 2430632767)).toBe(false);
  });
});
