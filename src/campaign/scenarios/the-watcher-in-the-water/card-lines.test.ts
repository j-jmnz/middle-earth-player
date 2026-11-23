// Rules: rr.shadow-effects, rr.damage (data/rules/entries.json).
// Lines: 901505:A:2. Banks of Sirannon's Shadow when its attack deals no damage, which a card-spec row cannot hold alone (it holds without the records): it is checked with an attack that deals 1, and run again
// without the records of its line (lineSpec), where it must fail. The rows of spec.test.ts hold 1 and 2 damage.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { attack, defend, type Act } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const ID = "the-watcher-in-the-water";

// The cards left in the first player's hand of three after the actions.
function handAfter(act: readonly Act[], effects: readonly Effect[]): number {
  const { state } = play(ID, { line: "901505:A:2", layout: { hand: ["filler", "filler", "filler"] }, act, expect: [] }, effects, false).run;
  return state.seats[0]?.hand.length ?? -1;
}

describe("Banks of Sirannon (901505)", () => {
  // "Shadow: For each point of damage dealt by this attack, the defending player must discard a random card from his hand."
  lineSpec("901505:A:2", "an attack that deals no damage discards no card, one that deals 1 discards 1", (effects) => {
    // f0 (1 Attack) against dh1 (2 Defense) deals no damage.
    expect(handAfter([attack("f0", { shadow: "901505" }), defend("dh1")], effects)).toBe(3);
    expect(handAfter([attack("f0", { shadow: "901505", undefended: true })], effects)).toBe(2);
  });
});
