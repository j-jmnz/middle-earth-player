// Every record copied from another card's line (src/effects/authored/reprint.ts) still reads the same on both lines of the printed-text ledger
// (data/printed), so a ledger edit cannot leave a stale copy behind.
import { describe, expect, it } from "vitest";

import { shippedLedger } from "../catalog/printed-ledger.ts";
import { copiedLines, copyMismatch } from "./authored/reprint.ts";
import { EFFECTS } from "./index.ts";

describe("copied records", () => {
  const copied = EFFECTS.flatMap((record) => (copiedLines(record) ?? []).map((pair) => ({ id: record.id, pair })));

  it("are found among the shipped records", () => {
    expect(copied.length).toBeGreaterThan(50);
  });

  it("copy only lines that read the same on both cards", () => {
    const ledger = shippedLedger();
    const refused = copied.flatMap(({ id, pair }) => {
      const why = copyMismatch(ledger, pair);
      return why ? [`${id}: ${why}`] : [];
    });
    expect(refused).toEqual([]);
  });
});
