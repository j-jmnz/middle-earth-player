import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT } from "./tracked.ts";

// Each researched or recommended reading in a scenario file names the sources it read, and a recommended one says why none settles it (.claude/rules/authority.md, Open points).
// A reading is a list item whose text has a status in brackets. Its sources are a URL or "agent recommendation" in the item, or in a "Sources read" line under the same heading.
const SCENARIOS = path.join(ROOT, "docs", "scenarios");
const READING_STATUS = /\((?:[^()]*\b)?(?:researched|recommended)\b/;
const RECOMMENDED = /\((?:[^()]*\b)?recommended\b/;
const SOURCE = /https?:\/\/|agent recommendation/;
const SOURCES_READ = /Sources read[^\n]*(?:https?:\/\/|agent recommendation)/;
const NO_SOURCE_SETTLES =
  /\b(?:no|none|nothing|neither)\b[^.]{0,100}\b(?:sources?|rulings?|settles?|settled|official|staff|FAQ|posts?|threads?|answers?|covers?|names?|says?|rules?)\b|community only|\bnot (?:taken|settled|ruled)\b/i;

type Problem = "no source" | "no reason that no source settles it";

/** The readings of one file that break the rule, each with its first words. */
function badReadings(text: string): { reading: string; problem: Problem }[] {
  const bad: { reading: string; problem: Problem }[] = [];
  // A section runs from a heading to the next; an item runs from its bullet to the next line that is not a continuation.
  for (const section of text.split(/^(?=#{1,6} )/m)) {
    const sectionSourced = SOURCES_READ.test(section);
    const items: string[] = [];
    for (const line of section.split("\n")) {
      if (/^\s*[-*] /.test(line)) items.push(line);
      else if (items.length > 0 && /^\s+\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
      else if (!/^\s+\S/.test(line)) items.push("");
    }
    for (const item of items) {
      if (!READING_STATUS.test(item)) continue;
      const reading = item.slice(0, 80);
      if (!SOURCE.test(item) && !sectionSourced) bad.push({ reading, problem: "no source" });
      else if (RECOMMENDED.test(item) && !NO_SOURCE_SETTLES.test(item)) bad.push({ reading, problem: "no reason that no source settles it" });
    }
  }
  return bad;
}

// Readings that fail today, per file, at their count: a count only goes down (a file fixed is removed, a file that failed less is lowered).
const KNOWN: Readonly<Record<string, number>> = {
  "docs/scenarios/against-the-shadow/assault-on-osgiliath.md": 7,
  "docs/scenarios/against-the-shadow/encounter-at-amon-din.md": 15,
  "docs/scenarios/against-the-shadow/into-ithilien.md": 16,
  "docs/scenarios/against-the-shadow/peril-in-pelargir.md": 6,
  "docs/scenarios/against-the-shadow/the-blood-of-gondor.md": 26,
  "docs/scenarios/against-the-shadow/the-druadan-forest.md": 13,
  "docs/scenarios/against-the-shadow/the-morgul-vale.md": 1,
  "docs/scenarios/against-the-shadow/the-siege-of-cair-andros.md": 19,
  "docs/scenarios/against-the-shadow/the-stewards-fear.md": 15,
  "docs/scenarios/against-the-shadow.md": 1,
  "docs/scenarios/angmar-awakened.md": 1,
  "docs/scenarios/dwarrowdelf/flight-from-moria.md": 8,
  "docs/scenarios/dwarrowdelf/road-to-rivendell.md": 4,
  "docs/scenarios/dwarrowdelf/shadow-and-flame.md": 2,
  "docs/scenarios/dwarrowdelf/the-long-dark.md": 1,
  "docs/scenarios/dwarrowdelf/the-redhorn-gate.md": 1,
  "docs/scenarios/dwarrowdelf/the-watcher-in-the-water.md": 1,
  "docs/scenarios/ered-mithrin/lost-in-mirkwood.md": 1,
  "docs/scenarios/ered-mithrin.md": 1,
  "docs/scenarios/shadows-of-mirkwood/a-journey-to-rhosgobel.md": 1,
  "docs/scenarios/standalone-scenarios/fog-on-the-barrow-downs.md": 2,
  "docs/scenarios/standalone-scenarios/murder-at-the-prancing-pony.md": 1,
  "docs/scenarios/standalone-scenarios/the-battle-of-lake-town.md": 2,
  "docs/scenarios/standalone-scenarios/the-old-forest.md": 2,
  "docs/scenarios/standalone-scenarios/the-ruins-of-belegost.md": 1,
  "docs/scenarios/standalone-scenarios/the-stone-of-erech.md": 4,
  "docs/scenarios/the-hobbit/dungeons-deep-and-caverns-dim.md": 1,
  "docs/scenarios/the-hobbit/flies-and-spiders.md": 2,
  "docs/scenarios/the-hobbit/the-battle-of-five-armies.md": 3,
  "docs/scenarios/the-hobbit/the-lonely-mountain.md": 10,
  "docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md": 1,
  "docs/scenarios/the-hobbit.md": 2,
  "docs/scenarios/the-return-of-the-king/the-tower-of-cirith-ungol.md": 1,
  "docs/scenarios/the-ring-maker/celebrimbors-secret.md": 2,
  "docs/scenarios/the-ring-maker/into-fangorn.md": 8,
  "docs/scenarios/the-ring-maker/the-dunland-trap.md": 9,
  "docs/scenarios/the-ring-maker/the-nin-in-eilph.md": 1,
  "docs/scenarios/the-ring-maker/the-three-trials.md": 2,
  "docs/scenarios/the-ring-maker/to-catch-an-orc.md": 2,
  "docs/scenarios/the-two-towers/the-passage-of-the-marshes.md": 1,
};

function markdownIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? markdownIn(path.join(dir, entry.name)) : entry.name.endsWith(".md") ? [path.join(dir, entry.name)] : []));
}

describe("scenario files name the sources of each reading", () => {
  const counts = new Map(markdownIn(SCENARIOS).map((file) => [path.relative(ROOT, file).split(path.sep).join("/"), badReadings(readFileSync(file, "utf8")).length]));

  it("has no new reading without a source or a reason that none settles it", () => {
    const grown = [...counts].filter(([file, count]) => count > (KNOWN[file] ?? 0)).map(([file, count]) => `${file}: ${count} (known ${KNOWN[file] ?? 0})`);
    expect(grown, "name the URLs read, or 'agent recommendation' with why no source settles it").toEqual([]);
  });

  it("lists in KNOWN only the count that still stands", () => {
    const stale = Object.entries(KNOWN).filter(([file, count]) => (counts.get(file) ?? 0) !== count).map(([file, count]) => `${file}: known ${count}, now ${counts.get(file) ?? 0}`);
    expect(stale, "lower or remove the entry").toEqual([]);
  });

  it("tests each reading, not the file", () => {
    const text = [
      "## Readings",
      "- A (recommended). No source settles it. Basis: https://example.com/a",
      "- B (recommended). Basis: the printed line.",
      "",
      "## Other",
      "Sources read: https://example.com/b",
      "- C (researched). Basis: the printed line.",
      "- D (recommended). Source: https://example.com/c. Not taken: the other.",
      "- E (recommended). Basis: https://example.com/d.",
      "- F (span-settled). Basis: `rr.setup`.",
    ].join("\n");
    expect(badReadings(text).map((bad) => `${bad.reading.slice(2, 3)} ${bad.problem}`)).toEqual(["B no source", "E no reason that no source settles it"]);
  });
});
