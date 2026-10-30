import type { Effect } from "../../catalog/boundary.ts";

// Records for the first two stages of Breaking of the Fellowship (scenario 6, campaign card 142060) and the stage 3 cards' Setup-like Forced effect that
// the separate staging areas need (phase 16a); the rest of the stage 3 and 4 cards, the encounter cards and the campaign card are phase 16b and 16c. Every line is
// read from the scan ledger (data/printed/fellowship-of-the-ring.json). The breaking family (src/catalog/families/breaking.ts) is the vocabulary the scenario adds:
// removing the Ring-bearer from the game, skipping the travel phase, and the staging area and quest stage each player has from stage 2B. 142061:B:2 (the players cannot
// advance while The Argonath is in play) is read by the template (src/effects/generated/fellowship-of-the-ring.ts).
// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.removed-from-game, rr.quest-advancement, rr.engagement-check, rr.travel, rr.step-4-2,
// rr.first-player, rr.the-word-choose (data/rules/entries.json).
const SEAT_OF_SEEING = "142074";
const FRODOS_CHOICE = "142068";
const STAGES_3A = ["142063", "142064", "142065", "142066"] as const;

// "Forced: After stage 2B is discarded, if the total Threat of encounter cards in this staging area is less than 4, reveal 1 encounter card." (the same line on
// each of the four stage 3A cards): the seat whose stage it is reveals.
const SMALL_AREA_REVEALS = (code: string): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "forced",
  trigger: "stageDiscarded",
  condition: { kind: "stagingThreat", max: 3 },
  instructions: [{ verb: "RevealEncounter" }],
});

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 142061 The Great River. Setup: the piles set Frodo's Choice, Seat of Seeing and Parth Galen aside and put The Argonath and Sarn Gebir in the staging area (the scenario
  // data's piles), so the record has nothing left to do. 1B: enemies get +2 Defense and cannot be engaged; the encounter phase is skipped (the table flag skipEncounter).
  { id: "142061:setup:1", cardCode: "142061", lines: ["142061:A:1"], timing: "setup", instructions: [] },
  {
    id: "142061:constant:2",
    cardCode: "142061",
    lines: ["142061:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", target: "enemies" },
      { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "enemies" },
      { verb: "ModifyStat", stat: "skipEncounter", amount: 1, until: "whileSourceInPlay", target: "table" },
    ],
  },

  // 142062 The Company Divided. 2A: the Ring-bearer and each card attached to it leave the game (The One Ring's text is blank, so its loss line does not fire), each
  // enemy's engagement cost is 0 until the end of the encounter phase, and the travel phase is skipped this round.
  {
    id: "142062:whenRevealed:1",
    cardCode: "142062",
    lines: ["142062:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "RemoveRingBearer" }, { verb: "ZeroEngagementCosts" }, { verb: "SkipTravelPhase" }],
  },
  // 2B: at the end of the refresh phase Seat of Seeing and Frodo's Choice are shuffled into the encounter discard pile, which goes under the encounter deck; each player,
  // first player first, creates a staging area and a stage of their own, a different one of the four stage 3A (one player has the choice of all four); in player order each
  // moves a card of the shared staging area to their own until none are left; then 2B is discarded and each stage 3A hears it.
  {
    id: "142062:forced:1",
    cardCode: "142062",
    lines: ["142062:B:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Refresh" },
    instructions: [
      { verb: "ShuffleSetAsideIntoDiscard", codes: [SEAT_OF_SEEING, FRODOS_CHOICE] },
      { verb: "PlaceDiscardUnderDeck" },
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [{ verb: "Choose", who: "actor", different: true, options: STAGES_3A.map((code) => ({ id: code, instructions: [{ verb: "StartSeparateStage", code }] })) }],
      },
      { verb: "DealOutStaging" },
      { verb: "DiscardSharedStage" },
    ],
  },

  // 142063 Searching the Woods, 142064 Guard the Hobbits, 142065 The Seat of Amon Hen, 142066 Orc Hunting: 3A reveals a card for its seat when its area is small.
  ...STAGES_3A.map(SMALL_AREA_REVEALS),
];

export const AUTHORED_REPLACES: readonly string[] = [];
