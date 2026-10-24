import { z } from "zod";

import { scenarioDefinitionSchema, type Effect, type Instruction, type ScenarioDefinition } from "./boundary.ts";

// A scenario as data/scenarios/<id>.json stores it: which cards go to which pile, in Normal and Easy
// counts. The sync adapters and the quest cards' Setup text both agree on it before the build writes it.
// `burden` is the burden deck (Flight to the Ford): a zone beside the quest deck, not part of the encounter deck.
export const PILES = ["encounter", "quest", "staging", "activeLocation", "setAside", "attached", "burden"] as const;
export type Pile = (typeof PILES)[number];

const placementSchema = z
  .strictObject({
    code: z.string().min(1),
    normal: z.number().int().positive(),
    easy: z.number().int().nonnegative(),
    pile: z.enum(PILES),
    // Staging only: this many copies per player in the game ("1 Fell Rider per player"); `normal` is the box's total.
    perPlayer: z.number().int().positive().optional(),
  })
  .refine((card) => card.easy <= card.normal, { message: "easy exceeds normal" });

export const scenarioDataSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    number: z.number().int().positive(),
    stages: z.array(z.string().min(1)).min(1),
    // The booklet's encounter sets, in booklet order, with the Normal count of cards each contributes.
    encounterSets: z.array(z.strictObject({ name: z.string().min(1), count: z.number().int().nonnegative() })),
    cards: z.array(placementSchema),
    // The campaign card printed for this scenario. Its Setup and Resolution records belong to the scenario.
    campaignCard: z.string().min(1),
    // Cards the campaign card's Setup places or shuffles in. They are not in `cards`; the records deal them.
    campaignPlaced: z.array(z.string().min(1)),
    // The Ring-bearer's starting life, when a Setup line sets it.
    life: z.number().int().positive().optional(),
    // Table pieces the cards call for, read from their printed text by the build.
    widgets: z.strictObject({ hide: z.boolean(), secondActiveLocation: z.boolean(), perSeatStaging: z.boolean() }),
    source: z.strictObject({ dragnNormal: z.string(), dragnEasy: z.string().nullable(), hobSlug: z.string() }),
  })
  .superRefine((data, context) => {
    const quest = data.cards.filter((card) => card.pile === "quest").map((card) => card.code);
    const same = quest.length === data.stages.length && data.stages.every((code, index) => quest.includes(code) && data.stages.indexOf(code) === index);
    if (!same) context.addIssue({ code: "custom", message: "stages must be the quest-pile cards" });
    const seen = new Set<string>();
    for (const card of data.cards) {
      const key = `${card.code}\u0000${card.pile}`;
      if (seen.has(key)) context.addIssue({ code: "custom", message: `duplicate code and pile ${card.code} ${card.pile}` });
      seen.add(key);
    }
  });

export type ScenarioData = z.infer<typeof scenarioDataSchema>;
export type Placement = z.infer<typeof placementSchema>;

// One printed row of a starter decklist: the card's name as the booklet prints it, its collector number, its type,
// how many copies, and the catalog code chosen for it.
export const starterRowSchema = z.strictObject({
  name: z.string().min(1),
  collector: z.number().int().positive(),
  type: z.enum(["hero", "ally", "attachment", "event"]),
  count: z.number().int().positive(),
  code: z.string().min(1),
});
// `span` is the rule span of the MEC109 booklet that prints the list (data/rules/index.json).
export const starterDeckSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  span: z.string().min(1),
  rows: z.array(starterRowSchema).min(1),
});
export type StarterRow = z.infer<typeof starterRowSchema>;
export type StarterDeckData = z.infer<typeof starterDeckSchema>;

export const campaignDataSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  scenarios: z.array(z.string().min(1)),
  // The campaign card of each scenario, by scenario id. Its Setup and Resolution lines are effect records.
  campaignCards: z.record(z.string(), z.string().min(1)),
  // The page of the MEC109 booklet where a scenario's setup is printed, by scenario id. Only scenarios whose page is
  // recorded in data/rules/index.json have one; the reader opens on it, otherwise on the saved last page.
  bookletPages: z.record(z.string(), z.number().int().positive()).optional(),
  // Cards every scenario starts with, attached to the Ring-bearer. From the sources' player-1 play area.
  prelude: z.array(z.strictObject({ code: z.string().min(1) })),
  // The two starter decks the booklet prints (data/starter-decks.json). The seed script reads them.
  starterDecks: z.array(starterDeckSchema),
});
export type CampaignData = z.infer<typeof campaignDataSchema>;

