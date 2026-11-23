// Rules: rr.attachment-cards, rr.cannot, rr.in-play-and-out-of-play (data/rules/entries.json); docs/scenarios/standalone-scenarios/murder-at-the-prancing-pony.md (Murder at the Prancing Pony).
// The Suspects' "Cannot have attachments.", which a card-spec row cannot read for a player card: `attachBlocked` is the gate every attach
// of a player card passes. Hired Muscle ("Attach to a Brigand enemy without a copy of Hired Muscle attached and return that enemy to the staging area") is the encounter card that
// attaches to a Brigand, and every Suspect is a Brigand. Each table is `tableFromLayout`; `lineSpec` runs the check again without the records of its line, where it must fail. Each test title starts with the line id it tests.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { count, reveal, rowProblems, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "murder-at-the-prancing-pony";
// Todd the Troll, Susie the Spider, Wolf-pelt Jake, Johnny Goblin-fingers, Old Orc-eyes.
const SUSPECTS = ["50709", "50710", "50711", "50712", "50713"] as const;
const HIRED_MUSCLE = "50726";
const LAWLESS_RUFFIAN = "50723";
const F0 = ["f0", "f0", "f0", "f0"];

describe("Cannot have attachments (50709:A:1, 50710:A:1, 50711:A:1, 50712:A:1, 50713:A:1)", () => {
  for (const code of SUSPECTS) {
    lineSpec(`${code}:A:1`, "a player attachment cannot attach to the Suspect, in the staging area or engaged", (effects) => {
      const staged = tableFromLayout(SCENARIO, { staging: [code] }, { effects });
      expect(attachBlocked(staged.state, staged.ctx, idOf(staged.state, code), "attachment")).toBe(true);
      const engaged = tableFromLayout(SCENARIO, { engaged: [code] }, { effects });
      expect(attachBlocked(engaged.state, engaged.ctx, idOf(engaged.state, code), "attachment")).toBe(true);
    });
  }

  for (const code of SUSPECTS) {
    const row: Row = { line: `${code}:A:1`, layout: { engaged: [code], deck: F0 }, act: reveal(HIRED_MUSCLE), expect: [count(HIRED_MUSCLE, "attached", 0), zone(code, "engaged")] };
    it(`${code}:A:1 Hired Muscle cannot attach to the Suspect, which stays engaged`, () => {
      expect(rowProblems(SCENARIO, row, EFFECTS)).toEqual([]);
    });
  }

  it("50709:A:1 with another Brigand engaged Hired Muscle attaches to it and returns it, not Todd the Troll", () => {
    const row: Row = { line: "50709:A:1", layout: { engaged: ["50709", LAWLESS_RUFFIAN], deck: F0 }, act: reveal(HIRED_MUSCLE), expect: [count(HIRED_MUSCLE, "attached", 1), zone(LAWLESS_RUFFIAN, "staging"), zone("50709", "engaged")] };
    expect(rowProblems(SCENARIO, row, EFFECTS)).toEqual([]);
  });
});
