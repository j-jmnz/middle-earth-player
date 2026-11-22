// Rules: rr.attachment-cards, rr.engaged, rr.cannot (data/rules/entries.json).
// Nazgûl of Mordor's and Gorgoroth Hill-troll's attachment restrictions, read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { attachmentTargets } from "../../../rules/player/planning.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "the-black-gate-opens";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";
// Hell-hawk (146036), a Morgul treachery.
const HELL_HAWK = "146036";

// The table with the enemy and a stand-in f0 engaged with the first player and Forest Snare in his hand.
const snareTable = (enemy: string, effects: readonly Effect[]): LayoutTable => tableFromLayout(ID, { engaged: [enemy, "f0"], hand: [SNARE] }, { effects, extra: [SNARE] });

// The codes of the engaged enemies Forest Snare may be played on.
const snareTargets = (made: LayoutTable): string[] => attachmentTargets({ ...made.state, activeSeat: 0 }, idOf(made.state, SNARE), made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();

describe("Nazgûl of Mordor (146032)", () => {
  // "Cannot have non-Morgul attachments." Forest Snare is an Item and Trap; Hell-hawk (146036) is a Morgul treachery that attaches to a Nazgûl enemy.
  lineSpec("146032:A:1", "Forest Snare cannot be attached to Nazgûl of Mordor and can be to another engaged enemy, and the Morgul Hell-hawk can be attached to it", (effects) => {
    const made = snareTable("146032", effects);
    expect(snareTargets(made)).toEqual(["f0"]);
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, "146032"), HELL_HAWK)).toBe(false);
  });
});

describe("Gorgoroth Hill-troll (146033)", () => {
  // "Cannot have attachments."
  lineSpec("146033:A:1", "Forest Snare can be played on another engaged enemy and not on Gorgoroth Hill-troll", (effects) => {
    expect(snareTargets(snareTable("146033", effects))).toEqual(["f0"]);
  });
});
