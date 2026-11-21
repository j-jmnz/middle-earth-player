import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import sharp from "sharp";

import { SCENE_PICTURE } from "../../src/screens/art/crop.ts";
import { sniffImage } from "../../src/screens/images/policy.ts";
import { DATA_DIR, PDF_CACHE_DIR, PICTURE_CACHE_DIR, SCAN_CACHE_DIR } from "../data/paths.ts";
import { fetchBytesRetrying, sha256, type SourceFile, type SourceRecord } from "../data/sources/fetch.ts";
import { mirrorFromEnv, mirrorReader } from "../data/mirror/client.ts";
import { renderPdfPage } from "../data/sources/pictures.ts";
import { bytes, duration, isDirectRun, runPack, type Log } from "../log.ts";

// A bundled picture is at most this many pixels on its long side: about twice the 600 of a Hall of Beorn scan, which is
// sharp on a phone's inspect screen. The 600 DPI pictures are about 2100.
export const MAX_SIDE = 1200;
const KEEP_BYTES = 400_000;

// What a picture in assets/scans was packed from, so a later pack keeps it while its pin is the same: the pinned file's sha256 and the
// map entries it gave (the card, and its scene). Raise PACK_VERSION when shrinkToMaxSide or sceneOf changes what a pin packs to.
const PACK_VERSION = 1;
const STAMP_FILE = ".packed.json";
type Stamp = { version: number; entries: Record<string, { pin: string; scans: PackedScan[] }> };

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
  // The asset mirror, read before a pin's URL (scripts/data/mirror/client.ts, mirrorReader); null on a miss.
  mirror?: (hash: string) => Promise<Uint8Array | null>;
  render?: (pdfFile: string, page: number) => Uint8Array;
  shrink?: (body: Uint8Array, typeCode: string, side: "A" | "B", code: string) => Promise<Uint8Array>;
  // The first quest card of each scenario: its scene is also bundled on its own, at the source's size (`<code>.scene`, sceneOf).
  sceneCodes?: ReadonlySet<string>;
  scene?: (body: Uint8Array, typeCode: string, code: string) => Promise<Uint8Array>;
  // How many pictures are loaded at once (PACK_CONCURRENCY when not given).
  concurrency?: number;
};

type Pin = SourceFile & { cacheDir: string };

/**
 * Bundles side A of every card in the catalog, and side B of each card pinned with one (a quest stage, a campaign card), so the
 * app needs no network (user decision, 2026-10-29) and a quest stage on its B side shows that side. Side B is written as
 * `<code>.B` and keyed so in the map (src/play/canvas/picture-key.ts). The file is the
 * card's `pictures` file of data/sources.json when it has one, else its `scans` file: the cached copy is used when its
 * hash matches the pin; otherwise the asset mirror's copy, then the pinned URL (a release machine has no cache), and a PDF
 * page the mirror does not hold is rendered from the pinned PDF. Bytes that do not match the pin fail the build: run `pnpm data sync scans pictures` to move the pins.
 * A picture larger than MAX_SIDE is scaled down to it. A card with neither is drawn as its text.
 */
