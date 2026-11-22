// Rules: rr.attachment-cards, rr.engaged, rr.cannot (data/rules/entries.json).
// The Lord of the Dead's attachment restriction, read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { attachmentTargets } from "../../../rules/player/planning.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "the-stone-of-erech";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

// The table with the enemy and a stand-in f0 engaged with the first player and Forest Snare in his hand.
const snareTable = (enemy: string, effects: readonly Effect[]): LayoutTable => tableFromLayout(ID, { engaged: [enemy, "f0"], hand: [SNARE] }, { effects, extra: [SNARE] });

// The codes of the engaged enemies Forest Snare may be played on.
const snareTargets = (made: LayoutTable): string[] => attachmentTargets({ ...made.state, activeSeat: 0 }, idOf(made.state, SNARE), made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();

describe("The Lord of the Dead (50305)", () => {
  // "Cannot have attachments."
  lineSpec("50305:A:1", "Forest Snare can be played on another engaged enemy and not on The Lord of the Dead", (effects) => {
    expect(snareTargets(snareTable("50305", effects))).toEqual(["f0"]);
  });
});
