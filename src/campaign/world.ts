// Rules: ltp.campaign-setup-checklist (data/rules/entries.json). Everything a briefing, a replay and a resolution read
// to turn a save into an opening state: the campaign file, the scenario, the effect records, and the engine's cards.
import { and, eq, inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { collectionVerbs, type Effect } from "../catalog/boundary.ts";
import { contentVersion } from "../catalog/content-hash.ts";
import type { DeckSaveCard } from "../catalog/deck-save.ts";
import { cards } from "../catalog/schema.ts";
import { campaignGameCodes, recordInstructions, scenarioCards, type AnyScenarioData, type CampaignData } from "../catalog/scenario-data.ts";
import { ORC_GUARD_CODE, printedOf, type PrintedCard } from "../rules/core/printed.ts";

import type { CampaignLog } from "./log.ts";

import { printedFromRow, printedMap, type CatalogRow } from "./cards.ts";

export type World = {
  campaign: CampaignData;
  // A cycle's scenario (Shadows of Mirkwood) has no campaign card and no campaign: it is played standalone only.
  scenario: AnyScenarioData;
  effects: readonly Effect[];
  cards: ReadonlyMap<string, PrintedCard>;
  // The encounter set of each card the catalog knows, for the briefing's per-set counts.
  sets: ReadonlyMap<string, string>;
  // The deckbuilding facts of the same rows (rr.deckbuilding), so the briefing refuses a saved deck that is not ready to
  // play. A world built by hand in a test may leave it out, and then that check is skipped.
  deckFacts?: ReadonlyMap<string, DeckSaveCard>;
  // How many copies of each card one collection holds (the catalog's quantity), which caps the encounter cards the Campaign Pool tallies (emce.campaign-pool-encounter).
  copies?: ReadonlyMap<string, number>;
};

const sortedEntries = <V>(map: ReadonlyMap<string, V> | undefined): [string, V][] => (map ? [...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)) : []);

// The last hash computed for a world: its key (the codes it covered) and the number. A world is hashed for one set of codes in practice (the game's).
const HASHES = new WeakMap<World, { key: string; hash: number }>();

// What a replay of a game reads, as a number: the printed rows of the codes the game can reach (gameCodes: the scenario's, plus `extra`, the
// codes of the loadout and the log, which is what the table's open loads and what a deal stamps), the scenario and the campaign data, and the effect
// records of those codes. A save stamps it (ActiveScenario.world) and the table compares it on open, so a card, a scenario or a record that is not in
// this game never moves it, and a world loaded for a briefing (every saved deck) gives the number the table's world gives. The codes are sorted, so it does
// not depend on the order a Map was filled in. Computed once for a world and a set of codes.
export function worldHash(world: World, extra: Iterable<string> = []): number {
  const codes = new Set(gameCodes(world.campaign, world.scenario, world.effects, extra));
  const key = [...codes].sort().join("\0");
  const known = HASHES.get(world);
  if (known?.key === key) return known.hash;
  const within = <V>(map: ReadonlyMap<string, V> | undefined) => sortedEntries(map).filter(([code]) => codes.has(code));
  const effects = world.effects.filter((effect) => codes.has(effect.cardCode));
  const hash = contentVersion([world.campaign, world.scenario, within(world.cards), within(world.sets), within(world.deckFacts), within(world.copies), effects]);
  HASHES.set(world, { key, hash });
  return hash;
}

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

