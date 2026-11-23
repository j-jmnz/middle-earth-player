// Rules: rr.attachment-cards, rr.engaged, rr.cannot (data/rules/entries.json).
// Stuart's attachment restriction, read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { attachTargetCodes, engagedHandTable, idOf } from "../../../../test/harness/scene-kit.ts";

const ID = "conflict-at-the-carrock";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

// The table with the enemy and a stand-in f0 engaged with the first player and Forest Snare in his hand.

// The codes of the engaged enemies Forest Snare may be played on.

describe("Stuart (900507)", () => {
  // "Cannot have player attachments." Forest Snare is a player attachment; an encounter card (the stand-in treachery) is not barred.
  lineSpec("900507:A:1", "Forest Snare cannot be attached to Stuart and can be to another engaged enemy, and an encounter card can be attached to it", (effects) => {
    const made = engagedHandTable(ID, SNARE, "900507", effects);
    expect(attachTargetCodes(made, SNARE)).toEqual(["f0"]);
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, "900507"), "treachery")).toBe(false);
  });
});
