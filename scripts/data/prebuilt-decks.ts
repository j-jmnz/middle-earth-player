import { readFileSync } from "node:fs";
import path from "node:path";

import { parse as parseJsonc } from "jsonc-parser";
import { z } from "zod";

import type { Card } from "../../src/catalog/card-facts.ts";
import type { PrebuiltDeck } from "../../src/catalog/prebuilt-deck.ts";
import { parseDecklist, type PrintedRow, type Section } from "./decklists.ts";
import type { RawData } from "./normalize/load-raw.ts";
import type { HobCard } from "./sources/hallofbeorn.ts";
import { DATA_DIR } from "./paths.ts";
import type { RuleEntry } from "./rules/spans.ts";

// data/prebuilt-decks.json names each pre-built player deck and where its list comes from.
// - `collectors`: a deck the Learn to Play prints as "all copies of cards numbered 13–27 and two copies of card 73": every
//   copy of the product's cards in that range, the `plus` rows, and the heroes it names. The DragnCards deck it names (the
//   2011 core set's 30-card list) must have the same heroes and titles.
// - `sets`: a decklist an official product prints (a `decklist.*` span). Each row is resolved by name, type and collector
//   number within the Hall of Beorn sets the deck names ("printed": the products each row's parenthesis names). A heading
//   total must match its rows unless `misprints` says why not, and a "0-3x" row takes the count `counts` chooses. A starter
//   deck also names its RingsDB `product` and DragnCards deck: the sideboard is the rest of the product, and all three
//   lists must equal DragnCards'.
// `aliases` maps a name as printed to the card it means, with the reason: a misspelling, a name the card does not carry,
// or a card listed under the wrong heading.
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
const sectionSchema = z.enum(["hero", "ally", "attachment", "event", "player-side-quest"]);
const printedSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  productName: z.string().min(1),
  span: z.string().regex(/^decklist\./),
  sets: z.union([z.array(z.string().min(1)).min(1), z.literal("printed")]),
  product: z.string().min(1).optional(),
  dragncards: z.string().min(1).optional(),
  counts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  misprints: z.partialRecord(sectionSchema, z.string().min(1)).optional(),
  note: z.string().min(1).optional(),
});
const aliasSchema = z.strictObject({
  printed: z.string().min(1),
  qualifier: z.string().min(1).optional(),
  collector: z.number().int().positive().optional(),
  name: z.string().min(1),
  type: sectionSchema.optional(),
  sets: z.array(z.string().min(1)).optional(),
  sphere: z.string().min(1).optional(),
  reason: z.string().min(1),
});
export const prebuiltIndexSchema = z.strictObject({ aliases: z.array(aliasSchema), decks: z.array(z.union([rangeSchema, printedSchema])) });
type RangeEntry = z.infer<typeof rangeSchema>;
type PrintedEntry = z.infer<typeof printedSchema>;
type Alias = z.infer<typeof aliasSchema>;

const dragnDeckSchema = z.object({ cards: z.array(z.object({ databaseId: z.string(), quantity: z.number().int().positive(), loadGroupId: z.string() })) });

type Counts = Map<string, number>;
type ProductRow = { code: string; collector: number; quantity: number };
type Lists = { heroes: string[]; deck: Counts; side: Counts; source: string; order: (code: string) => number; note?: string };
type Fail = (message: string) => never;
type Context = {
  raw: RawData;
  byCode: ReadonlyMap<string, Card>;
  entries: ReadonlyMap<string, RuleEntry>;
  aliases: readonly Alias[];
  dragn: (deck: string) => { play: Counts; deck: Counts; side: Counts };
};

function add(counts: Counts, code: string, count: number): void {
  counts.set(code, (counts.get(code) ?? 0) + count);
}

function sameCounts(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  return a.size === b.size && [...a].every(([code, count]) => b.get(code) === count);
}

// Letters and digits only, without accents: "Celebrían’s Stone" and "Celebrian's Stone" compare equal.
export function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// "Mountain of Fire" names Hall of Beorn's "The Mountain of Fire"; "Over Hill and Under Hill" its "The Hobbit: Over Hill…".
function setMatches(hobSet: string, named: string): boolean {
  const full = plain(hobSet);
  return full === plain(named) || full.endsWith(plain(named.replace(/^the /i, "")));
}

const HOB_TYPE: Readonly<Record<string, Section>> = { Hero: "hero", Ally: "ally", Attachment: "attachment", Event: "event", Player_Side_Quest: "player-side-quest" };

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

