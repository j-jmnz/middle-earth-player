// Rules: rr.reveal, rr.staging, rr.travel, rr.victory, rr.first-player, dwd.caradhras, faq.lasting-effects, faq.progress-without-advancing (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, cardSpecs, committed, resourcesOn, reveal, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Redhorn Gate (dwarrowdelf part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
// The Build task wrote the rows that show the moments a new verb or flag needs; Finish writes the rest.
const ROWS: readonly Row[] = [
  // 04012 Snowdrifts: Caradhras becomes the active location from the staging area, the victory display, or the encounter deck; the active location it replaces is discarded.
  { line: "04012:B:2", name: "the active location is discarded and Caradhras becomes the active location from the staging area", layout: { stage: "04012", active: "place", staging: ["04015"] }, act: announce("questCardDefeated", "04012"), expect: [zone("04015", "activeLocation"), zone("place", "encounterDiscard")] },
  { line: "04012:B:2", name: "Caradhras comes back from the victory display", layout: { stage: "04012", active: "place", victory: ["04015"] }, act: announce("questCardDefeated", "04012"), expect: [zone("04015", "activeLocation"), zone("place", "encounterDiscard")] },
  { line: "04012:B:2", name: "Caradhras is searched out of the encounter deck when it lies there", layout: { stage: "04012", active: "place", deck: ["f0", "04015"] }, act: announce("questCardDefeated", "04012"), expect: [zone("04015", "activeLocation"), zone("place", "encounterDiscard")] },

  // 04016 Fanuidhol: when the quest total is counted the controller of each committed hero with a resource chooses whether to spend 1 from its pool.
  { line: "04016:A:1", name: "a hero that pays spends 1 resource from its own pool and counts its Willpower", layout: { stage: "04011", active: "04016", heroResources: 2, committed: ["dh1", "dh2"] }, act: [announce("questTotalCounted"), answer("pay"), answer("keep")], expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 2), committed("dh1")] },

  // 901307 Blinding Blizzard stays in the staging area once revealed.
  { line: "901307:A:2", name: "Blinding Blizzard stays in the staging area after its When Revealed", layout: { deck: ["901307"] }, act: reveal("901307"), expect: zone("901307", "staging") },

  // 04020 Fell Voices: the Snow cards of the discard pile go on top of the deck.
  { line: "04020:A:1", name: "the top 2 Snow cards go on top in the order the first player chooses; with 1 Snow treachery among them it gains surge, so the top card is revealed", layout: { discard: ["04022", "04027", "f0"], deck: ["f3"] }, act: [reveal("04020"), answer("04027")], expect: [zone("04027", "staging"), zone("04022", "encounterDeck")] },
];

if (ROWS.length > 0) cardSpecs("the-redhorn-gate", ROWS);
else describe("the-redhorn-gate card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