// data/campaigns/index.json: every campaign the list may name. A campaign without scenario files is listed locked, with
// the name and scenario count the sources give (scripts/data/normalize/campaigns.ts).
export const campaignIndexSchema = z.array(
  z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    scenarioCount: z.number().int().positive(),
    playable: z.boolean(),
  }),
);
export type CampaignIndexEntry = z.infer<typeof campaignIndexSchema>[number];

export function parseScenarioData(raw: unknown): ScenarioData {
  const parsed = scenarioDataSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string" ? raw.id : "(missing id)";
    const paths = parsed.error.issues.map((issue) => (issue.path.length === 0 ? issue.message : `${issue.path.join(".")}: ${issue.message}`)).join(", ");
    throw new Error(`Scenario ${id}: ${paths}`);
  }
  return parsed.data;
}

export function scenarioCards(data: ScenarioData): Placement[] {
  return data.cards;
}

export function normalEncounterSize(data: ScenarioData): number {
  return data.cards.filter((card) => card.pile === "encounter").reduce((sum, card) => sum + card.normal, 0);
}

export function normalCopiesByCode(data: ScenarioData): Map<string, number> {
  const totals = new Map<string, number>();
  for (const card of data.cards) totals.set(card.code, (totals.get(card.code) ?? 0) + card.normal);
  return totals;
}

export type Difficulty = "Easy" | "Normal";

// The encounter deck at a difficulty. Easy drops the cards the booklet marks (the `easy` count of each placement).
export function encounterCodes(data: ScenarioData, difficulty: Difficulty = "Normal"): string[] {
  return data.cards
    .filter((card) => card.pile === "encounter")
    .flatMap((card) => Array.from({ length: difficulty === "Easy" ? card.easy : card.normal }, () => card.code));
}

const SETUP_VERB = {
  setAside: "SetAside",
  staging: "AddToStaging",
  activeLocation: "MakeActiveLocation",
  attached: "AttachToRingBearer",
} as const;

// Order of the quest card's setup steps: set aside, add to staging, make a location active, then attach.
// Each copy is one instruction; a per-player card is one per seat, which the engine counts. The encounter, quest
// and burden piles are dealt by buildStart.
export function setupInstructions(data: ScenarioData): Instruction[] {
  const instructions: Instruction[] = [];
  for (const pile of ["setAside", "staging", "activeLocation", "attached"] as const) {
    for (const card of data.cards) {
      if (card.pile !== pile) continue;
      for (let copy = 0; copy < card.normal; copy += 1) instructions.push({ verb: SETUP_VERB[pile], code: card.code });
    }
  }
  return instructions;
}

export function burdenCodes(data: ScenarioData): string[] {
  return data.cards.filter((card) => card.pile === "burden").flatMap((card) => Array.from({ length: card.normal }, () => card.code));
}

// The records of one timing on a card, in line order, flattened to their instructions.
export function recordInstructions(effects: readonly Effect[], code: string, timing: Effect["timing"]): Instruction[] {
  return effects.filter((effect) => effect.cardCode === code && effect.timing === timing).flatMap((effect) => effect.instructions);
}

export function scenarioDefinition(data: ScenarioData, _campaign: CampaignData, effects: readonly Effect[] = []): ScenarioDefinition {
  const burden = burdenCodes(data);
  return scenarioDefinitionSchema.parse({
    id: data.id,
    encounterSets: data.encounterSets.map((set) => ({ code: set.name, count: set.count })),
    stages: data.stages.map((code) => ({ code })),
    widgets: {
      hide: data.widgets.hide,
      lifeTracker: data.life != null,
      burdenDeck: burden.length > 0,
      secondActiveLocation: data.widgets.secondActiveLocation,
      perSeatStaging: data.widgets.perSeatStaging,
    },
    setup: setupInstructions(data),
    resolution: recordInstructions(effects, data.campaignCard, "resolution"),
    ...(burden.length > 0 ? { burdenDeck: burden } : {}),
    ...(data.life != null ? { life: data.life } : {}),
    campaignCard: data.campaignCard,
  });
}
