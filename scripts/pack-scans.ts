import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { isRingsdbImagePath, sniffImage } from "../src/screens/images/policy.ts";
import { DATA_DIR, SCAN_CACHE_DIR } from "./data/paths.ts";
import { fetchBytes, sha256, type SourceFile, type SourceRecord } from "./data/sources/fetch.ts";
import { bytes, runScript, type Log } from "./log.ts";

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
  scansDir: string;
  mapPath: string;
  fetch?: (url: string) => Promise<Uint8Array>;
};

/**
 * Bundles side A of every scenario card RingsDB has no picture for. Each file is a `scans` file of data/sources.json:
 * the `.cache/scans` copy is used when its hash matches the pin; otherwise the pinned URL is fetched (an EAS machine has
 * no cache). Bytes that do not match the pin fail the build: run `pnpm data:sync scans` to move the pin.
 */
export async function packScans(options: PackScansOptions, log: Log): Promise<PackedScan[]> {
  const codes = fixtureCodes(options.fixturesDir);
  log.info(`${codes.length} card codes in the scenario fixtures`);
  const { sources } = JSON.parse(readFileSync(options.sourcesPath, "utf8")) as { sources: Partial<Record<string, SourceRecord>> };
  const pins = new Map<string, SourceFile>();
  for (const file of sources.scans?.files ?? []) {
    const match = /^scans\/(.+)\.A\.(jpg|png)$/.exec(file.path);
    if (match?.[1]) pins.set(match[1], file);
  }
  const fetchScan = options.fetch ?? ((url: string) => fetchBytes(url, 60_000, log));
  const database = new Database(options.catalogDb, { readonly: true });
  try {
    mkdirSync(options.scansDir, { recursive: true });
    mkdirSync(options.scanCacheDir, { recursive: true });
    const packed: PackedScan[] = [];
    let fetched = 0;
    for (const code of codes) {
      const card = database.prepare("select name, imagesrc from cards where code = ?").get(code) as
        | { name: string; imagesrc: string | null }
        | undefined;
      if (!card) throw new Error(`Fixture code ${code} is not in the catalog`);
      // A RingsDB picture is downloaded on the phone; only a card RingsDB lacks is bundled.
      if (card.imagesrc && isRingsdbImagePath(card.imagesrc)) {
        log.debug(`${code} ${card.name}: RingsDB has a picture, not bundled`);
        continue;
      }
      const pin = pins.get(code);
      if (!pin) throw new Error(`${code} (${card.name}) has no pinned side A scan in ${options.sourcesPath}. Run pnpm data:sync scans.`);
      const cached = path.join(options.scanCacheDir, path.basename(pin.path));
      let body: Uint8Array;
      if (existsSync(cached) && sha256(readFileSync(cached)) === pin.sha256) {
        body = new Uint8Array(readFileSync(cached));
      } else {
        log.debug(`${code}: ${pin.path} not in the cache at its pin, fetching ${pin.url}`);
        body = await fetchScan(pin.url);
        const hash = sha256(body);
        if (hash !== pin.sha256) throw new Error(`${pin.url} has sha256 ${hash}, pinned ${pin.sha256}. Run pnpm data:sync scans and check the change.`);
        writeFileSync(cached, body);
        fetched += 1;
      }
      packed.push(writeScan(code, body, cached, options.scansDir));
    }
    writeScanMap(options.mapPath, packed);
    const total = packed.reduce((sum, scan) => sum + (pins.get(scan.code)?.bytes ?? 0), 0);
    log.info(`bundled ${packed.length} scan${packed.length === 1 ? "" : "s"} (${bytes(total)}, ${fetched} fetched) into ${options.scansDir}; map ${options.mapPath}`);
    return packed;
  } finally {
    database.close();
  }
}

function writeScan(code: string, body: Uint8Array, cached: string, scansDir: string): PackedScan {
  const media = sniffImage(body);
  if (!media) throw new Error(`Scan for ${code} is not a JPEG or PNG`);
  const filename = `${code}.${media.extension}`;
  copyFileSync(cached, path.join(scansDir, filename));
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
        scansDir: path.join(root, "assets/scans"),
        mapPath: path.join(root, "src/screens/images/scan-map.ts"),
      },
      log,
    );
  });
}
