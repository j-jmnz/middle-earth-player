// Rules: ltp.campaign-setup-checklist (data/rules/entries.json). Everything a briefing, a replay and a resolution read
// to turn a save into an opening state: the campaign file, the scenario, the effect records, and the engine's cards.
import { and, eq, inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { Effect } from "../catalog/boundary.ts";
import type { DeckSaveCard } from "../catalog/deck-save.ts";
import { cards } from "../catalog/schema.ts";
import { recordInstructions, scenarioCards, type CampaignData, type ScenarioData } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/printed.ts";

import type { CampaignLog } from "./log.ts";

import { printedFromRow, printedMap, type CatalogRow } from "./cards.ts";

export type World = {
  campaign: CampaignData;
  scenario: ScenarioData;
  effects: readonly Effect[];
  cards: ReadonlyMap<string, PrintedCard>;
  // The encounter set of each card the catalog knows, for the briefing's per-set counts.
  sets: ReadonlyMap<string, string>;
  // The deckbuilding facts of the same rows (rr.deckbuilding), so the briefing refuses a saved deck that is not ready to
  // play. A world built by hand in a test may leave it out, and then that check is skipped.
  deckFacts?: ReadonlyMap<string, DeckSaveCard>;
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
  const deckFacts = new Map<string, DeckSaveCard>();
  for (const row of rows) {
    if (row.encounterSet) sets.set(row.code, row.encounterSet);
    deckFacts.set(row.code, { name: row.name, typeCode: row.typeCode, sphereCode: row.sphereCode, deckLimit: row.deckLimit, deckLegal: row.deckLegal, traits: row.traits });
  }
  const printed = printedMap(rows);
  // The campaign card is dealt as an engine card only for the scenario being played, and only when it has an ability that works
  // while the scenario is played (141056:A:2), which the engine places beside the quest deck (families/burden-campaign.ts).
  for (const row of rows) if (row.code === scenario.campaignCard && row.typeCode === "campaign") printed.set(row.code, printedFromRow(row));
  return { campaign, scenario, effects, cards: printed, sets, deckFacts };
}

// Whether a card among these codes has a record that chooses a hero card from the collection.
function namesCollection(effects: readonly Effect[], codes: ReadonlySet<string>): boolean {
  return effects.some((effect) => codes.has(effect.cardCode) && /"(SwapHero|AttachCollectionHero)"/.test(JSON.stringify(effect.instructions)));
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
  // A card that names the player's collection (Helm of Secrecy, Thorongil) needs every hero card the player may own: the app
  // tracks no collection, so that is every deck-legal hero (families/misc-collection.ts).
  if (!namesCollection(effects, new Set(codes))) return worldFrom(campaign, scenario, effects, rows);
  const known = new Set(rows.map((row) => row.code));
  const heroes = catalog.select().from(cards).where(and(eq(cards.typeCode, "hero"), eq(cards.deckLegal, true))).all();
  return worldFrom(campaign, scenario, effects, [...rows, ...heroes.filter((row) => !known.has(row.code))]);
}
