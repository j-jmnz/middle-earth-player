import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { REPRINTS } from "../campaign-defs.ts";
import { loadCards } from "../load-cards.ts";
import { RINGSDB_ORIGIN } from "../../../src/screens/images/policy.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import { PDF_CACHE_DIR, PICTURE_CACHE_DIR, RAW_DIR } from "../paths.ts";
import { MEC109_CHANGED, MEC112_CHANGED, scanTargets, type ScanSide } from "../printed/scope.ts";
import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchBytes, sha256, type SourceFile, type SourceRecord } from "./fetch.ts";
import { driveFileUrl, JVZIJP_FOLDER, JVZIJP_SITE, jvzijpFile, jvzijpPictures, listDriveTree } from "./jvzijp.ts";
import { lettersOf } from "./names.ts";
import { isNightmareCard } from "../nightmare-defs.ts";
import { extensionOf, widthOf } from "./scans.ts";

export { lettersOf };

// The pictures the app bundles, every card's, so it needs no network (user decisions, 2026-10-29). The `scans` source stays
// what the printed-text ledger was read from; a picture is only shown. Each side of the scan scope and side A of every other
// card gets one, pinned by sha256, from the first of these that has it:
// - JvZijp's enhanced proxies on Google Drive, the user's first choice (jvzijp.ts), except for a page of FFG's PDFs;
// - FFG's print-and-play PDFs of the campaign, boon and burden cards, the only digital originals (InDesign, vector text over
//   300 ppi art), rendered at 600 DPI;
// - else the 600 DPI scan lotr.cardgame.tools hosts (u/LepcisMagna's, about 1480×2100), found through its card database;
// - else, for a card outside the scan scope, the RingsDB picture, then the Hall of Beorn or DragnCards one;
// - else none: a card of the scan scope keeps its scan.

export const CARDGAME_TOOLS_DB = "https://lotr.cardgame.tools/lotr_lcg.db";
export const CARDGAME_TOOLS_IMAGES = "https://images.cardgame.tools/lotr/";

export const CORE_CAMPAIGN_PDF = "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/core_set_campaign_cards.pdf";
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
// the same name, except these, which cardgame.tools names differently or RingsDB does not list. The saga boxes (MEC109, MEC112)
// may have no pictures of their own there: they reuse the twin packs' scans, so the cards whose MEC109 or MEC112
// wording differs keep their scan. Messenger of the King Allies is not on cardgame.tools.
const PRODUCT_OF_PACK: Readonly<Record<string, string>> = { OHaUH: "MEC16", OtD: "MEC24", ...Object.fromEntries(REPRINTS.map((reprint) => [reprint.pack, reprint.product])) };

// cardgame.tools files Mount Gundabad's seven Exploring Gundabad stage 2s under one number (135, fronts 135a to 135g) and their backs under the
// numbers 136 to 142; the printings number the stage 2s 135 and 137 to 142. A printing filed under another number names it here.
const FILED_UNDER: Readonly<Record<string, string>> = { "MG 135": "135a", "MG 137": "135b", "MG 138": "135c", "MG 139": "135d", "MG 140": "135e", "MG 141": "135f", "MG 142": "135g" };

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
    const number = printing.number == null ? null : (FILED_UNDER[`${printing.pack} ${printing.number}`] ?? printing.number);
    const row = product && number != null ? rows.get(`${product} ${number}`) : undefined;
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
    // A front lettered after its number (MEC70-135b-front-...) is also filed under that lettered number.
    const lettered = (row: (typeof rows)[number]) => /^[^-]+-(\d+[a-z])-front-/.exec(row.FrontImageUrl)?.[1] ?? row.Number;
    const entries = rows.flatMap((row) => {
      const value = { slug: row.CardSlug, front: row.FrontImageUrl, back: row.BackImageUrl };
      const letter = lettered(row);
      return letter === row.Number ? [[`${row.ProductCode} ${row.Number}`, value] as const] : [[`${row.ProductCode} ${row.Number}`, value] as const, [`${row.ProductCode} ${letter}`, value] as const];
    });
    return { rows: new Map(entries), products };
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

const SYNC_CONCURRENCY = 8;

