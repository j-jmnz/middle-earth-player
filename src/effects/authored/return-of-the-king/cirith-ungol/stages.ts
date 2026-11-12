import type { Effect } from "../../../../catalog/boundary.ts";

import { EACH_PLAYER } from "../pelennor/shared.ts";
import { CONSIDERED_ENGAGED, DISCARD_UNTIL_ENEMY_OR_COPY, LAST_OF_THE_COMPANY, ONE_RING, QUEST_PHASE, STAGE_2, TOPMOST_CHAMBER, WATCHERS_ENEMY, WATCHERS_IN_PLAY, WATCHERS_IN_STAGING, WATCHERS_LOCATION } from "./shared.ts";

// Records for the quest stages of The Tower of Cirith Ungol (146066 to 146068). The cards the quest card's piles place (Shagrat set aside, The Two Watchers and Topmost Chamber in the staging area) are dealt by the data; no record places them.
// Every line is read from the scan ledger (data/printed/the-return-of-the-king.json). See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.setting-up-the-game, mec113.the-one-ring, mec113.saga-staging-rules, mec113.immune-to-player-card-effects, rr.guarded, rr.objective-cards, rr.quest-advancement, rr.ownership-and-control, rr.engaged, rr.effects,
// rr.then, rr.lasting-effects, rr.travel, faq.progress-without-advancing, faq.last-encounter-card, faq.next-player (data/rules/entries.json).
export const STAGE_RECORDS: readonly Effect[] = [
  // 146066 Pass the Two Watchers (stage 1, 0 quest points). Setup (after the piles): the first player loses control of the Ring-bearer, which lies faceup under Topmost Chamber as a guarded objective, keeping its tokens and attachments (The One Ring goes with it first);
  // then he attaches Last of the Company to a hero he controls (the Ring-bearer is no longer one) and The One Ring to that hero.
  // Side B: each non-unique location in the staging area gets -1 Threat and cannot leave it (no travel to it, no effect moves it); The Two Watchers' enemy side is considered engaged with each player while it is in the staging area; the stage cannot be defeated while
  // The Two Watchers is in play (it has 0 quest points: the flag advancesWhenFreed advances it as soon as the Watchers leave play).
  {
    id: "146066:setup:1",
    cardCode: "146066",
    lines: ["146066:A:1"],
    timing: "setup",
    instructions: [
      { verb: "CaptureRingBearer", under: TOPMOST_CHAMBER, guarded: true },
      { verb: "SetAside", code: LAST_OF_THE_COMPANY },
      { verb: "Pick", pick: { type: "hero", control: "you", who: "firstPlayer" } },
      { verb: "AttachSetAside", code: LAST_OF_THE_COMPANY },
      { verb: "MoveAttachment", code: ONE_RING, to: "picked" },
    ],
  },
  {
    id: "146066:constant:1",
    cardCode: "146066",
    lines: ["146066:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: -1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, nonUnique: true } },
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, nonUnique: true } },
    ],
  },
  { id: "146066:constant:2", cardCode: "146066", lines: ["146066:B:2"], timing: "constant", instructions: CONSIDERED_ENGAGED },
  {
    id: "146066:constant:3",
    cardCode: "146066",
    lines: ["146066:B:3"],
    timing: "constant",
    condition: WATCHERS_IN_PLAY,
    instructions: [{ verb: "Restrict", what: "advance" }],
  },
  { id: "146066:constant:4", cardCode: "146066", lines: ["146066:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "advancesWhenFreed", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 146067 Fighting in the Tower (stage 2). When Revealed: the encounter discard pile is shuffled into the deck and cards are discarded until X enemies are discarded, X the number of players; each goes to the staging area. Side B: at the beginning of the quest phase cards are
  // discarded from the top of the encounter deck until an enemy is discarded; a copy of it in the staging area is discarded too, else it is added to the staging area. The stage cannot be defeated unless Topmost Chamber is in the victory display; the Ring-bearer, free of
  // encounters once Topmost Chamber is out of play, returns to the first player (FreeRingBearer, the settle loop).
  { id: "146067:whenRevealed:1", cardCode: STAGE_2, lines: ["146067:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }] },
  { id: "146067:forced:1", cardCode: STAGE_2, lines: ["146067:B:1"], timing: "forced", trigger: "beginningOfPhase", condition: QUEST_PHASE, instructions: DISCARD_UNTIL_ENEMY_OR_COPY },
  { id: "146067:constant:1", cardCode: STAGE_2, lines: ["146067:B:2"], timing: "constant", condition: { kind: "inVictory", code: TOPMOST_CHAMBER, is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "146067:constant:2", cardCode: STAGE_2, lines: ["146067:B:2"], timing: "constant", instructions: [{ verb: "FreeRingBearer" }] },

  // 146068 Escape from Cirith Ungol (stage 3). When Revealed: Last of the Company goes to the victory display (the hero it was on is no longer the Ring-bearer); The One Ring is attached to the Ring-bearer, which is exhausted; the first player moves The Two Watchers from the victory display
  // to the staging area, location side faceup; each other player reveals an encounter card. Side B: the players cannot travel to The Two Watchers (the location) unless the stage holds 12 progress; the enemy side gets +3 Threat and +3 Defense and is considered engaged with each
  // player; the stage cannot be defeated while The Two Watchers is in play, and defeating it wins the game.
  {
    id: "146068:whenRevealed:1",
    cardCode: "146068",
    lines: ["146068:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "card", control: "any", names: ["Last of the Company"] } },
      { verb: "AddToVictory", target: "picked" },
      { verb: "MoveAttachment", code: ONE_RING, to: "ringBearer" },
      { verb: "Pick", pick: { type: "hero", control: "any", trait: "Ring-bearer" } },
      { verb: "Exhaust", target: { kind: "picked" } },
      { verb: "ReturnFromVictory", code: WATCHERS_ENEMY, into: WATCHERS_LOCATION },
      EACH_PLAYER([{ verb: "RevealEncounter", when: { kind: "not", condition: { kind: "firstPlayer" } } }]),
    ],
  },
  { id: "146068:constant:1", cardCode: "146068", lines: ["146068:B:1"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 12 } }, instructions: [{ verb: "Restrict", what: "travel", location: WATCHERS_LOCATION }] },
  {
    id: "146068:constant:2",
    cardCode: "146068",
    lines: ["146068:B:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 3, until: "whileSourceInPlay", holders: WATCHERS_IN_STAGING },
      { verb: "ModifyStat", stat: "defense", amount: 3, until: "whileSourceInPlay", holders: WATCHERS_IN_STAGING },
      ...CONSIDERED_ENGAGED,
    ],
  },
  { id: "146068:constant:3", cardCode: "146068", lines: ["146068:B:3"], timing: "constant", condition: WATCHERS_IN_PLAY, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "146068:questResolution:1", cardCode: "146068", lines: ["146068:B:3"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },
];
