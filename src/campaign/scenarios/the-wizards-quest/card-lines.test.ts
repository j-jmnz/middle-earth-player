// Rules: rr.attachment-cards, rr.cannot (data/rules/entries.json).
// Twilight Hall's "Cannot have attachments.", read on a table built from a layout (tableFromLayout) and run again without the records of its line (lineSpec), where it must fail. Each test title starts with the line id it tests.
import { describe, expect } from "vitest";

import { attachmentTargets } from "../../../rules/player/planning.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-wizards-quest";
const HALL = "51019";
// Power in the Earth (01056): "Attach to a location."
const POWER = "01056";

describe("Twilight Hall (51019)", () => {
  // "Cannot have attachments."
  lineSpec("51019:A:1", "Power in the Earth can be played on another location in the staging area and not on Twilight Hall", (effects) => {
    const made = tableFromLayout(ID, { staging: [HALL, "place"], hand: [POWER] }, { effects, extra: [POWER] });
    const targets = attachmentTargets({ ...made.state, activeSeat: 0 }, idOf(made.state, POWER), made.ctx).map((id) => made.state.cards[id]?.code);
    expect(targets).toEqual(["place"]);
  });
});
