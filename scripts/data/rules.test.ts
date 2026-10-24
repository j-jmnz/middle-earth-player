import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { hashColumns, parseColumns, parseDoc, type ExtractedDoc } from "./rules/extract.ts";
import { buildEntries, extractSpan, indexSchema, type RuleEntry, type Span } from "./rules/spans.ts";
import { DATA_DIR, ROOT } from "./paths.ts";

// data/rules/index.json is the hand-checked list of rule spans, each bounded by two exact quotes. entries.json is
// written from it. These tests read the committed markdown, so they run without the PDFs.
const rulesDir = path.join(DATA_DIR, "rules");
const index = indexSchema.parse(JSON.parse(readFileSync(path.join(rulesDir, "index.json"), "utf8")));
const entries = JSON.parse(readFileSync(path.join(rulesDir, "entries.json"), "utf8")) as RuleEntry[];
const steps = JSON.parse(readFileSync(path.join(rulesDir, "steps.json"), "utf8")) as { id: string; phase: string; entries: string[] }[];
const columns = parseColumns(readFileSync(path.join(rulesDir, "columns.json"), "utf8"));
const docs = new Map(
  readdirSync(rulesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => parseDoc(readFileSync(path.join(rulesDir, name), "utf8")))
    .map((doc) => [doc.doc, doc]),
);
const byId = new Map(entries.map((entry) => [entry.id, entry]));

function listFiles(dir: string, extension: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, extension) : full.endsWith(extension) ? [full] : [];
  });
}

describe("rule columns", () => {
  it("records the column boxes per document, and the markdown was extracted with them", () => {
    for (const [name, doc] of docs) {
      expect(columns[name], `${name} has column boxes`).toBeDefined();
      expect(doc.columnsSha256, `${name} was extracted with the recorded boxes`).toBe(hashColumns(columns[name] as never));
      for (const page of doc.pages) expect(page.columns.length, `${name} p${page.number}`).toBe((columns[name]?.pages?.[String(page.number)] ?? columns[name]?.default ?? []).length);
    }
  });
});

describe("rule spans", () => {
  it("have unique ids and a page and column in their document", () => {
    expect(new Set(index.map((span) => span.id)).size).toBe(index.length);
    for (const span of index) {
      const page = docs.get(span.doc)?.pages.find((candidate) => candidate.number === span.page);
      expect(page?.columns[span.column - 1], `${span.id} is on ${span.doc} p${span.page} c${span.column}`).toBeDefined();
    }
  });

  it("open at their from-quote and close at the first to-quote after it, with no icon artifacts", () => {
    for (const span of index) {
      const flat = extractSpan(span, docs.get(span.doc) as ExtractedDoc).replace(/\s+/g, " ");
      const from = span.from.replace(/\s+/g, " ");
      const to = span.to.replace(/\s+/g, " ");
      expect(flat.startsWith(from), `${span.id} opens with its from-quote`).toBe(true);
      // The span stops at the first place the to-quote can close it: nothing earlier, past the from-quote, ends the same way.
      // (A span that runs into later columns closes in its last column, so only single-column spans are measured here.)
      if (!span.through) {
        const early = flat.indexOf(to, Math.max(0, from.length - to.length));
        expect(early + to.length, `${span.id} closes at the first to-quote after its from-quote`).toBe(flat.length);
      }
      expect(flat, `${span.id} holds a stray icon glyph`).not.toMatch(/[ÚÛÒ$‰]/);
    }
  });

  it("fail when a quote is missing, repeated, or out of order", () => {
    const doc = docs.get("rr") as ExtractedDoc;
    const base: Span = { id: "rr.surge", doc: "rr", page: 17, column: 1, from: "Surge Surge is a keyword ability", to: "the staging of the encounter card.", title: "Surge" };
    expect(extractSpan(base, doc)).toContain("reveal 1 additional encounter card");
    expect(() => extractSpan({ ...base, from: "Surge is a keyword ability that is not printed" }, doc)).toThrow(/found 0 times/);
    expect(() => extractSpan({ ...base, from: "Surge" }, doc)).toThrow(/found [2-9] times/);
    expect(() => extractSpan({ ...base, to: "Staging is the term used" }, doc)).toThrow(/not found after/);
  });

  it("are what entries.json holds", () => {
    expect(buildEntries(index, [...docs.values()])).toEqual(entries);
  });
});