// The catalog codes a scenario needs to be dealt and resolved: its piles and its Nightmare deck, its campaign card and what that card names,
// the campaign prelude, and any extra codes the caller holds (the heroes and decks of a loadout, the pool).
export function worldCodes(campaign: CampaignData, scenario: AnyScenarioData, effects: readonly Effect[], extra: Iterable<string> = []): string[] {
  const codes = new Set<string>(campaign.prelude.map((card) => card.code));
  if (scenario.campaignCard !== undefined) codes.add(scenario.campaignCard);
  // The saga hero a scenario grants and what it attaches to the Ring-bearer (ScenarioData.sagaStart).
  if (scenario.sagaStart) for (const code of "hero" in scenario.sagaStart ? [scenario.sagaStart.hero] : scenario.sagaStart.attached) codes.add(code);
  // A card with two catalog codes (the Stormcaller Elite) is dealt as its first side; the other side is in the world for the flip.
  for (const card of scenarioCards(scenario)) {
    codes.add(card.code);
    if (card.back != null) codes.add(card.back);
  }
  for (const code of scenario.campaignPlaced) codes.add(code);
  // The reprints a campaign game deals in place of the originals, and the Hard/Expert Mode card (campaignGameCodes).
  for (const code of campaignGameCodes(campaign, scenario)) codes.add(code);
  // The Nightmare deck, so a briefing can switch to Nightmare without loading the world again.
  if (scenario.nightmare) {
    codes.add(scenario.nightmare.setupCard);
    for (const card of scenario.nightmare.cards) codes.add(card.code);
  }
  if (scenario.campaignCard !== undefined) for (const code of instructionCodes(effects, scenario.campaignCard)) codes.add(code);
  for (const code of extra) codes.add(code);
  return [...codes];
}

// The codes a log names: its heroes, its fallen heroes, the cards of its pool and the cards it takes in from another campaign.
export function logCodes(log: CampaignLog): string[] {
  return [...log.heroesBySeat.flat(), ...log.fallenHeroesBySeat.flat(), ...log.campaignPool.map((card) => card.code), ...log.carryIn.map((card) => card.code), ...log.campaignPool.flatMap((card) => (card.attachedTo ? [card.attachedTo] : [])), ...log.treasures, ...Object.keys(log.encounterPool), ...Object.keys(log.blackGate)];
}

