// Rules: rr.attachment-cards, rr.engaged, rr.cannot (data/rules/entries.json).
// Daechanar's "Cannot have attachments.", read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { attachmentTargets } from "../../../rules/player/planning.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-dread-realm";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

// The codes of the engaged enemies Forest Snare in the first player's hand may be played on, with the enemy and a stand-in f0 engaged with him.
function snareTargets(enemy: string, effects: readonly Effect[]): string[] {
  const made = tableFromLayout(ID, { engaged: [enemy, "f0"], hand: [SNARE] }, { effects, extra: [SNARE] });
  return attachmentTargets({ ...made.state, activeSeat: 0 }, idOf(made.state, SNARE), made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();
}

describe("Daechanar (10153)", () => {
  // "Cannot have attachments."
  lineSpec("10153:A:1", "Forest Snare can be played on another engaged enemy and not on Daechanar", (effects) => {
    expect(snareTargets("10153", effects)).toEqual(["f0"]);
  });
});
