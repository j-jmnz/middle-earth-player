import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse as parseJsonc } from "jsonc-parser";
import { z } from "zod";

import type { Card } from "../../src/catalog/card-facts.ts";
import type { PrebuiltDeck } from "../../src/catalog/prebuilt-deck.ts";
import { DATA_DIR, RAW_DIR } from "./paths.ts";
import type { RuleEntry } from "./rules/spans.ts";

// data/prebuilt-decks.json names each pre-built player deck and where its list comes from. A deck the Learn to Play
// prints (`span`) is every copy of the product's cards in a collector range, plus the extra rows the span names, with
// the heroes it names; the DragnCards deck of the same name is a cross-check on the heroes and the card list. A deck
// read from DragnCards (`dragncards` alone) is its play area, deck and sideboard; together they must be exactly the
// product's contents as RingsDB lists them.
const printedSchema = z.strictObject({
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
const indexSchema = z.array(z.union([printedSchema, dragnSchema]));

// RingsDB lists a reprint under its first pack; `packs` holds each product's position (its collector number), quantity
// and OCTGN id. DragnCards' databaseId is that OCTGN id.
const ringsDbRowSchema = z.object({
  code: z.string(),
  octgnid: z.string().nullish(),
  packs: z.array(z.object({ pack_code: z.string(), position: z.number().int(), quantity: z.number().int(), octgnid: z.string().nullish() })),
});
const dragnDeckSchema = z.object({ cards: z.array(z.object({ databaseId: z.string(), quantity: z.number().int().positive(), loadGroupId: z.string() })) });

type Slot = { code: string; count: number };
type ProductRow = { code: string; collector: number; quantity: number };

function readRaw(...parts: string[]): string {
  return readFileSync(path.join(RAW_DIR, ...parts), "utf8");
}

function productRows(product: string): ProductRow[] {
  const rows = z.array(ringsDbRowSchema).parse(JSON.parse(readRaw("ringsdb", "cards", `${product}.json`)) as unknown);
  return rows.flatMap((row) => row.packs.filter((pack) => pack.pack_code === product).map((pack) => ({ code: row.code, collector: pack.position, quantity: pack.quantity })));
}

function octgnCodes(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of readdirSync(path.join(RAW_DIR, "ringsdb", "cards")).sort()) {
    for (const row of z.array(ringsDbRowSchema).parse(JSON.parse(readRaw("ringsdb", "cards", file)) as unknown)) {
      if (row.octgnid) out.set(row.octgnid, row.code);
      for (const printing of row.packs) if (printing.octgnid) out.set(printing.octgnid, row.code);
    }
  }
  return out;
}

function add(slots: Map<string, number>, code: string, count: number): void {
  slots.set(code, (slots.get(code) ?? 0) + count);
}

function sameSlots(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  return a.size === b.size && [...a].every(([code, count]) => b.get(code) === count);
}

export function loadPrebuiltDecks(cards: readonly Card[], entries: readonly RuleEntry[], dataDir = DATA_DIR): PrebuiltDeck[] {
  const index = indexSchema.parse(JSON.parse(readFileSync(path.join(dataDir, "prebuilt-decks.json"), "utf8")) as unknown);
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const spans = new Set(entries.map((entry) => entry.id));
  const productNames = new Map((JSON.parse(readRaw("ringsdb", "packs.json")) as { code: string; name: string }[]).map((pack) => [pack.code, pack.name]));
  const dragnDecks = (parseJsonc(readRaw("dragncards", "preBuiltDecks.json")) as { preBuiltDecks: Record<string, unknown> }).preBuiltDecks;
  const octgn = octgnCodes();

  return index.map((entry) => {
    const fail = (message: string): never => {
      throw new Error(`Pre-built deck ${entry.id}: ${message}`);
    };
    const productName = productNames.get(entry.product) ?? fail(`product ${entry.product} is not a RingsDB pack`);
    const product = productRows(entry.product);
    const order = new Map(product.map((row) => [row.code, row.collector]));
    const rawDeck = dragnDecks[entry.dragncards] ?? fail(`DragnCards has no deck ${entry.dragncards}`);
    const dragn = { play: new Map<string, number>(), deck: new Map<string, number>(), side: new Map<string, number>() };
    for (const line of dragnDeckSchema.parse(rawDeck).cards) {
      const code = octgn.get(line.databaseId) ?? fail(`DragnCards card ${line.databaseId} has no RingsDB code`);
      const group = { playerNPlay1: dragn.play, playerNDeck: dragn.deck, playerNSideboard: dragn.side }[line.loadGroupId] ?? fail(`unknown DragnCards group ${line.loadGroupId}`);
      add(group, code, line.quantity);
    }

    let heroes: string[];
    let deck: Map<string, number>;
    let side: Map<string, number>;
    let source: string;
    if ("span" in entry) {
      if (!spans.has(entry.span)) fail(`span ${entry.span} is not in data/rules/index.json`);
      heroes = entry.heroes.map((name) => product.find((row) => byCode.get(row.code)?.type === "hero" && byCode.get(row.code)?.name === name)?.code ?? fail(`${entry.product} has no hero ${name}`));
      deck = new Map();
      for (const row of product) if (row.collector >= entry.collectors.from && row.collector <= entry.collectors.to) add(deck, row.code, row.quantity);
      for (const extra of entry.plus) add(deck, product.find((row) => row.collector === extra.collector)?.code ?? fail(`${entry.product} has no collector ${extra.collector}`), extra.count);
      side = new Map();
      source = entry.span;
      // DragnCards lists the 2011 core set's 30-card decks: the same heroes and titles, fewer copies.
      if (!sameSlots(new Map(heroes.map((code) => [code, 1])), dragn.play)) fail(`heroes differ from DragnCards ${entry.dragncards}`);
      const titles = [...deck.keys()].sort().join(",");
      if (titles !== [...dragn.deck.keys()].sort().join(",")) fail(`cards differ from DragnCards ${entry.dragncards}`);
    } else {
      heroes = [...dragn.play.keys()];
      deck = dragn.deck;
      side = dragn.side;
      source = `dragncards:${entry.dragncards}`;
      const listed = new Map<string, number>();
      for (const group of [dragn.play, dragn.deck, dragn.side]) for (const [code, count] of group) add(listed, code, count);
      if (!sameSlots(listed, new Map(product.map((row) => [row.code, row.quantity])))) fail(`DragnCards ${entry.dragncards} is not the contents of ${entry.product}`);
    }

    const slots = (group: ReadonlyMap<string, number>): Slot[] =>
      [...group].sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0)).map(([code, count]) => ({ code, count }));
    for (const [codes, heroSlot] of [[heroes, true], [[...deck.keys()], false], [[...side.keys()], null]] as const) {
      for (const code of codes) {
        const card = byCode.get(code) ?? fail(`${code} is not in data/cards`);
        if (!card.deckLegal) fail(`${code} (${card.name}) is not deck-legal`);
        if (heroSlot !== null && (card.type === "hero") !== heroSlot) fail(`${code} (${card.name}) is a ${card.type}`);
      }
    }
    return { id: entry.id, name: entry.name, product: entry.product, productName, source, heroes: slots(new Map(heroes.map((code) => [code, 1]))).map((slot) => slot.code), cards: slots(deck), sideboard: slots(side) };
  });
}
