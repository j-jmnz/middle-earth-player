// Rules: rr.attachment-cards, rr.cannot, rr.in-play-and-out-of-play (data/rules/entries.json).
// Uglúk's "Toughness 3. Cannot have attachments." (the keyword is the card's, the records cover the bar), which a card-spec row cannot read: `attachBlocked` is the gate every attach passes.
// Each table is `tableFromLayout`; `lineSpec` runs the check again without the records of its line, where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-uruk-hai";
const UGLUK = "143023";

describe("Uglúk (143023:A:1)", () => {
  lineSpec("143023:A:1", "no card can be attached to Uglúk, a player card or an encounter card, in the staging area or engaged", (effects) => {
    for (const where of ["staging", "engaged"] as const) {
      const made = tableFromLayout(SCENARIO, { [where]: [UGLUK] }, { effects });
      const ugluk = idOf(made.state, UGLUK);
      expect(attachBlocked(made.state, made.ctx, ugluk, "attachment"), where).toBe(true);
      expect(attachBlocked(made.state, made.ctx, ugluk, "treachery"), where).toBe(true);
    }
  });
});
