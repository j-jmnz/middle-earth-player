// Rules: dwd.ambush, rr.engagement-check, rr.engaged, rr.reveal, rr.search, rr.guarded, rr.explored (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, cardSpecs, exhausted, flag, reveal, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Road to Rivendell (dwarrowdelf part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). Build wrote the rows for the mechanics it added (Ambush's checks, Goblin Gate's gained ambush, Barren Hills,
// Orc Ambush, Goblin Gate's live quest points); Finish writes the rest. The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense; the first player's threat is the layout's first number.
const ROWS: readonly Row[] = [
  // 04043 Goblin Gate: while it is the active location the round's first enemy revealed from the deck gains ambush, so Crebain (cost 35, no ambush of its own) engages a first player with threat 40.
  { line: "04043:A:1", name: "the first enemy revealed gains ambush and engages the first player", layout: { active: "04043", deck: ["f0"], threat: [40, 0] }, act: reveal("04051"), expect: [zone("04051", "engaged"), flag("04051", "gainsAmbush")] },

  // 04045 Barren Hills: while active the ambush keyword has no effect.
  { line: "04045:A:1", name: "an enemy with ambush is not checked and stays in the staging area", layout: { active: "04045", threat: [40, 0] }, act: reveal("04049"), expect: zone("04049", "staging") },

  // 04048 Orc Ambush: every Orc in the staging area engages the first player; with none there the Orcs of the discard pile return to the staging area.
  { line: "04048:A:2", name: "each Orc enemy in the staging area engages the first player, whatever its engagement cost", layout: { staging: ["04049", "04050"], deck: ["f0"], threat: [0, 0] }, act: reveal("04048"), expect: [zone("04049", "engaged"), zone("04050", "engaged")] },
  { line: "04048:A:2", name: "with no Orc in the staging area every Orc enemy in the discard pile returns to it", layout: { discard: ["04049", "04050"], deck: ["f0"], threat: [0, 0] }, act: reveal("04048"), expect: [zone("04049", "staging"), zone("04050", "staging")] },

  // 04046 Sleeping Sentry: every ready character exhausts.
  { line: "04046:A:1", name: "every ready character is exhausted", layout: { deck: ["f0"] }, act: reveal("04046"), expect: [exhausted("dh1"), exhausted("dh2")] },

  // 901402 Ambush in the Night: Goblin Gate's quest points grow by 1 for each enemy engaged with a player.
  { line: "901402:B:2", name: "Goblin Gate gets 1 more quest point for each enemy engaged with a player", layout: { stage: "901402", side: "B", active: "04043", engaged: ["04049", "04050"] }, act: announce("engaged", "04049"), expect: stat("04043", "questPoints", 6) },
  { line: "901402:B:2", name: "a Goblin Gate whose progress equals its quest points once an engaged enemy leaves is explored at once", layout: { stage: "901402", side: "B", active: { code: "04043", progress: 4 }, engaged: ["04049"], deck: ["f0"], threat: [0, 0] }, act: reveal("901409"), expect: zone("04043", "encounterDiscard") },
];

if (ROWS.length > 0) cardSpecs("road-to-rivendell", ROWS);
else describe("road-to-rivendell card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));

