import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { loadCards } from "../load-cards.ts";
import { PDF_CACHE_DIR, PICTURE_CACHE_DIR } from "../paths.ts";
import { MEC109_CHANGED, scanTargets, type ScanSide } from "../printed/scope.ts";
import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchBytes, sha256, type SourceFile, type SourceRecord } from "./fetch.ts";
import { extensionOf, widthOf } from "./scans.ts";

// The pictures the app bundles in place of the 429×600 scans (user request, 2026-10-29). The `scans` source stays what the
// printed-text ledger was read from; a picture is only shown. Each side of the scan scope gets one, pinned by sha256:
// - FFG's print-and-play PDFs of the campaign, boon and burden cards, the only digital originals (InDesign, vector text over
//   300 ppi art), rendered at 600 DPI;
// - else the 600 DPI scan lotr.cardgame.tools hosts (u/LepcisMagna's, about 1480×2100), found through its card database;
// - else none, and the app keeps the scan.

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

// cardgame.tools files a card by product and number. The scope's codes are RingsDB codes whose last three digits are the
// number in the product their prefix names: the Revised Core Set, The Dark of Mirkwood, The Black Riders, The Road Darkens,
// Mount Gundabad. The Fellowship box (MEC109) has no pictures of its own there: it reuses The Black Riders' and The Road
// Darkens' scans, so the cards whose MEC109 wording differs keep their scan.
const PRODUCT_OF_PREFIX: readonly (readonly [string, string])[] = [
  ["141", "MEC32"],
  ["142", "MEC34"],
  ["41", "MEC102"],
  ["01", "MEC101"],
  ["19", "MEC70"],
];

export function productOf(code: string): { product: string; number: string } | null {
  if (!/^\d{5,6}$/.test(code)) return null;
  const entry = PRODUCT_OF_PREFIX.find(([prefix]) => code.length === prefix.length + 3 && code.startsWith(prefix));
  return entry ? { product: entry[1], number: String(Number(code.slice(-3))) } : null;
}

// Letters only, without accents: "Nibin-Dûm" and "Nibin-DÛm", "Gandalf's" and "Gandalfs" read the same.
export function lettersOf(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// The image file of one side on cardgame.tools, when its slug names the card.
export function cardgameToolsFile(
  rows: ReadonlyMap<string, { slug: string; front: string; back: string | null }>,
  code: string,
  side: ScanSide,
  name: string,
): string | null {
  const at = productOf(code);
  const row = at ? rows.get(`${at.product} ${at.number}`) : undefined;
  if (!row || !lettersOf(row.slug).includes(lettersOf(name))) return null;
  return side === "A" ? row.front : row.back;
}

function cardgameToolsRows(file: string): Map<string, { slug: string; front: string; back: string | null }> {
  const database = new Database(file, { readonly: true });
  try {
    const rows = database.prepare("select ProductCode, Number, CardSlug, FrontImageUrl, BackImageUrl from productCards").all() as {
      ProductCode: string;
      Number: string;
      CardSlug: string;
      FrontImageUrl: string;
      BackImageUrl: string | null;
    }[];
    return new Map(rows.map((row) => [`${row.ProductCode} ${row.Number}`, { slug: row.CardSlug, front: row.FrontImageUrl, back: row.BackImageUrl }]));
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
  const rows = cardgameToolsRows(db.file);
  log.info(`cardgame.tools lists ${rows.size} printed cards`);
  const pdfs = new Map<string, string>();
  for (const url of new Set(PDF_PAGES.map((entry) => entry.pdf))) {
    const pdf = await fetchInto(url, path.join(PDF_CACHE_DIR, path.basename(new URL(url).pathname)), log);
    files.push({ path: pdfPath(url), url, sha256: pdf.sha256, bytes: pdf.bytes });
    pdfs.set(url, pdf.file);
  }
  const names = new Map(loadCards().map((card) => [card.code, card.name]));
  const targets = scanTargets();
  const tick = log.progress(targets.length, "picture");
  const kept: string[] = [];
  for (const target of targets) {
    const key = `${target.code}.${target.side}`;
    const name = names.get(target.code) ?? "";
    const page = PDF_PAGES.find((entry) => entry.code === target.code && entry.side === target.side);
    let picture: { url: string; body: Uint8Array } | null = null;
    if (page) {
      const pdfFile = pdfs.get(page.pdf) ?? "";
      const text = lettersOf(pageText(pdfFile, page.page));
      const expected = target.side === "A" ? lettersOf(name) : "resolution";
      if (!text.includes(expected)) throw new Error(`${key}: page ${page.page} of ${page.pdf} does not name "${target.side === "A" ? name : "Resolution"}"`);
      picture = { url: pdfPageUrl(page.pdf, page.page), body: renderPdfPage(pdfFile, page.page) };
    } else if (!MEC109_CHANGED.includes(target.code)) {
      const file = cardgameToolsFile(rows, target.code, target.side, name);
      if (file) {
        const url = `${CARDGAME_TOOLS_IMAGES}${file}`;
        try {
          const body = await fetchBytes(url, 120_000, log);
          if (extensionOf(body) === null) throw new Error("not a JPEG or PNG");
          picture = { url, body };
        } catch (error) {
          log.warn(`${key}: ${error instanceof Error ? error.message : String(error)}; the scan stays its picture`);
        }
      }
    }
    if (!picture) {
      kept.push(key);
      tick(`${key} keeps its scan`);
      continue;
    }
    const extension = extensionOf(picture.body) ?? "jpg";
    writeFileSync(path.join(PICTURE_CACHE_DIR, `${key}.${extension}`), picture.body);
    files.push({ path: `pictures/${key}.${extension}`, url: picture.url, sha256: sha256(picture.body), bytes: picture.body.byteLength });
    tick(`${key} ${widthOf(picture.body)} px, ${bytes(picture.body.byteLength)}`);
  }
  if (kept.length > 0) log.info(`${kept.length} side${kept.length === 1 ? "" : "s"} keep their scan: ${kept.join(", ")}`);
  return { id: "pictures", site: "https://lotr.cardgame.tools", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}
