import { z } from "zod";

import { scenarioDefinitionSchema, type Instruction, type ScenarioDefinition } from "./boundary.ts";

// A scenario as data/scenarios/<id>.json stores it: which cards go to which pile, in Normal and Easy
// counts. The sync adapters and the quest cards' Setup text both agree on it before the build writes it.
export const PILES = ["encounter", "quest", "staging", "activeLocation", "setAside", "attached"] as const;
export type Pile = (typeof PILES)[number];

const placementSchema = z
  .strictObject({
    code: z.string().min(1),
    normal: z.number().int().positive(),
    easy: z.number().int().nonnegative(),
    pile: z.enum(PILES),
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

// One reward group. The player picks one choice per group, in order. The campaign file authors them by code.
export const campaignDataSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  scenarios: z.array(z.string().min(1)),
  // Cards every scenario starts with, attached to the Ring-bearer. From the sources' player-1 play area.
  prelude: z.array(z.strictObject({ code: z.string().min(1) })),
  authored: z.strictObject({
    resolution: z.record(
      z.string(),
      z.array(z.strictObject({ id: z.string().min(1), choices: z.array(z.strictObject({ code: z.string().min(1) })).min(1) })),
    ),
  }),
});
export type CampaignData = z.infer<typeof campaignDataSchema>;

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

export function encounterCodes(data: ScenarioData): string[] {
  return data.cards.filter((card) => card.pile === "encounter").flatMap((card) => Array.from({ length: card.normal }, () => card.code));
}

const SETUP_VERB = {
  setAside: "SetAside",
  staging: "AddToStaging",
  activeLocation: "MakeActiveLocation",
  attached: "AttachToRingBearer",
} as const;

// Order of the quest card's setup steps: set aside, add to staging, make a location active, then attach.
// Each copy is one instruction. The encounter and quest piles are dealt by buildStart.
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

const widgets = {
  hide: true,
  lifeTracker: false,
  burdenDeck: false,
  secondActiveLocation: false,
  perSeatStaging: false,
} as const;

export function scenarioDefinition(data: ScenarioData, campaign: CampaignData): ScenarioDefinition {
  return scenarioDefinitionSchema.parse({
    id: data.id,
    encounterSets: data.encounterSets.map((set) => ({ code: set.name, count: set.count })),
    stages: data.stages.map((code) => ({ code })),
    widgets,
    setup: setupInstructions(data),
    resolution: campaign.authored.resolution[data.id] ?? [],
  });
}