export async function packScans(options: PackScansOptions, log: Log): Promise<PackedScan[]> {
  const begin = performance.now();
  const { sources } = JSON.parse(readFileSync(options.sourcesPath, "utf8")) as { sources: Partial<Record<string, SourceRecord>> };
  const scanPins = sidePins(sources.scans, "scans", options.scanCacheDir);
  // The Nightmare decks' pictures are pinned by their own source, cached beside the others (sources/nightmare.ts).
  const picturePins = new Map([...sidePins(sources.pictures, "pictures", options.pictureCacheDir), ...sidePins(sources.nightmare, "pictures", options.pictureCacheDir)]);
  const pdfPins = new Map((sources.pictures?.files ?? []).filter((file) => file.path.startsWith("pdf/")).map((file) => [file.url, file]));
  const notes: RenderNotes = { noPdftoppm: [], rehashed: [] };
  const context: LoadContext = { ...options, fetchScan: options.fetch ?? ((url: string) => fetchBytesRetrying(url, 120_000, log)), pdfPins, notes };
  const shrink = options.shrink ?? shrinkToMaxSide;
  const database = new Database(options.catalogDb, { readonly: true });
  let cards: { code: string; name: string; type_code: string }[];
  try {
    cards = database.prepare("select code, name, type_code from cards order by code").all() as { code: string; name: string; type_code: string }[];
  } finally {
    database.close();
  }
  log.info(`${cards.length} cards in the catalog`);
  // Side A of every card, and side B of a card with a pin for it; a card with no side B pin has none to show.
  const jobs = cards.flatMap((card) => {
    const back = `${card.code}.B`;
    return [
      { key: card.code, card },
      ...(picturePins.has(back) || scanPins.has(back) ? [{ key: back, card }] : []),
    ];
  });
  mkdirSync(options.scansDir, { recursive: true });
  const before = readStamp(options.scansDir);
  const stamp: Stamp = { version: PACK_VERSION, entries: {} };
  const packed: PackedScan[] = [];
  const missing: string[] = [];
  // Where each loaded pin came from, and the time the workers spent loading and on the image work, summed over them
  // (PACK_CONCURRENCY at once), for the summary line a release log keeps.
  const from: Record<LoadedFrom, number> = { cache: 0, mirror: 0, source: 0, render: 0 };
  const spent = { load: 0, images: 0 };
  let kept = 0;
  let total = 0;
  const tick = log.progress(jobs.length, "picture");
  // Many at a time: on a machine without the cache each card is a fetch that mostly waits on the server (4 at once ran
  // about 10 pictures a second, 16 about 35). sharp decodes and encodes on its own thread pool.
  // The first failure stops every worker before its next picture, so a failed pack ends in seconds rather than after
  // the rest of the downloads.
  let next = 0;
  let failure: { error: unknown } | null = null;
  const worker = async () => {
    try {
      await work();
    } catch (error) {
      failure ??= { error };
    }
  };
  const work = async () => {
    while (failure === null && next < jobs.length) {
      const job = jobs[next++];
      if (!job) break;
      const { key, card } = job;
      const picture = picturePins.get(key);
      const scan = scanPins.get(key);
      const wantsScene = key === card.code && options.sceneCodes?.has(key) === true;
      // Packed before from the same pin (and with its scene when one is wanted): kept as it is, with nothing loaded.
      const earlier = before.entries[key];
      const first = picture ?? scan;
      if (first && earlier?.pin === stampPin(first.sha256, card.code) && earlier.scans.length === (wantsScene ? 2 : 1) && earlier.scans.every((entry) => existsSync(path.join(options.scansDir, entry.filename)))) {
        stamp.entries[key] = earlier;
        packed.push(...earlier.scans);
        kept += 1;
        tick(`${key} kept`);
        continue;
      }
      let body: Uint8Array | null = null;
      let used: Pin | null = null;
      const loading = performance.now();
      for (const pin of [picture, scan]) {
        if (!pin || body) continue;
        const loaded = await loadPin(pin, context, log);
        if (loaded) from[loaded.from] += 1;
        body = loaded?.body ?? null;
        if (body) used = pin;
      }
      spent.load += performance.now() - loading;
      if (!body || !used) {
        missing.push(`${key} ${card.name}`);
        tick(`${key} has no picture`);
        continue;
      }
      const working = performance.now();
      const shown = await shrink(body, card.type_code, key.endsWith(".B") ? "B" : "A", card.code);
      total += shown.byteLength;
      const scans = [writeScan(key, shown, options.scansDir)];
      if (wantsScene) {
        const scene = await (options.scene ?? sceneOf)(body, card.type_code, card.code);
        total += scene.byteLength;
        scans.push(writeScan(`${key}.scene`, scene, options.scansDir));
      }
      spent.images += performance.now() - working;
      stamp.entries[key] = { pin: stampPin(used.sha256, card.code), scans };
      packed.push(...scans);
      tick(`${key} ${bytes(shown.byteLength)}`);
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? PACK_CONCURRENCY }, worker));
  if (failure !== null) {
    // What this pack finished, over the last stamp's entries for the cards it did not reach, so a rerun (a CI cache saved
    // after the failure) fetches only what is still missing. An entry is reused only while its pin and files match.
    writeFileSync(path.join(options.scansDir, STAMP_FILE), `${JSON.stringify({ ...stamp, entries: { ...before.entries, ...stamp.entries } })}\n`);
    throw (failure as { error: unknown }).error;
  }
  packed.sort((left, right) => left.code.localeCompare(right.code));
  writeScanMap(options.mapPath, packed);
  writeFileSync(path.join(options.scansDir, STAMP_FILE), `${JSON.stringify(stamp)}\n`);
  if (notes.noPdftoppm.length > 0) {
    log.warn(
      `pdftoppm is not installed, so ${notes.noPdftoppm.length} cards drawn from FFG's PDFs use their older scans (${notes.noPdftoppm.sort().join(", ")}). Install poppler (macOS: brew install poppler; Debian or Ubuntu: apt install poppler-utils) and run pnpm assets scans again.`,
    );
  }
  if (notes.rehashed.length > 0) log.info(`${notes.rehashed.length} PDF pages rendered with a different poppler version than their pins; the fresh renders are bundled`);
  // No source has a picture of these (docs/brief.md, Card images); --verbose names them.
  if (missing.length > 0) {
    log.info(`${missing.length} card${missing.length === 1 ? "" : "s"} have no pinned picture or scan and show as text`);
    log.debug(missing.join(", "));
  }
  log.notice(
    `bundled ${packed.length} picture${packed.length === 1 ? "" : "s"} in ${duration(performance.now() - begin)}: ${kept} kept from the last pack, ${from.cache} from .cache, ${from.mirror} from the mirror, ${from.source} from their sources, ${from.render} rendered from a PDF; ${bytes(total)} written; worker time ${duration(spent.load)} loading, ${duration(spent.images)} on the images`,
  );
  log.info(`wrote ${options.scansDir}; map ${options.mapPath}`);
  return packed;
}

