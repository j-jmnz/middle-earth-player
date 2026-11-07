import { describe, expect, it } from "vitest";

import { bannerHeightNow, setBannerHeight } from "./banner-height.ts";

describe("the banner's height", () => {
  it("is what the banner reported, and 0 once it leaves", () => {
    expect(bannerHeightNow()).toBe(0);
    setBannerHeight(96);
    expect(bannerHeightNow()).toBe(96);
    setBannerHeight(0);
    expect(bannerHeightNow()).toBe(0);
  });
});
