import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { catalogInputs, catalogIsStale } from "./ensure-catalog.ts";

function touch(file: string, seconds: number): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "x");
  utimesSync(file, seconds, seconds);
}

describe("ensure-catalog", () => {
  it("is stale when the database is missing, or older than a payload, an effect file, a fixture, or the local cards", () => {
    const base = mkdtempSync(path.join(tmpdir(), "ensure-catalog-"));
    const db = path.join(base, "assets", "catalog.db");
    const inputs = catalogInputs(base);
    expect(catalogIsStale(db, inputs)).toBe(true);
    touch(db, 2000);
    expect(catalogIsStale(db, inputs)).toBe(false);
    touch(path.join(base, ".cache", "ringsdb", "manifest.json"), 1000);
    touch(path.join(base, "src", "effects", "set", "a.ts"), 1000);
    touch(path.join(base, "fixtures", "f.json"), 1000);
    touch(path.join(base, "scripts", "local-cards.ts"), 1000);
    expect(catalogIsStale(db, inputs)).toBe(false);
    for (const changed of [
      path.join(base, ".cache", "ringsdb", "manifest.json"),
      path.join(base, "src", "effects", "set", "a.ts"),
      path.join(base, "fixtures", "f.json"),
      path.join(base, "scripts", "local-cards.ts"),
    ]) {
      touch(changed, 3000);
      expect(catalogIsStale(db, inputs), changed).toBe(true);
      touch(changed, 1000);
    }
  });
});
