import { z } from "zod";

import { scenarioDefinitionSchema, type Instruction, type ScenarioDefinition } from "./boundary.ts";

const piles = ["encounter", "quest", "staging", "activeLocation", "setAside", "attached"] as const;

const fixtureCardSchema = z
  .strictObject({
    code: z.string().min(1),
    easy: z.number().int().nonnegative(),
    normal: z.number().int().positive(),
    pile: z.enum(piles),
  })
  .refine((card) => card.easy <= card.normal, { message: "easy exceeds normal" });

const fixtureSetSchema = z.strictObject({
  name: z.string().min(1),
  cards: z.array(fixtureCardSchema),
});

export const scenarioFixtureSchema = z
  .strictObject({
    id: z.string().min(1),
    stages: z.array(z.string().min(1)).min(1),
    sets: z.array(fixtureSetSchema),
    cards: z.array(fixtureCardSchema),
  })
  .superRefine((fixture, context) => {
    const cards = listedCards(fixture);
    const seen = new Set<string>();
    for (const card of cards) {
      const key = `${card.code}\u0000${card.pile}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: `duplicate code and pile ${card.code} ${card.pile}`,
        });
      }
      seen.add(key);
    }

    const stageSeen = new Set<string>();
    for (const code of fixture.stages) {
      if (stageSeen.has(code)) {
        context.addIssue({ code: "custom", message: `duplicate stage ${code}` });
      }
      stageSeen.add(code);
    }

    const quest = cards.filter((card) => card.pile === "quest").map((card) => card.code);
    const sameQuest =
      quest.length === fixture.stages.length &&
      fixture.stages.every((code) => quest.includes(code)) &&
      quest.every((code) => fixture.stages.includes(code));
    if (!sameQuest) {
      context.addIssue({ code: "custom", message: "stages must be the quest-pile cards" });
    }
  });

export type ScenarioFixture = z.infer<typeof scenarioFixtureSchema>;
export type ScenarioFixtureCard = z.infer<typeof fixtureCardSchema>;

function listedCards(fixture: { sets: { cards: ScenarioFixtureCard[] }[]; cards: ScenarioFixtureCard[] }): ScenarioFixtureCard[] {
  return [...fixture.sets.flatMap((set) => set.cards), ...fixture.cards];
}

export function fixtureCards(fixture: ScenarioFixture): ScenarioFixtureCard[] {
  return listedCards(fixture);
}

export function parseScenarioFixture(raw: unknown): ScenarioFixture {
  const parsed = scenarioFixtureSchema.safeParse(raw);
  if (!parsed.success) {
    const id = fixtureId(raw);
    const paths = parsed.error.issues
      .map((issue) => (issue.path.length === 0 ? issue.message : `${issue.path.join(".")}: ${issue.message}`))
      .join(", ");
    throw new Error(`Scenario fixture ${id}: ${paths}`);
  }
  return parsed.data;
}

function fixtureId(raw: unknown): string {
  if (typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string" && raw.id !== "") {
    return raw.id;
  }
  return "(missing id)";
}

export function normalEncounterSize(fixture: ScenarioFixture): number {
  return fixtureCards(fixture)
    .filter((card) => card.pile === "encounter")
    .reduce((sum, card) => sum + card.normal, 0);
}

export function normalCopiesByCode(fixture: ScenarioFixture): Map<string, number> {
  const totals = new Map<string, number>();
  for (const card of fixtureCards(fixture)) {
    totals.set(card.code, (totals.get(card.code) ?? 0) + card.normal);
  }
  return totals;
}

const widgets = {
  hide: true,
  lifeTracker: false,
  burdenDeck: false,
  secondActiveLocation: false,
  perSeatStaging: false,
} as const;

const SETUP_VERB = {
  setAside: "SetAside",
  staging: "AddToStaging",
  activeLocation: "MakeActiveLocation",
  attached: "AttachToRingBearer",
} as const;

// Order of the quest card's setup steps: set aside, add to staging, make a location active, then attach.
// Source: MEC109 quest card 1A (Three is Company, 141022), setup side. Read via Hall of Beorn 2026-10-24.
// Confirm on the card.
// Each copy is one instruction. The encounter and quest piles are dealt by the scenario script.
export function setupInstructions(fixture: ScenarioFixture): Instruction[] {
  const listed = fixtureCards(fixture);
  const instructions: Instruction[] = [];
  for (const pile of ["setAside", "staging", "activeLocation", "attached"] as const) {
    for (const card of listed) {
      if (card.pile !== pile) continue;
      for (let copy = 0; copy < card.normal; copy += 1) {
        instructions.push({ verb: SETUP_VERB[pile], code: card.code });
      }
    }
  }
  return instructions;
}

export function encounterCodes(fixture: ScenarioFixture): string[] {
  return fixtureCards(fixture)
    .filter((card) => card.pile === "encounter")
    .flatMap((card) => Array.from({ length: card.normal }, () => card.code));
}

export function scenarioDefinition(fixture: ScenarioFixture): ScenarioDefinition {
  return scenarioDefinitionSchema.parse({
    id: fixture.id,
    encounterSets: fixture.sets.map((set) => ({
      code: set.name,
      count: set.cards.reduce((sum, card) => sum + card.normal, 0),
    })),
    stages: fixture.stages.map((code) => ({ code })),
    widgets,
    setup: setupInstructions(fixture),
    resolution: [],
  });
}
