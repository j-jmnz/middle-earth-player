import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import sharp from "sharp";

import { isRingsdbImagePath, sniffImage } from "../src/screens/images/policy.ts";
import { DATA_DIR, PDF_CACHE_DIR, PICTURE_CACHE_DIR, SCAN_CACHE_DIR } from "./data/paths.ts";
import { fetchBytes, sha256, type SourceFile, type SourceRecord } from "./data/sources/fetch.ts";
import { renderPdfPage } from "./data/sources/pictures.ts";
import { bytes, runScript, type Log } from "./log.ts";

// A bundled picture is at most this many pixels on its long side: about twice the 600 of a Hall of Beorn scan, which is
// sharp on a phone's inspect screen. The 600 DPI pictures are about 2100.
export const MAX_SIDE = 1200;

export type PackedScan = {
  code: string;
  filename: string;
  width: number;
  height: number;
};

export type PackScansOptions = {
  fixturesDir: string;
  catalogDb: string;
  sourcesPath: string;
  scanCacheDir: string;
  pictureCacheDir: string;
  pdfCacheDir: string;
  scansDir: string;
  mapPath: string;
  fetch?: (url: string) => Promise<Uint8Array>;
  render?: (pdfFile: string, page: number) => Uint8Array;
  shrink?: (body: Uint8Array) => Promise<Uint8Array>;
};

type Pin = SourceFile & { cacheDir: string };

/**
 * Bundles side A of every scenario card RingsDB has no picture for, and of every card whose picture is a page of FFG's
 * print-and-play PDFs. The file is the card's `pictures` file of data/sources.json when it has one, else its `scans` file:
 * the cached copy is used when its hash matches the pin; otherwise the pinned URL is fetched (an EAS machine has no cache),
 * and a PDF page is rendered from the pinned PDF. Bytes that do not match the pin fail the build: run
 * `pnpm data:sync scans pictures` to move the pins. A picture larger than MAX_SIDE is scaled down to it.
 */
export async function packScans(options: PackScansOptions, log: Log): Promise<PackedScan[]> {
  const { sources } = JSON.parse(readFileSync(options.sourcesPath, "utf8")) as { sources: Partial<Record<string, SourceRecord>> };
  const scanPins = sideAPins(sources.scans, "scans", options.scanCacheDir);
  const picturePins = sideAPins(sources.pictures, "pictures", options.pictureCacheDir);
  const pdfPins = new Map((sources.pictures?.files ?? []).filter((file) => file.path.startsWith("pdf/")).map((file) => [file.url, file]));
  const fromPdf = [...picturePins.values()].filter((pin) => pageOf(pin.url) !== null).map((pin) => codeOf(pin.path));
  const codes = [...new Set([...fixtureCodes(options.fixturesDir), ...fromPdf])].sort();
  log.info(`${codes.length} card codes: the scenario fixtures and ${fromPdf.length} pages of FFG's PDFs`);
  const fetchScan = options.fetch ?? ((url: string) => fetchBytes(url, 120_000, log));
  const shrink = options.shrink ?? shrinkToMaxSide;
  const database = new Database(options.catalogDb, { readonly: true });
  try {
    mkdirSync(options.scansDir, { recursive: true });
    const packed: PackedScan[] = [];
    let fetched = 0;
    let total = 0;
    for (const code of codes) {
      const card = database.prepare("select name, imagesrc from cards where code = ?").get(code) as
        | { name: string; imagesrc: string | null }
        | undefined;
      if (!card) throw new Error(`Card code ${code} is not in the catalog`);
      const picture = picturePins.get(code);
      // A RingsDB picture is downloaded on the phone; only a card RingsDB lacks, or one FFG's PDFs draw, is bundled.
      if (card.imagesrc && isRingsdbImagePath(card.imagesrc) && !fromPdf.includes(code)) {
        log.debug(`${code} ${card.name}: RingsDB has a picture, not bundled`);
        continue;
      }
      const scan = scanPins.get(code);
      if (!picture && !scan) throw new Error(`${code} (${card.name}) has no pinned side A scan in ${options.sourcesPath}. Run pnpm data:sync scans.`);
      let body: Uint8Array | null = null;
      if (picture) {
        const loaded = await loadPin(picture, { ...options, fetchScan, pdfPins }, log);
        if (loaded) {
          body = loaded.body;
          if (loaded.fetched) fetched += 1;
        }
      }
      if (!body && scan) {
        const loaded = await loadPin(scan, { ...options, fetchScan, pdfPins }, log);
        body = loaded?.body ?? null;
        if (loaded?.fetched) fetched += 1;
      }
      if (!body) throw new Error(`${code} (${card.name}): no picture or scan could be loaded`);
      const shown = await shrink(body);
      total += shown.byteLength;
      packed.push(writeScan(code, shown, options.scansDir));
    }
    writeScanMap(options.mapPath, packed);
    log.info(`bundled ${packed.length} picture${packed.length === 1 ? "" : "s"} (${bytes(total)}, ${fetched} fetched) into ${options.scansDir}; map ${options.mapPath}`);
    return packed;
  } finally {
    database.close();
  }
}

