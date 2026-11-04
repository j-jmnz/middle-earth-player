import { describe, expect, it } from "vitest";

import { catalogAssetModule } from "./catalog-asset.ts";

describe("catalogAssetModule", () => {
  it("keeps a native numeric Metro asset id", () => {
    expect(catalogAssetModule(4)).toBe(4);
  });

  it("keeps the URL string Metro returns on web", () => {
    expect(catalogAssetModule("/assets/assets/catalog.db")).toBe("/assets/assets/catalog.db");
  });

  it("keeps a virtual asset with a uri", () => {
    expect(catalogAssetModule({ uri: "/assets/catalog.db", width: undefined })).toEqual({
      uri: "/assets/catalog.db",
      width: undefined,
    });
  });

  it("rejects a module that is not an asset", () => {
    expect(() => catalogAssetModule({ default: 1 })).toThrow(/Metro asset/);
  });
});
