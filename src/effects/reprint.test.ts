// Checks the scan ledger (data/printed/mirkwood-paths.json) against `reprint` (authored/reprint.ts).
import { describe, expect, it } from "vitest";

import ledger from "../../data/printed/mirkwood-paths.json" with { type: "json" };
import { AUTHORED_EFFECTS as OATH } from "./authored/the-oath.ts";
import { reprint } from "./authored/reprint.ts";

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
