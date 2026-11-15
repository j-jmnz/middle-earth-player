import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Linking: { openURL: vi.fn(() => Promise.resolve()) } }));

const { PRIVACY_POLICY_URL, SUPPORT_URL } = await import("./links");

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { homepage: string };
const repository = pkg.homepage.replace(/#.*$/, "");

describe("the About links", () => {
  it("points the privacy policy at PRIVACY.md on main of the repository package.json names", () => {
    expect(PRIVACY_POLICY_URL).toBe(`${repository}/blob/main/PRIVACY.md`);
    expect(existsSync(path.join(ROOT, "PRIVACY.md"))).toBe(true);
  });

  it("points Support at the README's Support section", () => {
    expect(SUPPORT_URL).toBe(`${repository}#support`);
    expect(readFileSync(path.join(ROOT, "README.md"), "utf8")).toMatch(/^## Support$/m);
  });
});
