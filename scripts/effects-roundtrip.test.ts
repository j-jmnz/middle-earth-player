import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { effectSchema } from "../src/catalog/boundary.ts";
import { EFFECTS } from "../src/effects/index.ts";

const dbPath = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "assets", "catalog.db");

describe("effects round trip", () => {
  it("catalog.db holds exactly the TypeScript effect ids and records", () => {
    expect(existsSync(dbPath), "assets/catalog.db is missing. Run pnpm catalog:build or scripts/ensure-catalog.ts").toBe(true);
    const database = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = database.prepare("select id, record from effects order by id").all();
      const stored = rows.map((row) => String(row.id));
      expect(stored).toEqual(EFFECTS.map((effect) => effect.id).sort());
      for (const row of rows) {
        const record = effectSchema.parse(JSON.parse(String(row.record)));
        expect(record.id).toBe(row.id);
        expect(record).toEqual(EFFECTS.find((effect) => effect.id === row.id));
      }
    } finally {
      database.close();
    }
  });
});
