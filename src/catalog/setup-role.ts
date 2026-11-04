// Which of a campaign card's Setup verbs the scenario's start handles itself (src/campaign/start.ts). The verb's own schema entry says it, through
// `setupRole(schema, role)` (zod's `.meta()`), so the lists do not grow beside it:
// - "dealt": the engine runs it in Setup, in the campaign card's printed order, before the quest card's Setup (the Fellowship's two verbs, an objective ally put into play, a card set aside).
// - "afterSetup": it names the ships or cards the quest card's Setup prepares, so it resolves in a frame after it (ScenarioDefinition.afterSetup).
import { z } from "zod";

export type SetupRole = "dealt" | "afterSetup";

/** Marks a verb's schema entry as one the start deals or resolves after the quest card's Setup. Returns the same schema type. */
export function setupRole<Schema extends z.ZodType>(schema: Schema, role: SetupRole): Schema {
  return schema.meta({ setupRole: role });
}

/** The role a verb's schema entry carries, or undefined. */
export function setupRoleOf(schema: z.ZodType): SetupRole | undefined {
  const role = z.globalRegistry.get(schema)?.setupRole;
  return role === "dealt" || role === "afterSetup" ? role : undefined;
}
