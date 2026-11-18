// The cards the Cards tab's Encounter cards view lists, read from catalog.db once per database handle: every card that is not a deck-legal
// player card (encounter and quest cards, the Nightmare decks, campaign cards, boons, burdens, treasures; the Messenger of the King's heroes are read but listed by the pool),
// with only the columns a row or a grid cell reads, and the trees built from them on first use. The catalog is read-only while the app
// runs, so an entry never goes stale; a WeakMap frees it with the handle (the same rule as pool/cache.ts).
import { asc, eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaigns, cards, packs } from "../../catalog/schema";
import { collectionSets } from "../collection/sets";
import { printedScenarioName } from "../../campaign/printed-name";
import { campaignIds, campaignOf, scenarioOf } from "../data/campaign-data";
import { campaignTree, type CampaignTree } from "./campaign-tree";
import { placementCopies, type EasyCopies, type GroupRow } from "./group-types";
import { scenarioCards, type ScenarioCards } from "./scenario-group";
import { scenarioTree, type ScenarioTree } from "./scenario-tree";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const columns = {
  code: cards.code,
  name: cards.name,
  typeCode: cards.typeCode,
  typeName: cards.typeName,
  packCode: cards.packCode,
  packCodes: cards.packCodes,
  position: cards.position,
  encounterSet: cards.encounterSet,
  quantity: cards.quantity,
  stage: cards.stage,
  questPoints: cards.quest,
  campaignKind: cards.campaignKind,
  burdenSet: cards.burdenSet,
  campaignId: cards.campaignId,
  imagesrc: cards.imagesrc,
};

/** The rows of every card that is not deck-legal, in code order. */
export function readGroupRows<TRun>(catalog: Db<TRun>): readonly GroupRow[] {
  return catalog.select(columns).from(cards).where(eq(cards.deckLegal, false)).orderBy(asc(cards.code)).all();
}

export type ScenarioFacts = {
  /** The scenario that gives each boon and burden: the scenario whose campaign card places the card (`campaignPlaced`), by card code. */
  givenBy: ReadonlyMap<string, string>;
  /** The copies each card deals in Normal and in Easy Mode, from the scenario files; a card two scenarios count differently is left out. */
  easy: ReadonlyMap<string, EasyCopies>;
};

/** What the built scenarios' files say of the cards: where a boon or burden comes from, and the Easy Mode counts (the catalog has neither). */
export function scenarioFacts(): ScenarioFacts {
  const givenBy = new Map<string, string>();
  const easy = new Map<string, EasyCopies>();
  const conflicting = new Set<string>();
  for (const id of campaignIds()) {
    for (const scenarioId of campaignOf(id)?.scenarios ?? []) {
      const scenario = scenarioOf(scenarioId);
      if (!scenario) continue;
      for (const code of scenario.campaignPlaced) if (!givenBy.has(code)) givenBy.set(code, printedScenarioName(scenario.name));
      const counts = placementCopies(scenario.cards);
      for (const [code, found] of counts) {
        const known = easy.get(code);
        if (!known) easy.set(code, found);
        else if (known.normal !== found.normal || known.easy !== found.easy) conflicting.add(code);
      }
    }
  }
  for (const code of conflicting) easy.delete(code);
  return { givenBy, easy };
}

export type GroupData = {
  rows: readonly GroupRow[];
  scenario: () => ScenarioTree;
  campaign: () => CampaignTree;
  /** One scenario's cards by its id (scenario-group.ts), with its printed name; null for an id no scenario file has. */
  scenarioCards: (id: string) => ScenarioGroup | null;
};

export type ScenarioGroup = { name: string; cards: ScenarioCards };

const groups = new WeakMap<object, GroupData>();

function build<TRun>(catalog: Db<TRun>): GroupData {
  const rows = readGroupRows(catalog);
  let scenario: ScenarioTree | null = null;
  let campaign: CampaignTree | null = null;
  let packRows: { code: string; name: string }[] | null = null;
  let byCode: ReadonlyMap<string, GroupRow> | null = null;
  const scenarios = new Map<string, ScenarioGroup | null>();
  let scenarioFactsRead: ScenarioFacts | null = null;
  const facts = () => (scenarioFactsRead ??= scenarioFacts());
  const packList = () => (packRows ??= catalog.select({ code: packs.code, name: packs.name }).from(packs).all());
  const data: GroupData = {
    rows,
    scenario: () => (scenario ??= scenarioTree(rows, collectionSets(), packList(), facts().easy)),
    campaign: () =>
      (campaign ??= campaignTree(
        rows,
        catalog.select({ id: campaigns.id, name: campaigns.name, kind: campaigns.kind, position: campaigns.position }).from(campaigns).all(),
        collectionSets(),
        packList(),
        facts().givenBy,
      )),
    scenarioCards: (id) => {
      if (!scenarios.has(id)) {
        const scenario = scenarioOf(id);
        byCode ??= new Map(rows.map((row) => [row.code, row]));
        scenarios.set(id, scenario ? { name: printedScenarioName(scenario.name), cards: scenarioCards(scenario, byCode) } : null);
      }
      return scenarios.get(id) ?? null;
    },
  };
  return data;
}

/** The group data of this catalog, read on the first call. */
export function groupDataOf<TRun>(catalog: Db<TRun>): GroupData {
  let found = groups.get(catalog);
  if (!found) {
    found = build(catalog);
    groups.set(catalog, found);
  }
  return found;
}
