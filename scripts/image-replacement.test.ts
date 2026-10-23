import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import migrations from "../drizzle/migrations.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { commitImageRecord, type ImageRecord } from "../src/screens/images/policy.ts";
import { writeAppliedCatalogVersion } from "../src/screens/applied-catalog-version.ts";

function migrationSql(entry: { idx: number; tag: string }): string {
  const key = `m${entry.idx.toString().padStart(4, "0")}`;
  const sql = migrations.migrations[key as keyof typeof migrations.migrations];
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw new Error(`Missing migration: ${entry.tag}`);
  }
  return sql;
}

function openUserDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  for (const entry of migrations.journal.entries) {
    for (const statement of migrationSql(entry).split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length === 0) continue;
      database.exec(trimmed);
    }
  }
  return database;
}

describe("image files survive a catalog version bump", () => {
  it("keeps the image row when the applied catalog version changes and no new hash is present", () => {
    const database = openUserDatabase();
    database.exec(
      `INSERT INTO image_files (code, path, width, height, byte_size, media_type, sha256) VALUES ('141001', 'file:///images/141001.jpg', 423, 600, 148338, 'image/jpeg', 'abc')`,
    );
    writeAppliedCatalogVersion((statement) => {
      database.exec(statement);
    }, CATALOG_VERSION + 1);

    const row = database
      .prepare("SELECT code, path, width, height, byte_size, media_type, sha256 FROM image_files WHERE code = ?")
      .get("141001") as
      | { code: string; path: string; width: number; height: number; byte_size: number; media_type: string; sha256: string }
      | undefined;
    expect(row).toEqual({
      code: "141001",
      path: "file:///images/141001.jpg",
      width: 423,
      height: 600,
      byte_size: 148338,
      media_type: "image/jpeg",
      sha256: "abc",
    });

    const existing: ImageRecord = {
      code: row?.code ?? "",
      path: row?.path ?? null,
      width: row?.width ?? null,
      height: row?.height ?? null,
      byteSize: row?.byte_size ?? null,
      mediaType: row?.media_type ?? null,
      sha256: row?.sha256 ?? null,
    };
    const bumped = commitImageRecord(existing, { ...existing, sha256: null, path: "file:///images/next.jpg" });
    expect(bumped.deletePaths).toEqual([]);
    expect(bumped.record.path).toBe("file:///images/141001.jpg");

    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const opener = readFileSync(path.join(root, "src/screens/open-databases.ts"), "utf8");
    expect(opener).not.toContain("image_files");
    expect(opener).not.toContain("images/");
  });
});
