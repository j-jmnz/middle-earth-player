// Rules: rr.attachment-cards, rr.engaged, rr.cannot (data/rules/entries.json).
// Vanguard of Carn Dûm's "Cannot have attachments.", read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { attachTargetCodes, engagedHandTable } from "../../../../test/harness/scene-kit.ts";

const ID = "the-siege-of-annuminas";
// Forest Snare (01069): "Attach to an enemy engaged with a player."
const SNARE = "01069";

// The codes of the engaged enemies Forest Snare in the first player's hand may be played on, with the enemy and a stand-in f0 engaged with him.

describe("Vanguard of Carn Dûm (50828)", () => {
  // "Cannot have attachments."
  lineSpec("50828:A:1", "Forest Snare can be played on another engaged enemy and not on Vanguard of Carn Dûm", (effects) => {
    expect(attachTargetCodes(engagedHandTable(ID, SNARE, "50828", effects), SNARE)).toEqual(["f0"]);
  });
});
