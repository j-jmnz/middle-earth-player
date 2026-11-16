// The page's own stylesheet (page-styles.ts): the focus ring and the dock "i" hit area at a UI scale.
import { describe, expect, it } from "vitest";

import { pageCss } from "./page-styles.ts";

describe("pageCss", () => {
  it("draws the design ring, 2 pt wide and 2 pt off in accentHigh, for a keyboard's focus only", () => {
    const css = pageCss(1);
    expect(css).toContain(":focus-visible { outline: 2px solid rgb(var(--accentHigh)); outline-offset: 2px; }");
    expect(pageCss(1.3)).toContain("outline: 2.6px solid");
  });

  it("pads the dock's 26 pt pill to 44 pt, 9 pt above and below at Medium and the phone's own slop at a larger scale", () => {
    expect(pageCss(1)).toContain("top: -9px; bottom: -9px; left: -6px; right: -12px;");
    expect(pageCss(1.3)).toContain(`top: -11.7px; bottom: -11.7px; left: -7.8px; right: -15.6px;`);
  });
});
