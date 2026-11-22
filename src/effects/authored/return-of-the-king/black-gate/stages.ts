import type { Effect, Instruction } from "../../../../catalog/boundary.ts";

import { BLACK_GATE_TOKENS, EACH_PLAYER, GWAIHIR, STAGE_1, STAGE_2 } from "./shared.ts";

// Records for the quest stages of The Black Gate Opens (146072, 146073). The cards the quest card's piles place (The Black Gate and The Mouth of Sauron in the staging area, Gwaihir set aside) are dealt by the data; no record places them.
// Dire is a keyword the data reads from each stage. Every line is read from the scan ledger (data/printed/the-return-of-the-king.json). See docs/scenarios/the-return-of-the-king.md, The Return of the King, for each reading.
// Rules: mec113.dire, mec113.saga-staging-rules, rr.in-player-order, rr.first-player, rr.cancel, rr.search, rr.quest-advancement, faq.progress-without-advancing (data/rules/entries.json).

// 146072:B:1, the Embassy from the Dark Tower. The players place faceup cards (four in all, round robin); four encounter cards lie faceup; each player card, from the highest cost down, is paired with the highest Threat encounter card left (the first player decides a tie: each Pick is his);
// for each pair, in that order, the first player chooses to discard both or to reveal the encounter card and play the player card at no cost (its owner plays it). The play is offered only when the card could be played; with just one choice it is made without asking.
const PAIRS = 4;
const EMBASSY: Instruction[] = [
  { verb: "EmbassyDeal", cards: PAIRS },
  {
    verb: "Repeat",
    times: PAIRS,
    instructions: [
      { verb: "Pick", pick: { type: "card", control: "any", embassy: "player", highestCost: true, who: "firstPlayer" } },
      { verb: "Pick", pick: { type: "card", control: "any", embassy: "encounter", highestThreat: true, who: "firstPlayer" } },
      { verb: "EmbassyPair" },
    ],
  },
  {
    verb: "Repeat",
    times: PAIRS,
    instructions: [
      { verb: "EmbassyNext" },
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "discard", requires: { kind: "embassy", is: "pair" }, instructions: [{ verb: "EmbassyDiscard" }] },
          { id: "play", requires: { kind: "embassy", is: "playable" }, instructions: [{ verb: "EmbassyReveal" }, { verb: "PlayRevealedFree", embassy: true }] },
        ],
      },
    ],
  },
  { verb: "EmbassyEnd" },
];

export const STAGE_RECORDS: readonly Effect[] = [
  // 146072 Embassy from the Dark Tower (stage 1, 0 quest points: it advances with the first progress it takes).
  { id: "146072:setup:1", cardCode: STAGE_1, lines: ["146072:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
  { id: "146072:whenRevealed:1", cardCode: STAGE_1, lines: ["146072:B:1"], timing: "whenRevealed", instructions: EMBASSY },

  // 146073 The Battle of the Morannon (stage 2). When Revealed: each player, the first player first, searches the encounter deck and discard pile for a different Orc, Troll or Nazgûl enemy and adds it to the staging area; Gwaihir, set aside, is shuffled into the encounter deck.
  // Side B: the first player's reveal of the staging step is replaced by one reveal for each resource on The Black Gate (the others reveal as usual); a Forced effect discards the active location after an unsuccessful quest; the stage cannot be defeated.
  {
    id: "146073:whenRevealed:1",
    cardCode: STAGE_2,
    lines: ["146073:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER([{ verb: "SearchMove", traits: ["Orc", "Troll", "Nazgûl"], type: "enemy", to: "staging", different: true }]), { verb: "ShuffleSetAsideIntoEncounterDeck", code: GWAIHIR }],
  },
  {
    id: "146073:constant:1",
    cardCode: STAGE_2,
    lines: ["146073:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "firstPlayerReveals", amount: 1, until: "whileSourceInPlay", target: "table" },
      { verb: "ModifyStat", stat: "firstPlayerRevealCount", amount: BLACK_GATE_TOKENS, until: "whileSourceInPlay", target: "table" },
    ],
  },
  { id: "146073:forced:1", cardCode: STAGE_2, lines: ["146073:B:2"], timing: "forced", trigger: "questFailed", instructions: [{ verb: "Discard", target: { kind: "activeLocation" } }] },
  { id: "146073:constant:2", cardCode: STAGE_2, lines: ["146073:B:3"], timing: "constant", instructions: [{ verb: "Restrict", what: "advance" }] },
];
