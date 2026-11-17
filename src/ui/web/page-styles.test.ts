// The page's own stylesheet (page-styles.ts): the focus ring and the dock "i" hit area at a UI scale.
import { describe, expect, it } from "vitest";

import { pageCss } from "./page-styles.ts";

describe("pageCss", () => {
  it("draws the design ring, 2 pt wide and 2 pt off in accentHigh, for a keyboard's focus only", () => {
    const css = pageCss(1);
    expect(css).toContain(":focus-visible { outline: 2px solid rgb(var(--accentHigh)); outline-offset: 2px; }");
    expect(pageCss(1.3)).toContain("outline: 2.6px solid");
  });

  it("rounds a fold header's ring to its face and lifts it above the section's body", () => {
    expect(pageCss(1)).toContain('[role="button"][data-testid^="section-"]:focus-visible { position: relative; z-index: 1; border-radius: 12px; }');
    expect(pageCss(1.3)).toContain("border-radius: 15.6px;");
  });

  it("keeps the ring's room under the booklet's Close button", () => {
    expect(pageCss(1)).toContain(":has(> [data-testid=\"booklet-close\"]) { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 4px); }");
  });

  it("pads the dock's 26 pt pill to 44 pt, 9 pt above and below at Medium and the phone's own slop at a larger scale", () => {
    expect(pageCss(1)).toContain("top: -9px; bottom: -9px; left: -6px; right: -12px;");
    expect(pageCss(1.3)).toContain(`top: -11.7px; bottom: -11.7px; left: -7.8px; right: -15.6px;`);
  });
});
