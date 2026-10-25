import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BOOKLETS, type BookletId } from "../src/screens/booklets/books.ts";
import { fetchBytes, sha256, type SourceRecord } from "./data/sources/fetch.ts";
import { bytes, runScript, type Log } from "./log.ts";

// The PDF each book is bundled from: a file of the `rules` source in data/sources.json, pinned by sha256 there.
export const BOOKLET_SOURCES: Record<BookletId, string> = {
  "fellowship-of-the-ring": "mec109_rulebook-compressed.pdf",
  "learn-to-play": "mec101_learn_to_play_eng_v11-compressed.pdf",
};

export type PackedBooklet = {
  id: BookletId;
  filename: string;
  bytes: number;
};

export type PackBookletsOptions = {
  sourcesPath: string;
  pdfCacheDir: string;
  bookletsDir: string;
  mapPath: string;
  fetch?: (url: string) => Promise<Uint8Array>;
};

/**
 * Copies each book's pinned PDF into the app's assets and writes the map the reader installs from. The `.cache/pdf` copy
 * is used when its hash matches the pin; otherwise the pinned URL is fetched (an EAS machine has no cache). Bytes that do
 * not match the pin fail the build: run `pnpm data:sync rules` to move the pin.
 */
export async function packBooklets(options: PackBookletsOptions, log: Log): Promise<PackedBooklet[]> {
  const { sources } = JSON.parse(readFileSync(options.sourcesPath, "utf8")) as { sources: Partial<Record<string, SourceRecord>> };
  const files = sources.rules?.files ?? [];
  const fetchPdf = options.fetch ?? ((url: string) => fetchBytes(url, 300_000, log));
  mkdirSync(options.bookletsDir, { recursive: true });
  const packed: PackedBooklet[] = [];
  for (const { id } of BOOKLETS) {
    const file = BOOKLET_SOURCES[id];
    const pin = files.find((entry) => entry.path === `pdf/${file}`);
    if (!pin) throw new Error(`${file} (booklet ${id}) is not a pinned rules file in ${options.sourcesPath}`);
    const filename = `${id}.pdf`;
    const target = path.join(options.bookletsDir, filename);
    const cached = path.join(options.pdfCacheDir, file);
    if (existsSync(cached) && sha256(readFileSync(cached)) === pin.sha256) {
      copyFileSync(cached, target);
      log.debug(`${id}: ${file} from the cache`);
    } else {
      log.info(`${id}: ${file} not in the cache at its pin, fetching ${pin.url}`);
      const body = await fetchPdf(pin.url);
      const hash = sha256(body);
      if (hash !== pin.sha256) throw new Error(`${pin.url} has sha256 ${hash}, pinned ${pin.sha256}. Run pnpm data:sync rules and check the change.`);
      writeFileSync(target, body);
    }
    packed.push({ id, filename, bytes: pin.bytes });
  }
  writeBookletMap(options.mapPath, packed);
  log.info(`bundled ${packed.length} booklets (${bytes(packed.reduce((sum, book) => sum + book.bytes, 0))}) into ${options.bookletsDir}`);
  return packed;
}

function writeBookletMap(mapPath: string, packed: readonly PackedBooklet[]): void {
  const lines = packed.map(
    (book) => `  ${JSON.stringify(book.id)}: { moduleId: require("../../../assets/booklets/${book.filename}") as number, filename: ${JSON.stringify(BOOKLET_SOURCES[book.id])} },`,
  );
  const body = lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
  writeFileSync(
    mapPath,
    `export type BundledBooklet = {\n  moduleId: number;\n  filename: string;\n};\n\n// Leave this object empty in git. scripts/pack-booklets.ts replaces it on the release machine.\nexport const bundledBooklets: Partial<Record<string, BundledBooklet>> = {${body}};\n`,
  );
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return entry ? path.resolve(entry) === fileURLToPath(import.meta.url) : false;
}

if (isDirectRun()) {
  void runScript("pack-booklets", async (log) => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    await packBooklets(
      {
        sourcesPath: path.join(root, "data/sources.json"),
        pdfCacheDir: path.join(root, ".cache/pdf"),
        bookletsDir: path.join(root, "assets/booklets"),
        mapPath: path.join(root, "src/screens/booklets/bundled-map.ts"),
      },
      log,
    );
  });
}
