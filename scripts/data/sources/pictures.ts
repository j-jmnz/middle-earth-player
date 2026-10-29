import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { loadCards } from "../load-cards.ts";
import { RINGSDB_ORIGIN } from "../../../src/screens/images/policy.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import { PDF_CACHE_DIR, PICTURE_CACHE_DIR, RAW_DIR } from "../paths.ts";
import { MEC109_CHANGED, scanTargets, type ScanSide } from "../printed/scope.ts";
import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchBytes, sha256, type SourceFile, type SourceRecord } from "./fetch.ts";
import { extensionOf, widthOf } from "./scans.ts";

// The pictures the app bundles, every card's, so it needs no network (user decisions, 2026-10-29). The `scans` source stays
// what the printed-text ledger was read from; a picture is only shown. Each side of the scan scope and side A of every other
// card gets one, pinned by sha256:
// - FFG's print-and-play PDFs of the campaign, boon and burden cards, the only digital originals (InDesign, vector text over
//   300 ppi art), rendered at 600 DPI;
// - else the 600 DPI scan lotr.cardgame.tools hosts (u/LepcisMagna's, about 1480×2100), found through its card database;
// - else, for a card outside the scan scope, the RingsDB picture, then the Hall of Beorn or DragnCards one;
// - else none: a card of the scan scope keeps its scan.

export const CARDGAME_TOOLS_DB = "https://lotr.cardgame.tools/lotr_lcg.db";
export const CARDGAME_TOOLS_IMAGES = "https://images.cardgame.tools/lotr/";

const CORE_CAMPAIGN_PDF = "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/core_set_campaign_cards.pdf";
const DARK_OF_MIRKWOOD_PDF = "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/dark_of_mirkwood_campaign_cards.pdf";
export const PDF_DPI = 600;

// The page of each card side in FFG's PDFs. Each card is a front page and a back page; a boon or burden printed in several
// copies takes its first. A campaign card's back is its side B. syncPictures checks each page names the card.
export const PDF_PAGES: readonly { code: string; side: ScanSide; pdf: string; page: number }[] = [
  ...[
    ["01129", 1, 2],
    ["01130", 3, 4],
    ["01131", 5, 6],
  ].flatMap(([code, a, b]) => [
    { code: String(code), side: "A" as const, pdf: CORE_CAMPAIGN_PDF, page: Number(a) },
    { code: String(code), side: "B" as const, pdf: CORE_CAMPAIGN_PDF, page: Number(b) },
  ]),
  ...[
    ["01132", 7],
    ["01133", 15],
    ["01134", 23],
    ["01135", 25],
    ["01136", 27],
    ["01137", 29],
    ["01138", 31],
  ].map(([code, page]) => ({ code: String(code), side: "A" as const, pdf: CORE_CAMPAIGN_PDF, page: Number(page) })),
  ...[
    ["41050", 1, 2],
    ["41051", 3, 4],
  ].flatMap(([code, a, b]) => [
    { code: String(code), side: "A" as const, pdf: DARK_OF_MIRKWOOD_PDF, page: Number(a) },
    { code: String(code), side: "B" as const, pdf: DARK_OF_MIRKWOOD_PDF, page: Number(b) },
  ]),
  ...[
    ["41044", 5],
    ["41045", 7],
    ["41046", 9],
    ["41047", 11],
    ["41048", 13],
    ["41049", 21],
    ["41041", 29],
    ["41042", 31],
    ["41043", 33],
  ].map(([code, page]) => ({ code: String(code), side: "A" as const, pdf: DARK_OF_MIRKWOOD_PDF, page: Number(page) })),
];

// cardgame.tools files a card by product and number; a printing names its RingsDB pack and number. A pack is the product of
// the same name, except these, which cardgame.tools names differently or RingsDB does not list. The Fellowship box (MEC109)
// has no pictures of its own there: it reuses The Black Riders' and The Road Darkens' scans, so the cards whose MEC109
// wording differs keep their scan. Messenger of the King Allies is not on cardgame.tools.
const PRODUCT_OF_PACK: Readonly<Record<string, string>> = { OHaUH: "MEC16", OtD: "MEC24", TFotR: "MEC109" };