// The codes of a deal's loadout: the Ring-bearer and the heroes and cards of each seat's deck. Shared by what the table opens with (a save's
// log adds its own) and what a deal stamps, so both hash the same cards (worldHash).
export function dealtCodes(loadout: { ringBearer: string | null; seats: readonly { heroes: readonly string[]; deck: readonly string[] }[] } | null): string[] {
  if (!loadout) return [];
  return [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
}

// Every code a game can reach, which loadWorld loads and worldHash hashes: worldCodes, `extra`, and the cards its records take from the collection by code.
export function gameCodes(campaign: CampaignData, scenario: AnyScenarioData, effects: readonly Effect[], extra: Iterable<string> = []): string[] {
  const dealt = worldCodes(campaign, scenario, effects, extra);
  return [...new Set([...dealt, ...collectionTaken(effects, new Set(dealt))])];
}

export function worldFrom(campaign: CampaignData, scenario: AnyScenarioData, effects: readonly Effect[], rows: readonly CatalogRow[]): World {
  const sets = new Map<string, string>();
  const deckFacts = new Map<string, DeckSaveCard>();
  const copies = new Map<string, number>();
  for (const row of rows) {
    copies.set(row.code, row.quantity);
    if (row.encounterSet) sets.set(row.code, row.encounterSet);
    deckFacts.set(row.code, { name: row.name, typeCode: row.typeCode, sphereCode: row.sphereCode, deckLimit: row.deckLimit, deckLegal: row.deckLegal, traits: row.traits });
  }
  const printed = printedMap(rows);
  // The campaign card is dealt as an engine card only for the scenario being played, and only when it has an ability that works
  // while the scenario is played (141056:A:2), which the engine places beside the quest deck (families/burden/campaign.ts).
  for (const row of rows) if (scenario.campaignCard !== undefined && row.code === scenario.campaignCard && row.typeCode === "campaign") printed.set(row.code, printedFromRow(row));
  // The Orc Guard a deck card becomes (01107:A:1) is no card of the catalog: the engine makes it, and the table names it.
  printed.set(ORC_GUARD_CODE, printedOf(printed, ORC_GUARD_CODE));
  return { campaign, scenario, effects, cards: printed, sets, deckFacts, copies };
}

// Whether a card among these codes has a record, at any depth, with a verb that chooses a hero card from the collection (`collection: "hero"`, src/catalog/verb-flags.ts).
function namesCollection(effects: readonly Effect[], codes: ReadonlySet<string>): boolean {
  const heroVerbs = collectionVerbs("hero");
  return effects.some((effect) => {
    if (!codes.has(effect.cardCode)) return false;
    const verbs: string[] = [];
    walkInstructions(effect.instructions, (instruction) => verbs.push(String(instruction.verb)));
    return verbs.some((verb) => heroVerbs.has(verb));
  });
}

// Whether a card among these codes has a record, at any depth, with a verb that draws from the treasures of the catalog (`collection: "treasure"`, src/catalog/verb-flags.ts).
export function namesTreasures(effects: readonly Effect[], codes: ReadonlySet<string>): boolean {
  const treasureVerbs = collectionVerbs("treasure");
  return effects.some((effect) => {
    if (!codes.has(effect.cardCode)) return false;
    let found = false;
    walkInstructions(effect.instructions, (instruction) => {
      if (typeof instruction.verb === "string" && treasureVerbs.has(instruction.verb)) found = true;
    });
    return found;
  });
}

// Every instruction in a value, nested ones too (a Choose's options, an Each's instructions), whatever the key order.
function walkInstructions(value: unknown, visit: (instruction: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walkInstructions(item, visit);
    return;
  }
  if (value == null || typeof value !== "object") return;
  const entry = value as Record<string, unknown>;
  if (typeof entry.verb === "string") visit(entry);
  for (const inner of Object.values(entry)) walkInstructions(inner, visit);
}

// The codes the records of these cards take from the collection by code (`collection: "card"`): they are loaded whether or not the scenario deals them.
function collectionTaken(effects: readonly Effect[], codes: ReadonlySet<string>): string[] {
  const cardVerbs = collectionVerbs("card");
  const taken: string[] = [];
  for (const effect of effects) {
    if (!codes.has(effect.cardCode)) continue;
    walkInstructions(effect.instructions, (instruction) => {
      if (typeof instruction.verb === "string" && cardVerbs.has(instruction.verb) && typeof instruction.code === "string") taken.push(instruction.code);
    });
  }
  return taken;
}

// Reads the rows a scenario needs from catalog.db, read-only, and builds the world. `extra` is the heroes and deck cards
// of a loadout and the pool: the codes the screen already holds.
export function loadWorld<TRun>(
  catalog: BaseSQLiteDatabase<"sync", TRun>,
  campaign: CampaignData,
  scenario: AnyScenarioData,
  effects: readonly Effect[],
  extra: Iterable<string> = [],
): World {
  const codes = gameCodes(campaign, scenario, effects, extra);
  const rows = catalog.select().from(cards).where(inArray(cards.code, codes)).all();
  // A record that draws a random treasure (AttachRandomTreasure, emce.treasure) needs every treasure of the catalog: the draw is from the ones the log has not recorded.
  const treasures = namesTreasures(effects, new Set(codes)) ? catalog.select().from(cards).where(eq(cards.campaignKind, "treasure")).all() : [];
  const loaded = new Set(rows.map((row) => row.code));
  const withTreasures = treasures.length > 0 ? [...rows, ...treasures.filter((row) => !loaded.has(row.code))] : rows;
  // A card that names the player's collection (Helm of Secrecy, Thorongil) needs every hero card the player may own: the app
  // tracks no collection, so that is every deck-legal hero (families/misc/collection.ts).
  if (!namesCollection(effects, new Set(codes))) return worldFrom(campaign, scenario, effects, withTreasures);
  const known = new Set(withTreasures.map((row) => row.code));
  const heroes = catalog.select().from(cards).where(and(eq(cards.typeCode, "hero"), eq(cards.deckLegal, true))).all();
  return worldFrom(campaign, scenario, effects, [...withTreasures, ...heroes.filter((row) => !known.has(row.code))]);
}
