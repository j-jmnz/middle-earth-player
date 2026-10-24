import { z } from "zod";

const optionalString = z.string().nullish();
const optionalInt = z.number().int().nullish();

export const ringsDbPackSchema = z
  .object({
    name: z.string(),
    code: z.string().min(1),
    position: z.number().int(),
    cycle_position: z.number().int(),
    available: z.string(),
  })
  .strip();

export const ringsDbCardSchema = z
  .object({
    code: z.string().min(1),
    name: z.string(),
    pack_code: z.string().min(1),
    type_code: z.string().min(1),
    type_name: z.string(),
    sphere_code: optionalString,
    sphere_name: optionalString,
    position: z.number().int(),
    traits: optionalString,
    text: optionalString,
    is_unique: z.boolean(),
    cost: optionalString,
    deck_limit: optionalInt,
    quantity: z.number().int(),
    threat: optionalInt,
    willpower: optionalInt,
    attack: optionalInt,
    defense: optionalInt,
    health: optionalInt,
    quest: optionalInt,
    victory: optionalInt,
    has_errata: z.boolean(),
    imagesrc: optionalString,
  })
  .strip();

function verbSchema<const Verb extends string>(verb: Verb) {
  return z.strictObject({ verb: z.literal(verb) });
}

export const costSchema = verbSchema("PayCost");

export const modifierUntilSchema = z.enum(["endOfPhase", "endOfRound", "endOfAttack", "whileSourceInPlay"]);

export const modifierStatSchema = z.enum(["willpower", "attack", "defense", "threat"]);

// Authored amounts are fine. A player intent never supplies one.
const modifyStatSchema = z.strictObject({
  verb: z.literal("ModifyStat"),
  stat: modifierStatSchema,
  amount: z.number().int(),
  until: modifierUntilSchema,
});

export const instructionSchema = z.discriminatedUnion("verb", [
  verbSchema("Draw"),
  verbSchema("GainResources"),
  costSchema,
  verbSchema("PlayAlly"),
  verbSchema("Attach"),
  verbSchema("Exhaust"),
  verbSchema("Ready"),
  verbSchema("Commit"),
  verbSchema("RevealStaging"),
  verbSchema("PlaceProgress"),
  verbSchema("RaiseThreat"),
  verbSchema("Travel"),
  verbSchema("Engage"),
  verbSchema("DealShadow"),
  verbSchema("DeclareDefender"),
  verbSchema("DealDamage"),
  verbSchema("Attack"),
  verbSchema("AdvanceStep"),
  verbSchema("ResolveEffect"),
  modifyStatSchema,
]);

export const conditionSchema = z.never();

const timings = [
  "setup",
  "forced",
  "whenRevealed",
  "response",
  "action",
  "shadow",
  "constant",
  "questResolution",
  "travel",
  "engagement",
  "beginningOfPhase",
  "endOfPhase",
  "endOfRound",
] as const;

export const effectSchema = z.strictObject({
  id: z.string().optional(),
  cardCode: z.string(),
  timing: z.enum(timings),
  trigger: z.string().optional(),
  limit: z.enum(["oncePerPhase", "oncePerRound"]).optional(),
  cost: costSchema.optional(),
  condition: conditionSchema.optional(),
  instructions: z.array(instructionSchema),
});

export const resolutionOptionSchema = z.strictObject({
  id: z.string(),
});

const encounterSetSchema = z.strictObject({
  code: z.string(),
  count: z.number().int(),
});

const stageSchema = z.strictObject({
  code: z.string(),
});

const widgetsSchema = z.strictObject({
  hide: z.boolean(),
  lifeTracker: z.boolean(),
  burdenDeck: z.boolean(),
  secondActiveLocation: z.boolean(),
  perSeatStaging: z.boolean(),
});

export const scenarioDefinitionSchema = z.strictObject({
  id: z.string(),
  encounterSets: z.array(encounterSetSchema),
  stages: z.array(stageSchema),
  widgets: widgetsSchema,
  setup: z.array(instructionSchema),
  resolution: z.array(resolutionOptionSchema),
  bookletPage: z.number().int().optional(),
});

export type RingsDbPack = z.infer<typeof ringsDbPackSchema>;
export type RingsDbCard = z.infer<typeof ringsDbCardSchema>;
export type Cost = z.infer<typeof costSchema>;
export type Instruction = z.infer<typeof instructionSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type ModifierUntil = z.infer<typeof modifierUntilSchema>;
export type ModifierStat = z.infer<typeof modifierStatSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type ResolutionOption = z.infer<typeof resolutionOptionSchema>;
export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>;

function issuePaths(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length === 0 ? "(root)" : issue.path.map((part) => String(part)).join(".")))
    .join(", ");
}

function readCode(raw: unknown): string {
  if (typeof raw === "object" && raw !== null && "code" in raw && typeof raw.code === "string" && raw.code !== "") {
    return raw.code;
  }
  return "(missing code)";
}

export function parseRingsDbPacks(payload: unknown): RingsDbPack[] {
  if (!Array.isArray(payload)) {
    throw new Error("Pack index is not an array");
  }
  return payload.map((raw) => {
    const parsed = ringsDbPackSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Pack ${readCode(raw)}: invalid at ${issuePaths(parsed.error)}`);
    }
    return parsed.data;
  });
}

export function parseRingsDbCard(raw: unknown): RingsDbCard {
  const parsed = ringsDbCardSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Card ${readCode(raw)}: invalid at ${issuePaths(parsed.error)}`);
  }
  return parsed.data;
}

export function parseRingsDbCards(payload: unknown, packCode: string): RingsDbCard[] {
  if (!Array.isArray(payload)) {
    throw new Error(`Pack ${packCode}: card payload is not an array`);
  }
  return payload.map((raw) => parseRingsDbCard(raw));
}
