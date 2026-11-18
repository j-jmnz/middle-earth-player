// The cards the Cards tab's Scenario and Campaign views list, read from catalog.db once per database handle: every card that is not a deck-legal
// player card (encounter and quest cards, the Nightmare decks, campaign cards, boons, burdens, treasures, the Messenger of the King's heroes),
// with only the columns a row or a grid cell reads, and the trees built from them on first use. The catalog is read-only while the app
// runs, so an entry never goes stale; a WeakMap frees it with the handle (the same rule as pool/cache.ts).
import { asc, eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaigns, cards, packs } from "../../catalog/schema";
import { collectionSets } from "../collection/sets";
import { printedScenarioName } from "../../campaign/printed-name";
import { campaignIds, campaignOf, scenarioOf } from "../data/campaign-data";
import { campaignTree, type CampaignTree } from "./campaign-tree";
import type { GroupTrees } from "./card-group";
import type { GroupRow } from "./group-types";
import { motkHeroes, type MotkHero } from "./motk";
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
  easyQuantity: cards.easyQuantity,
  campaignKind: cards.campaignKind,
  burdenSet: cards.burdenSet,
  campaignId: cards.campaignId,
  imagesrc: cards.imagesrc,
};

/** The rows of every card that is not deck-legal, in code order. */
export function readGroupRows<TRun>(catalog: Db<TRun>): readonly GroupRow[] {
  return catalog.select(columns).from(cards).where(eq(cards.deckLegal, false)).orderBy(asc(cards.code)).all();
}

/** The scenario that gives each boon and burden: the scenario whose campaign card places the card (`campaignPlaced`), by card code. */
export function givenByScenario(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const id of campaignIds()) {
    for (const scenarioId of campaignOf(id)?.scenarios ?? []) {
      const scenario = scenarioOf(scenarioId);
      if (!scenario) continue;
      for (const code of scenario.campaignPlaced) if (!map.has(code)) map.set(code, printedScenarioName(scenario.name));
    }
  }
  return map;
}

export type GroupData = {
  rows: readonly GroupRow[];
  scenario: () => ScenarioTree;
  campaign: () => CampaignTree;
  motk: () => readonly MotkHero[];
  trees: () => GroupTrees;
};

const groups = new WeakMap<object, GroupData>();

function build<TRun>(catalog: Db<TRun>): GroupData {
  const rows = readGroupRows(catalog);
  let scenario: ScenarioTree | null = null;
  let campaign: CampaignTree | null = null;
  let motk: readonly MotkHero[] | null = null;
  let packRows: { code: string; name: string }[] | null = null;
  const packList = () => (packRows ??= catalog.select({ code: packs.code, name: packs.name }).from(packs).all());
  const data: GroupData = {
    rows,
    scenario: () => (scenario ??= scenarioTree(rows, collectionSets(), packList())),
    campaign: () =>
      (campaign ??= campaignTree(
        rows,
        catalog.select({ id: campaigns.id, name: campaigns.name, kind: campaigns.kind, position: campaigns.position }).from(campaigns).all(),
        collectionSets(),
        packList(),
        givenByScenario(),
      )),
    motk: () => (motk ??= motkHeroes(rows)),
    trees: () => ({ scenario: data.scenario(), campaign: data.campaign(), motk: data.motk() }),
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