// The catalog card a Hall of Beorn printing is: its RingsDB id when that is a card of the same name (a reprint in a
// revised product carries a placeholder id), else the one deck-legal card with its name, type and sphere.
function catalogCode(hob: HobCard, byCode: ReadonlyMap<string, Card>, legal: readonly Card[]): string | null {
  const direct = hob.RingsDbCardId ? byCode.get(hob.RingsDbCardId) : undefined;
  if (direct && plain(direct.name) === plain(hob.Title)) return direct.code;
  const sphere = (hob.Sphere ?? "neutral").toLowerCase();
  const matches = legal.filter((card) => plain(card.name) === plain(hob.Title) && card.type === HOB_TYPE[hob.CardType] && (card.sphere ?? "neutral") === sphere);
  return matches.length === 1 ? (matches[0]?.code ?? null) : null;
}

function rangeDeck(entry: RangeEntry, { raw, byCode, dragn }: Context, fail: Fail): Lists {
  const product = productRows(raw, entry.product);
  const heroNamed = (name: string): string =>
    product.find((row) => byCode.get(row.code)?.type === "hero" && byCode.get(row.code)?.name === name)?.code ?? fail(`${entry.product} has no hero ${name}`);
  const atCollector = (collector: number): string => product.find((row) => row.collector === collector)?.code ?? fail(`${entry.product} has no collector ${collector}`);
  const heroes = entry.heroes.map(heroNamed);
  const deck: Counts = new Map();
  for (const row of product) if (row.collector >= entry.collectors.from && row.collector <= entry.collectors.to) add(deck, row.code, row.quantity);
  for (const extra of entry.plus) add(deck, atCollector(extra.collector), extra.count);
  const theirs = dragn(entry.dragncards);
  if (!sameCounts(new Map(heroes.map((code) => [code, 1])), theirs.play)) fail(`heroes differ from DragnCards ${entry.dragncards}`);
  if ([...deck.keys()].sort().join() !== [...theirs.deck.keys()].sort().join()) fail(`cards differ from DragnCards ${entry.dragncards}`);
  const collector = new Map(product.map((row) => [row.code, row.collector]));
  return { heroes, deck, side: new Map(), source: entry.span, order: (code) => collector.get(code) ?? 0 };
}

function printedDeck(entry: PrintedEntry, context: Context, fail: Fail): Lists {
  const { raw, byCode, entries, aliases } = context;
  const span = entries.get(entry.span) ?? fail(`span ${entry.span} is not in data/rules/index.json`);
  const printed = parseDecklist(span.text);
  const sets = entry.sets === "printed" ? [...new Set(printed.rows.flatMap((row) => (row.qualifier ?? "").split(",").map((name) => name.trim()).filter((name) => name !== "")))] : entry.sets;
  const legal = [...byCode.values()].filter((card) => card.deckLegal);

  const resolve = (row: PrintedRow): string => {
    const alias = aliases.find(
      (item) => item.printed === row.name && (item.qualifier === undefined || item.qualifier === row.qualifier) && (item.collector === undefined || item.collector === row.collector),
    );
    const name = alias?.name ?? row.name;
    const type = alias?.type ?? row.section;
    // A Community Deck List row names its own products; a row without them looks in every product the list names.
    const own = entry.sets === "printed" && row.qualifier ? row.qualifier.split(",").map((name) => name.trim()) : null;
    const within = alias?.sets ?? own ?? sets;
    const named = raw.hob.filter((hob) => within.some((set) => setMatches(hob.CardSet, set)) && plain(hob.Title) === plain(name) && HOB_TYPE[hob.CardType] === type);
    const sphered = alias?.sphere ? named.filter((hob) => (hob.Sphere ?? "").toLowerCase() === alias.sphere) : named;
    const atCollector = sphered.filter((hob) => hob.Number === row.collector);
    const codes = new Set((atCollector.length > 0 ? atCollector : sphered).map((hob) => catalogCode(hob, byCode, legal)));
    const [code] = codes;
    if (codes.size !== 1 || !code) fail(`"${row.name}"${row.collector === null ? "" : ` (${row.collector})`} as a ${type} in ${within.join(", ")} is ${codes.size === 0 ? "no card" : [...codes].join(" or ")}`);
    return code as string;
  };

  const counted = new Map<Section, number>();
  const heroes: string[] = [];
  const deck: Counts = new Map();
  const order = new Map<string, number>();
  for (const row of printed.rows) {
    const chosen = entry.counts?.[row.name];
    if (row.min !== row.max && chosen === undefined) fail(`"${row.name}" is printed ${row.min}-${row.max}x; counts must choose`);
    if (chosen !== undefined && (chosen < row.min || chosen > row.max)) fail(`"${row.name}" count ${chosen} is outside the printed ${row.min}-${row.max}`);
    const count = chosen ?? row.max;
    counted.set(row.section, (counted.get(row.section) ?? 0) + row.max);
    const code = resolve(row);
    if (!order.has(code)) order.set(code, order.size);
    if (count === 0) continue;
    if (row.section === "hero") heroes.push(code);
    else add(deck, code, count);
  }
  for (const [section, total] of printed.totals) {
    const misprint = entry.misprints?.[section];
    if ((counted.get(section) ?? 0) !== total && !misprint) fail(`${section} heading says ${total}, the rows add to ${counted.get(section) ?? 0}`);
    if ((counted.get(section) ?? 0) === total && misprint) fail(`${section} is recorded as a misprint, but the rows add to the heading`);
  }

  let side: Counts = new Map();
  if (entry.product) {
    side = new Map(productRows(raw, entry.product).map((row) => [row.code, row.quantity]));
    for (const [code, count] of [...heroes.map((hero): [string, number] => [hero, 1]), ...deck]) {
      const left = (side.get(code) ?? 0) - count;
      if (left < 0) fail(`${code} is not ${count} more cards of ${entry.product}`);
      if (left === 0) side.delete(code);
      else side.set(code, left);
    }
  }
  if (entry.dragncards) {
    const theirs = context.dragn(entry.dragncards);
    if (!sameCounts(new Map(heroes.map((code) => [code, 1])), theirs.play)) fail(`heroes differ from DragnCards ${entry.dragncards}`);
    if (!sameCounts(deck, theirs.deck)) fail(`deck differs from DragnCards ${entry.dragncards}`);
    if (!sameCounts(side, theirs.side)) fail(`sideboard differs from DragnCards ${entry.dragncards}`);
  }
  const sideOrder = new Map(entry.product ? productRows(raw, entry.product).map((row) => [row.code, row.collector]) : []);
  return { heroes, deck, side, source: entry.span, order: (code) => order.get(code) ?? 1000 + (sideOrder.get(code) ?? 0), ...(entry.note ? { note: entry.note } : {}) };
}

