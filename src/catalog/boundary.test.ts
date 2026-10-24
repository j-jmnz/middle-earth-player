import { describe, expect, it } from "vitest";

import {
  conditionSchema,
  costSchema,
  effectSchema,
  instructionSchema,
  parseRingsDbCard,
  resolutionOptionSchema,
  ringsDbCardSchema,
  scenarioDefinitionSchema,
} from "./boundary.ts";

const INSTRUCTION_VERBS = [
  "Draw",
  "GainResources",
  "PayCost",
  "PlayAlly",
  "Attach",
  "Exhaust",
  "Ready",
  "Commit",
  "RevealStaging",
  "PlaceProgress",
  "RaiseThreat",
  "Travel",
  "Engage",
  "DealShadow",
  "DeclareDefender",
  "DealDamage",
  "Attack",
  "AdvanceStep",
  "ResolveEffect",
] as const;

const effect = {
  id: "10001:action:1",
  cardCode: "10001",
  timing: "action",
  instructions: [{ verb: "Draw" }],
} as const;

const scenario = {
  id: "example",
  encounterSets: [{ code: "set", count: 2 }],
  stages: [{ code: "stage" }],
  widgets: {
    hide: true,
    lifeTracker: false,
    burdenDeck: false,
    secondActiveLocation: false,
    perSeatStaging: false,
  },
  setup: [{ verb: "RevealStaging" }],
  resolution: [{ id: "choice" }],
};

function minimalCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "10001",
    name: "Synthetic Hero",
    pack_code: "A",
    type_code: "hero",
    type_name: "Hero",
    position: 1,
    is_unique: true,
    has_errata: false,
    quantity: 1,
    ...overrides,
  };
}

describe("catalog boundary", () => {
  it.each(INSTRUCTION_VERBS)("accepts the %s instruction", (verb) => {
    expect(instructionSchema.parse({ verb })).toEqual({ verb });
  });

  it("accepts an authored ModifyStat and rejects one without a duration", () => {
    const modify = { verb: "ModifyStat", stat: "willpower", amount: 2, until: "endOfPhase" };
    expect(instructionSchema.parse(modify)).toEqual(modify);
    expect(instructionSchema.safeParse({ verb: "ModifyStat", stat: "willpower", amount: 2 }).success).toBe(false);
  });

  it("rejects an amount on an instruction", () => {
    expect(instructionSchema.safeParse({ verb: "Draw", amount: 1 }).success).toBe(false);
  });

  it("accepts a strict cost with a kind", () => {
    expect(costSchema.parse({ kind: "exhaustSelf" })).toEqual({ kind: "exhaustSelf" });
    expect(costSchema.parse({ kind: "resources", amount: 2 })).toEqual({ kind: "resources", amount: 2 });
    expect(costSchema.safeParse({ kind: "resources", amount: 0 }).success).toBe(false);
    expect(costSchema.safeParse({ kind: "exhaustSelf", amount: 1 }).success).toBe(false);
    expect(costSchema.safeParse({ verb: "PayCost" }).success).toBe(false);
  });

  it("accepts an effect and rejects an unknown condition", () => {
    expect(effectSchema.parse(effect)).toEqual(effect);
    const known = { kind: "hideFailed", scope: "phase" };
    expect(effectSchema.parse({ ...effect, condition: known }).condition).toEqual(known);
    expect(effectSchema.safeParse({ ...effect, condition: { kind: "ready" } }).success).toBe(false);
    expect(effectSchema.safeParse({ ...effect, condition: null }).success).toBe(false);
    expect(conditionSchema.safeParse("ready").success).toBe(false);
  });

  it("requires an effect id and a trigger from the event list", () => {
    const { id: _id, ...unnamed } = effect;
    expect(effectSchema.safeParse(unnamed).success).toBe(false);
    expect(effectSchema.safeParse({ ...effect, id: "" }).success).toBe(false);
    expect(effectSchema.parse({ ...effect, timing: "forced", trigger: "hideFailed" }).trigger).toBe("hideFailed");
    expect(effectSchema.safeParse({ ...effect, timing: "forced", trigger: "whenever" }).success).toBe(false);
  });

  it("accepts nested instructions one level down and rejects deeper nesting", () => {
    const choose = {
      verb: "Choose",
      who: "firstPlayer",
      options: [{ id: "a", instructions: [{ verb: "RaiseThreat", amount: 3, who: "firstPlayer" }] }],
    };
    expect(instructionSchema.parse(choose)).toEqual(choose);
    const each = { verb: "ForEachPlayer", order: "lastFirst", instructions: [choose] };
    expect(instructionSchema.parse(each)).toEqual(each);
    const delay = { verb: "Delay", until: "endOfPhase", instructions: [{ verb: "EngageAll", who: "firstPlayer" }] };
    expect(instructionSchema.parse(delay)).toEqual(delay);
    expect(instructionSchema.safeParse({ verb: "Delay", until: "endOfPhase", instructions: [delay] }).success).toBe(false);
    expect(instructionSchema.safeParse({ verb: "RaiseThreat", amount: 0 }).success).toBe(false);
  });

  it("rejects extra effect fields", () => {
    expect(effectSchema.safeParse({ ...effect, note: "extra" }).success).toBe(false);
  });

  it("accepts a scenario definition and a strict resolution option", () => {
    expect(scenarioDefinitionSchema.parse(scenario)).toEqual(scenario);
    expect(scenarioDefinitionSchema.parse({ ...scenario, bookletPage: 4 }).bookletPage).toBe(4);
    expect(resolutionOptionSchema.safeParse({ id: "choice", label: "extra" }).success).toBe(false);
  });

  it("strips unknown card keys and keeps a string cost", () => {
    const parsed = ringsDbCardSchema.parse(minimalCard({ cost: "X", flavor: "not stored" }));
    expect(parsed.cost).toBe("X");
    expect(parsed).not.toHaveProperty("flavor");
    expect(ringsDbCardSchema.safeParse(minimalCard({ cost: 1 })).success).toBe(false);
  });

  it("names the card code and issue path without the card text", () => {
    const raw = minimalCard({ code: "40001", text: "SENTINEL_TEXT", type_code: undefined });
    let message = "";
    try {
      parseRingsDbCard(raw);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("Card 40001");
    expect(message).toContain("type_code");
    expect(message).not.toContain("SENTINEL_TEXT");
  });
});
