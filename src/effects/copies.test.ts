// Every record copied from another card's line (src/effects/authored/reprint.ts) still reads the same on both lines of the printed-text ledger
// (data/printed) with each card's own name as {self}, so a ledger edit cannot leave a stale copy behind, and its source record names no card.
import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";
import { ledgerByCode } from "../catalog/active-text.ts";
import { shippedLedger } from "../catalog/printed-ledger.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";
import { copiedLines, copyMismatch, copySource } from "./authored/reprint.ts";
import { EFFECTS } from "./index.ts";

describe("copied records", () => {
  const copied = EFFECTS.flatMap((record) => {
    const source = copySource(record);
    return source ? (copiedLines(record) ?? []).map((pair) => ({ id: record.id, pair, source })) : [];
  });

  it("are found among the shipped records", () => {
    expect(copied.length).toBeGreaterThan(50);
  });

  it("copy only lines that read the same on both cards", () => {
    const ledger = shippedLedger();
    const names = new Map(loadCards().map((card) => [card.code, card.name]));
    const refused = copied.flatMap(({ id, pair, source }) => {
      const why = copyMismatch(ledger, pair, (code) => names.get(code), source);
      return why ? [`${id}: ${why}`] : [];
    });
    expect(refused).toEqual([]);
  });

  // A hand-made ledger: two cards print the same sentence with their own name, and a third prints another.
  const side = (code: string, line: string) => ({ code, side: "A", lines: [line], inert: [] });
  const tiny = ledgerByCode([side("1", "Ann gets +1 Attack."), side("2", "Bob gets +1 Attack."), side("3", "Bob gets +2 Attack."), side("4", "Ann gets +1 Attack.")] as never);
  const names = new Map([["1", "Ann"], ["2", "Bob"], ["3", "Bob"], ["4", "Ann"]]);
  const record = (extra: object): Effect => ({ id: "1:constant:1", cardCode: "1", lines: ["1:A:1"], timing: "constant", instructions: [], ...extra }) as Effect;
  const check = (to: string, source: Effect) => copyMismatch(tiny, { from: "1:A:1", to: `${to}:A:1` }, (code) => names.get(code), source);

  it("reads each card's own name as {self}", () => {
    expect(check("2", record({}))).toBeNull();
    expect(check("3", record({}))).toMatch(/is not/);
  });

  it("refuses a source that names its own card for a card named otherwise, not for a same-named reprint", () => {
    const naming = record({ names: ["Ann"] });
    expect(check("2", naming)).toMatch(/names its own card "Ann"/);
    expect(check("4", naming)).toBeNull();
  });

  it("refuses a source that holds its own card code in any field", () => {
    const coded = record({ each: { kind: "tokens", code: "1" } });
    expect(check("2", coded)).toMatch(/by code "1"/);
    expect(check("2", record({ each: { kind: "tokens", code: "9" } }))).toBeNull();
  });
});
