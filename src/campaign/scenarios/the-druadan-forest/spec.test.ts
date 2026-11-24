// Rules: rr.reveal, rr.staging, rr.defending-player, rr.keywords, rr.resource-match (data/rules/entries.json). The lines that need a played Setup, a stage 3, a Prowl, a shadow or a payment are the tests of the files beside this one (setup.test.ts, prowl.test.ts, stage-three.test.ts, shadows.test.ts, payments.test.ts, places.test.ts).
import { describe, it } from "vitest";

import { cardSpecs, deckCount, resolve, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Drúadan Forest (against-the-shadow part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points;
// `f0` and `f3` are enemies of Attack 1 and Defense 1 (Threat 0 and 3).
const PURSUIT = "06042";
const DRUMMER = "06046";
const THIEF = "06049";

const ROWS: readonly Row[] = [
  { line: "06042:B:1", name: "When Revealed: 1 card from the encounter deck is revealed and added to the staging area for a single player", layout: { stage: PURSUIT, deck: ["f3", "f0", "f0"] }, act: resolve(PURSUIT, "whenRevealed"), expect: [zone("f3", "staging"), deckCount(2)] },
  { line: "06042:B:1", name: "When Revealed: 2 cards, one for each player, for two players", layout: { seats: 2, stage: PURSUIT, deck: ["f3", "f0", "f0"] }, act: resolve(PURSUIT, "whenRevealed"), expect: [zone("f3", "staging"), deckCount(1)] },


  { line: "06046:A:1", name: "Each Wose enemy in the staging area gets +2 Threat, the Drummer itself included, and an enemy that is no Wose does not", layout: { staging: [DRUMMER, THIEF, "f3"] }, act: [], expect: [stat(DRUMMER, "threat", 2), stat(THIEF, "threat", 4), stat("f3", "threat", 3)] },
  { line: "06046:A:1", name: "Two Drummers add up: a Wose in the staging area gets +4 Threat", layout: { staging: [DRUMMER, DRUMMER, THIEF] }, act: [], expect: stat(THIEF, "threat", 6) },
];

if (ROWS.length > 0) cardSpecs("the-druadan-forest", ROWS);
else describe("the-druadan-forest card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