const PACK_CONCURRENCY = 16;

// The pins of each side by its map key: the code for side A, `<code>.B` for side B.
function sidePins(record: SourceRecord | undefined, kind: string, cacheDir: string): Map<string, Pin> {
  const pins = new Map<string, Pin>();
  for (const file of record?.files ?? []) {
    const side = new RegExp(`^${kind}/.+\\.([AB])\\.(jpg|png)$`).exec(file.path)?.[1];
    if (side) pins.set(side === "A" ? codeOf(file.path) : `${codeOf(file.path)}.B`, { ...file, cacheDir });
  }
  return pins;
}

const codeOf = (pinPath: string): string => path.basename(pinPath).split(".")[0] ?? "";

// The last pack's stamp, or an empty one when there is none or it was written by another PACK_VERSION.
function readStamp(scansDir: string): Stamp {
  const file = path.join(scansDir, STAMP_FILE);
  if (!existsSync(file)) return { version: PACK_VERSION, entries: {} };
  try {
    const stamp = JSON.parse(readFileSync(file, "utf8")) as Stamp;
    return stamp.version === PACK_VERSION && typeof stamp.entries === "object" ? stamp : { version: PACK_VERSION, entries: {} };
  } catch {
    return { version: PACK_VERSION, entries: {} };
  }
}

// "<pdf url>#page=<n>" names a page of a pinned PDF.
function pageOf(url: string): { pdf: string; page: number } | null {
  const match = /^(.+\.pdf)#page=(\d+)$/.exec(url);
  return match?.[1] && match[2] ? { pdf: match[1], page: Number(match[2]) } : null;
}

// What a pack noted about PDF pages, reported once at the end: pages with no pdftoppm to render them, and renders that hash
// differently from their pin.
type RenderNotes = { noPdftoppm: string[]; rehashed: string[] };

type LoadContext = PackScansOptions & { fetchScan: (url: string) => Promise<Uint8Array>; pdfPins: ReadonlyMap<string, SourceFile>; notes: RenderNotes };

