// Rules: mec108.safe, mec108.objective-locations, mec108.side-quests-in-play, rr.guarded, rr.travel, rr.reveal, rr.forced, rr.response, rr.running-out-of-cards, mec108.objective-allies, mec108.immune (data/rules/entries.json).
import { describe, it } from "vitest";

import { cardSpecs, drew, endPhase, resolve, resourcesOn, respond, reveal, revealedBy, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Across the Ettenmoors (angmar-awakened part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot express (the Setup pair, a safe location over a whole round, a damage rule over several steps, a pool) is a test
// titled with its line id in safe.test.ts, behaviour.test.ts, encounter.test.ts, stages.test.ts and pool.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28.
const SECLUDED_CAVE = "10068";
const ABANDONED_CAMP = "10070";
const PATCH_OF_WOODS = "10071";
const STAGE_3 = "10066";
const DECK = ["f0", "f0", "f0", "f0"];

const ROWS: readonly Row[] = [
  { line: "10066:A:1", name: "When Revealed: the discard pile is shuffled into the encounter deck and cards are discarded until a side quest is discarded, which is revealed and added to the staging area", layout: { stage: STAGE_3, discard: ["f0"], deck: ["f3", "10082", "f0"] }, act: resolve(STAGE_3, "whenRevealed"), expect: zone("10082", "staging") },

  { line: "10068:A:3", name: "Response after you travel to it: each player draws 3 cards", layout: { phase: "Travel", staging: [SECLUDED_CAVE], deckOf: ["filler", "filler", "filler", "filler", "filler"] }, act: [travel(SECLUDED_CAVE), respond(SECLUDED_CAVE)], expect: drew(3) },

  { line: "10070:A:1", name: "Safe: when the players travel to it every engaged enemy returns to the staging area", layout: { phase: "Travel", staging: [ABANDONED_CAMP], engaged: ["f3"] }, act: travel(ABANDONED_CAMP), expect: zone("f3", "staging") },
  { line: "10071:A:3", name: "Response after you travel to it: each player adds 1 resource to each of their heroes", layout: { phase: "Travel", staging: [PATCH_OF_WOODS], heroResources: 0 }, act: resolve(PATCH_OF_WOODS, "response"), expect: resourcesOn("dh1", 1) },
  { line: "10071:A:1", name: "Guarded: when it is revealed the next card of the encounter deck is revealed and attached to it as its guard", layout: { deck: ["f3", "f0"] }, act: reveal(PATCH_OF_WOODS), expect: revealedBy("f3", 0) },
  { line: "10071:A:1", name: "Safe: while it is the active location enemies make no engagement checks", layout: { phase: "Encounter", active: PATCH_OF_WOODS, staging: ["10076"], deck: DECK }, act: endPhase, expect: zone("10076", "staging") },
];

if (ROWS.length > 0) cardSpecs("across-the-ettenmoors", ROWS);
else describe("across-the-ettenmoors card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