describe("rules store", () => {
  it("joins every DragnCards framework step to Rules Reference entries that exist", () => {
    expect(steps.length).toBeGreaterThan(20);
    for (const step of steps) for (const id of step.entries) expect(byId.has(id), `${step.id} -> ${id}`).toBe(true);
    expect(steps.find((step) => step.id === "6.E")?.entries).toEqual(["rr.step-6-3", "rr.step-6-4-1", "rr.step-6-4-2", "rr.step-6-4-3", "rr.step-6-4-4", "rr.step-6-4a", "rr.step-6-4b", "rr.step-6-5", "rr.step-6-6"]);
  });

  it("knows every rule id that src, docs and the tests name", () => {
    const found = new Set<string>();
    const scan = (file: string): void => {
      for (const match of readFileSync(file, "utf8").matchAll(/\b((?:rr|ltp|mec109|faq)\.[a-z0-9][a-z0-9-]*[a-z0-9])\b/g)) found.add(match[1] ?? "");
    };
    for (const file of listFiles(path.join(ROOT, "src"), ".ts")) scan(file);
    // The plan and the 8c phase file name the old wrong ids on purpose, as findings.
    for (const file of listFiles(path.join(ROOT, "docs"), ".md")) if (!/plans|phase-08c/.test(file)) scan(file);
    const unresolved = [...found].filter((id) => !byId.has(id) && !/^(rr|ltp|mec109|faq)\.(step-|setup-)$/.test(id)).sort();
    // Wildcards in prose ("mec109.setup-*") end in a hyphen or are followed by *, and are skipped by the pattern above.
    expect(unresolved).toEqual([]);
    expect(found.size).toBeGreaterThan(15);
  });

  it("covers the rules the brief and the phases rely on", () => {
    for (const id of [
      "mec109.archery",
      "mec109.toughness",
      "mec109.indestructible",
      "mec109.permanent",
      "rr.restricted",
      "rr.scoring",
      "ltp.scoring",
      "rr.campaign-cards",
      "ltp.campaign-cards",
      "rr.campaign-pool",
      "ltp.campaign-pool",
      "rr.campaign-setup-checklist",
      "ltp.campaign-setup-checklist",
      "mec109.setup-a-shadow-of-the-past",
      "mec109.setup-a-knife-in-the-dark",
      "mec109.setup-flight-to-the-ford",
      "mec109.setup-the-ring-goes-south",
      "mec109.setup-journey-in-the-dark",
      "mec109.setup-breaking-of-the-fellowship",
      "mec109.burden-deck",
      "mec109.ringbearers-life",
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("holds the rule each of the formerly wrong ids named", () => {
    const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
    expect(text("mec109.archery")).toContain("[defense] does not block archery damage.");
    expect(text("mec109.toughness")).toContain("reduces the amount of damage it takes by X");
    expect(text("rr.scoring")).toContain("Add 10 for each completed round");
    expect(text("rr.scoring")).toContain("Subtract any victory points");
    expect(text("ltp.scoring")).toContain("Subtract Victory Points");
    for (const id of ["rr.campaign-setup-checklist", "ltp.campaign-setup-checklist"]) {
      for (const step of ["1. Check that each player", "4. Apply threat penalty", "8. Set encounter deck"]) expect(text(id), `${id} ${step}`).toContain(step);
    }
    for (const id of ["rr.campaign-pool", "ltp.campaign-pool"]) expect(text(id)).toContain("removed from the Campaign Pool");
    expect(text("mec109.ringbearers-life")).toContain("set the Ring-bearer’s life at 15");
  });
});