export type Product = { code: string; name: string; type: string };

// A Nightmare deck carries the name of the pack it is for ("The Black Riders"); the pack is the product of the other type.
export function productsOfPacks(packs: readonly { code: string; name: string }[], products: readonly Product[]): Map<string, string> {
  const byName = new Map(products.filter((product) => product.type !== "Nightmare_Expansion").map((product) => [lettersOf(product.name), product.code]));
  const out = new Map<string, string>();
  for (const pack of packs) {
    const product = byName.get(lettersOf(pack.name));
    if (product) out.set(pack.code, product);
  }
  for (const [pack, product] of Object.entries(PRODUCT_OF_PACK)) out.set(pack, product);
  return out;
}

// Letters only, without accents: "Nibin-Dûm" and "Nibin-DÛm", "Gandalf's" and "Gandalfs" read the same.
export function lettersOf(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

type CardgameToolsRow = { slug: string; front: string; back: string | null };

// The image file of one side on cardgame.tools: the first printing whose product row's slug names the card.
export function cardgameToolsFile(
  rows: ReadonlyMap<string, CardgameToolsRow>,
  productOfPack: ReadonlyMap<string, string>,
  card: Pick<Card, "name" | "printings">,
  side: ScanSide,
): string | null {
  for (const printing of card.printings) {
    const product = productOfPack.get(printing.pack);
    const row = product && printing.number != null ? rows.get(`${product} ${printing.number}`) : undefined;
    if (!row || !lettersOf(row.slug).includes(lettersOf(card.name))) continue;
    return side === "A" ? row.front : row.back;
  }
  return null;
}

// A card outside the scan scope that cardgame.tools lacks: its RingsDB picture, then its Hall of Beorn or DragnCards one.
export function fallbackUrls(card: Pick<Card, "imagesrc" | "printings">): string[] {
  const others = card.printings.flatMap((printing) => printing.imageUrls ?? []);
  return [...(card.imagesrc ? [`${RINGSDB_ORIGIN}${card.imagesrc}`] : []), ...others.filter((url) => !url.includes("dragncards")), ...others.filter((url) => url.includes("dragncards"))];
}

function cardgameTools(file: string): { rows: Map<string, CardgameToolsRow>; products: Product[] } {
  const database = new Database(file, { readonly: true });
  try {
    const products = database.prepare("select Code as code, Name as name, Type as type from products").all() as Product[];
    const rows = database.prepare("select ProductCode, Number, CardSlug, FrontImageUrl, BackImageUrl from productCards").all() as {
      ProductCode: string;
      Number: string;
      CardSlug: string;
      FrontImageUrl: string;
      BackImageUrl: string | null;
    }[];
    return { rows: new Map(rows.map((row) => [`${row.ProductCode} ${row.Number}`, { slug: row.CardSlug, front: row.FrontImageUrl, back: row.BackImageUrl }])), products };
  } finally {
    database.close();
  }
}

/** One page of a PDF as a JPEG at PDF_DPI, through poppler's pdftoppm (the rules extraction already needs poppler). */
export function renderPdfPage(pdfFile: string, page: number): Uint8Array {
  const dir = mkdtempSync(path.join(tmpdir(), "pdf-page-"));
  try {
    const prefix = path.join(dir, "page");
    execFileSync("pdftoppm", ["-r", String(PDF_DPI), "-f", String(page), "-l", String(page), "-singlefile", "-jpeg", "-jpegopt", "quality=92", pdfFile, prefix]);
    return new Uint8Array(readFileSync(`${prefix}.jpg`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function pageText(pdfFile: string, page: number): string {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), pdfFile, "-"], { encoding: "utf8" });
}

export const pdfPath = (url: string): string => `pdf/${path.basename(new URL(url).pathname)}`;
export const pdfPageUrl = (url: string, page: number): string => `${url}#page=${page}`;

async function fetchInto(url: string, file: string, log: Log): Promise<SourceFile & { file: string }> {
  const body = await fetchBytes(url, 300_000, log);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
  return { path: "", url, sha256: sha256(body), bytes: body.byteLength, file };
}

export async function syncPictures(log: Log = createLog("pictures")): Promise<SourceRecord> {
  mkdirSync(PICTURE_CACHE_DIR, { recursive: true });
  const files: SourceFile[] = [];
  const db = await fetchInto(CARDGAME_TOOLS_DB, path.join(PICTURE_CACHE_DIR, "lotr_lcg.db"), log);
  files.push({ path: "pictures/lotr_lcg.db", url: db.url, sha256: db.sha256, bytes: db.bytes });
  const { rows, products } = cardgameTools(db.file);
  const packs = JSON.parse(readFileSync(path.join(RAW_DIR, "ringsdb", "packs.json"), "utf8")) as { code: string; name: string }[];
  const productOfPack = productsOfPacks(packs, products);
  log.info(`cardgame.tools lists ${rows.size} printed cards`);
  const pdfs = new Map<string, string>();
  for (const url of new Set(PDF_PAGES.map((entry) => entry.pdf))) {
    const pdf = await fetchInto(url, path.join(PDF_CACHE_DIR, path.basename(new URL(url).pathname)), log);
    files.push({ path: pdfPath(url), url, sha256: pdf.sha256, bytes: pdf.bytes });
    pdfs.set(url, pdf.file);
  }
  const cards = new Map(loadCards().map((card) => [card.code, card]));
  const scoped = scanTargets().map((target) => ({ code: target.code, side: target.side, scoped: true }));
  const scopedCodes = new Set(scoped.map((target) => target.code));
  const targets = [...scoped, ...[...cards.keys()].filter((code) => !scopedCodes.has(code)).map((code) => ({ code, side: "A" as const, scoped: false }))];
  const tick = log.progress(targets.length, "picture");
  const kept: string[] = [];
  for (const target of targets) {
    const key = `${target.code}.${target.side}`;
    const card = cards.get(target.code);
    if (!card) throw new Error(`${key} is not in data/cards`);
    const name = card.name;
    const page = PDF_PAGES.find((entry) => entry.code === target.code && entry.side === target.side);
    let picture: { url: string; body: Uint8Array } | null = null;
    if (page) {
      const pdfFile = pdfs.get(page.pdf) ?? "";
      const text = lettersOf(pageText(pdfFile, page.page));
      const expected = target.side === "A" ? lettersOf(name) : "resolution";
      if (!text.includes(expected)) throw new Error(`${key}: page ${page.page} of ${page.pdf} does not name "${target.side === "A" ? name : "Resolution"}"`);
      picture = { url: pdfPageUrl(page.pdf, page.page), body: renderPdfPage(pdfFile, page.page) };
    } else if (!MEC109_CHANGED.includes(target.code)) {
      const file = cardgameToolsFile(rows, productOfPack, card, target.side);
      const urls = [...(file ? [`${CARDGAME_TOOLS_IMAGES}${file}`] : []), ...(target.scoped ? [] : fallbackUrls(card))];
      for (const url of urls) {
        try {
          const body = await fetchBytes(url, 120_000, log);
          if (extensionOf(body) === null) throw new Error("not a JPEG or PNG");
          picture = { url, body };
          break;
        } catch (error) {
          log.warn(`${key}: ${error instanceof Error ? error.message : String(error)}${target.scoped ? "; the scan stays its picture" : ""}`);
        }
      }
    }
    if (!picture) {
      kept.push(key);
      tick(`${key} ${target.scoped ? "keeps its scan" : "has no picture"}`);
      continue;
    }
    const extension = extensionOf(picture.body) ?? "jpg";
    writeFileSync(path.join(PICTURE_CACHE_DIR, `${key}.${extension}`), picture.body);
    files.push({ path: `pictures/${key}.${extension}`, url: picture.url, sha256: sha256(picture.body), bytes: picture.body.byteLength });
    tick(`${key} ${widthOf(picture.body)} px, ${bytes(picture.body.byteLength)}`);
  }
  if (kept.length > 0) log.info(`${kept.length} side${kept.length === 1 ? "" : "s"} have no picture (a scanned one keeps its scan): ${kept.join(", ")}`);
  return { id: "pictures", site: "https://lotr.cardgame.tools", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
