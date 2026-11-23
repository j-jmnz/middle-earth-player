// Rules: rr.attachment-cards, rr.engaged (data/rules/entries.json).
// Orc War Party's "Cannot have attachments.", read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { attachTargetCodes, engagedHandTable } from "../../../../test/harness/scene-kit.ts";

const ID = "intruders-in-chetwood";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

// The codes of the engaged enemies Forest Snare in the first player's hand may be played on, with the enemy and a stand-in f0 engaged with him.

describe("Orc War Party (09017)", () => {
  // "Cannot have attachments."
  lineSpec("09017:A:1", "Forest Snare can be played on another engaged enemy and not on Orc War Party", (effects) => {
    expect(attachTargetCodes(engagedHandTable(ID, SNARE, "09017", effects), SNARE)).toEqual(["f0"]);
  });
});
