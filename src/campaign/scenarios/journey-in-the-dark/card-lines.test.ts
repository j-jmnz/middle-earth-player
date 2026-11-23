// Rules: mec109.setup-journey-in-the-dark, rr.burdens, rr.engaged, rr.engagement-check, rr.winning-the-game, rr.attachment-cards (data/rules/entries.json).
import { describe, it } from "vitest";

import { attack, cardSpecs, defend, endPhase, flag, notWon, progressOn, quest, resolve, stagingThreat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Journey in the Dark (The Fellowship of the Ring part 5) and its Nightmare deck: one row for each printed line a single action can show, on a table of plain-number heroes (dh1 and dh2: 2 Willpower,
// 2 Attack, 2 Defense, 6 hit points) and the stand-in ally (1 Willpower, 1 Defense, 2 hit points). `cardSpecs` runs each row again without the records of its line, where it must fail. The burdens' and the campaign
// card's Setup, the last stage's win and the attachments are in card-lines-scenes.test.ts.
const ROWS: readonly Row[] = [
  // 142041 Drums in the Deep A:1: "When Revealed: Add Chamber of Mazarbul to the staging area."
  { line: "142041:A:1", name: "the set-aside Chamber of Mazarbul joins the staging area", layout: { stage: "142041", side: "A", setAside: ["142051"] }, act: resolve("142041", "whenRevealed"), expect: zone("142051", "staging") },

  // 142042 The Bridge of Khazad-dûm B:2: "The players cannot defeat this stage while The Great Bridge is in play." 14 of its 15 quest points are on it; three allies and the heroes (7 Willpower) quest past the
  // Great Bridge's 5 Threat.
  { line: "142042:B:2", name: "the stage is not defeated while The Great Bridge is in the staging area", layout: { stage: "142042", progress: 14, staging: ["142050"], play: ["ally", "ally", "ally"], committed: ["ally"] }, act: quest("success"), expect: [notWon, zone("142042", "questStage")] },

  // 142044 The Balrog A:2: "While in the staging area, The Balrog is considered to be engaged with the first player and only the first player can declare attackers against The Balrog." It adds no Threat there
  // and no player engages it (docs/scenarios/fellowship-of-the-ring.md, Journey in the Dark, the Doom countdown and the Balrog).
  { line: "142044:A:2", name: "in the staging area the Balrog counts as engaged with the first player and adds no Threat", layout: { staging: ["142044"] }, act: [], expect: [flag("142044", "engagedWithFirst"), stagingThreat(0)] },
  { line: "142044:A:2", name: "an engagement check at a threat of 50 leaves the Balrog in the staging area", layout: { phase: "Encounter", staging: ["142044"], threat: [50, 0] }, act: endPhase, expect: zone("142044", "staging") },

  // 142046 Great Cave-troll A:2: "For each point of excess combat damage dealt by Great Cave-troll (damage that is dealt beyond the remaining hit points of the character damaged by its attack) remove 1 progress
  // from the current quest." Its 6 Attack against the ally's 1 Defense deals 5, 3 past the ally's 2 hit points.
  { line: "142046:A:2", name: "3 excess damage on a destroyed ally removes 3 progress from the current quest", layout: { progress: 5, play: ["ally"] }, act: [attack("142046"), defend("ally")], expect: [zone("ally", "discard"), progressOn("142040", 2)] },

  // 906502 Slab-bearer A:1: "Cannot have attachments."
  { line: "906502:A:1", name: "Slab-bearer cannot have attachments", layout: { staging: ["906502"] }, act: [], expect: flag("906502", "cannotHaveAttachments") },
];

if (ROWS.length > 0) cardSpecs("journey-in-the-dark", ROWS);
else describe("journey-in-the-dark card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
