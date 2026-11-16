import { afterEach, describe, expect, it, vi } from "vitest";

import { desktopBuild } from "./desktop";

// The desktop export sets EXPO_PUBLIC_DESKTOP=1 (docs/architecture.md, Desktop); every other build leaves it unset.
describe("desktop build flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off without the variable or with another value, on with 1", () => {
    vi.stubEnv("EXPO_PUBLIC_DESKTOP", "");
    expect(desktopBuild()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_DESKTOP", "0");
    expect(desktopBuild()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_DESKTOP", "1");
    expect(desktopBuild()).toBe(true);
  });
});
