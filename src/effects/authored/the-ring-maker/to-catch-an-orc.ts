import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { timeOption } from "./time-option.ts";

// Records for To Catch an Orc (The Ring-maker part 2, The Voice of Isengard, no campaign card): the out-of-play decks and Mugash with his Guards, the Searches X locations, the encounter cards no template reads and the three quest stages.
// Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. Time X is the angmar family's (src/catalog/families/angmar.ts: a constant `Time`, the Forced
// effect `lastTimeCounterRemoved`); the verbs the box adds (the out-of-play decks, Mugash's return, the Guard's engagement) are in src/catalog/families/ring-maker.ts.
// Rules: rm.time-x, rm.out-of-play-deck, rm.mugash-player-card-backs, rm.searches-x, rr.forced, rr.setup, rr.attachment-cards, rr.first-player, rr.the-word-choose, rr.search, rr.cancel, rr.constant-ability, rr.step-3-4, rr.quest-advancement (data/rules/entries.json).
const MUGASH = "07024";
const GUARD = "07025";
const MUGASH_NAME = "Mugash";
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ATTACHED: Condition = { kind: "sourceIn", zone: "attached" };
// "Orc enemies in play": staged or engaged.
const ORC_IN_PLAY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Orc" };
const ORC_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Orc" };
const STAGED_LOCATIONS: PickSpec = { type: "location", control: "any", stagingOnly: true };
// "A hero with Mugash attached" and "Mugash in play" (staged, engaged or attached).
const HERO_WITH_MUGASH: PickSpec = { type: "hero", control: "any", hasAttachment: { names: [MUGASH_NAME] } };
const MUGASH_IN_PLAY: PickSpec = { type: "card", control: "any", names: [MUGASH_NAME], allInPlay: true };
const MUGASH_ATTACHED: Condition = { kind: "canPick", pick: HERO_WITH_MUGASH };
const EXHAUSTED_CHARACTER: PickSpec = { type: "character", control: "any", state: "exhausted" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
// "Searches X" (07027:A:2, 07028:A:1): the actor reveals the top X cards of his out-of-play deck and picks 1 of the others for his hand.
const searches = (amount: number): Extract<Instruction, { verb: "RevealOutOfPlay" }> => ({ verb: "RevealOutOfPlay", amount, chooseForHand: true });
// "Each player searches the encounter deck [and discard pile] for a location and adds it to the staging area" (07030:A:1, 07062:B:1).
const SHUFFLED: Instruction = { verb: "ShuffleEncounterDeck" };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 07024 Mugash. Forced: after he is defeated the first player attaches him to a hero he controls and exhausts it (an effect, not a cost, so an exhausted hero takes him). Attached he counts as a Captive attachment: the hero cannot ready, and the players lose if it leaves play.
  {
    id: "07024:forced:1",
    cardCode: MUGASH,
    lines: ["07024:A:2"],
    timing: "forced",
    trigger: "enemyDestroyed",
    subject: "self",
    instructions: [{ verb: "ActAs", who: "firstPlayer" }, { verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "AttachEnemyToPicked" }, { verb: "Exhaust", target: { kind: "picked" } }],
  },
  { id: "07024:constant:2", cardCode: MUGASH, lines: ["07024:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Captive" }] },
  {
    id: "07024:constant:3",
    cardCode: MUGASH,
    lines: ["07024:A:2"],
    timing: "constant",
    condition: { kind: "all", conditions: [ATTACHED, { kind: "matches", card: "host", pick: { type: "hero", control: "any" } }] },
    instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "lossOnLeavingPlay", amount: 1, until: "whileSourceInPlay", target: "host" }],
  },

  // 07025 Mugash's Guard. While a player controls a hero with Mugash attached the Guard engages him (the settle sweep, families/ring-maker/captor.ts). Forced: after it destroys a character, Mugash goes back to the staging area if he is attached to a hero.
  { id: "07025:constant:1", cardCode: GUARD, lines: ["07025:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "EngageCaptiveHolder", captive: MUGASH_NAME }] },
  {
    id: "07025:forced:1",
    cardCode: GUARD,
    lines: ["07025:A:2"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    subject: { type: "character", control: "any" },
    condition: { kind: "all", conditions: [{ kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } }, MUGASH_ATTACHED] },
    instructions: [{ verb: "ReturnAttachedEnemy", name: MUGASH_NAME }],
  },

  // 07026 Methedras Orc. Forced: when it attacks, the defending player shuffles a random card of his hand into his out-of-play deck. Shadow: if the attack destroys a character, a time counter comes off the current quest.
  { id: "07026:forced:1", cardCode: "07026", lines: ["07026:A:1"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "ShuffleHandCardIntoOutOfPlay", random: true }] },
  { id: "07026:shadow:1", cardCode: "07026", lines: ["07026:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RemoveTimeFromQuest", amount: 1, when: { kind: "x", min: 1 } }] }] },

  // 07027 Methedras. While active every staged location gets +1 Threat. Forced: when it leaves play as an explored location each player searches 3.
  { id: "07027:constant:1", cardCode: "07027", lines: ["07027:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: STAGED_LOCATIONS }] },
  { id: "07027:forced:1", cardCode: "07027", lines: ["07027:A:2"], timing: "forced", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [EACH_PLAYER([searches(3)])] },

  // 07028 Orc Cave. Forced: after it leaves play as an explored location the first player searches 5. Travel: discard X cards from the top of the encounter deck, X the players; each Orc enemy among them joins the staging area.
  { id: "07028:forced:1", cardCode: "07028", lines: ["07028:A:1"], timing: "forced", trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" }, instructions: [{ verb: "ActAs", who: "firstPlayer" }, searches(5)] },
  { id: "07028:travel:1", cardCode: "07028", lines: ["07028:A:2"], timing: "travel", instructions: [{ verb: "DiscardEncounterTop", count: { players: true } }, { verb: "StageDiscarded", type: "enemy", trait: "Orc" }] },

  // 07029 Mugash's Lair. Forced: at the beginning of the encounter phase each player reveals the top card of his out-of-play deck; an enemy joins the staging area, any other card is discarded. Shadow: the defending player discards an attachment he controls.
  { id: "07029:forced:1", cardCode: "07029", lines: ["07029:A:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Encounter" }, instructions: [EACH_PLAYER([{ verb: "RevealOutOfPlay", amount: 1 }])] },
  { id: "07029:shadow:1", cardCode: "07029", lines: ["07029:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", controlled: true } }, { verb: "Discard", target: { kind: "picked" } }] },

  // 07030 Orc Territory. When Revealed: each player adds a location from the deck or the discard pile to the staging area and the deck is shuffled; if the staging area's total Threat is below the total Willpower committed, each engaged Orc attacks.
  {
    id: "07030:whenRevealed:1",
    cardCode: "07030",
    lines: ["07030:A:1"],
    timing: "whenRevealed",
    instructions: [
      EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging" }]),
      SHUFFLED,
      { verb: "ImmediateAttackEach", trait: "Orc", notStaging: true, when: { kind: "questLeads" } },
    ],
  },

  // 07038 Orc Skirmisher. Forced: after it engages a player he chooses, 3 damage to a character he controls or a time counter off the current quest.
  {
    id: "07038:forced:1",
    cardCode: "07038",
    lines: ["07038:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "damage", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: 3, target: "picked" }] },
          timeOption(),
        ],
      },
    ],
  },

  // 07039 Orc Hunter. When Revealed: the first player chooses, reveal 1 more encounter card or take a time counter off the current quest.
  {
    id: "07039:whenRevealed:1",
    cardCode: "07039",
    lines: ["07039:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "reveal", instructions: [{ verb: "RevealEncounter" }] }, timeOption()] }],
  },

  // 07040 Orc Hound. Forced: after it engages a player, that player exhausts a character he controls.
  { id: "07040:forced:1", cardCode: "07040", lines: ["07040:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },

  // 07041 Orc Hunting Party. When Revealed: each Orc enemy in play is dealt a shadow card and gets -15 engagement cost until the end of the round; with no Orc enemy in the staging area the card gains surge.
  {
    id: "07041:whenRevealed:1",
    cardCode: "07041",
    lines: ["07041:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "DealShadowInPlay", trait: "Orc" },
      { verb: "Each", pick: ORC_IN_PLAY, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -15, until: "endOfRound", target: "picked" }] },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: ORC_IN_STAGING } } },
    ],
  },

  // 07053 Prowling Wolf. Engaged, +1 Attack for each location in the staging area. Shadow: the defending player exhausts a character he controls.
  { id: "07053:constant:1", cardCode: "07053", lines: ["07053:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: STAGED_LOCATIONS }, until: "whileSourceInPlay", target: "self" }] },
  { id: "07053:shadow:1", cardCode: "07053", lines: ["07053:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },

  // 07054 Broken Lands. While it is in the staging area no progress is placed on a staged location. Shadow: the attacking enemy gets +1 Attack for each location in the staging area.
  { id: "07054:constant:1", cardCode: "07054", lines: ["07054:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: STAGED_LOCATIONS }] },
  { id: "07054:shadow:1", cardCode: "07054", lines: ["07054:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: STAGED_LOCATIONS }, until: "endOfAttack", target: "attacker" }] },

  // 07055 Take Cover!. When Revealed: the first player chooses, 1 damage to each exhausted character or a time counter off the current quest.
  {
    id: "07055:whenRevealed:1",
    cardCode: "07055",
    lines: ["07055:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "damage", requires: { kind: "canPick", pick: EXHAUSTED_CHARACTER }, instructions: [{ verb: "DamageEach", amount: 1, pick: EXHAUSTED_CHARACTER }] },
          timeOption(),
        ],
      },
    ],
  },

  // 07062 Orders from Orthanc. Setup: each player puts the top 20 cards of his deck aside as his out-of-play deck; Mugash and a Guard for each other player are shuffled into them. Side B: each player searches the encounter deck for a Mountain location and adds it to the staging area, the deck is shuffled, the quest advances.
  { id: "07062:setup:1", cardCode: "07062", lines: ["07062:A:1"], timing: "setup", instructions: [{ verb: "CreateOutOfPlayDecks", count: 20 }, { verb: "ShuffleIntoOutOfPlayDecks", once: MUGASH, perOtherPlayer: GUARD }] },
  { id: "07062:whenRevealed:1", cardCode: "07062", lines: ["07062:B:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", trait: "Mountain", to: "staging", deckOnly: true }]), SHUFFLED, { verb: "AdvanceStage" }] },

  // 07063 Searching for Mugash. Time 2; after the last counter the encounter discard pile is shuffled into the deck, 2 cards are revealed for each player and 2 counters go on the stage. Response: after questing successfully the first player cancels the progress this phase and places a counter,
  // or, with Mugash in play, advances to stage 3 (trackQuestProgress keeps the progress the cancel reads). With no progress to cancel the first option is not offered (rr.then: the counter follows a cancel that resolved).
  { id: "07063:constant:1", cardCode: "07063", lines: ["07063:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 2 }] },
  {
    id: "07063:forced:1",
    cardCode: "07063",
    lines: ["07063:B:2"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "RevealEncounter", times: { players: true, times: 2 } }, { verb: "PlaceResourceTokens", amount: 2, on: "self" }],
  },
  {
    id: "07063:response:1",
    cardCode: "07063",
    lines: ["07063:B:3"],
    timing: "response",
    trigger: "questSucceeded",
    eventSeat: "you",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "time", requires: { kind: "questProgressNoted", is: true }, instructions: [{ verb: "CancelPhaseProgress" }, { verb: "PlaceResourceTokens", amount: 1, on: "self" }] },
          { id: "advance", requires: { kind: "canPick", pick: MUGASH_IN_PLAY }, instructions: [{ verb: "AdvanceStage" }] },
        ],
      },
    ],
  },
  { id: "07063:constant:2", cardCode: "07063", lines: ["07063:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "trackQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 07064 The Wizard's Prize. Time 3; after the last counter Mugash returns to the staging area, X encounter cards are revealed (X the players less 1) and 3 counters go on the stage. No progress is placed on it unless Mugash is attached to a hero. Defeating it wins the game.
  { id: "07064:constant:1", cardCode: "07064", lines: ["07064:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 3 }] },
  {
    id: "07064:forced:1",
    cardCode: "07064",
    lines: ["07064:B:2"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    instructions: [{ verb: "ReturnAttachedEnemy", name: MUGASH_NAME }, { verb: "RevealEncounter", times: { players: true, plus: -1 } }, { verb: "PlaceResourceTokens", amount: 3, on: "self" }],
  },
  { id: "07064:constant:2", cardCode: "07064", lines: ["07064:B:3"], timing: "constant", condition: { kind: "not", condition: MUGASH_ATTACHED }, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "07064:questResolution:1", cardCode: "07064", lines: ["07064:B:4"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