function sideAPins(record: SourceRecord | undefined, kind: string, cacheDir: string): Map<string, Pin> {
  const pins = new Map<string, Pin>();
  for (const file of record?.files ?? []) {
    if (new RegExp(`^${kind}/.+\\.A\\.(jpg|png)$`).test(file.path)) pins.set(codeOf(file.path), { ...file, cacheDir });
  }
  return pins;
}

const codeOf = (pinPath: string): string => path.basename(pinPath).split(".")[0] ?? "";

// "<pdf url>#page=<n>" names a page of a pinned PDF.
function pageOf(url: string): { pdf: string; page: number } | null {
  const match = /^(.+\.pdf)#page=(\d+)$/.exec(url);
  return match?.[1] && match[2] ? { pdf: match[1], page: Number(match[2]) } : null;
}

type LoadContext = PackScansOptions & { fetchScan: (url: string) => Promise<Uint8Array>; pdfPins: ReadonlyMap<string, SourceFile> };

// The pinned bytes: the cache at the pin, else the URL, else the PDF page rendered again. A rendered page that hashes
// differently (another poppler) is used with a warning; a page that cannot be rendered (no pdftoppm) returns null.
async function loadPin(pin: Pin, context: LoadContext, log: Log): Promise<{ body: Uint8Array; fetched: boolean } | null> {
  const cached = path.join(pin.cacheDir, path.basename(pin.path));
  if (existsSync(cached) && sha256(readFileSync(cached)) === pin.sha256) return { body: new Uint8Array(readFileSync(cached)), fetched: false };
  const page = pageOf(pin.url);
  if (page) {
    const pdfPin = context.pdfPins.get(page.pdf);
    if (!pdfPin) throw new Error(`${pin.path} is a page of ${page.pdf}, which data/sources.json does not pin. Run pnpm data:sync pictures.`);
    const pdfFile = path.join(context.pdfCacheDir, path.basename(pdfPin.path));
    if (!existsSync(pdfFile) || sha256(readFileSync(pdfFile)) !== pdfPin.sha256) {
      const body = await context.fetchScan(pdfPin.url);
      if (sha256(body) !== pdfPin.sha256) throw new Error(`${pdfPin.url} has sha256 ${sha256(body)}, pinned ${pdfPin.sha256}. Run pnpm data:sync pictures and check the change.`);
      mkdirSync(context.pdfCacheDir, { recursive: true });
      writeFileSync(pdfFile, body);
    }
    let body: Uint8Array;
    try {
      body = (context.render ?? renderPdfPage)(pdfFile, page.page);
    } catch (error) {
      log.warn(`${pin.path}: page ${page.page} of ${path.basename(pdfFile)} could not be rendered (${error instanceof Error ? error.message : String(error)}); bundling the scan`);
      return null;
    }
    if (sha256(body) !== pin.sha256) log.warn(`${pin.path}: the rendered page hashes differently from its pin (another poppler version); bundling the fresh render`);
    mkdirSync(pin.cacheDir, { recursive: true });
    writeFileSync(cached, body);
    return { body, fetched: true };
  }
  log.debug(`${pin.path} not in the cache at its pin, fetching ${pin.url}`);
  const body = await context.fetchScan(pin.url);
  const hash = sha256(body);
  if (hash !== pin.sha256) throw new Error(`${pin.url} has sha256 ${hash}, pinned ${pin.sha256}. Run pnpm data:sync scans pictures and check the change.`);
  mkdirSync(pin.cacheDir, { recursive: true });
  writeFileSync(cached, body);
  return { body, fetched: true };
}