// The pinned bytes: the cache at the pin, else the mirror, else the URL, else the PDF page rendered again. A rendered page that hashes
// differently (another poppler) is used with a warning; a page that cannot be rendered (no pdftoppm) returns null.
// Where a loaded pin came from: the cache, the asset mirror, its URL, or a page rendered from its PDF.
type LoadedFrom = "cache" | "mirror" | "source" | "render";

async function loadPin(pin: Pin, context: LoadContext, log: Log): Promise<{ body: Uint8Array; from: LoadedFrom } | null> {
  const cached = path.join(pin.cacheDir, path.basename(pin.path));
  if (existsSync(cached) && sha256(readFileSync(cached)) === pin.sha256) return { body: new Uint8Array(readFileSync(cached)), from: "cache" };
  const mirrored = await context.mirror?.(pin.sha256);
  if (mirrored) {
    mkdirSync(pin.cacheDir, { recursive: true });
    writeFileSync(cached, mirrored);
    return { body: mirrored, from: "mirror" };
  }
  const page = pageOf(pin.url);
  if (page) {
    const pdfPin = context.pdfPins.get(page.pdf);
    if (!pdfPin) throw new Error(`${pin.path} is a page of ${page.pdf}, which data/sources.json does not pin. Run pnpm data sync pictures.`);
    const pdfFile = path.join(context.pdfCacheDir, path.basename(pdfPin.path));
    if (!existsSync(pdfFile) || sha256(readFileSync(pdfFile)) !== pdfPin.sha256) {
      const body = (await context.mirror?.(pdfPin.sha256)) ?? (await context.fetchScan(pdfPin.url));
      if (sha256(body) !== pdfPin.sha256) throw new Error(`${pdfPin.url} has sha256 ${sha256(body)}, pinned ${pdfPin.sha256}. Run pnpm data sync pictures and check the change.`);
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
    return { body, from: "render" };
  }
  log.debug(`${pin.path} not in the cache at its pin, fetching ${pin.url}`);
  const body = await context.fetchScan(pin.url);
  const hash = sha256(body);
  if (hash !== pin.sha256) throw new Error(`${pin.url} has sha256 ${hash}, pinned ${pin.sha256}. Run pnpm data sync scans pictures and check the change.`);
  mkdirSync(pin.cacheDir, { recursive: true });
  writeFileSync(cached, body);
  return { body, from: "source" };
}

// A quest card and a side quest are printed sideways, and the app shows them so. JvZijp files them upright, a quest turned
// one way and a side quest the other: the clockwise turn that lays each back down, checked against cardgame.tools'
// landscape scans (31 quests, 10 player side quests). A quest's side B is filed the other way up from its side A (the text of
// "141022 - 1B" runs bottom to top), so it takes the opposite turn.
const UPRIGHT_TURN: Readonly<Record<string, number>> = { quest: 90, "player-side-quest": 270, "encounter-side-quest": 270 };

// The cards JvZijp files upright the other way from the rest of their kind (the text box on the left, its text running bottom to
// top): The Hunt for the Dreadnaught's two quest stages (user report, 2026-11-20: shown upside down, and the scenario's scene cut
// from the text box). They take the opposite turn.
const TURNED_THE_OTHER_WAY: ReadonlySet<string> = new Set(["40004", "40005"]);

// The pin a stamp records for a card: a card turned the other way is marked, so a pack stamped before it was turned packs that card
// again while every other card keeps its earlier copy (no full repack, PACK_VERSION unchanged).
function stampPin(sha: string, code: string): string {
  return TURNED_THE_OTHER_WAY.has(code) ? `${sha} turned` : sha;
}

// The clockwise turn that lays a picture of `media`'s size down: none for a picture already wider than tall.
function layDownTurn(media: { width: number; height: number }, typeCode: string, code: string): number {
  const turn = media.height > media.width ? (UPRIGHT_TURN[typeCode] ?? 0) : 0;
  return turn !== 0 && TURNED_THE_OTHER_WAY.has(code) ? (turn + 180) % 360 : turn;
}

// Scales a picture down to MAX_SIDE on its long side as a JPEG, laying an upright quest picture down first. A JPEG already
// within MAX_SIDE, the right way round and at most KEEP_BYTES is kept byte for byte; a PNG, or a JPEG saved at a far higher
// quality than the bundle needs (JvZijp's campaign pages run to 1.2 MB), is encoded again.
export async function shrinkToMaxSide(body: Uint8Array, typeCode = "", side: "A" | "B" = "A", code = ""): Promise<Uint8Array> {
  const media = sniffImage(body);
  if (!media) throw new Error("Picture is not a JPEG or PNG");
  const sideA = layDownTurn(media, typeCode, code);
  const turn = side === "B" && sideA !== 0 ? (sideA + 180) % 360 : sideA;
  if (turn === 0 && media.extension === "jpg" && Math.max(media.width, media.height) <= MAX_SIDE && body.byteLength <= KEEP_BYTES) return body;
  const image = turn === 0 ? sharp(body) : sharp(body).rotate(turn);
  return new Uint8Array(await image.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer());
}

// A source this wide or wider, laid down, is a scan of a printed card (JvZijp's proxies are about 1930, cardgame.tools' 600 dpi
// scans about 2100): its scene is softened just enough to take out the print's halftone screen, which a scene drawn large across
// a page shows as grain (user report, 2026-10-30). A smaller, digital picture (Hall of Beorn's 700) is not softened.
const PRINT_SCAN_WIDTH = 1600;
const HALFTONE_BLUR = 1.2;

/**
 * A scenario's scene from its first quest card's picture, laid down: the SCENE_PICTURE region at the source's own size, unscaled, so the
 * scene a page draws large is never a crop of the shrunk card. A print scan is softened (PRINT_SCAN_WIDTH).
 */
export async function sceneOf(body: Uint8Array, typeCode = "quest", code = ""): Promise<Uint8Array> {
  const media = sniffImage(body);
  if (!media) throw new Error("A scene's picture is not a JPEG or PNG");
  const turn = layDownTurn(media, typeCode, code);
  const width = turn % 180 === 0 ? media.width : media.height;
  const height = turn % 180 === 0 ? media.height : media.width;
  const laid = await sharp(body).rotate(turn).toBuffer();
  const region = { left: Math.round(SCENE_PICTURE.x * width), top: Math.round(SCENE_PICTURE.y * height), width: Math.round(SCENE_PICTURE.w * width), height: Math.round(SCENE_PICTURE.h * height) };
  const cropped = sharp(laid).extract(region);
  return new Uint8Array(await (width >= PRINT_SCAN_WIDTH ? cropped.blur(HALFTONE_BLUR) : cropped).jpeg({ quality: 88, mozjpeg: true }).toBuffer());
}

/** The first quest card of every scenario in data/scenarios: the cards whose scene a page shows (art.tsx, useSceneCard). */
export function sceneCodesOf(scenariosDir: string): Set<string> {
  const codes = new Set<string>();
  for (const file of readdirSync(scenariosDir).filter((name) => name.endsWith(".json"))) {
    const first = (JSON.parse(readFileSync(path.join(scenariosDir, file), "utf8")) as { stages?: string[] }).stages?.[0];
    if (first) codes.add(first);
  }
  return codes;
}

// `code` is the map key: a card's code for side A, `<code>.B` for side B.
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
        `  ${JSON.stringify(entry.code)}: { moduleId: require("../../../assets/scans/${entry.filename}") as number | { uri: string }, width: ${entry.width}, height: ${entry.height} },`,
    );
  const body = lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
  writeFileSync(
    mapPath,
    `export type ScanAsset = {\n  moduleId: number | { uri: string };\n  width: number;\n  height: number;\n};\n\n// Leave this object empty in git. scripts/build/pack-scans.ts replaces it on the release machine.\nexport const scanAssets: Record<string, ScanAsset> = {${body}};\n`,
  );
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

// --optional (pnpm start): a failed pack is a warning, so Metro still starts offline with the pictures of the last pack.
if (isDirectRun(import.meta.url)) {
  runPack("pack-scans", "pictures not packed, so this bundle keeps the last pack's", async (log) => {
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
        sceneCodes: sceneCodesOf(path.join(DATA_DIR, "scenarios")),
        mirror: mirrorReader(mirrorFromEnv(), log),
      },
      log,
    );
  });
}
