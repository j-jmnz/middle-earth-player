import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { contentVersion, sha256Word } from "./content-hash.ts";

describe("contentVersion", () => {
  it.each(["", "abc", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000), "Éowyn \u{1f409} Ñ 日本"])("is the first 32 bits of the SHA-256 of %j", (text) => {
    expect(sha256Word(text)).toBe(Number.parseInt(createHash("sha256").update(text).digest("hex").slice(0, 8), 16));
  });

  it("hashes the JSON of its parts", () => {
    expect(contentVersion([{ a: 1 }, ["b"]])).toBe(sha256Word('[{"a":1},["b"]]'));
  });
});
