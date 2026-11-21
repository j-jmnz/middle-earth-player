import { afterEach, describe, expect, it } from "vitest";

import { dealSeed, e2eAt, e2eBuild } from "./e2e.ts";

// The fixture route and the fixed deal seed exist only in the e2e-test build (eas.json sets EXPO_PUBLIC_E2E_SEED).
describe("e2e build flag", () => {
  const before = process.env.EXPO_PUBLIC_E2E_SEED;
  afterEach(() => {
    if (before === undefined) delete process.env.EXPO_PUBLIC_E2E_SEED;
    else process.env.EXPO_PUBLIC_E2E_SEED = before;
  });

  it("is off without the variable and on with a positive seed", () => {
    delete process.env.EXPO_PUBLIC_E2E_SEED;
    expect(e2eBuild()).toBe(false);
    expect(dealSeed(() => 0)).toBe(1);
    process.env.EXPO_PUBLIC_E2E_SEED = "1";
    expect(e2eBuild()).toBe(true);
    expect(dealSeed(() => 0.5)).toBe(1);
    process.env.EXPO_PUBLIC_E2E_SEED = "0";
    expect(e2eBuild()).toBe(false);
  });
});

describe("e2e fixture link's at", () => {
  it("reads a count of intents, and nothing else", () => {
    expect(e2eAt("5")).toBe(5);
    expect(e2eAt(["0", "9"])).toBe(0);
    expect(e2eAt(undefined)).toBeUndefined();
    expect(e2eAt("-1")).toBeUndefined();
    expect(e2eAt("2x")).toBeUndefined();
  });
});
