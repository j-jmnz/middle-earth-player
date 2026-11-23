// Rules: rr.attachment-cards, rr.engaged, rr.cannot (data/rules/entries.json).
// Cave-troll's and Old Stone-troll's attachment restrictions, read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { attachmentTargets } from "../../../rules/player/planning.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "escape-from-khazad-dum";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

// The table with the enemy and a stand-in f0 engaged with the first player and Forest Snare in his hand.
const snareTable = (enemy: string, effects: readonly Effect[]): LayoutTable => tableFromLayout(ID, { engaged: [enemy, "f0"], hand: [SNARE] }, { effects, extra: [SNARE] });

// The codes of the engaged enemies Forest Snare may be played on.
const snareTargets = (made: LayoutTable): string[] => attachmentTargets({ ...made.state, activeSeat: 0 }, idOf(made.state, SNARE), made.ctx).map((id) => made.state.cards[id]?.code ?? "").sort();

describe("Cave-troll (51318)", () => {
  // "Cannot have non-objective player card attachments." Forest Snare is a player attachment; an encounter card (the stand-in treachery) is not barred.
  lineSpec("51318:A:1", "Forest Snare cannot be attached to Cave-troll and can be to another engaged enemy, and an encounter card can be attached to it", (effects) => {
    const made = snareTable("51318", effects);
    expect(snareTargets(made)).toEqual(["f0"]);
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, "51318"), "treachery")).toBe(false);
  });
});

describe("Old Stone-troll (51321)", () => {
  // "Cannot have non-objective player card attachments." Forest Snare is a player attachment; an encounter card (the stand-in treachery) is not barred.
  lineSpec("51321:A:1", "Forest Snare cannot be attached to Old Stone-troll and can be to another engaged enemy, and an encounter card can be attached to it", (effects) => {
    const made = snareTable("51321", effects);
    expect(snareTargets(made)).toEqual(["f0"]);
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, "51321"), "treachery")).toBe(false);
  });
});
