import { afterEach, describe, expect, it } from "vitest";

import { dealSeed, e2eBuild } from "./e2e.ts";

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
