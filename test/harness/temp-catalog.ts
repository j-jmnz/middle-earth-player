import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildCatalog } from "../../scripts/build/catalog.ts";

let built: string | null = null;

// Builds the catalog from data/ into a temporary directory, once per test file, and returns the database path.
// The committed src/catalog/version.ts and assets/catalog.db are never touched.
export function temporaryCatalog(): string {
  if (built) return built;
  const scratch = mkdtempSync(path.join(tmpdir(), "catalog-test-"));
  buildCatalog({ dbPath: path.join(scratch, "catalog.db"), versionPath: path.join(scratch, "version.ts") });
  built = path.join(scratch, "catalog.db");
  return built;
}