// Scales a picture down to MAX_SIDE on its long side as a JPEG. A picture already within it is kept byte for byte.
export async function shrinkToMaxSide(body: Uint8Array): Promise<Uint8Array> {
  const media = sniffImage(body);
  if (!media) throw new Error("Picture is not a JPEG or PNG");
  if (Math.max(media.width, media.height) <= MAX_SIDE) return body;
  return new Uint8Array(await sharp(body).resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer());
}

function writeScan(code: string, body: Uint8Array, scansDir: string): PackedScan {
  const media = sniffImage(body);
  if (!media) throw new Error(`Scan for ${code} is not a JPEG or PNG`);
  const filename = `${code}.${media.extension}`;
  writeFileSync(path.join(scansDir, filename), body);
  return { code, filename, width: media.width, height: media.height };
}

function fixtureCodes(fixturesDir: string): string[] {
  const codes = new Set<string>();
  for (const name of readdirSync(fixturesDir)) {
    if (!name.endsWith(".json")) continue;
    const parsed: unknown = JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"));
    collectFixtureCodes(parsed, codes);
  }
  return [...codes].sort();
}

function collectFixtureCodes(value: unknown, codes: Set<string>): void {
  if (typeof value !== "object" || value === null) return;
  const fixture = value as { stages?: unknown; sets?: unknown; cards?: unknown };
  addCodeList(fixture.stages, codes);
  addCardList(fixture.cards, codes);
  if (!Array.isArray(fixture.sets)) return;
  for (const set of fixture.sets) {
    if (typeof set !== "object" || set === null || !("cards" in set)) continue;
    addCardList(set.cards, codes);
  }
}

function addCodeList(value: unknown, codes: Set<string>): void {
  if (!Array.isArray(value)) return;
  for (const code of value) {
    if (typeof code === "string" && code.length > 0) codes.add(code);
  }
}

function addCardList(value: unknown, codes: Set<string>): void {
  if (!Array.isArray(value)) return;
  for (const card of value) {
    if (typeof card !== "object" || card === null || !("code" in card)) continue;
    if (typeof card.code === "string" && card.code.length > 0) codes.add(card.code);
  }
}

function writeScanMap(mapPath: string, packed: readonly PackedScan[]): void {
  const lines = [...packed]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map(
      (entry) =>
        `  ${JSON.stringify(entry.code)}: { moduleId: require("../../../assets/scans/${entry.filename}") as number, width: ${entry.width}, height: ${entry.height} },`,
    );
  const body = lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
  writeFileSync(
    mapPath,
    `export type ScanAsset = {\n  moduleId: number;\n  width: number;\n  height: number;\n};\n\n// Leave this object empty in git. scripts/pack-scans.ts replaces it on the release machine.\nexport const scanAssets: Record<string, ScanAsset> = {${body}};\n`,
  );
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  void runScript("pack-scans", async (log) => {
    const root = repoRoot();
    await packScans(
      {
        fixturesDir: path.join(DATA_DIR, "scenarios"),
        catalogDb: path.join(root, "assets/catalog.db"),
        sourcesPath: path.join(DATA_DIR, "sources.json"),
        scanCacheDir: SCAN_CACHE_DIR,
        pictureCacheDir: PICTURE_CACHE_DIR,
        pdfCacheDir: PDF_CACHE_DIR,
        scansDir: path.join(root, "assets/scans"),
        mapPath: path.join(root, "src/screens/images/scan-map.ts"),
      },
      log,
    );
  });
}
