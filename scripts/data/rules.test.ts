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
    // Every prefix entries.json holds (rr, ltp, mec109, faq, dcce, ...), so a new document's ids are checked without editing this test.
    const prefixes = [...new Set(entries.map((entry) => entry.id.split(".")[0] ?? ""))].map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"));
    const ids = new RegExp(`\\b((?:${prefixes.join("|")})\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\\b(?![-<*])`, "g");
    const scan = (file: string): void => {
      for (const match of readFileSync(file, "utf8").matchAll(ids)) found.add(match[1] ?? "");
    };
    for (const file of listFiles(path.join(ROOT, "src"), ".ts")) scan(file);
    // The plan and the 8c phase file name the old wrong ids on purpose, as findings.
    for (const file of listFiles(path.join(ROOT, "docs"), ".md")) if (!/plans|phase-08c/.test(file)) scan(file);
    const unresolved = [...found].filter((id) => !byId.has(id)).sort();
    // A wildcard in prose ("mec109.setup-*", "dcce.setup-<id>") names a family of ids: the pattern above skips an id followed by -, < or *.
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

// Mirkwood Paths and The Dark of Mirkwood (phase 27): the hand-checked spans their scenario data reads.
describe("Mirkwood spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");

  it("pin The Dark of Mirkwood rulebook as a document of 8 pages with its campaign-mode page", () => {
    expect(docs.get("tdom")?.pages.length).toBe(8);
    expect(text("tdom.campaign-mode")).toContain("pages 30");
    expect(text("tdom.mirkwood-paths")).toContain("The Oath is part 4");
    expect(text("tdom.mirkwood-paths")).toContain("is part 5");
    expect(text("tdom.mini-campaign")).toContain("blank Campaign Log");
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks Hall of Beorn against", () => {
    expect(text("ltp.setup-passage-through-mirkwood")).toContain("Passage Through Mirkwood, Spiders of Mirkwood, and Dol Guldur Orcs");
    expect(text("ltp.setup-journey-along-the-anduin")).toContain("Journey Down the Anduin, Sauron’s Reach, Dol Guldur Orcs, and Wilderlands");
    expect(text("ltp.setup-escape-from-dol-guldur")).toContain("Escape from Dol Guldur, Spiders of Mirkwood, and Dol Guldur Orcs");
    expect(text("tdom.setup-the-oath")).toContain("The Oath and The Goblins");
    expect(text("tdom.setup-the-caves-of-nibin-dum")).toContain("The Caves of Nibin-dûm and The Goblins");
  });

  it("list what Easy Mode removes from each Core Set encounter set (easy-mode.core-set)", () => {
    const sheet = text("easy-mode.core-set");
    expect(sheet).toContain("Dol Guldur Orcs 1x Chieftain Ufthak 1x Dol Guldur Beastmaster");
    expect(sheet).toContain("Passage Through Mirkwood None");
    expect(sheet).toContain("2x Dungeon Jailor");
  });
});

