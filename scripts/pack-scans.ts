import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { sniffImage } from "../src/screens/images/policy.ts";

const SIDE_SUFFIXES = ["-1a", "-1b", "-2a", "-2b", "-3a", "-3b", "-setupa", "-setupb"] as const;
const A_SIDES = ["-1a", "-2a", "-3a", "-setupa"] as const;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

export function normalizeScanKey(value: string): string {
  const base = value.replace(/\.[^.]+$/, "");
  return base
    .toLowerCase()
    .replace(/['’ʻʼ]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export type ShelfCandidate = {
  path: string;
};

export function matchShelfScan(cardName: string, files: readonly ShelfCandidate[]): string | null {
  const cardKey = normalizeScanKey(cardName);
  if (cardKey.length === 0) return null;
  let exact: string | null = null;
  const sides = new Map<string, string>();
  for (const file of files) {
    if (isSkippedShelfPath(file.path)) continue;
    const key = normalizeScanKey(path.basename(file.path));
    if (key === cardKey) {
      exact = file.path;
      continue;
    }
    for (const suffix of SIDE_SUFFIXES) {
      if (key === `${cardKey}${suffix}`) sides.set(suffix, file.path);
    }
  }
  if (exact) return exact;
  for (const suffix of A_SIDES) {
    const match = sides.get(suffix);
    if (match) return match;
  }
  return null;
}

export function shelfFetchArgs(): readonly string[] {
  return ["--experimental-strip-types", "scripts/fetch-sources.ts"];
}

export type PackedScan = {
  code: string;
  filename: string;
  width: number;
  height: number;
};

export type PackScansOptions = {
  root: string;
  fixturesDir: string;
  catalogDb: string;
  readingDir: string;
  scansDir: string;
  mapPath: string;
  fetchShelf?: () => void;
};

export function packScans(options: PackScansOptions): PackedScan[] {
  const codes = fixtureCodes(options.fixturesDir);
  const database = new Database(options.catalogDb, { readonly: true });
  try {
    mkdirSync(options.scansDir, { recursive: true });
    const packed: PackedScan[] = [];
    const missing: { code: string; name: string }[] = [];
    for (const code of codes) {
      const card = database.prepare("select name, imagesrc from cards where code = ?").get(code) as
        | { name: string; imagesrc: string | null }
        | undefined;
      if (!card) throw new Error(`Fixture code ${code} is not in the catalog`);
      if (card.imagesrc) continue;
      const match = matchShelfScan(card.name, listReadingFiles(options.readingDir));
      if (!match) {
        missing.push({ code, name: card.name });
        continue;
      }
      packed.push(copyScan(code, match, options.scansDir));
    }
    if (missing.length > 0) {
      const fetchShelf = options.fetchShelf ?? (() => fetchScenarioShelf(options.root));
      fetchShelf();
      const files = listReadingFiles(options.readingDir);
      for (const card of missing) {
        const match = matchShelfScan(card.name, files);
        if (!match) throw new Error(`No shelf file for ${card.code} (${card.name}) and no imagesrc`);
        packed.push(copyScan(card.code, match, options.scansDir));
      }
    }
    writeScanMap(options.mapPath, packed);
    return packed;
  } finally {
    database.close();
  }
}

function copyScan(code: string, source: string, scansDir: string): PackedScan {
  const bytes = new Uint8Array(readFileSync(source));
  const media = sniffImage(bytes);
  if (!media) throw new Error(`Shelf file for ${code} is not a JPEG or PNG`);
  const filename = `${code}.${media.extension}`;
  copyFileSync(source, path.join(scansDir, filename));
  return { code, filename, width: media.width, height: media.height };
}

function listReadingFiles(readingDir: string): ShelfCandidate[] {
  if (!existsSync(readingDir)) return [];
  const found: ShelfCandidate[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name.toLowerCase() === "ringsdb") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push({ path: full });
    }
  };
  walk(readingDir);
  return found;
}

function isSkippedShelfPath(filePath: string): boolean {
  if (path.extname(filePath).toLowerCase() === ".pdf") return true;
  if (!IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return true;
  return filePath.split(/[\\/]/).some((part) => part.toLowerCase() === "ringsdb");
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

function fetchScenarioShelf(root: string): void {
  const script = path.join(root, "scripts/fetch-sources.ts");
  if (!existsSync(script)) {
    throw new Error("scripts/fetch-sources.ts is not available to fetch the scenario shelf");
  }
  const result = spawnSync(process.execPath, [...shelfFetchArgs()], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error("Scenario shelf fetch failed");
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
  const root = repoRoot();
  packScans({
    root,
    fixturesDir: path.join(root, "data", "scenarios"),
    catalogDb: path.join(root, "assets/catalog.db"),
    readingDir: path.join(root, ".cache/sources/reading"),
    scansDir: path.join(root, "assets/scans"),
    mapPath: path.join(root, "src/screens/images/scan-map.ts"),
  });
}
