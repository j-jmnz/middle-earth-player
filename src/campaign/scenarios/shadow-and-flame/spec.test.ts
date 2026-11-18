// Rules: dwd.durins-bane, rr.forced, rr.reveal, rr.shadow-effects, rr.attachment-cards, rr.cancel, rr.quest-phase, rr.active-location, rr.refresh-phase, rr.winning-the-game (data/rules/entries.json).
import { describe, it } from "vitest";

import { attack, cardSpecs, reveal, zone, type Row } from "../../../../test/harness/card-spec.ts";

const ROWS: readonly Row[] = [
  { line: "04148:A:1", name: "each player discards 1 attachment he controls", layout: { staging: ["04150"], attached: [{ code: "attachment", to: "dh1" }] }, act: [reveal("04145"), reveal("04148")], expect: zone("attachment", "discard") },
  { line: "04148:A:2", name: "Shadow: Durin's Bane makes the defending player discard every attachment he controls, never Counter-Spell", layout: { engaged: [{ code: "04150", seat: 0 }], attached: [{ code: "04145", to: "04150" }, { code: "attachment", to: "dh2" }] }, act: attack("04150", { shadow: "04148" }), expect: [zone("04145", "play"), zone("attachment", "discard")] },
];

if (ROWS.length > 0) cardSpecs("shadow-and-flame", ROWS);
else describe("shadow-and-flame card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
