// Rules: rr.reveal, rr.staging, rr.damage, rr.ranged, rr.running-out-of-cards, dwd.book-of-mazarbul, dwd.revealing-enemies (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, damageOn, resolve, resourcesOn, reveal, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Seventh Level (dwarrowdelf part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
const ROWS: readonly Row[] = [
  { line: "03032:A:3", name: "an enemy revealed from the encounter deck, Goblin Archer itself included, has the first player damage a character he controls", layout: { deck: ["f0"] }, act: reveal("03032"), expect: [damageOn("dh1", 1)] },
  { line: "03067:A:1", name: "the Book is attached to a hero of the first player's choice at Setup", layout: { stage: "03067", deck: ["03024", "f0"] }, act: resolve("03067", "setup"), expect: [zone("03024", "attached")] },
  { line: "03024:A:2", name: "a hero exhausts to claim the Book from the staging area", layout: { staging: ["03024"] }, act: resolve("03024", "action"), expect: [zone("03024", "attached")] },
  { line: "03068:B:1", name: "the Book leaves the game from the staging area", layout: { stage: "03068", staging: ["03024"] }, act: resolve("03068", "whenRevealed"), expect: [zone("03024", "removed")] },
  { line: "901107:A:1", name: "a Goblin revealed while Deep-Mines is in the staging area gets 1 resource", layout: { staging: ["901107"], deck: ["f0"] }, act: reveal("03031"), expect: [resourcesOn("03031", 1)] },
  { line: "901105:A:1", name: "Goblin Skirmisher gives +1 Attack for each resource once however many copies are in play", layout: { staging: ["901105", "901105", { code: "03031", resources: 2 }] }, act: [], expect: [stat("03031", "attack", 4)] },
];

if (ROWS.length > 0) cardSpecs("the-seventh-level", ROWS);
else describe("the-seventh-level card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
