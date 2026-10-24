import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "./build-catalog.ts";

// Builds assets/catalog.db when it is missing or older than what it is built from. CI runs this before
// the tests, so a cached database never hides a changed payload, effect record, or fixture.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Newest modification time under a file or directory, or 0 when it does not exist.
function newest(target: string): number {
  if (!existsSync(target)) return 0;
  const info = statSync(target);
  if (!info.isDirectory()) return info.mtimeMs;
  return readdirSync(target).reduce((latest, name) => Math.max(latest, newest(path.join(target, name))), 0);
}

export function catalogInputs(base: string): string[] {
  return [
    path.join(base, ".cache", "ringsdb", "manifest.json"),
    path.join(base, "src", "effects"),
    path.join(base, "fixtures"),
    path.join(base, "scripts", "local-cards.ts"),
  ];
}

export function catalogIsStale(dbPath: string, inputs: readonly string[]): boolean {
  if (!existsSync(dbPath)) return true;
  const built = statSync(dbPath).mtimeMs;
  return inputs.some((input) => newest(input) > built);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry != null && path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const dbPath = path.join(root, "assets", "catalog.db");
  if (!catalogIsStale(dbPath, catalogInputs(root))) {
    console.log("catalog.db is current");
  } else {
    void buildCatalog()
      .then((result) => console.log(`catalog ${result.version}: ${result.packCount} packs, ${result.cardCount} cards`))
      .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
  }
}
