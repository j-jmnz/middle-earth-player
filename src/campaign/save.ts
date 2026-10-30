// Rules: ltp.campaign-log, rr.campaign-log (data/rules/entries.json). A save is one playthrough: its log, and the open
// scenario as the seed and the intents sent, never the table.
import { z } from "zod";

import { DIFFICULTIES, type Difficulty } from "../catalog/scenario-data.ts";
import type { PlayerIntent } from "../rules/intents.ts";

import { emptyLog, type CampaignLog, type PoolCard } from "./log.ts";
import type { ActiveScenario } from "./replay.ts";

export const FELLOWSHIP_ID = "fellowship-of-the-ring";

const poolCardSchema = z.strictObject({
  code: z.string(),
  back: z.enum(["player", "encounter"]),
  burdenSet: z.string().nullable(),
  attachedTo: z.string().nullable(),
  seat: z.number().int().nullable(),
  perPlayer: z.boolean().optional(),
});

const seatLists = z.array(z.array(z.string()));

export const campaignLogSchema = z.strictObject({
  heroesBySeat: seatLists,
  fallenHeroesBySeat: seatLists,
  threatPenalty: z.number().int(),
  campaignPool: z.array(poolCardSchema),
  captives: z.array(z.strictObject({ seat: z.number().int(), hero: z.string() })),
  completed: z.array(z.string()),
  earned: z.record(z.string(), z.array(z.string())).default({}),
  scenarios: z.record(z.string(), z.strictObject({ rounds: z.number().int(), victoryPoints: z.number().int(), score: z.number().int() })),
  score: z.number().int(),
  notes: z.string(),
  // The structured campaign facts (phase 28). A log saved before them reads with these defaults.
  prisoner: z.string().nullable().default(null),
  usedOnce: z.array(z.string()).default([]),
  counters: z.record(z.string(), z.number().int()).default({}),
  carryOver: z.array(poolCardSchema).default([]),
  carryIn: z.array(poolCardSchema).default([]),
  carriedFrom: z.string().optional(),
});

// The intents are checked by the reducer when they are replayed: one it does not know is refused, and the open
// scenario is dropped. Here only the shape of the record is checked.
export const activeScenarioSchema = z.strictObject({
  engineVersion: z.number().int(),
  dataHash: z.number(),
  seed: z.number().int(),
  intents: z.array(z.looseObject({ type: z.string() })),
  startedAt: z.number().optional(),
});

// What the briefing chose, kept with the open scenario so a relaunch rebuilds the same start: the heroes and the cards
// of each deck as they were when the player dealt, so editing a deck later does not move a game in progress.
export type StoredLoadout = {
  scenarioId: string;
  difficulty: Difficulty;
  seats: { deckId: string | null; heroes: string[]; deck: string[] }[];
  ringBearer: string | null;
  choices: string[];
  acceptPenalty: boolean;
};

// What any deal keeps, campaign or standalone: the scenario, the difficulty, each seat's deck and the Ring-bearer slot.
export const dealtLoadoutSchema = z.strictObject({
  scenarioId: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  seats: z.array(z.strictObject({ deckId: z.string().nullable(), heroes: z.array(z.string()), deck: z.array(z.string()) })),
  ringBearer: z.string().nullable(),
});

// A campaign deal adds the answers to the campaign card's Setup choices and the accepted penalty.
export const storedLoadoutSchema = dealtLoadoutSchema.extend({
  choices: z.array(z.string()),
  acceptPenalty: z.boolean(),
});

export type Save = {
  id: string;
  campaignId: string;
  seatCount: 1 | 2;
  log: CampaignLog;
  active: ActiveScenario | null;
  loadout: StoredLoadout | null;
};

// A new save starts on a blank log (the Dark of Mirkwood mini campaign included). `carried` is the carry-over of a finished save
// (carry-over.ts): the cards its first checklist takes into the pool. A copy for each player becomes one entry for each of this
// save's seats, whatever the finished save had. `carriedFrom` is the finished save's id.
export function newSave(id: string, campaignId: string, seatCount: 1 | 2, carried: readonly PoolCard[] = [], carriedFrom: string | null = null): Save {
  const carryIn = carried.flatMap((card) => (card.perPlayer ? Array.from({ length: seatCount }, (_, seat) => ({ ...card, seat })) : [card]));
  return { id, campaignId, seatCount, log: { ...emptyLog(seatCount), carryIn, ...(carriedFrom ? { carriedFrom } : {}) }, active: null, loadout: null };
}

export function parseSeatCount(value: number): 1 | 2 {
  if (value === 1 || value === 2) return value;
  throw new Error(`A save has one or two seats, not ${value}`);
}

export function parseLog(value: unknown): CampaignLog {
  return campaignLogSchema.parse(value);
}

export function parseActive(value: unknown): ActiveScenario | null {
  if (value == null) return null;
  const parsed = activeScenarioSchema.parse(value);
  // The record's intents are the reducer's own, written by recordIntent.
  return { ...parsed, intents: parsed.intents as unknown as PlayerIntent[] };
}

export function parseLoadout(value: unknown): StoredLoadout | null {
  return value == null ? null : storedLoadoutSchema.parse(value);
}
