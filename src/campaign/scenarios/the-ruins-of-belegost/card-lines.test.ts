// Rules: rr.attachment-cards, rr.cannot, rr.in-play-and-out-of-play (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-ruins-of-belegost.md (The Ruins of Belegost).
// The enemies' attachment bars, which a card-spec row cannot read (ledger data/printed/standalone-scenarios.json): Lurker of the Depths' "Cannot have attachments.", and "Cannot have player card
// attachments." on Nameless Cave Dweller and Old Stone Troll, on `attachBlocked`, the gate every attach passes. Each table is `tableFromLayout`; `lineSpec` runs the check again
// without the records of its line, where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-ruins-of-belegost";
const LURKER = "50616";
const CAVE_DWELLER = "50617";
const STONE_TROLL = "50618";

describe("the enemies that cannot have attachments (50616:A:1, 50617:A:1, 50618:A:1)", () => {
  // Lurker of the Depths cannot be engaged: it is read in the staging area, where it is considered engaged with each player (50616:A:3).
  lineSpec("50616:A:1", "no card can be attached to Lurker of the Depths, a player card or an encounter card", (effects) => {
    const made = tableFromLayout(SCENARIO, { staging: [LURKER] }, { effects });
    const lurker = idOf(made.state, LURKER);
    expect(attachBlocked(made.state, made.ctx, lurker, "attachment")).toBe(true);
    expect(attachBlocked(made.state, made.ctx, lurker, "treachery")).toBe(true);
  });

  for (const code of [CAVE_DWELLER, STONE_TROLL]) {
    lineSpec(`${code}:A:1`, "a player card cannot be attached to it, in the staging area or engaged, and an encounter card can", (effects) => {
      for (const where of ["staging", "engaged"] as const) {
        const made = tableFromLayout(SCENARIO, { [where]: [code] }, { effects });
        const enemy = idOf(made.state, code);
        expect(attachBlocked(made.state, made.ctx, enemy, "attachment"), where).toBe(true);
        expect(attachBlocked(made.state, made.ctx, enemy, "treachery"), where).toBe(false);
      }
    });
  }
});
