// Rules: ltp.campaign-setup-checklist (data/rules/entries.json). Everything a briefing, a replay and a resolution read
// to turn a save into an opening state: the campaign file, the scenario, the effect records, and the engine's cards.
import { inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { Effect } from "../catalog/boundary.ts";
import { cards } from "../catalog/schema.ts";
import { recordInstructions, scenarioCards, type CampaignData, type ScenarioData } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/printed.ts";

import type { CampaignLog } from "./log.ts";

import { printedMap, type CatalogRow } from "./cards.ts";

export type World = {
  campaign: CampaignData;
  scenario: ScenarioData;
  effects: readonly Effect[];
  cards: ReadonlyMap<string, PrintedCard>;
  // The encounter set of each card the catalog knows, for the briefing's per-set counts.
  sets: ReadonlyMap<string, string>;
};

function instructionCodes(effects: readonly Effect[], card: string): string[] {
  const codes: string[] = [];
  for (const timing of ["campaignSetup", "resolution"] as const) {
    for (const instruction of recordInstructions(effects, card, timing)) {
      if ("codes" in instruction && Array.isArray(instruction.codes)) codes.push(...instruction.codes.filter((code): code is string => typeof code === "string"));
      if ("code" in instruction && typeof instruction.code === "string") codes.push(instruction.code);
    }
  }
  return codes;
}

// The catalog codes a scenario needs to be dealt and resolved: its piles, its campaign card and what that card names,
// the campaign prelude, and any extra codes the caller holds (the heroes and decks of a loadout, the pool).
export function worldCodes(campaign: CampaignData, scenario: ScenarioData, effects: readonly Effect[], extra: Iterable<string> = []): string[] {
  const codes = new Set<string>(campaign.prelude.map((card) => card.code));
  codes.add(scenario.campaignCard);
  for (const card of scenarioCards(scenario)) codes.add(card.code);
  for (const code of scenario.campaignPlaced) codes.add(code);
  for (const code of instructionCodes(effects, scenario.campaignCard)) codes.add(code);
  for (const code of extra) codes.add(code);
  return [...codes];
}

// The codes a log names: its heroes, its fallen heroes, and the cards of its pool.
export function logCodes(log: CampaignLog): string[] {
  return [...log.heroesBySeat.flat(), ...log.fallenHeroesBySeat.flat(), ...log.campaignPool.map((card) => card.code), ...log.campaignPool.flatMap((card) => (card.attachedTo ? [card.attachedTo] : []))];
}

export function worldFrom(campaign: CampaignData, scenario: ScenarioData, effects: readonly Effect[], rows: readonly CatalogRow[]): World {
  const sets = new Map<string, string>();
  for (const row of rows) if (row.encounterSet) sets.set(row.code, row.encounterSet);
  return { campaign, scenario, effects, cards: printedMap(rows), sets };
}

// Reads the rows a scenario needs from catalog.db, read-only, and builds the world. `extra` is the heroes and deck cards
// of a loadout and the pool: the codes the screen already holds.
export function loadWorld<TRun>(
  catalog: BaseSQLiteDatabase<"sync", TRun>,
  campaign: CampaignData,
  scenario: ScenarioData,
  effects: readonly Effect[],
  extra: Iterable<string> = [],
): World {
  const codes = worldCodes(campaign, scenario, effects, extra);
  const rows = catalog.select().from(cards).where(inArray(cards.code, codes)).all();
  return worldFrom(campaign, scenario, effects, rows);
}
