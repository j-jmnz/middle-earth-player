import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { LOCAL_CARDS } from "../../scripts/local-cards.ts";
import { scenarioDefinitionSchema } from "./boundary.ts";
import {
  fixtureCards,
  normalCopiesByCode,
  normalEncounterSize,
  parseScenarioFixture,
  scenarioDefinition,
} from "./scenario-fixture.ts";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/a-shadow-of-the-past.json",
);

describe("a-shadow-of-the-past fixture", () => {
  const fixture = parseScenarioFixture(JSON.parse(readFileSync(fixturePath, "utf8")) as unknown);

  it("counts the Normal encounter deck from the cards", () => {
    expect(normalEncounterSize(fixture)).toBe(42);
  });

  it("keeps the quest stages in printed order", () => {
    expect(fixture.stages).toEqual(["141022", "141023", "141024"]);
  });

  it("keeps easy within normal and does not repeat a code in the same pile", () => {
    const seen = new Set<string>();
    for (const card of fixtureCards(fixture)) {
      expect(card.easy).toBeLessThanOrEqual(card.normal);
      const key = `${card.code}:${card.pile}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("matches printed quantity for fixture codes that have a local record", () => {
    const copies = normalCopiesByCode(fixture);
    const localByCode = new Map(LOCAL_CARDS.map((card) => [card.code, card]));
    const fixtureCodes = new Set(fixtureCards(fixture).map((card) => card.code));
    expect(fixtureCodes.size).toBeGreaterThan(0);
    for (const code of fixtureCodes) {
      const local = localByCode.get(code);
      if (!local) continue;
      expect(copies.get(code)).toBe(local.quantity);
    }
    expect(localByCode.has("141085")).toBe(true);
    expect(fixtureCodes.has("141085")).toBe(false);
  });

  it("derives the booklet sets and the quest-card setup", () => {
    const definition = scenarioDefinitionSchema.parse(scenarioDefinition(fixture, (name) => `code:${name}`));
    expect(definition.encounterSets).toEqual([
      { code: "A Shadow of the Past", count: 29 },
      { code: "Hunted", count: 6 },
      { code: "The Ring", count: 3 },
      { code: "The Black Riders", count: 5 },
    ]);
    expect(definition.widgets).toEqual({
      hide: true,
      lifeTracker: false,
      burdenDeck: false,
      secondActiveLocation: false,
      perSeatStaging: false,
    });
    expect(definition.setup).toEqual([
      { verb: "SetAside", code: "141035" },
      { verb: "AddToStaging", code: "141039" },
      { verb: "AddToStaging", code: "141078" },
      { verb: "MakeActiveLocation", code: "141031" },
      { verb: "AttachToRingBearer", code: "141017" },
    ]);
    expect(definition.resolution).toEqual([
      { id: "gandalfs-delay-or-the-ring-draws-them", choices: [{ code: "code:Gandalf's Delay" }, { code: "code:The Ring Draws Them" }] },
      { id: "gildor-or-mr-underhill", choices: [{ code: "code:Gildor Inglorion" }, { code: "code:Mr. Underhill" }] },
    ]);
    expect(definition.bookletPage).toBeUndefined();
    expect(definition.stages.map((stage) => stage.code)).toEqual(["141022", "141023", "141024"]);
  });
});
