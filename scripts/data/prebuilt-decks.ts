import { readFileSync } from "node:fs";
import path from "node:path";

import { parse as parseJsonc } from "jsonc-parser";
import { z } from "zod";

import type { Card } from "../../src/catalog/card-facts.ts";
import type { PrebuiltDeck } from "../../src/catalog/prebuilt-deck.ts";
import type { RawData } from "./normalize/load-raw.ts";
import { DATA_DIR } from "./paths.ts";
import type { RuleEntry } from "./rules/spans.ts";

// data/prebuilt-decks.json names each pre-built player deck and where its list comes from.
// - `collectors`: a deck the Learn to Play prints as "all copies of cards numbered 13–27 and two copies of card 73": every
//   copy of the product's cards in that range, the `plus` rows, and the heroes it names. The DragnCards deck it names (the
//   2011 core set's 30-card list) must have the same heroes and titles.
// - `dragncards` alone: DragnCards' play area, deck and sideboard, which together must be exactly the product's contents
//   as RingsDB lists them.
const rangeSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  product: z.string().min(1),
  span: z.string().min(1),
  heroes: z.array(z.string().min(1)).min(1).max(3),
  collectors: z.strictObject({ from: z.number().int().positive(), to: z.number().int().positive() }),
  plus: z.array(z.strictObject({ collector: z.number().int().positive(), count: z.number().int().positive() })),
  dragncards: z.string().min(1),
});
const dragnSchema = z.strictObject({ id: z.string().min(1), name: z.string().min(1), product: z.string().min(1), dragncards: z.string().min(1) });
export const prebuiltIndexSchema = z.array(z.union([rangeSchema, dragnSchema]));
type RangeEntry = z.infer<typeof rangeSchema>;
type DragnEntry = z.infer<typeof dragnSchema>;

const dragnDeckSchema = z.object({ cards: z.array(z.object({ databaseId: z.string(), quantity: z.number().int().positive(), loadGroupId: z.string() })) });

type Counts = Map<string, number>;
type ProductRow = { code: string; collector: number; quantity: number };
type Lists = { heroes: string[]; deck: Counts; side: Counts; source: string };
type Context = { byCode: ReadonlyMap<string, Card>; product: readonly ProductRow[]; dragn: { play: Counts; deck: Counts; side: Counts } };

function add(counts: Counts, code: string, count: number): void {
  counts.set(code, (counts.get(code) ?? 0) + count);
}

function sameCounts(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  return a.size === b.size && [...a].every(([code, count]) => b.get(code) === count);
}

// Every printing of the product, at its collector number, with the copies the product holds.
function productRows(raw: RawData, product: string): ProductRow[] {
  return (raw.ringsdb.get(product) ?? []).flatMap((card) =>
    (card.packs ?? []).filter((pack) => pack.pack_code === product).map((pack) => ({ code: card.code, collector: pack.position, quantity: pack.quantity })),
  );
}

function octgnCodes(raw: RawData): Map<string, string> {
  const out = new Map<string, string>();
  for (const cards of raw.ringsdb.values()) {
    for (const card of cards) {
      if (card.octgnid) out.set(card.octgnid, card.code);
      for (const printing of card.packs ?? []) if (printing.octgnid) out.set(printing.octgnid, card.code);
    }
  }
  return out;
}

function rangeDeck(entry: RangeEntry, { byCode, product, dragn }: Context, fail: (message: string) => never): Lists {
  const heroNamed = (name: string): string =>
    product.find((row) => byCode.get(row.code)?.type === "hero" && byCode.get(row.code)?.name === name)?.code ?? fail(`${entry.product} has no hero ${name}`);
  const atCollector = (collector: number): string => product.find((row) => row.collector === collector)?.code ?? fail(`${entry.product} has no collector ${collector}`);
  const heroes = entry.heroes.map(heroNamed);
  const deck: Counts = new Map();
  for (const row of product) if (row.collector >= entry.collectors.from && row.collector <= entry.collectors.to) add(deck, row.code, row.quantity);
  for (const extra of entry.plus) add(deck, atCollector(extra.collector), extra.count);
  if (!sameCounts(new Map(heroes.map((code) => [code, 1])), dragn.play)) fail(`heroes differ from DragnCards ${entry.dragncards}`);
  if ([...deck.keys()].sort().join() !== [...dragn.deck.keys()].sort().join()) fail(`cards differ from DragnCards ${entry.dragncards}`);
  return { heroes, deck, side: new Map(), source: entry.span };
}