export async function syncPictures(log: Log = createLog("pictures")): Promise<SourceRecord> {
  mkdirSync(PICTURE_CACHE_DIR, { recursive: true });
  const files: SourceFile[] = [];
  const db = await fetchInto(CARDGAME_TOOLS_DB, path.join(PICTURE_CACHE_DIR, "lotr_lcg.db"), log);
  files.push({ path: "pictures/lotr_lcg.db", url: db.url, sha256: db.sha256, bytes: db.bytes });
  const { rows, products } = cardgameTools(db.file);
  const packs = JSON.parse(readFileSync(path.join(RAW_DIR, "ringsdb", "packs.json"), "utf8")) as { code: string; name: string }[];
  const productOfPack = productsOfPacks(packs, products);
  log.info(`cardgame.tools lists ${rows.size} printed cards`);
  const drive = await listDriveTree(JVZIJP_FOLDER, log);
  const listing = `${JSON.stringify(drive, null, 1)}\n`;
  writeFileSync(path.join(PICTURE_CACHE_DIR, "jvzijp.json"), listing);
  files.push({ path: "pictures/jvzijp.json", url: JVZIJP_SITE, sha256: sha256(listing), bytes: Buffer.byteLength(listing) });
  const jvzijp = jvzijpPictures(drive, packs);
  log.info(`JvZijp's Drive holds ${drive.length} files, ${jvzijp.length} of them card pictures`);
  const pdfs = new Map<string, string>();
  for (const url of new Set(PDF_PAGES.map((entry) => entry.pdf))) {
    const pdf = await fetchInto(url, path.join(PDF_CACHE_DIR, path.basename(new URL(url).pathname)), log);
    files.push({ path: pdfPath(url), url, sha256: pdf.sha256, bytes: pdf.bytes });
    pdfs.set(url, pdf.file);
  }
  // The Nightmare decks' pictures are the `nightmare` source's (sources/nightmare.ts).
  const all = loadCards();
  const cards = new Map(all.filter((card) => !isNightmareCard(card)).map((card) => [card.code, card]));
  // The scan scope holds the Nightmare cards too; their pictures are the `nightmare` source's, so this source skips them.
  const nightmare = new Set(all.filter(isNightmareCard).map((card) => card.code));
  const scoped = scanTargets()
    .filter((target) => !nightmare.has(target.code))
    .map((target) => ({ code: target.code, side: target.side, scoped: true }));
  const scopedCodes = new Set(scoped.map((target) => target.code));
  const targets = [...scoped, ...[...cards.keys()].filter((code) => !scopedCodes.has(code)).map((code) => ({ code, side: "A" as const, scoped: false }))];
  const tick = log.progress(targets.length, "picture");
  const kept: string[] = [];
  const from = { jvzijp: 0, pdf: 0, cardgameTools: 0, other: 0 };
  const one = async (target: (typeof targets)[number]) => {
    const key = `${target.code}.${target.side}`;
    const card = cards.get(target.code);
    if (!card) throw new Error(`${key} is not in data/cards`);
    const page = PDF_PAGES.find((entry) => entry.code === target.code && entry.side === target.side);
    // Each source in order of preference, as a fetch or a render. The cards MEC109 and MEC112 reword have no picture of that printing.
    const sources: { from: keyof typeof from; url: string; load: () => Promise<Uint8Array> }[] = [];
    if (!MEC109_CHANGED.includes(target.code) && !MEC112_CHANGED.includes(target.code)) {
      const drivePicture = jvzijpFile(jvzijp, card, target.side, page ? (page.pdf === CORE_CAMPAIGN_PDF ? page.page : -1) : null);
      if (drivePicture) {
        const url = driveFileUrl(drivePicture.id);
        sources.push({ from: "jvzijp", url, load: () => fetchBytes(url, 120_000, log) });
      }
      if (page) {
        const pdfFile = pdfs.get(page.pdf) ?? "";
        sources.push({
          from: "pdf",
          url: pdfPageUrl(page.pdf, page.page),
          load: () => {
            const text = lettersOf(pageText(pdfFile, page.page));
            const expected = target.side === "A" ? lettersOf(card.name) : "resolution";
            if (!text.includes(expected)) throw new Error(`page ${page.page} of ${page.pdf} does not name "${target.side === "A" ? card.name : "Resolution"}"`);
            return Promise.resolve(renderPdfPage(pdfFile, page.page));
          },
        });
      }
      const file = cardgameToolsFile(rows, productOfPack, card, target.side);
      if (file) sources.push({ from: "cardgameTools", url: `${CARDGAME_TOOLS_IMAGES}${file}`, load: () => fetchBytes(`${CARDGAME_TOOLS_IMAGES}${file}`, 120_000, log) });
      if (!target.scoped) for (const url of fallbackUrls(card)) sources.push({ from: "other", url, load: () => fetchBytes(url, 120_000, log) });
      // A page of FFG's PDFs comes before JvZijp's copy of it, a smaller render of the same page (816×1110 against 1477×2097;
      // user decision, 2026-10-29). JvZijp's stays next in line.
      if (page) sources.sort((left, right) => Number(right.from === "pdf") - Number(left.from === "pdf"));
    }
    for (const source of sources) {
      try {
        const body = await source.load();
        // Drive answers a quota or sign-in page as HTML: that is not a picture.
        if (extensionOf(body) === null) throw new Error("not a JPEG or PNG");
        const extension = extensionOf(body) ?? "jpg";
        writeFileSync(path.join(PICTURE_CACHE_DIR, `${key}.${extension}`), body);
        files.push({ path: `pictures/${key}.${extension}`, url: source.url, sha256: sha256(body), bytes: body.byteLength });
        from[source.from] += 1;
        tick(`${key} ${widthOf(body)} px, ${bytes(body.byteLength)}`);
        return;
      } catch (error) {
        log.warn(`${key}: ${source.url}: ${error instanceof Error ? error.message : String(error)}; trying the next source`);
      }
    }
    kept.push(key);
    tick(`${key} ${target.scoped ? "keeps its scan" : "has no picture"}`);
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: SYNC_CONCURRENCY }, async () => {
      while (next < targets.length) {
        const target = targets[next++];
        if (target) await one(target);
      }
    }),
  );
  log.info(`pictures from JvZijp ${from.jvzijp}, FFG's PDFs ${from.pdf}, cardgame.tools ${from.cardgameTools}, RingsDB or Hall of Beorn ${from.other}`);
  if (kept.length > 0) log.info(`${kept.length} side${kept.length === 1 ? "" : "s"} have no picture (a scanned one keeps its scan): ${kept.sort().join(", ")}`);
  files.sort((left, right) => left.path.localeCompare(right.path));
  return { id: "pictures", site: JVZIJP_SITE, pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
