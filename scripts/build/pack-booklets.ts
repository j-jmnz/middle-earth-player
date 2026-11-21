import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BOOKLETS, type BookletId } from "../../src/screens/booklets/books.ts";
import { BOOKLET_PACK_DIR, DATA_DIR, PDF_CACHE_DIR } from "../data/paths.ts";
import { mirrorFromEnv, mirrorReader } from "../data/mirror/client.ts";
import { fetchBytes, sha256, type SourceRecord } from "../data/sources/fetch.ts";
import { bytes, isDirectRun, runPack, type Log } from "../log.ts";

// The PDF each book is bundled from: a file of the `rules` source in data/sources.json, pinned by sha256 there.
export const BOOKLET_SOURCES: Record<BookletId, string> = {
  "fellowship-of-the-ring": "mec109_rulebook-compressed.pdf",
  "learn-to-play": "mec101_learn_to_play_eng_v11-compressed.pdf",
  "rules-reference": "mec101_rules_reference.pdf",
  "the-dark-of-mirkwood": "dark_of_mirkwood_rulebook_v2.pdf",
  "dream-chaser": "mec111_dream-chaser_campaign_expansion.pdf",
  "ered-mithrin": "mec115_rules-web.pdf",
  "angmar-awakened": "mec108_rules.pdf",
  "the-two-towers": "mec112_rulebook_eng.pdf",
  "the-return-of-the-king": "mec113_rules-web.pdf",
};

export type PackedBooklet = {
  id: BookletId;
  filename: string;
  bytes: number;
  sha256: string;
};

export type PackBookletsOptions = {
  sourcesPath: string;
  pdfCacheDir: string;
  /** Gets each `<id>.pdf` and the `bundled-map.ts` that requires them; metro.config.js puts that map in place of the stub. */
  outDir: string;
  fetch?: (url: string) => Promise<Uint8Array>;
  // The asset mirror, read before a pin's URL (scripts/data/mirror/client.ts, mirrorReader); null on a miss.
  mirror?: (hash: string) => Promise<Uint8Array | null>;
};

/**
 * Copies each book's pinned PDF into the app's assets and writes the map the reader installs from. The `.cache/pdf` copy
 * is used when its hash matches the pin; otherwise the asset mirror's copy, then the pinned URL (a release machine has no
 * cache), and the fetched PDF is kept in the cache. Bytes that do
 * not match the pin fail the build: run `pnpm data sync rules` to move the pin.
 */
export async function packBooklets(options: PackBookletsOptions, log: Log): Promise<PackedBooklet[]> {
  const { sources } = JSON.parse(readFileSync(options.sourcesPath, "utf8")) as { sources: Partial<Record<string, SourceRecord>> };
  const files = sources.rules?.files ?? [];
  const fetchPdf = options.fetch ?? ((url: string) => fetchBytes(url, 300_000, log));
  mkdirSync(options.outDir, { recursive: true });
  const packed: PackedBooklet[] = [];
  const from = { cache: 0, mirror: 0, source: 0 };
  for (const { id } of BOOKLETS) {
    const file = BOOKLET_SOURCES[id];
    const pin = files.find((entry) => entry.path === `pdf/${file}`);
    if (!pin) throw new Error(`${file} (booklet ${id}) is not a pinned rules file in ${options.sourcesPath}`);
    const filename = `${id}.pdf`;
    const target = path.join(options.outDir, filename);
    const cached = path.join(options.pdfCacheDir, file);
    if (existsSync(cached) && sha256(readFileSync(cached)) === pin.sha256) {
      copyFileSync(cached, target);
      from.cache += 1;
      log.debug(`${id}: ${file} from the cache`);
    } else {
      const mirrored = await options.mirror?.(pin.sha256);
      if (!mirrored) log.info(`${id}: ${file} not in the cache at its pin, fetching ${pin.url}`);
      const body = mirrored ?? (await fetchPdf(pin.url));
      from[mirrored ? "mirror" : "source"] += 1;
      const hash = sha256(body);
      if (hash !== pin.sha256) throw new Error(`${pin.url} has sha256 ${hash}, pinned ${pin.sha256}. Run pnpm data sync rules and check the change.`);
      writeFileSync(target, body);
      mkdirSync(options.pdfCacheDir, { recursive: true });
      writeFileSync(cached, body);
    }
    packed.push({ id, filename, bytes: pin.bytes, sha256: pin.sha256 });
  }
  writeBookletMap(path.join(options.outDir, "bundled-map.ts"), packed);
  log.notice(`packed ${packed.length} booklets (${bytes(packed.reduce((sum, book) => sum + book.bytes, 0))}): ${from.cache} from .cache, ${from.mirror} from the mirror, ${from.source} from their sources`);
  log.info(`wrote ${options.outDir}; the next Metro bundle carries them`);
  return packed;
}

function writeBookletMap(mapPath: string, packed: readonly PackedBooklet[]): void {
  const lines = packed.map(
    (book) => `  ${JSON.stringify(book.id)}: { moduleId: require("./${book.filename}") as number, filename: ${JSON.stringify(BOOKLET_SOURCES[book.id])}, bytes: ${book.bytes}, sha256: ${JSON.stringify(book.sha256)} },`,
  );
  const body = lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
  writeFileSync(
    mapPath,
    `export type BundledBooklet = {\n  moduleId: number;\n  filename: string;\n  bytes: number;\n  sha256: string;\n};\n\n// Written by scripts/build/pack-booklets.ts. metro.config.js uses this file in place of src/screens/booklets/bundled-map.ts.\nexport const bundledBooklets: Partial<Record<string, BundledBooklet>> = {${body}};\n`,
  );
}

/** Packs from this checkout's pins and PDF cache into `assets/booklets`. `data sync rules` runs it after a fetch. */
export function packBookletsHere(log: Log): Promise<PackedBooklet[]> {
  return packBooklets({ sourcesPath: path.join(DATA_DIR, "sources.json"), pdfCacheDir: PDF_CACHE_DIR, outDir: BOOKLET_PACK_DIR, mirror: mirrorReader(mirrorFromEnv(), log) }, log);
}

// --optional (pnpm start): a failed pack is a warning, so Metro still starts offline; the books are then not bundled.
if (isDirectRun(import.meta.url)) runPack("pack-booklets", "booklets not packed, so this bundle carries none", packBookletsHere);
