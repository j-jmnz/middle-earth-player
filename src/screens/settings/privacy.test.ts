import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Linking: { openURL: vi.fn(() => Promise.resolve()) } }));

const { PRIVACY_POLICY_URL } = await import("./privacy");

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

describe("the privacy policy link", () => {
  it("points at PRIVACY.md on main of the repository package.json names", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { homepage: string };
    const repository = pkg.homepage.replace(/#.*$/, "");
    expect(PRIVACY_POLICY_URL).toBe(`${repository}/blob/main/PRIVACY.md`);
    expect(existsSync(path.join(ROOT, "PRIVACY.md"))).toBe(true);
  });
});
