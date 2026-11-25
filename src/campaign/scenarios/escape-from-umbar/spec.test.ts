// Rules: hrd.setup-escape-from-umbar, hrd.side-quests, hrd.current-quest, rr.forced, rr.travel, rr.then, rr.cannot, rr.engaged, rr.shadow-effects (data/rules/entries.json); ledger lines of Escape from Umbar (data/printed/haradrim.json).
import { describe, it } from "vitest";

import { attack, cardSpecs, defend, progressOn, resolve, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Escape from Umbar (haradrim part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). What a row cannot express is a test titled with its line id in lines.test.ts.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28.
const STAGE_1 = "16066";
const SOLDIER = "16042";

const ROWS: readonly Row[] = [
  // 16014:A:1 "Forced: After an enemy attacks and destroys a character, remove X progress from the main quest, X is the attacking enemy's Threat." The Soldier has Threat 3 and kills the ally defending.
  { line: "16014:A:1", name: "Forced: an enemy that destroys a character takes progress off the main quest equal to its Threat", layout: { stage: STAGE_1, progress: 5, staging: ["16014"], engaged: [SOLDIER], play: ["ally"], deck: ["f0"] }, act: [attack(SOLDIER), defend("ally")], expect: progressOn(STAGE_1, 2) },
];

if (ROWS.length > 0) cardSpecs("escape-from-umbar", ROWS);
else describe("escape-from-umbar card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
