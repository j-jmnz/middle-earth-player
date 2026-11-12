import { copyLine, type Copy } from "../../reprint.ts";
import type { Effect } from "../../../../catalog/boundary.ts";

import { EACH_PLAYER, QUEST_PHASE, type Cond } from "../black-gate/shared.ts";
import { EACH_PLAYER_TESTS, LAST_FORTITUDE_FAILED, LAST_FORTITUDE_PASSED, MORDOR_ROAD, STAGE_1, STAGE_2, STAGE_3, STAGE_4 } from "./shared.ts";

// Records for the quest stages of Mount Doom (146075 to 146078). The cards the quest card's piles place (Mount Doom and The Tower of Barad-dûr in the staging area, Brake of Thorns the active location, the four locations the players search for) are dealt by the data; no record places them.
// Dire is a keyword the data reads from each stage. Every line is read from the scan ledger (data/printed/the-return-of-the-king.json). See docs/brief.md, The Return of the King, for each reading.
// Rules: mec113.dire, mec113.fortitude-tests, mec113.saga-staging-rules, rr.in-player-order, rr.first-player, rr.search, rr.active-location, rr.travel, rr.quest-advancement, rr.cancel, faq.progress-without-advancing (data/rules/entries.json).
const MOUNT_DOOM_ACTIVE = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", names: ["Mount Doom"] } } satisfies Cond;

export const STAGE_RECORDS: readonly (Effect | Copy)[] = [
  // 146075 Stage 1. Setup: each player, in player order, searches the encounter deck for a different location and adds it to the staging area; the deck is shuffled. Side B (4 quest points): +4 quest points for each player; the first treachery revealed each quest phase is immune to player card effects and gains surge.
  { id: "146075:setup:1", cardCode: STAGE_1, lines: ["146075:A:1"], timing: "setup", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", different: true }]), { verb: "ShuffleEncounterDeck" }] },
  { id: "146075:constant:1", cardCode: STAGE_1, lines: ["146075:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { players: true, times: 4 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "146075:constant:2", cardCode: STAGE_1, lines: ["146075:B:2"], timing: "constant", instructions: [{ verb: "FirstTreacheryImmuneSurge" }] },

  // 146076 Stage 2 (no quest points: no progress can defeat it, only its own record advances it). When Revealed: Mordor Road is searched for in the encounter deck, discard pile and victory display and added to the staging area; the discard pile is shuffled into the deck; the players travel to Mordor Road
  // (only when no location is active: rr.active-location; the Forced of Mordor Road resolves if they do). Side B: after progress is placed here from questing successfully each player, in player order, makes a Fortitude test: a pass places a resource here, a failure discards cards until an enemy is discarded and puts it into play
  // engaged with that player. At the end of the quest phase, with at least as many resources here as there are players, the quest advances to stage 3.
  { id: "146076:whenRevealed:1", cardCode: STAGE_2, lines: ["146076:A:1"], timing: "whenRevealed", instructions: [{ verb: "SearchMove", code: MORDOR_ROAD, to: "staging", victory: true, remember: true }, { verb: "ShuffleEncounterDiscard" }, { verb: "TravelTo", target: "picked", unlessActive: true }] },
  {
    id: "146076:forced:1",
    cardCode: STAGE_2,
    lines: ["146076:B:1"],
    timing: "forced",
    trigger: "progressPlaced",
    subject: "self",
    condition: { kind: "all", conditions: [QUEST_PHASE, { kind: "questSucceeded" }] },
    instructions: [
      EACH_PLAYER_TESTS([
        { verb: "PlaceResourceTokens", amount: 1, on: "self", when: LAST_FORTITUDE_PASSED },
        { verb: "DiscardUntil", type: "enemy", when: LAST_FORTITUDE_FAILED },
        { verb: "MoveEncounterCard", card: "picked", to: "engaged", when: { kind: "all", conditions: [LAST_FORTITUDE_FAILED, { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false }] } },
      ]),
    ],
  },
  {
    id: "146076:forced:2",
    cardCode: STAGE_2,
    lines: ["146076:B:2"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: QUEST_PHASE,
    instructions: [{ verb: "AdvanceStage", when: { kind: "not", condition: { kind: "less", left: { stat: "resources", of: "self" }, right: { players: true } } } }],
  },

  // 146077 Stage 3 (20 quest points). When Revealed: the discard pile is shuffled into the deck and cards are discarded until one location for each player is discarded; those locations are added to the staging area. Side B: the first treachery revealed each quest phase is immune and gains surge (the line of stage 1).
  // Forced: at the beginning of the quest phase the first player makes a Fortitude test; if he fails it no more than 5 progress can be placed here this round (the active location still takes progress first). The stage cannot be defeated unless Mount Doom is the active location (progress still goes on).
  { id: "146077:whenRevealed:1", cardCode: STAGE_3, lines: ["146077:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilLocations", perPlayer: 1 }] },
  copyLine("146075:B:2", "146077:B:1"),
  {
    id: "146077:forced:1",
    cardCode: STAGE_3,
    lines: ["146077:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: QUEST_PHASE,
    instructions: [{ verb: "FortitudeTest", who: "firstPlayer" }, { verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "endOfRound", target: "table", when: LAST_FORTITUDE_FAILED }],
  },
  { id: "146077:constant:2", cardCode: STAGE_3, lines: ["146077:B:3"], timing: "constant", condition: { kind: "not", condition: MOUNT_DOOM_ACTIVE }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 146078 Stage 4 (no quest points: no progress can defeat it). When Revealed: the discard pile is shuffled into the deck and cards are discarded until one enemy for each player is discarded; those enemies are added to the staging area. Side B: allies cannot enter play and 'when revealed' effects cannot be canceled.
  // Forced: when Mount Doom is explored the first player makes a Fortitude test with one extra card discarded for each player: a failure loses the game (the Ring-bearer claims The One Ring: nothing is written), a pass wins it (the campaign card's Resolution follows).
  { id: "146078:whenRevealed:1", cardCode: STAGE_4, lines: ["146078:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }] },
  {
    id: "146078:constant:1",
    cardCode: STAGE_4,
    lines: ["146078:B:1"],
    timing: "constant",
    instructions: [{ verb: "LimitEntries", cardType: "ally", max: 0 }, { verb: "UncancelableWhenRevealed" }],
  },
  {
    id: "146078:forced:1",
    cardCode: STAGE_4,
    lines: ["146078:B:2"],
    timing: "forced",
    trigger: "locationExplored",
    subject: { type: "location", control: "any", names: ["Mount Doom"] },
    instructions: [
      { verb: "FortitudeTest", who: "firstPlayer", extraCards: { players: true } },
      { verb: "LoseGame", reason: "The Ring-bearer claimed The One Ring", when: LAST_FORTITUDE_FAILED },
      { verb: "WinGame", when: LAST_FORTITUDE_PASSED },
    ],
  },
];

