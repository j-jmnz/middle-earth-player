// Checks the scan ledger (data/printed/mirkwood-paths.json) against `reprint` (authored/reprint.ts).
import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";
import ledger from "../../data/printed/mirkwood-paths.json" with { type: "json" };
import { AUTHORED_EFFECTS as OATH } from "./authored/the-oath.ts";
import { shippedLedger } from "../catalog/printed-ledger.ts";
import { copiedLines, copyLine, copyMismatch, reprint, withCopies } from "./authored/reprint.ts";

const linesOf = (code: string): string[] => ledger.entries.filter((entry) => entry.code === code && entry.side === "A").flatMap((entry) => entry.lines);

describe("reprint", () => {
  const twins = [["01100", "41012"], ["01092", "41016"], ["01080", "41018"], ["01083", "41020"]] as const;

  it.each(twins)("%s and %s print the same lines on their scans", (from, to) => {
    expect(linesOf(to)).toEqual(linesOf(from));
    expect(linesOf(to).length).toBeGreaterThan(0);
  });

  it.each(twins)("gives %s's records to %s with the code changed in each id, card code and line", (from, to) => {
    const records = OATH.filter((record) => record.cardCode === to);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.id.startsWith(`${to}:`)).toBe(true);
      expect(record.lines.every((line) => line.startsWith(`${to}:`))).toBe(true);
    }
    expect(reprint(records, to, from).map((record) => record.cardCode)).toEqual(records.map(() => from));
  });

  it("refuses a card with no record", () => {
    expect(() => reprint([], "01100", "41012")).toThrow();
  });
});

describe("withCopies", () => {
  const dawnStar: Effect = { id: "11081:triggered:3", cardCode: "11081", lines: ["11081:A:5"], timing: "triggered", trigger: "characterDestroyed", subject: "self", instructions: [{ verb: "EliminatePlayer" }] };

  it("takes the number the line has on its own card: the source's, moved by how far the target's line stands from the source's", () => {
    const [onFront, onBack] = withCopies([dawnStar, copyLine("11081:A:5", "110137:A:5"), copyLine("11081:A:5", "110137:B:5")]).slice(1);
    expect(onFront).toEqual({ ...dawnStar, id: "110137:triggered:3", cardCode: "110137", lines: ["110137:A:5"] });
    expect(onBack).toEqual({ ...dawnStar, id: "110137:triggered:4", cardCode: "110137", lines: ["110137:B:5"] });
  });

  it("moves the number by the target's own records of the timing before the line", () => {
    const earlier: Effect = { id: "110137:triggered:1", cardCode: "110137", lines: ["110137:A:3"], timing: "triggered", instructions: [] };
    const copied = withCopies([dawnStar, earlier, copyLine("11081:A:5", "110137:A:5")]);
    expect(copied[2]?.id).toBe("110137:triggered:4");
  });

  it("keeps the line pairs of each copy, and the ledger check refuses two lines whose printed text differs, naming both", () => {
    const calphon: Effect = { id: "11028:triggered:1", cardCode: "11028", lines: ["11028:A:3"], timing: "triggered", instructions: [] };
    const [, copied] = withCopies([calphon, copyLine("11028:A:3", "110013:A:3")]);
    const pairs = copiedLines(copied!) ?? [];
    expect(pairs).toEqual([{ from: "11028:A:3", to: "110013:A:3" }]);
    expect(copyMismatch(shippedLedger(), pairs[0]!)).toMatch(/11028:A:3.*110013:A:3/);
    expect(copiedLines(calphon)).toBeUndefined();
  });

  it("refuses a line no record owns and an id that is taken", () => {
    expect(() => withCopies([copyLine("11081:A:5", "110137:A:5")])).toThrow(/No record/);
    const taken: Effect = { ...dawnStar, id: "110137:triggered:3", cardCode: "110137", lines: ["110137:B:6"] };
    expect(() => withCopies([dawnStar, taken, copyLine("11081:A:5", "110137:A:5")])).toThrow(/not free/);
  });
});
