import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import sharp from "sharp";

import { sniffImage } from "../src/screens/images/policy.ts";
import { DATA_DIR, PDF_CACHE_DIR, PICTURE_CACHE_DIR, SCAN_CACHE_DIR } from "./data/paths.ts";
import { fetchBytes, sha256, type SourceFile, type SourceRecord } from "./data/sources/fetch.ts";
import { renderPdfPage } from "./data/sources/pictures.ts";
import { bytes, runScript, type Log } from "./log.ts";

// A bundled picture is at most this many pixels on its long side: about twice the 600 of a Hall of Beorn scan, which is
// sharp on a phone's inspect screen. The 600 DPI pictures are about 2100.
export const MAX_SIDE = 1200;
const KEEP_BYTES = 400_000;

export type PackedScan = {
  code: string;
  filename: string;
  width: number;
  height: number;
};

export type PackScansOptions = {
  catalogDb: string;
  sourcesPath: string;
  scanCacheDir: string;
  pictureCacheDir: string;
  pdfCacheDir: string;
  scansDir: string;
  mapPath: string;
  fetch?: (url: string) => Promise<Uint8Array>;
  render?: (pdfFile: string, page: number) => Uint8Array;
  shrink?: (body: Uint8Array, typeCode: string) => Promise<Uint8Array>;
};

type Pin = SourceFile & { cacheDir: string };

/**
 * Bundles side A of every card in the catalog, so the app needs no network (user decision, 2026-10-29). The file is the
 * card's `pictures` file of data/sources.json when it has one, else its `scans` file: the cached copy is used when its
 * hash matches the pin; otherwise the pinned URL is fetched (an EAS machine has no cache), and a PDF page is rendered from
 * the pinned PDF. Bytes that do not match the pin fail the build: run `pnpm data:sync scans pictures` to move the pins.
 * A picture larger than MAX_SIDE is scaled down to it. A card with neither is drawn as its text.
 */
export async function packScans(options: PackScansOptions, log: Log): Promise<PackedScan[]> {
  const { sources } = JSON.parse(readFileSync(options.sourcesPath, "utf8")) as { sources: Partial<Record<string, SourceRecord>> };
  const scanPins = sideAPins(sources.scans, "scans", options.scanCacheDir);
  const picturePins = sideAPins(sources.pictures, "pictures", options.pictureCacheDir);
  const pdfPins = new Map((sources.pictures?.files ?? []).filter((file) => file.path.startsWith("pdf/")).map((file) => [file.url, file]));
  const notes: RenderNotes = { noPdftoppm: [], rehashed: [] };
  const context: LoadContext = { ...options, fetchScan: options.fetch ?? ((url: string) => fetchBytes(url, 120_000, log)), pdfPins, notes };
  const shrink = options.shrink ?? shrinkToMaxSide;
  const database = new Database(options.catalogDb, { readonly: true });
  let cards: { code: string; name: string; type_code: string }[];
  try {
    cards = database.prepare("select code, name, type_code from cards order by code").all() as { code: string; name: string; type_code: string }[];
  } finally {
    database.close();
  }
  log.info(`${cards.length} cards in the catalog`);
  mkdirSync(options.scansDir, { recursive: true });
  const packed: PackedScan[] = [];
  const missing: string[] = [];
  let fetched = 0;
  let total = 0;
  const tick = log.progress(cards.length, "picture");
  // Many at a time: on a machine without the cache each card is a fetch that mostly waits on the server (4 at once ran
  // about 10 pictures a second, 16 about 35). sharp decodes and encodes on its own thread pool.
  let next = 0;
  const worker = async () => {
    while (next < cards.length) {
      const card = cards[next++];
      if (!card) break;
      const picture = picturePins.get(card.code);
      const scan = scanPins.get(card.code);
      let body: Uint8Array | null = null;
      for (const pin of [picture, scan]) {
        if (!pin || body) continue;
        const loaded = await loadPin(pin, context, log);
        if (loaded?.fetched) fetched += 1;
        body = loaded?.body ?? null;
      }
      if (!body) {
        missing.push(`${card.code} ${card.name}`);
        tick(`${card.code} has no picture`);
        continue;
      }
      const shown = await shrink(body, card.type_code);
      total += shown.byteLength;
      packed.push(writeScan(card.code, shown, options.scansDir));
      tick(`${card.code} ${bytes(shown.byteLength)}`);
    }
  };
  await Promise.all(Array.from({ length: PACK_CONCURRENCY }, worker));
  packed.sort((left, right) => left.code.localeCompare(right.code));
  writeScanMap(options.mapPath, packed);
  if (notes.noPdftoppm.length > 0) {
    log.warn(
      `pdftoppm is not installed, so ${notes.noPdftoppm.length} cards drawn from FFG's PDFs use their older scans (${notes.noPdftoppm.sort().join(", ")}). Install poppler (macOS: brew install poppler; Debian or Ubuntu: apt install poppler-utils) and run pnpm scans:pack again.`,
    );
  }
  if (notes.rehashed.length > 0) log.info(`${notes.rehashed.length} PDF pages rendered with a different poppler version than their pins; the fresh renders are bundled`);
  // No source has a picture of these (docs/brief.md, Card images); --verbose names them.
  if (missing.length > 0) {
    log.info(`${missing.length} card${missing.length === 1 ? "" : "s"} have no pinned picture or scan and show as text`);
    log.debug(missing.join(", "));
  }
  log.info(`bundled ${packed.length} picture${packed.length === 1 ? "" : "s"} (${bytes(total)}, ${fetched} fetched) into ${options.scansDir}; map ${options.mapPath}`);
  return packed;
}

