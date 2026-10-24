import { z } from "zod";

import { instructionSchema } from "./effect-schema.ts";

export {
  cancelSchema,
  conditionSchema,
  costSchema,
  effectSchema,
  instructionSchema,
  isStatCondition,
  modifierStatSchema,
  modifierUntilSchema,
  phaseNameSchema,
  targetSchema,
  timingSchema,
  triggerSchema,
} from "./effect-schema.ts";
export type {
  Condition,
  Cost,
  Effect,
  Instruction,
  ModifierStat,
  PickSpec,
  ModifierUntil,
  SimpleInstruction,
  Target,
  Timing,
  Trigger,
} from "./effect-schema.ts";

const optionalString = z.string().nullish();
const optionalInt = z.number().int().nullish();

// Printed keywords and rule flags for one card. An absent field means the card does not have it.
export const printedKeywordsSchema = z.strictObject({
  hide: z.number().int().positive().optional(),
  surge: z.boolean().optional(),
  doomed: z.number().int().positive().optional(),
  peril: z.boolean().optional(),
  archery: z.number().int().positive().optional(),
  toughness: z.number().int().positive().optional(),
  indestructible: z.boolean().optional(),
  immune: z.boolean().optional(),
  permanent: z.boolean().optional(),
  sentinel: z.boolean().optional(),
  ranged: z.boolean().optional(),
  restricted: z.boolean().optional(),
  // Leaving play ends the game (flag).
  leavesPlayLoses: z.boolean().optional(),
});

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
    // Not in the RingsDB payload. Local records and the build overrides carry them.
    engagement_cost: optionalInt,
    keywords: printedKeywordsSchema.nullish(),
  })
  .strip();


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
  // The campaign card's Resolution records, in line order. The reducer asks the players for each choice they open.
  resolution: z.array(instructionSchema),
  // Cards of the burden deck (Flight to the Ford), in booklet order, and the Ring-bearer's starting life. Absent
  // when the scenario has neither; the widget flags are derived from them.
  burdenDeck: z.array(z.string().min(1)).optional(),
  life: z.number().int().positive().optional(),
  // The campaign card whose Setup and Resolution records belong to this scenario.
  campaignCard: z.string().min(1).optional(),
  bookletPage: z.number().int().optional(),
});

export type RingsDbPack = z.infer<typeof ringsDbPackSchema>;
export type RingsDbCard = z.infer<typeof ringsDbCardSchema>;
export type PrintedKeywords = z.infer<typeof printedKeywordsSchema>;
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
