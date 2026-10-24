import { describe, expect, it } from "vitest";

import { effectSchema } from "../catalog/boundary.ts";

import { EFFECTS } from "./index.ts";

describe("authored effects", () => {
  it("parse with the effect schema", () => {
    for (const effect of EFFECTS) {
      const parsed = effectSchema.safeParse(effect);
      expect(parsed.success, effect.id).toBe(true);
    }
  });

  it("have unique ids shaped <code>:<timing>:<n>", () => {
    const ids = EFFECTS.map((effect) => effect.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const effect of EFFECTS) {
      expect(effect.id, effect.id).toMatch(new RegExp(`^${effect.cardCode}:${effect.timing}:[1-9]\\d*$`));
    }
  });

  it("name a trigger on every Forced and triggered effect, and on no other", () => {
    for (const effect of EFFECTS) {
      const triggered = effect.timing === "forced" || effect.timing === "triggered";
      expect(effect.trigger != null, effect.id).toBe(triggered);
    }
  });
});
