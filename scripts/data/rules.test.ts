import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseDoc } from "./rules/extract.ts";
import type { RuleEntry } from "./rules/split.ts";
import { DATA_DIR, ROOT } from "./paths.ts";

const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as RuleEntry[];
const steps = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "steps.json"), "utf8")) as { id: string; phase: string; entries: string[] }[];
const docs = new Map(
  readdirSync(path.join(DATA_DIR, "rules"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => parseDoc(readFileSync(path.join(DATA_DIR, "rules", name), "utf8")))
    .map((doc) => [doc.doc, doc]),
);

describe("rules store", () => {
  it("has unique ids and a page for every entry", () => {
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(docs.get(entry.doc)?.pages.some((page) => page.number === entry.page), entry.id).toBe(true);
    }
  });

  it("finds each entry's title, or its step number, on its page", () => {
    for (const entry of entries) {
      const page = docs.get(entry.doc)?.pages.find((candidate) => candidate.number === entry.page);
      const flat = (page?.text ?? "").replace(/\s+/g, " ").toLowerCase();
      const probe = entry.id.startsWith("rr.step-") ? entry.title.split(" ")[0] ?? "" : entry.title.replace(/\s+/g, " ").toLowerCase();
      expect(flat.includes(probe.toLowerCase()), `${entry.id} on p${entry.page}`).toBe(true);
    }
  });

  it("joins every DragnCards framework step to Rules Reference entries that exist", () => {
    const known = new Set(entries.map((entry) => entry.id));
    expect(steps.length).toBeGreaterThan(20);
    for (const step of steps) for (const id of step.entries) expect(known.has(id), `${step.id} -> ${id}`).toBe(true);
    expect(steps.find((step) => step.id === "6.E")?.entries.length).toBeGreaterThan(1);
  });

  it("knows every rule id that src/rules and docs/brief.md name", () => {
    const known = new Set(entries.map((entry) => entry.id));
    const found = new Set<string>();
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) for (const match of readFileSync(full, "utf8").matchAll(/\b((?:rr|ltp|mec109|faq)\.[a-z0-9][a-z0-9-]*)\b/g)) found.add(match[1] ?? "");
      }
    };
    walk(path.join(ROOT, "src", "rules"));
    for (const match of readFileSync(path.join(ROOT, "docs", "brief.md"), "utf8").matchAll(/`((?:rr|ltp|mec109|faq)\.[a-z0-9][a-z0-9-]*)`/g)) found.add(match[1] ?? "");
    expect(found.size).toBeGreaterThan(10);
    for (const id of found) expect(known.has(id), id).toBe(true);
  });
});
