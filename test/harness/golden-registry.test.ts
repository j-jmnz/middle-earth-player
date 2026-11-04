import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scenarioOrder } from "../../scripts/data/load-scenarios.ts";

import { GOLDEN_REGISTRY } from "./golden-registry.ts";

// The registry lists every scenario's goldens, once, in campaign order (A Shadow of the Past's are read by causes.test.ts and replay.test.ts directly).
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCENARIOS = path.join(ROOT, "src", "campaign", "scenarios");
const DIRECT = "a-shadow-of-the-past";

describe("the golden registry", () => {
  it("has an entry for each scenario that has a golden game, in campaign order", () => {
    const withGolden = readdirSync(SCENARIOS).filter((id) => id !== DIRECT && existsSync(path.join(SCENARIOS, id, "golden.json")));
    const order = scenarioOrder();
    expect(GOLDEN_REGISTRY.map((entry) => entry.scenarioId)).toEqual(order.filter((id) => withGolden.includes(id)));
    expect(withGolden.every((id) => order.includes(id))).toBe(true);
  });

  it("gives every golden a name of its own", () => {
    for (const entry of GOLDEN_REGISTRY) {
      expect(entry.goldens.length, entry.scenarioId).toBeGreaterThan(0);
      expect(new Set(entry.goldens.map((golden) => golden.name)).size, entry.scenarioId).toBe(entry.goldens.length);
    }
  });
});
