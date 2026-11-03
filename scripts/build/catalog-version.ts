import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// The catalog version is the first 32 bits of a hash of the rows the database holds. The same data gives the
// same number on every machine, so src/catalog/version.ts can be checked in CI instead of bumped by hand.
export function contentVersion(parts: readonly unknown[]): number {
  const hash = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return Number.parseInt(hash.slice(0, 8), 16);
}

export function writeCatalogVersion(versionPath: string, version: number): void {
  const declaration = `export const CATALOG_VERSION = ${version};`;
  if (!existsSync(versionPath)) {
    mkdirSync(path.dirname(versionPath), { recursive: true });
    writeFileSync(versionPath, `${declaration}\n`);
    return;
  }
  const current = readFileSync(versionPath, "utf8");
  if (!/export const CATALOG_VERSION = \d+;/.test(current)) {
    throw new Error(`Could not read CATALOG_VERSION from ${versionPath}`);
  }
  const next = current.replace(/export const CATALOG_VERSION = \d+;/, declaration);
  if (next !== current) writeFileSync(versionPath, next);
}
