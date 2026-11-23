// Rules: rr.attachment-cards, rr.engaged, rr.cannot (data/rules/entries.json).
// The Lord of the Dead's attachment restriction, read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { attachTargetCodes, engagedHandTable } from "../../../../test/harness/scene-kit.ts";

const ID = "the-stone-of-erech";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

// The table with the enemy and a stand-in f0 engaged with the first player and Forest Snare in his hand.

// The codes of the engaged enemies Forest Snare may be played on.

describe("The Lord of the Dead (50305)", () => {
  // "Cannot have attachments."
  lineSpec("50305:A:1", "Forest Snare can be played on another engaged enemy and not on The Lord of the Dead", (effects) => {
    expect(attachTargetCodes(engagedHandTable(ID, SNARE, "50305", effects), SNARE)).toEqual(["f0"]);
  });
});
