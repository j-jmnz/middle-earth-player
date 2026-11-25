import { describe, expect, it } from "vitest";

import { measureOf, measureTable, measureText, parseMeasure, totalWriting } from "./scenario-measures.ts";

// The two lines are the bodies of the squash commits of The Morgul Vale (one line) and The Steward's Fear (wrapped), as `git log origin/main --grep "Pipeline measure"` prints them.

const MORGUL = `## What and why

Text.

Pipeline measure: Read: 0 full test runs, 1 wait minutes, 45 writing minutes. Research: done before Read. Build: 1 test fast, 1 soak, 11 wait minutes, 190 writing minutes. Judge: 2 minutes, 2 wrong and 0 ambiguous of 36 lines, 0 wrong of 4 checks. Tests: 1 soak, 15 wait minutes, 110 writing minutes. Words: 9 wait minutes, 15 writing minutes. Games: 1 test fast, 2 full scenario runs, 1 soak, about 38 wait minutes, about 150 writing minutes; 6 goldens, about 770 intents; scenario budget 23 s. Review findings: 1 block, 14 real, about 13 smaller, 2 not fixed; reviewer 10 minutes, ux 14 minutes. Focused review: 9 minutes, 0 blocks, 8 real and 8 smaller findings. Fix: 2 full test runs, 1 soak, 1 scenario run, about 35 wait minutes, about 15 writing minutes. Second fix: 1 full test run, 1 soak, 1 full scenario run, about 11 wait minutes, about 25 writing minutes.

### repo: Add the skeletons`;

const STEWARD = `Pipeline measure: Read: 0 full test runs, 3 wait minutes, 40 writing
minutes after a restart that lost one run. Research: about 6 minutes
before Read. Build: 1 test fast, 1 soak, 18 wait minutes, 70 writing
minutes. Judge: 4 minutes, 9 wrong and 1 ambiguous of 44 lines, 0 wrong
of 9 checks. Tests: 1 soak, 7 wait minutes, 70 writing minutes. Words: 6
wait minutes, 55 writing minutes. Games: 1 test fast, 1 full scenario
run, 9 wait minutes, 40 writing minutes; 7 goldens, 1228 intents;
scenario budget 25 s. Review findings: 0 blocks, 7 real, 20 smaller, 4
not fixed. Fix: 1 soak, 1 full test run, 18 wait minutes, 100 writing
minutes; 7 goldens, 1208 intents; scenario budget 23 s.

## Rules and sources

- Printed lines.`;

describe("scenario measures: the text of a measure", () => {
  it("runs from the label to the next blank line or heading, its wrapped lines joined", () => {
    expect(measureText(MORGUL)?.startsWith("Read: 0 full test runs")).toBe(true);
    expect(measureText(MORGUL)?.endsWith("about 25 writing minutes.")).toBe(true);
    expect(measureText(STEWARD)).toContain("40 writing minutes after a restart");
    expect(measureText(STEWARD)?.endsWith("scenario budget 23 s.")).toBe(true);
    expect(measureText("feat: Add a scenario\n\nMeasure: golden.test.ts 6 s")).toBeUndefined();
  });
});

describe("scenario measures: the minutes of each task", () => {
  it("reads a measure on one line, adds the fix rounds, and gives `?` for what it does not state", () => {
    const { tasks, findings } = parseMeasure(measureText(MORGUL) ?? "");
    expect(tasks.Read).toEqual({ wait: 1, writing: 45 });
    expect(tasks.Build).toEqual({ wait: 11, writing: 190 });
    expect(tasks.Games).toEqual({ wait: 38, writing: 150 });
    expect(tasks.Fix).toEqual({ wait: 46, writing: 40 });
    expect(tasks.Research).toEqual({});
    expect(tasks.Judge).toEqual({});
    expect(tasks.Review).toEqual({});
    expect(findings?.startsWith("Review findings: 1 block, 14 real")).toBe(true);
    expect(findings).not.toContain("Fix:");
  });

  it("reads a wrapped measure", () => {
    const { tasks, findings } = parseMeasure(measureText(STEWARD) ?? "");
    expect(tasks.Read).toEqual({ wait: 3, writing: 40 });
    expect(tasks.Build).toEqual({ wait: 18, writing: 70 });
    expect(tasks.Words).toEqual({ wait: 6, writing: 55 });
    expect(tasks.Fix).toEqual({ wait: 18, writing: 100 });
    expect(findings).toBe("Review findings: 0 blocks, 7 real, 20 smaller, 4 not fixed.");
  });
});

