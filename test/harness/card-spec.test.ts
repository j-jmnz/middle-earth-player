// Rules: rr.forced, rr.reveal, rr.shadow-effects (data/rules/entries.json); ledger lines 19155:A:1, 19155:A:2, 19159:A:2, 19164:A:1 of The Fate of Wilderland.
// The card-spec harness on real rows: each row holds, fails without its records, and the removal leaves the shared records as they were.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../src/effects/index.ts";

import { announce, answer, attack, cardSpecs, progressOn, quest, resolve, rowProblems, stat, withoutLine, zone, type Row } from "./card-spec.ts";
import { printedIn } from "./scene-kit.ts";

const ID = "the-fate-of-wilderland";
const FIGHT = ["19155", "19156", "19157"];
const defense = printedIn(ID, "19157")?.defense ?? 0;

const rows: Row[] = [
  { line: "19155:A:1", name: "Urdug gets +2 Defense for each other enemy", layout: { staging: [...FIGHT, "18020"] }, act: [], expect: stat("19157", "defense", defense + 2) },
  { line: "19155:A:2", name: "Forced after an unsuccessful quest", layout: { stage: "19168", threat: [30, 30], staging: [...FIGHT, "18020", "18022", "18021"] }, act: quest("fail"), expect: progressOn("19155", 1) },
  { line: "19159:A:2", name: "Shadow: +2 Attack", act: attack("f3", { shadow: "19159", undefended: true }), expect: stat("f3", "attack", (printedIn(ID, "f3")?.attack ?? 0) + 2) },
  { line: "19164:A:1", name: "When Revealed: either progress or an additional reveal", layout: { staging: FIGHT }, act: [resolve("19164", "whenRevealed"), answer("progress")], expect: progressOn("19155", 1) },
];
cardSpecs(ID, rows);

describe("card-spec", () => {
  it("reports an expectation that does not hold, and an action that cannot be played", () => {
    expect(rowProblems(ID, { ...rows[0]!, expect: stat("19157", "defense", 99) }, EFFECTS)).toEqual([`19157 defense is ${defense + 2}, not 99`]);
    expect(rowProblems(ID, { ...rows[3]!, act: [resolve("19164", "whenRevealed"), answer("nowhere")] }, EFFECTS)[0]).toMatch(/option nowhere is not offered/);
    expect(rowProblems(ID, { ...rows[1]!, act: quest("success") }, EFFECTS)[0]).toMatch(/meant to succeed/);
  });

  it("sees a row that still holds without its records", () => {
    const hollow: Row = { line: "19155:A:2", layout: { staging: FIGHT }, act: announce("endOfRound", undefined, { seat: null, phase: "End of round" }), expect: zone("19157", "staging") };
    expect(rowProblems(ID, hollow, EFFECTS)).toEqual([]);
    expect(rowProblems(ID, hollow, withoutLine(EFFECTS, hollow.line))).toEqual([]);
  });

  it("takes the records of a line out of a new list and leaves the shared one alone", () => {
    const before = EFFECTS.length;
    const kept = withoutLine(EFFECTS, "19155:A:2");
    expect(kept.length).toBeLessThan(before);
    expect(kept.some((effect) => effect.lines.includes("19155:A:2"))).toBe(false);
    expect(EFFECTS).toHaveLength(before);
    expect(EFFECTS.some((effect) => effect.lines.includes("19155:A:2"))).toBe(true);
  });
});