function dragncardsDeck(entry: DragnEntry, { product, dragn }: Context, fail: (message: string) => never): Lists {
  const listed: Counts = new Map();
  for (const group of [dragn.play, dragn.deck, dragn.side]) for (const [code, count] of group) add(listed, code, count);
  if (!sameCounts(listed, new Map(product.map((row) => [row.code, row.quantity])))) fail(`DragnCards ${entry.dragncards} is not the contents of ${entry.product}`);
  return { heroes: [...dragn.play.keys()], deck: dragn.deck, side: dragn.side, source: `dragncards:${entry.dragncards}` };
}

export function loadPrebuiltDecks(raw: RawData, cards: readonly Card[], entries: readonly RuleEntry[], dataDir = DATA_DIR): PrebuiltDeck[] {
  const index = prebuiltIndexSchema.parse(JSON.parse(readFileSync(path.join(dataDir, "prebuilt-decks.json"), "utf8")) as unknown);
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const spans = new Set(entries.map((entry) => entry.id));
  const productNames = new Map(raw.packs.map((pack) => [pack.code, pack.name]));
  const dragnDecks = (parseJsonc(raw.dragnRaw.preBuiltDecks) as { preBuiltDecks: Record<string, unknown> }).preBuiltDecks;
  const octgn = octgnCodes(raw);

  return index.map((entry) => {
    const fail = (message: string): never => {
      throw new Error(`Pre-built deck ${entry.id}: ${message}`);
    };
    const productName = productNames.get(entry.product) ?? fail(`product ${entry.product} is not a RingsDB pack`);
    const product = productRows(raw, entry.product);
    const dragn = { play: new Map<string, number>(), deck: new Map<string, number>(), side: new Map<string, number>() };
    const groups: Readonly<Record<string, Counts>> = { playerNPlay1: dragn.play, playerNDeck: dragn.deck, playerNSideboard: dragn.side };
    for (const line of dragnDeckSchema.parse(dragnDecks[entry.dragncards] ?? fail(`DragnCards has no deck ${entry.dragncards}`)).cards) {
      const group = groups[line.loadGroupId] ?? fail(`unknown DragnCards group ${line.loadGroupId}`);
      add(group, octgn.get(line.databaseId) ?? fail(`DragnCards card ${line.databaseId} has no RingsDB code`), line.quantity);
    }

    const context: Context = { byCode, product, dragn };
    if ("span" in entry && !spans.has(entry.span)) fail(`span ${entry.span} is not in data/rules/index.json`);
    const lists = "span" in entry ? rangeDeck(entry, context, fail) : dragncardsDeck(entry, context, fail);

    const cardOf = (code: string): Card => {
      const card = byCode.get(code) ?? fail(`${code} is not in data/cards`);
      return card.deckLegal ? card : fail(`${code} (${card.name}) is not deck-legal`);
    };
    for (const code of lists.heroes) if (cardOf(code).type !== "hero") fail(`hero ${code} is a ${cardOf(code).type}`);
    for (const code of lists.deck.keys()) if (cardOf(code).type === "hero") fail(`deck card ${code} is a hero`);
    for (const code of lists.side.keys()) cardOf(code);

    const collector = new Map(product.map((row) => [row.code, row.collector]));
    const slots = (counts: Counts) => [...counts].sort(([a], [b]) => (collector.get(a) ?? 0) - (collector.get(b) ?? 0)).map(([code, count]) => ({ code, count }));
    const heroes = [...lists.heroes].sort((a, b) => (collector.get(a) ?? 0) - (collector.get(b) ?? 0));
    return { id: entry.id, name: entry.name, product: entry.product, productName, source: lists.source, heroes, cards: slots(lists.deck), sideboard: slots(lists.side) };
  });
}
