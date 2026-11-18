// The Cards tab's Encounter cards view as data (docs/design-system.md, Card groups): one entry for each product of data/collection.json in its
// order, the Nightmare decks last, each holding its encounter sets and then its campaigns' sections (campaign cards, Boons, Burdens, Treasures).
// A pack's one set is a row of its own; a pack of several sets is a heading over them, unless the product is that one pack. A campaign is filed
// under the product that prints most of its cards. A search keeps the rows, headings and products whose words hold every word typed. Pure.
import { cardsWord } from "./card-group";
import type { CampaignNode, CampaignTree } from "./campaign-tree";
import type { ScenarioTree } from "./scenario-tree";

export type EncounterRow = {
  kind: "row";
  group: "set" | "campaign";
  key: string;
  testID: string;
  label: string;
  detail: string;
  /** More words a search matches: a set's pack. */
  find: string;
};
export type EncounterHeading = { kind: "heading"; id: string; title: string };
export type EncounterItem = EncounterRow | EncounterHeading;

export type EncounterProduct = {
  id: string;
  title: string;
  /** What the fold says while closed: "7 sets", "6 sets + campaign", "Campaign". */
  summary: string;
  items: readonly EncounterItem[];
};

type CollectionLike = { id: string; packs: readonly string[] };

// The collection entry that prints most of a campaign's cards; the first listed wins a tie.
function homeOf(campaign: CampaignNode, collection: readonly CollectionLike[]): string | null {
  let best: string | null = null;
  let bestHeld = 0;
  for (const entry of collection) {
    const held = entry.packs.reduce((sum, pack) => sum + (campaign.packs.get(pack) ?? 0), 0);
    if (held > bestHeld) {
      best = entry.id;
      bestHeld = held;
    }
  }
  return best;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function summaryOf(sets: number, campaign: boolean): string {
  if (sets === 0) return "Campaign";
  return campaign ? `${plural(sets, "set")} + campaign` : plural(sets, "set");
}

function campaignItems(campaigns: readonly CampaignNode[], productTitle: string): EncounterItem[] {
  return campaigns.flatMap((campaign): EncounterItem[] => [
    // One campaign of the product's own name is just "Campaign"; the Lord of the Rings saga names each of its three.
    { kind: "heading", id: `campaign-${campaign.id}`, title: campaigns.length === 1 && campaign.name === productTitle ? "Campaign" : campaign.name },
    ...campaign.sections.map((section): EncounterRow => ({ kind: "row", group: "campaign", key: section.key, testID: `cards-section-${section.key}`, label: section.title, detail: cardsWord(section.count), find: "" })),
  ]);
}

/** Every product with a set or a campaign section, in the collection's order, then the Nightmare decks. */
export function encounterList(scenario: ScenarioTree, campaign: CampaignTree, collection: readonly (CollectionLike & { title: string })[]): EncounterProduct[] {
  const homes = new Map<string, CampaignNode[]>();
  for (const node of campaign.campaigns) {
    const home = homeOf(node, collection);
    if (home) homes.set(home, [...(homes.get(home) ?? []), node]);
  }
  const products = new Map(scenario.products.map((product) => [product.id, product]));
  const entries = [...collection.map((entry) => ({ id: entry.id, title: entry.title })), ...scenario.products.filter((product) => !collection.some((entry) => entry.id === product.id))];
  return entries.flatMap((entry): EncounterProduct[] => {
    const product = products.get(entry.id);
    const packs = product?.packs ?? [];
    const sets: EncounterItem[] = packs.flatMap((pack): EncounterItem[] => {
      const rows = pack.sets.map((set): EncounterRow => {
        // A pack's one set named otherwise than its pack says the pack beside its count, so the pack can still be found.
        const detail = packs.length > 1 && pack.sets.length === 1 && set.name !== pack.name ? `${pack.name} · ${cardsWord(set.count)}` : cardsWord(set.count);
        return { kind: "row", group: "set", key: set.key, testID: `cards-set-${set.key}`, label: set.name, detail, find: pack.name };
      });
      return packs.length > 1 && pack.sets.length > 1 ? [{ kind: "heading", id: `pack-${pack.code}`, title: pack.name }, ...rows] : rows;
    });
    const count = packs.reduce((sum, pack) => sum + pack.sets.length, 0);
    const own = homes.get(entry.id) ?? [];
    const items = [...sets, ...campaignItems(own, entry.title)];
    return items.length === 0 ? [] : [{ id: entry.id, title: product?.title ?? entry.title, summary: summaryOf(count, own.length > 0), items }];
  });
}

/** The words a search compares: lower case, accents and punctuation dropped ("Númenor" is "numenor"). */
export function searchWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

function holds(haystack: string, words: readonly string[]): boolean {
  const found = searchWords(haystack);
  return words.every((word) => found.some((candidate) => candidate.startsWith(word)));
}

/**
 * The products a search keeps: a product whose title holds the words keeps every row; otherwise a row stays when its words, with its heading's
 * and its product's, hold them, and a heading stays over the rows it keeps. An empty search keeps everything.
 */
export function searchEncounter(products: readonly EncounterProduct[], text: string): readonly EncounterProduct[] {
  const words = searchWords(text);
  if (words.length === 0) return products;
  return products.flatMap((product): EncounterProduct[] => {
    if (holds(product.title, words)) return [product];
    const kept: EncounterItem[] = [];
    let heading: EncounterHeading | null = null;
    let headingShown = false;
    for (const item of product.items) {
      if (item.kind === "heading") {
        heading = item;
        headingShown = false;
        continue;
      }
      if (!holds(`${product.title} ${heading?.title ?? ""} ${item.label} ${item.find}`, words)) continue;
      if (heading && !headingShown) {
        kept.push(heading);
        headingShown = true;
      }
      kept.push(item);
    }
    return kept.length === 0 ? [] : [{ ...product, items: kept }];
  });
}
