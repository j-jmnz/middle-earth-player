import { describe, expect, it, vi } from "vitest";

import { resolveTheme } from "./theme.ts";

// theme.ts reads the phone's scheme through react-native, whose source the node test runner cannot parse.
vi.mock("react-native", () => ({ useColorScheme: () => "dark" }));

describe("resolveTheme", () => {
  it("keeps a chosen theme whatever the phone says", () => {
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("light", null)).toBe("light");
  });

  it("follows the phone for System", () => {
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("system", "dark")).toBe("dark");
  });

  it("falls back to Dark when the phone reports no scheme", () => {
    expect(resolveTheme("system", null)).toBe("dark");
    expect(resolveTheme("system", undefined)).toBe("dark");
    expect(resolveTheme("system", "unspecified")).toBe("dark");
  });
});
