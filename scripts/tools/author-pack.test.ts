import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALWAYS_SECTIONS, draftsOfScenario, entriesFor, headingsIn, packPlan, recordsOf, renderPack, verbFamilies } from "./author-pack.ts";

// pnpm author:pack <scenario-id>: what goes into the pack is a pure function of the drafts' text and the schema files' text.
const ROOT = path.resolve(import.meta.dirname, "..", "..");

const MANIFEST = `// Header of the south family.
// More header.
import { z } from "zod";

const code = z.string().min(1);

const VERBS = [
  // Does the first thing (a1:A:1).
  z.strictObject({ verb: z.literal("First"), ...when }),
  // Does the second thing,
  // over two lines of comment.
  verbFlags(z.strictObject({
    verb: z.literal("Second"),
    amount: positiveAmountSchema.optional(), // a (bracket
    ...when,
  }), { collection: "treasure" }),
  z.strictObject({ verb: z.literal("Third"), code, ...when }),
] as const;
`;

describe("entriesFor", () => {
  it("returns the statement of each wanted verb with the comment above it, and the file's header", () => {
    const { header, entries } = entriesFor(MANIFEST, new Set(["Second", "First"]));
    expect(header).toBe("// Header of the south family.\n// More header.");
    expect(entries).toEqual([
      '  // Does the first thing (a1:A:1).\n  z.strictObject({ verb: z.literal("First"), ...when }),',
      '  // Does the second thing,\n  // over two lines of comment.\n  verbFlags(z.strictObject({\n    verb: z.literal("Second"),\n    amount: positiveAmountSchema.optional(), // a (bracket\n    ...when,\n  }), { collection: "treasure" }),',
    ]);
  });

  it("returns nothing for a verb the file does not declare", () => {
    expect(entriesFor(MANIFEST, new Set(["Missing"])).entries).toEqual([]);
  });

  it("reads the helpers of the core schema file and a const of its own", () => {
    const core = `export const simpleVerbs = [\n  // Gains.\n  verb("GainResources"),\n  verbFlags(codeVerb("SetAside"), { setupRole: "dealt" }),\n];\n// The choice.\nconst choose = z.strictObject({\n  verb: z.literal("Choose"),\n  options: z.array(x),\n});\n`;
    const { entries } = entriesFor(core, new Set(["GainResources", "SetAside", "Choose"]));
    expect(entries).toEqual(['  // Gains.\n  verb("GainResources"),', '  verbFlags(codeVerb("SetAside"), { setupRole: "dealt" }),', "// The choice.\nconst choose = z.strictObject({\n  verb: z.literal(\"Choose\"),\n  options: z.array(x),\n});"]);
  });

  it("finds a real verb in the real manifest it is declared in", () => {
    const text = readFileSync(path.join(ROOT, "src/catalog/families/wilderland.ts"), "utf8");
    const { entries } = entriesFor(text, new Set(["DiscoverTreasure"]));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toContain('z.literal("DiscoverTreasure")');
    expect(entries[0]?.trimStart().startsWith("//")).toBe(true);
  });
});

describe("verbFamilies", () => {
  it("maps each verb to the first source, in name order, that declares it", () => {
    const found = verbFamilies(
      new Map([
        ["south", MANIFEST],
        ["alpha", 'z.strictObject({ verb: z.literal("First") })'],
        ["src/catalog/effect-schema-verbs.ts", 'verb("Plain"),'],
      ]),
    );
    expect(found.get("First")).toBe("alpha");
    expect(found.get("Second")).toBe("south");
    expect(found.get("Plain")).toBe("src/catalog/effect-schema-verbs.ts");
  });
});

describe("packPlan", () => {
  const DRAFT = ["# 1 Card", "", '```json', '{"verb":"DecoyVerb"}', "```", "", "## Line by line", "", "### 1:A:1: text", "```json", '{"id":"1:forced:1","trigger":"revealed","instructions":[{"verb":"Second","amount":{"count":{"type":"enemy"}}},{"verb":"Plain"}]}', "```"].join("\n");
  const FAMILY_OF = new Map([["First", "south"], ["Second", "south"], ["Plain", "src/catalog/effect-schema-verbs.ts"], ["Unused", "caves"]]);
  const HEADINGS = ["Workflow", "Where records live", "Templates and copied lines", "The record", "Which card an instruction acts on", "Pick filters", "Amounts", "Conditions", "Triggers and stat flags", "Patterns", "Mechanic families: engine and records together", "Readings the review catches", "Not expressible yet: leave open, report"];

  it("reads verbs from the records after the draft's Line by line heading only", () => {
    expect(recordsOf(DRAFT)).not.toContain("DecoyVerb");
    const plan = packPlan([DRAFT], FAMILY_OF, HEADINGS);
    expect(plan.verbs).toEqual(["Plain", "Second"]);
    expect(plan.families).toEqual(["south", "src/catalog/effect-schema-verbs.ts"]);
  });

  it("takes the fixed sections, and those a record's fields ask for, in the cookbook's order", () => {
    const plan = packPlan([DRAFT], FAMILY_OF, HEADINGS);
    for (const fixed of ALWAYS_SECTIONS) expect(plan.sections).toContain(fixed);
    expect(plan.sections).toEqual(["Where records live", "Templates and copied lines", "The record", "Amounts", "Triggers and stat flags", "Patterns", "Mechanic families: engine and records together", "Readings the review catches", "Not expressible yet: leave open, report"]);
  });

  it("with no drafts is the fixed sections alone", () => {
    const plan = packPlan([], FAMILY_OF, HEADINGS);
    expect(plan).toEqual({ verbs: [], families: [], sections: ["Where records live", "Templates and copied lines", "The record", "Mechanic families: engine and records together", "Readings the review catches", "Not expressible yet: leave open, report"] });
  });
});

describe("headingsIn and renderPack", () => {
  it("lists the second-level headings of a doc, not the third", () => {
    expect(headingsIn("# T\n\n## One\ntext\n### Sub\n## Two words\n")).toEqual(["One", "Two words"]);
  });

  it("writes the four parts in order, with only the entries the drafts' verbs need", () => {
    const plan = { verbs: ["First"], families: ["south"], sections: ["The record"] };
    const text = renderPack({ id: "the-x", vocabulary: "# Vocabulary\nVerbs: A", plan, sources: new Map([["south", MANIFEST]]), sections: ["docs/plans/effect-authoring.md:1-2\n## The record\nbody"], drafts: [{ name: "1.md", text: "# 1 Card" }] });
    const at = ["# Part 1: the vocabulary", "# Part 2: verb entries", "# Part 3: docs/plans/effect-authoring.md", "# Part 4: the drafts"].map((part) => text.indexOf(part));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(at.every((index) => index >= 0)).toBe(true);
    expect(text).toContain('verb: z.literal("First")');
    expect(text).not.toContain('verb: z.literal("Third")');
    expect(text).toContain("## src/catalog/families/south.ts");
    expect(text).toContain("## 1.md");
  });
});

describe("draftsOfScenario", () => {
  it("keeps the drafts of the cards a scenario deals and names the others", () => {
    expect(draftsOfScenario(["11001.md", "12044.md", "900101.md"], new Set(["12044", "900101"]))).toEqual({ kept: ["12044.md", "900101.md"], others: ["11001.md"] });
    expect(draftsOfScenario([], new Set(["1"]))).toEqual({ kept: [], others: [] });
  });
});
