import { z } from "zod";

import {
  conditionSchema,
  costSchema,
  instructionSchema,
  modifierStatSchema,
  modifierUntilSchema,
  timingSchema,
  triggerSchema,
} from "../../../src/catalog/effect-schema.ts";

// The words an effect record may use, read from the Zod schemas in src/catalog/effect-schema.ts, so the draft bundles list
// every verb (the ones declared through the verb() and codeVerb() helpers too) and nothing that is not one.
export type Vocabulary = {
  verbs: string[];
  conditions: string[];
  triggers: string[];
  timings: string[];
  costs: string[];
  stats: string[];
  durations: string[];
  statTargets: string[];
};

function literal(option: z.ZodType, key: string): string {
  const shape = (option as z.ZodObject).shape as Record<string, z.ZodType>;
  const field = shape[key];
  if (!(field instanceof z.ZodLiteral)) throw new Error(`Schema option has no literal ${key}`);
  return String(field.value);
}

function enumOf(schema: z.ZodType): string[] {
  const inner = schema instanceof z.ZodOptional ? schema.unwrap() : schema;
  if (!(inner instanceof z.ZodEnum)) throw new Error("Expected an enum");
  return inner.options.map(String);
}

export function vocabulary(): Vocabulary {
  const verbs = instructionSchema.options.map((option) => literal(option, "verb"));
  const modifyStat = instructionSchema.options.find((option) => literal(option, "verb") === "ModifyStat");
  const statTargets = modifyStat ? enumOf((modifyStat.shape as Record<string, z.ZodType>)["target"] as z.ZodType) : [];
  return {
    verbs: [...new Set(verbs)].sort(),
    conditions: conditionSchema.options.map((option) => literal(option, "kind")).sort(),
    triggers: triggerSchema.options.map(String),
    timings: timingSchema.options.map(String),
    costs: costSchema.options.map((option) => literal(option, "kind")),
    stats: modifierStatSchema.options.map(String),
    durations: modifierUntilSchema.options.map(String),
    statTargets,
  };
}
