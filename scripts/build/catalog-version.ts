import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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