// Dream-chaser (phase 37): the Dream-chaser Campaign Expansion rulebook (MEC111) is the document `dcce`.
describe("Dream-chaser spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
  const SCENARIOS = ["voyage-across-belegaer", "the-fate-of-numenor", "raid-on-the-grey-havens", "flight-of-the-stormcaller", "the-thing-in-the-depths", "temple-of-the-deceived", "the-drowned-ruins", "a-storm-on-cobas-haven", "the-city-of-corsairs"];

  it("pin the rulebook as a document of 32 pages with a span for each rule the plan names", () => {
    expect(docs.get("dcce")?.pages.length).toBe(32);
    for (const id of [
      ...SCENARIOS.map((scenario) => `dcce.setup-${scenario}`),
      ...["ships", "ship-enemies", "ship-objectives", "corsair-deck", "boarding", "prepare-your-fleet", "heading", "sailing", "sailing-tests", "stormcaller-elite", "campaign-mode", "uncharted", "uncharted-deck", "aflame", "stormcallers-area", "grapple", "island-map", "exploration", "grotto-deck", "from-sea-to-land", "indestructible", "archery", "last-player", "gaining-xp", "scalable-upgradable", "hard-expert"].map((rule) => `dcce.${rule}`),
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks the cards against", () => {
    expect(text("dcce.setup-voyage-across-belegaer")).toContain("Voyage Across Belegaer, Vast Oceans, Stormy Weather, Umbar Fleet, Corsair Pirates, and The Dream-chaser’s Fleet");
    expect(text("dcce.setup-the-city-of-corsairs")).toContain("The City of Corsairs, Coast of Umbar, Stormy Weather, Umbar Fleet, Voyage Across Belegaer, Corsair Raiders, and The Dream-chaser’s Fleet");
    expect(text("dcce.setup-the-thing-in-the-depths")).toContain("The Thing in the Depths, The Stormcaller, Corsair Raiders, and The Stormcaller Elite");
  });

  it("hold the sea rules as the rulebook words them", () => {
    expect(text("dcce.sailing-tests")).toContain("symbol found on the looked at cards, you may shift your heading on-course");
    expect(text("dcce.corsair-deck")).toContain("removing all non-ship enemies from the encounter deck");
    expect(text("dcce.boarding")).toContain("reveal the top X cards from the Corsair deck");
    expect(text("dcce.prepare-your-fleet")).toContain("One of the players must choose the Dream-chaser");
    expect(text("dcce.gaining-xp")).toContain("Record this amount in the Campaign Log");
    expect(text("dcce.scalable-upgradable")).toContain("Spending 1 XP allows the players to mark any one checkbox");
    expect(text("dcce.naasiyah")).toContain("cannot be used in scenarios 1 through 7");
    expect(text("dcce.from-sea-to-land")).toContain("shuffle the Corsair Deck and Corsair discard pile into the second encounter deck");
  });
});

// Ered Mithrin (phase 49): the Ered Mithrin Campaign Expansion rulebook (MEC115) is the document `emce`.
describe("Ered Mithrin spans", () => {
  const text = (id: string) => (byId.get(id)?.text ?? "").replace(/\s+/g, " ");
  const SCENARIOS = ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion", "fire-in-the-night", "the-ghost-of-framsburg", "mount-gundabad", "the-fate-of-wilderland"];

  it("pin the rulebook as a document of 28 pages with a span for each rule the plan names", () => {
    expect(docs.get("emce")?.pages.length).toBe(28);
    for (const id of [
      ...SCENARIOS.map((scenario) => `emce.setup-${scenario}`),
      ...["caves-deck", "deep", "guarded-x", "immune", "treasure", "campaign-pool-encounter", "evil-creatures-deck", "dragon-signs", "indestructible", "side-quests", "loot", "discover", "gundabad-quest-deck", "bypassing", "boon-allies", "haldan", "campaign-log"].map((rule) => `emce.${rule}`),
    ]) {
      expect(byId.has(id), id).toBe(true);
    }
  });

  it("print each scenario's encounter-deck paragraph, the set lists the build checks the cards against", () => {
    expect(text("emce.setup-journey-up-the-anduin")).toContain("Journey Up the Anduin, Grey Mountain Goblins, Hills of Wilderland, Lost in Wilderland, Journey Along the Anduin, and Wilderlands");
    expect(text("emce.setup-lost-in-mirkwood")).toContain("Lost in Mirkwood, Dark Woods, Gathering Gloom, Passage Through Mirkwood, Spiders of Mirkwood and Dol Guldur Orcs");
    expect(text("emce.setup-mount-gundabad")).toContain("Mount Gundabad, Fell Beasts, Deep Underground, Afraid of the Dark, Lost Caves, and Dragon Might");
  });

  it("hold the keyword and deck rules as the rulebook words them", () => {
    expect(text("emce.caves-deck")).toContain("take each card from the Lost Caves encounter set");
    expect(text("emce.deep")).toContain("If there are no cards remaining in the Caves deck, the Deep keyword is ignored.");
    expect(text("emce.guarded-x")).toContain("X is a card type: enemy or location");
    expect(text("emce.treasure")).toContain("Treasure cards added to a deck do not count towards that deck’s 50 card minimum.");
    expect(text("emce.campaign-pool-encounter")).toContain("add the noted number of copies of each card listed in the campaign log to the encounter deck, regardless of encounter set");
    expect(text("emce.evil-creatures-deck")).toContain("Remove each location and treachery card from the Wilderlands encounter set from the game.");
    expect(text("emce.gundabad-quest-deck")).toContain("shuffle all stage 2 quest cards together randomly");
    expect(text("emce.haldan")).toContain("Haldan cannot be used as a hero in this campaign.");
    expect(text("emce.boon-allies")).toContain("Isolde is on the hunt");
  });
});
