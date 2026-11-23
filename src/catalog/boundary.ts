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
  // Ambush (dwd.ambush): an enemy entering play makes each player, the first player first, an engagement check against it alone (src/rules/families/encounter/ambush.ts).
  ambush: z.boolean().optional(),
  // Regenerate X (dwd.regenerate): the enemy heals X damage from itself right after the first player token passes in the Refresh phase (src/rules/families/encounter/regenerate.ts).
  regenerate: z.number().int().positive().optional(),
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
  // The Siege value box an Attack on Dol Guldur card prints at its bottom right (docs/scenarios/standalone-scenarios/attack-on-dol-guldur.md, Attack on Dol Guldur, reading 2): what a destroyed enemy or an explored location adds to the round's tally. A printed mark, not a quest-card flag.
  siegeValue: z.number().int().positive().optional(),
  // Pillage X on an enemy (docs/scenarios/standalone-scenarios/the-hunt-for-the-dreadnaught.md, The Hunt for the Dreadnaught, reading 21): after the enemy's attack on a player has resolved, that player discards the top X cards of their deck (src/rules/families/sea/pillage.ts). Not in any source's keyword list for the box: `overrides.cards` sets it from the scan.
  pillage: z.number().int().positive().optional(),
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
  // Burn X on a location (docs/scenarios/standalone-scenarios/the-battle-of-lake-town.md, The Battle of Lake-town): the burn damage "Resolve all burn damage" adds up (src/rules/families/smaug/). A numbered keyword with a value of 0 does not exist.
  burn: z.number().int().positive().optional(),
  // Grapple (highest or lowest printed Threat or quest points) on an enemy (dcce.grapple): the staging-area location it attaches to, facedown, when it is revealed (src/rules/families/grapple/).
  grapple: z.enum(["highestThreat", "lowestThreat", "highestQuestPoints", "lowestQuestPoints"]).optional(),
  // Phantom on an enemy (mec113.phantom): the damage its attack would deal is canceled and the defending player raises their threat by that much (src/rules/families/grey-company/).
  phantom: z.boolean().optional(),
  // Spectral on an enemy (docs/scenarios/standalone-scenarios/the-stone-of-erech.md, The Stone of Erech): characters attacking it use their Willpower instead of their Attack to determine attack strength (src/rules/families/attack/spectral.ts).
  spectral: z.boolean().optional(),
  // Dire on a quest card (mec113.dire): while the main quest has it, each player's elimination level is 99, non-boon player card effects lower a player's threat by at most 1 each round and Valour triggers at 80 threat (src/rules/families/black-gate/dire.ts).
  dire: z.boolean().optional(),
  // PASS on a card (dwd.locate-test): the card passes a locate test it is discarded for, and the Goblin Stalker reads it on a shadow card dealt to it (src/rules/families/long-dark/).
  pass: z.boolean().optional(),
  // Not a keyword but a printed mark, kept here with the rule flags: the Sailing success symbols an encounter card prints in the bottom left
  // corner of its text box, read from the scan into the ledger (dcce.sailing-tests). Absent when the card prints none.
  sailingSuccess: z.number().int().positive().optional(),
  // Also a printed mark: the Sauron's Eye icons an encounter card prints in the bottom left corner of its text box, which a Fortitude test counts when the card is discarded for it (mec113.fortitude-tests, src/rules/families/mount-doom/). Absent when the card prints none.
  eyeIcons: z.number().int().positive().optional(),
  // Not a keyword either: the location prints X for its quest points (`quest` stays null), and a constant record sets them (Hills of Wilderland, Underground Lake): the engine lets it take progress and be explored.
  questPointsX: z.boolean().optional(),
  // Also a printed mark: the enemy prints X for its Attack and its hit points (the Nameless things): their numbers stay null, a record sets them, and the engine reads the hit points as 0 until it does.
  statsX: z.boolean().optional(),
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
  // The stages defeating this one proceeds to in a random order, each played once: one of `codes` still in the quest deck, else `otherwise`; with `remove` the stage defeated leaves the game (AdvanceToRandomStage, 19048:B:2).
  randomNext: z.strictObject({ codes: z.array(z.string()).min(2), otherwise: z.string().optional(), remove: z.literal(true).optional(), different: z.literal(true).optional() }).optional(),
  // The stage defeating this one proceeds to when the card with the code `code` is attached to a hero (`then`), else `otherwise`; a stage already played comes back (AdvanceIfAttached, 50601:B:3).
  attachedNext: z.strictObject({ code: z.string(), then: z.string(), otherwise: z.string() }).optional(),
  // A stage 2 of a quest deck that is not flipped when it is revealed: it arrives side A up and shows side B from the beginning of the quest phase (FlipAtQuestPhase, 19135:A:2; emce.gundabad-quest-deck).
  deck: z.literal(true).optional(),
});

const widgetsSchema = z.strictObject({
  hide: z.boolean(),
  lifeTracker: z.boolean(),
  burdenDeck: z.boolean(),
  // The pursuit value at which the players lose (mec112.pursuit), for a scenario whose quest card sets a pursuit tracker; absent otherwise.
  pursuitTracker: z.number().int().positive().optional(),
  // The objective whose resource tokens the table reads against the number that ends it (mec112.defense, 143033:A:3: 8 tokens on The Defense of Helm's Deep advance to stage 5A); absent otherwise.
  defenseTracker: z.strictObject({ code: z.string().min(1), limit: z.number().int().positive(), stage: z.number().int().positive() }).optional(),
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
  beforeReveal: z.array(instructionSchema).optional(),
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