describe("scenario measures: the table", () => {
  it("has a row for each task, a Total of writing minutes, the findings and the scenarios not parsed", () => {
    const table = measureTable([
      { id: "the-morgul-vale", measure: parseMeasure(measureText(MORGUL) ?? "") },
      { id: "the-stewards-fear", measure: parseMeasure(measureText(STEWARD) ?? "") },
      { id: "none-found", measure: null },
    ]);
    const lines = table.split("\n");
    expect(lines[0]).toBe("| Task | the-morgul-vale | the-stewards-fear | none-found |");
    expect(lines).toContain("| Read | 1/45 | 3/40 | ? |");
    expect(lines).toContain("| Research | ? | ? | ? |");
    expect(lines).toContain("| Fix | 46/40 | 18/100 | ? |");
    expect(lines).toContain("| Total writing | 550 | 375 | ? |");
    expect(lines.some((line) => line.startsWith("the-stewards-fear: Review findings: 0 blocks"))).toBe(true);
    expect(lines).toContain("none-found: no Review findings sentence");
    expect(lines).toContain("- the-morgul-vale: Research, Judge, Review");
    expect(lines).toContain("- none-found: Read, Research, Build, Judge, Tests, Words, Games, Review, Fix");
  });
});

describe("scenario measures: several blocks, list blocks, totals and the commit", () => {
  it("takes the last of several Pipeline measure blocks", () => {
    const body = "Pipeline measure: Read: 1 wait minutes, 5 writing minutes.\n\nText.\n\nPipeline measure: Read: 2 wait minutes, 9 writing minutes.\n\n## End";
    expect(measureText(body)).toBe("Read: 2 wait minutes, 9 writing minutes.");
  });

  it("reads a block written as a list item, and per-task list lines under a bare label", () => {
    expect(measureText("Intro\n\n- Pipeline measure: Read: 1 wait minutes, 5 writing minutes.\n  Build: 2 wait minutes, 6 writing minutes.\n\n## End")).toBe("Read: 1 wait minutes, 5 writing minutes. Build: 2 wait minutes, 6 writing minutes.");
    const body = "Pipeline measure:\n- Read: 1 wait minutes, 5 writing minutes.\n- Build: 2 wait minutes,\n  6 writing minutes.\n\n- Fix: 3 wait minutes, 7 writing minutes.\n\nOther paragraph.\n\n### repo: Next";
    const text = measureText(body) ?? "";
    expect(text).toContain("Build: 2 wait minutes, 6 writing minutes.");
    expect(text).toContain("Fix: 3 wait minutes");
    expect(text).not.toContain("Other paragraph");
    expect(parseMeasure(text).tasks.Fix).toEqual({ wait: 3, writing: 7 });
    expect(parseMeasure("Review findings: 1 block.\nReadings: 2 recommended.").findings).toBe("Review findings: 1 block.");
  });

  it("gives a total of ? or a sum followed by +? when a required task has no writing minutes", () => {
    expect(totalWriting(parseMeasure("Read: 1 wait minutes, 5 writing minutes. Build: 2 wait minutes, 6 writing minutes."))).toBe("11+?");
    expect(totalWriting(parseMeasure("Judge: not recorded."))).toBe("?");
    expect(totalWriting(parseMeasure(measureText(MORGUL) ?? ""))).toBe("550");
  });

  it("searches the id as playable.ts writes it, and takes only the first commit", () => {
    const calls: string[][] = [];
    const run = (args: readonly string[]): string | null => {
      calls.push([...args]);
      if (args[0] === "log") return "aaa\nbbb\n";
      return args[args.length - 1] === "aaa" ? "feat: Add it\n\nNo measure here." : "feat: Later\n\nPipeline measure: Read: 1 wait minutes, 2 writing minutes.";
    };
    const found = measureOf("the-oath", "origin/main", run);
    expect(calls[0]).toContain('-S"the-oath"');
    expect(found).toEqual({ text: undefined, note: "made playable before measures" });
    expect(calls.some((call) => call.includes("bbb"))).toBe(false);
  });
});
