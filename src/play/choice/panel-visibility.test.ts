import { describe, expect, it } from "vitest";

import { tableVisibility } from "./panel-visibility.ts";

describe("the reader table behind a panel", () => {
  it("is hidden from TalkBack while a panel is open, and from nothing else", () => {
    expect(tableVisibility("android", true)).toBe("no-hide-descendants");
    expect(tableVisibility("android", false)).toBeUndefined();
    expect(tableVisibility("ios", true)).toBeUndefined();
    expect(tableVisibility("web", true)).toBeUndefined();
  });
});