export function loadPrebuiltDecks(raw: RawData, cards: readonly Card[], ruleEntries: readonly RuleEntry[], dataDir = DATA_DIR): PrebuiltDeck[] {
  const index = prebuiltIndexSchema.parse(JSON.parse(readFileSync(path.join(dataDir, "prebuilt-decks.json"), "utf8")) as unknown);
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const productNames = new Map(raw.packs.map((pack) => [pack.code, pack.name]));
  const dragnDecks = (parseJsonc(raw.dragnRaw.preBuiltDecks) as { preBuiltDecks: Record<string, unknown> }).preBuiltDecks;
  const octgn = octgnCodes(raw);
  const dragn = (id: string) => {
    const lists = { play: new Map<string, number>(), deck: new Map<string, number>(), side: new Map<string, number>() };
    const groups: Readonly<Record<string, Counts>> = { playerNPlay1: lists.play, playerNDeck: lists.deck, playerNSideboard: lists.side };
    const deck = dragnDecks[id];
    if (!deck) throw new Error(`DragnCards has no deck ${id}`);
    for (const line of dragnDeckSchema.parse(deck).cards) {
      const group = groups[line.loadGroupId];
      const code = octgn.get(line.databaseId);
      if (!group || !code) throw new Error(`DragnCards ${id}: ${line.databaseId} in ${line.loadGroupId} has no RingsDB code or group`);
      add(group, code, line.quantity);
    }
    return lists;
  };
  const context: Context = { raw, byCode, entries: new Map(ruleEntries.map((entry) => [entry.id, entry])), aliases: index.aliases, dragn };

  return index.decks.map((entry) => {
    const fail: Fail = (message) => {
      throw new Error(`Pre-built deck ${entry.id}: ${message}`);
    };
    const lists = "collectors" in entry ? rangeDeck(entry, context, fail) : printedDeck(entry, context, fail);
    const productName = "productName" in entry ? entry.productName : (productNames.get(entry.product) ?? fail(`product ${entry.product} is not a RingsDB pack`));

    const cardOf = (code: string): Card => {
      const card = byCode.get(code) ?? fail(`${code} is not in data/cards`);
      return card.deckLegal ? card : fail(`${code} (${card.name}) is not deck-legal`);
    };
    for (const code of lists.heroes) if (cardOf(code).type !== "hero") fail(`hero ${code} is a ${cardOf(code).type}`);
    for (const code of lists.deck.keys()) if (cardOf(code).type === "hero") fail(`deck card ${code} is a hero`);
    for (const code of lists.side.keys()) cardOf(code);

    const slots = (counts: Counts) => [...counts].sort(([a], [b]) => lists.order(a) - lists.order(b)).map(([code, count]) => ({ code, count }));
    const heroes = [...lists.heroes].sort((a, b) => lists.order(a) - lists.order(b));
    return {
      id: entry.id,
      name: entry.name,
      ...("product" in entry && entry.product ? { product: entry.product } : {}),
      productName,
      source: lists.source,
      heroes,
      cards: slots(lists.deck),
      sideboard: slots(lists.side),
      ...(lists.note ? { note: lists.note } : {}),
    };
  });
}