const PACK_CONCURRENCY = 16;

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

// What a pack noted about PDF pages, reported once at the end: pages with no pdftoppm to render them, and renders that hash
// differently from their pin.
type RenderNotes = { noPdftoppm: string[]; rehashed: string[] };

type LoadContext = PackScansOptions & { fetchScan: (url: string) => Promise<Uint8Array>; pdfPins: ReadonlyMap<string, SourceFile>; notes: RenderNotes };

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
      if ((error as NodeJS.ErrnoException).code === "ENOENT") context.notes.noPdftoppm.push(codeOf(pin.path));
      else log.warn(`${pin.path}: page ${page.page} of ${path.basename(pdfFile)} could not be rendered (${error instanceof Error ? error.message : String(error)}); bundling the scan`);
      return null;
    }
    if (sha256(body) !== pin.sha256) context.notes.rehashed.push(codeOf(pin.path));
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

// A quest card and a side quest are printed sideways, and the app shows them so. JvZijp files them upright, a quest turned
// one way and a side quest the other: the clockwise turn that lays each back down, checked against cardgame.tools'
// landscape scans (31 quests, 10 player side quests).
const UPRIGHT_TURN: Readonly<Record<string, number>> = { quest: 90, "player-side-quest": 270, "encounter-side-quest": 270 };

// Scales a picture down to MAX_SIDE on its long side as a JPEG, laying an upright quest picture down first. A JPEG already
// within MAX_SIDE, the right way round and at most KEEP_BYTES is kept byte for byte; a PNG, or a JPEG saved at a far higher
// quality than the bundle needs (JvZijp's campaign pages run to 1.2 MB), is encoded again.
export async function shrinkToMaxSide(body: Uint8Array, typeCode = ""): Promise<Uint8Array> {
  const media = sniffImage(body);
  if (!media) throw new Error("Picture is not a JPEG or PNG");
  const turn = media.height > media.width ? (UPRIGHT_TURN[typeCode] ?? 0) : 0;
  if (turn === 0 && media.extension === "jpg" && Math.max(media.width, media.height) <= MAX_SIDE && body.byteLength <= KEEP_BYTES) return body;
  const image = turn === 0 ? sharp(body) : sharp(body).rotate(turn);
  return new Uint8Array(await image.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer());
}

function writeScan(code: string, body: Uint8Array, scansDir: string): PackedScan {
  const media = sniffImage(body);
  if (!media) throw new Error(`Scan for ${code} is not a JPEG or PNG`);
  const filename = `${code}.${media.extension}`;
  writeFileSync(path.join(scansDir, filename), body);
  return { code, filename, width: media.width, height: media.height };
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
