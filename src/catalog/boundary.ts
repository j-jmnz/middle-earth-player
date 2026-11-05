import { z } from "zod";

import { instructionSchema } from "./effect-schema.ts";

export {
  amountSchema,
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
export { collectionVerbs, setupRoleVerbs, setupRunVerbs, verbsRunningInFrame } from "./verb-sets.ts";
export type {
  Amount,
  AmountExpr,
  CardRef,
  Condition,
  Limit,
  Subject,
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
  // Battle / Siege on a quest card: committed characters count Attack / Defense instead of Willpower (hon.battle, hon.siege).
  battle: z.boolean().optional(),
  siege: z.boolean().optional(),
  // Secrecy X: the card costs X less to play while its player's threat is 20 or less.
  secrecy: z.number().int().positive().optional(),
  // Leaving play ends the game (flag).
  leavesPlayLoses: z.boolean().optional(),
  // The sea family's keywords (src/rules/families/sea/). Sailing on a quest stage: the first player performs a Sailing test at the beginning
  // of each quest phase (dcce.sailing). Boarding X on a ship-enemy: it brings X Corsair enemies when it engages a player from the staging area
  // (dcce.boarding).
  sailing: z.boolean().optional(),
  boarding: z.number().int().positive().optional(),
  // Uncharted on the Lost Island side of a double-sided location (dcce.uncharted): read from the ledger's side B, so a card shows the keyword only
  // while it lies on that side (src/rules/families/uncharted/index.ts).
  uncharted: z.boolean().optional(),
  // Aflame X on a location (dcce.aflame): the damage that destroys it, and puts it facedown underneath The Havens Burn (src/rules/families/aflame/). A numbered keyword with a value of 0 does not exist.
  aflame: z.number().int().positive().optional(),
  // Grapple (highest or lowest printed Threat or quest points) on an enemy (dcce.grapple): the staging-area location it attaches to, facedown, when it is revealed (src/rules/families/grapple/).
  grapple: z.enum(["highestThreat", "lowestThreat", "highestQuestPoints", "lowestQuestPoints"]).optional(),
  // Not a keyword but a printed mark, kept here with the rule flags: the Sailing success symbols an encounter card prints in the bottom left
  // corner of its text box, read from the scan into the ledger (dcce.sailing-tests). Absent when the card prints none.
  sailingSuccess: z.number().int().positive().optional(),
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
    // A reprint is listed under its first pack; `packs` holds each product's position (its collector number), quantity
    // and OCTGN id. DragnCards' databaseId is that OCTGN id.
    octgnid: optionalString,
    packs: z.array(z.object({ pack_code: z.string(), position: z.number().int(), quantity: z.number().int(), octgnid: optionalString }).strip()).optional(),
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
  // The stages defeating this one proceeds to, one of them at random, the rest removed from the game (BranchStage, 01120:B:1).
  branch: z.array(z.string()).min(2).optional(),
  // The number of stages the first player looks at when this stage is defeated on-course (LookAtStages, 11016:B:3).
  look: z.number().int().min(2).optional(),
  // Defeating this stage when the Stormcaller is at this stage number wins the game (CatchUpWins, 12013:B:3).
  catchUp: z.number().int().positive().optional(),
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
  // The Nightmare setup card, on Nightmare only: placed next to the quest deck before the Setup runs.
  nightmareCard: z.string().min(1).optional(),
  // The Hard/Expert Mode card (dcce.hard-expert), side A Hard or B Expert, put next to the quest deck at the end of setup and in play all game:
  // it takes the place the Nightmare setup card has. Its Resolution records are appended to `resolution`.
  modeCard: z.strictObject({ code: z.string().min(1), side: z.enum(["A", "B"]) }).optional(),
  bookletPage: z.number().int().optional(),
  // The part number of the scenario's campaign card (its place in a campaign with XP, counting from 1): "X is the campaign card's part number".
  part: z.number().int().positive().optional(),
  // The campaign card's Setup instructions that need the quest card's Setup done first (a Dream-chaser Setup that names the ship-objectives the quest
  // card's Setup prepares): they resolve in a frame after it (rules/setup/setup.ts).
  afterSetup: z.array(instructionSchema).optional(),
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
