import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

// Records for Beneath the Sands (haradrim cycle part 6, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json). See docs/scenarios/haradrim/beneath-the-sands.md, Readings, for each reading.
// The Search objective is one card, Off Track (17079) with On Track (17080) on its back: the piles deal it into the staging area Off Track faceup, and the haradrim family flips it (src/rules/families/haradrim/track.ts: FlipSearchObjective, ResolveTrack,
// StageMarkedFromTop). "Track X" is a Forced record on each Track location, heard after the players travel there, only while Off Track is in play. The Brood Mother (17065) is dealt aside; the records add it to the staging area and set it aside again.
// Rules: hrd.setup-beneath-the-sands, hrd.search-objective, hrd.track, hrd.track-example, bts.valour, hrd.side-quests, hrd.encounter-side-quests, rr.explored, rr.forced, rr.shadow-effects, rr.cancel, rr.attachment-cards, rr.first-player, rr.engaged, rr.search, rr.step-3-4, rr.modifiers (data/rules/entries.json).
type Cond = NonNullable<Effect["condition"]>;
type Instruction = Effect["instructions"][number];

const BROOD_MOTHER = "17065";
const BROODLING = "17067";
const OFF_TRACK = "17079";
const ON_TRACK = "17080";
const LOST_UNDERGROUND = "17075";
// The cards that print "On Track" in the lower right corner (read from the scans of 17066 to 17075, hrd.track): Hive Guardian, Spider Broodling, Pitch Black Tunnel, Nest of Vermin and Blocked Passage.
const ON_TRACK_CARDS = ["17066", BROODLING, "17069", "17070", "17072"];

const OFF_TRACK_IN_PLAY: Cond = { kind: "inPlay", code: OFF_TRACK, is: true };
// "While On Track is in play".
const ON_TRACK_IN_PLAY: Cond = { kind: "inPlay", code: ON_TRACK, is: true };
const NOT_ON_TRACK: Cond = { kind: "not", condition: ON_TRACK_IN_PLAY };
// "After the Search objective is flipped to Off Track": the objective hears `searchFlippedOff` about itself (FlipSearchObjective queues it on a flip to Off Track only).
const OFF_TRACK_FLIPPED: Pick<Effect, "trigger" | "subject"> = { trigger: "searchFlippedOff", subject: { type: "objective", control: "any" } };
const BROOD_MOTHER_IN_PLAY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Brood Mother"] };
const STAGED_LOCATIONS: PickSpec = { type: "location", control: "any", stagingOnly: true };
const ENEMY_FOUND: Cond = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", trait: "Creature" }, inPlay: false };

// "Track X." (17069:A:1, 17070:A:1, 17071:A:1, 17072:A:1): after the players travel to the location, while Off Track is in play, X cards are discarded from the encounter deck (the discard pile shuffled in when the deck runs out) and a card with the marker flips the objective.
const track = (code: string, amount: number): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "forced",
  trigger: "traveled",
  subject: "self",
  condition: OFF_TRACK_IN_PLAY,
  instructions: [{ verb: "ResolveTrack", amount, marked: ON_TRACK_CARDS }],
});
// "Flip the Search objective to Off Track" as a card's own effect.
const FLIP_OFF: Instruction = { verb: "FlipSearchObjective", to: "offTrack" };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 17065 Brood Mother. Cannot have attachments, cannot take damage (17078:B:1 takes the second text away at 5 progress). She engages the first player as soon as she is added to the staging area. At the end of the round a Spider Broodling is searched from the deck
  // and discard pile into the staging area and the deck is shuffled, a Broodling found or not.
  {
    id: "17065:constant:1",
    cardCode: BROOD_MOTHER,
    lines: ["17065:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "17065:forced:1", cardCode: BROOD_MOTHER, lines: ["17065:A:2"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "EngageFirstPlayer" }] },
  { id: "17065:forced:2", cardCode: BROOD_MOTHER, lines: ["17065:A:3"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "SearchMove", code: BROODLING, to: "staging" }, { verb: "ShuffleEncounterDeck" }] },

  // 17066 Hive Guardian (On Track marker). While On Track is in play +2 Attack and -5 engagement cost. Shadow: the attacker gets +1 Attack, +2 instead while On Track is in play.
  {
    id: "17066:constant:1",
    cardCode: "17066",
    lines: ["17066:A:1"],
    timing: "constant",
    condition: ON_TRACK_IN_PLAY,
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "engagementCost", amount: -5, until: "whileSourceInPlay", target: "self" },
    ],
  },
  {
    id: "17066:shadow:1",
    cardCode: "17066",
    lines: ["17066:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: NOT_ON_TRACK },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: ON_TRACK_IN_PLAY },
    ],
  },

  // 17067 Spider Broodling (On Track marker). While On Track is in play it gains surge. Shadow: with On Track in play it goes into play engaged with the defending player and is dealt a shadow card.
  { id: "17067:constant:1", cardCode: BROODLING, lines: ["17067:A:1"], timing: "constant", condition: ON_TRACK_IN_PLAY, instructions: [{ verb: "ModifyStat", stat: "gainsSurge", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "17067:shadow:1",
    cardCode: BROODLING,
    lines: ["17067:A:2"],
    timing: "shadow",
    instructions: [{ verb: "EngageShadowCard", when: ON_TRACK_IN_PLAY }, { verb: "DealShadowTo", target: "self", when: { kind: "sourceIn", zone: "engaged" } }],
  },

  // 17068 Spider Burrow. Forced: after it becomes the active location the objective flips to On Track and Brood Mother is added to the staging area (also when Lost Underground blocks the flip). Forced: when it leaves play explored Brood Mother is set aside, unless at stage 3B.
  { id: "17068:forced:1", cardCode: "17068", lines: ["17068:A:2"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "FlipSearchObjective", to: "onTrack" }, { verb: "AddSetAsideToStaging", code: BROOD_MOTHER }] },
  {
    id: "17068:forced:2",
    cardCode: "17068",
    lines: ["17068:A:3"],
    timing: "forced",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "subjectExplored" },
    instructions: [{ verb: "SetAsideCode", code: BROOD_MOTHER, when: { kind: "not", condition: { kind: "onStage", stage: 3 } } }],
  },

  // 17069 Pitch Black Tunnel (On Track marker). Track 4. X, its Threat, is the number of characters the first player controls.
  track("17069", 4),
  { id: "17069:constant:1", cardCode: "17069", lines: ["17069:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "character", control: "any", controlledBy: "firstPlayer" } }, until: "whileSourceInPlay", target: "self" }] },

  // 17070 Nest of Vermin (On Track marker). Track 3. Travel: the discard pile is shuffled into the deck and cards are discarded until a Creature enemy is discarded; it is added to the staging area.
  track("17070", 3),
  {
    id: "17070:travel:1",
    cardCode: "17070",
    lines: ["17070:A:2"],
    timing: "travel",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "enemy", trait: "Creature" }, { verb: "MoveEncounterCard", card: "picked", to: "staging", when: ENEMY_FOUND }],
  },

  // 17071 Cobwebbed Cavern. Track 2. While On Track is in play +2 Threat. Shadow: the defending player exhausts a ready character.
  track("17071", 2),
  { id: "17071:constant:1", cardCode: "17071", lines: ["17071:A:2"], timing: "constant", condition: ON_TRACK_IN_PLAY, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self" }] },
  { id: "17071:shadow:1", cardCode: "17071", lines: ["17071:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] },

  // 17072 Blocked Passage (On Track marker). Track 2. While On Track is in play no progress is placed on locations in the staging area. Shadow: the defending player discards an attachment they control.
  track("17072", 2),
  { id: "17072:constant:1", cardCode: "17072", lines: ["17072:A:2"], timing: "constant", condition: ON_TRACK_IN_PLAY, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: STAGED_LOCATIONS }] },
  { id: "17072:shadow:1", cardCode: "17072", lines: ["17072:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },

  // 17073 Forced Off Track. When Revealed: the first player chooses to flip the objective to Off Track (a choice that changes nothing when it is Off Track already) or to deal 1 damage to each questing character. Shadow: with On Track in play the attacker attacks again after this attack.
  {
    id: "17073:whenRevealed:1",
    cardCode: "17073",
    lines: ["17073:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "flip", instructions: [FLIP_OFF] },
          { id: "damage", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", committed: true } }] },
        ],
      },
    ],
  },
  { id: "17073:shadow:1", cardCode: "17073", lines: ["17073:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: ON_TRACK_IN_PLAY, instructions: [{ verb: "ImmediateAttack" }] }] },

  // 17074 Grabbed by Spiders (surge, doomed 1). When Revealed: it attaches to the main quest, Limit 1 per quest (a second copy stays unattached and is discarded as a revealed treachery). It counts as a Condition attachment with the text:
  // "Forced: After the Search objective is flipped to Off Track, each player discards an ally he controls. Then, discard Grabbed by Spiders."
  {
    id: "17074:whenRevealed:1",
    cardCode: "17074",
    lines: ["17074:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "AttachToQuest", main: true, when: { kind: "count", pick: { type: "attachment", control: "any", names: ["Grabbed by Spiders"] }, max: 0 } }],
  },
  { id: "17074:constant:1", cardCode: "17074", lines: ["17074:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  {
    id: "17074:forced:1",
    cardCode: "17074",
    lines: ["17074:A:2"],
    timing: "forced",
    ...OFF_TRACK_FLIPPED,
    condition: { kind: "sourceIn", zone: "attached" },
    // "Then, discard" (rr.then): the card goes only when each player has an ally to discard, read before the discards (a player with none keeps it attached, and it fires again at the next flip).
    instructions: [
      { verb: "Discard", target: { kind: "self" }, when: { kind: "everySeatHasAlly" } },
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          { verb: "Pick", pick: { type: "ally", control: "you" }, when: { kind: "canPick", pick: { type: "ally", control: "you" } } },
          { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: { type: "ally", control: "you" } } },
        ],
      },
    ],
  },

  // 17075 Lost Underground (side quest). When Revealed: the objective flips to Off Track (Track is not resolved). While it is in play (a constant record holds the flag `cannotFlipSearch`) the objective cannot flip and Track does not resolve, except by its own two flips. Response: when it is defeated the objective flips to On Track and ignores its Forced effects until the end of the phase.
  {
    id: "17075:whenRevealed:1",
    cardCode: LOST_UNDERGROUND,
    lines: ["17075:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "FlipSearchObjective", to: "offTrack", despiteBlock: true }],
  },
  // "While Lost Underground is in play, the Search objective cannot flip" is a constant of the same line, so a cancelled When Revealed keeps the block (and Track stays unresolved).
  { id: "17075:constant:1", cardCode: LOST_UNDERGROUND, lines: ["17075:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotFlipSearch", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "17075:response:1",
    cardCode: LOST_UNDERGROUND,
    lines: ["17075:A:2"],
    timing: "response",
    trigger: "questDefeated",
    subject: "self",
    instructions: [
      { verb: "FlipSearchObjective", to: "onTrack", despiteBlock: true },
      { verb: "ModifyStat", stat: "cannotTriggerForced", amount: 1, until: "endOfPhase", holders: { type: "objective", control: "any", names: ["On Track"] } },
    ],
  },

  // 17076 Searching the Caves. Setup: the piles set Brood Mother aside and add the Search objective, Off Track faceup, to the staging area. When Revealed (side B): cards are discarded until X locations are discarded, X the number of players, and each is added to the staging area (the deck running out stops it).
  { id: "17076:setup:1", cardCode: "17076", lines: ["17076:A:1"], timing: "setup", instructions: [] },
  { id: "17076:whenRevealed:1", cardCode: "17076", lines: ["17076:B:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardUntilEnemies", perPlayer: 1, cardType: "location", to: "staging" }] },

  // 17077 Getting Closer. When Revealed: the objective flips to Off Track, the discard pile is shuffled into the deck and cards are discarded until X enemies are discarded, X the number of players; each is added to the staging area. Side B: while On Track is in play encounter card effects cannot be canceled.
  {
    id: "17077:whenRevealed:1",
    cardCode: "17077",
    lines: ["17077:A:1"],
    timing: "whenRevealed",
    instructions: [FLIP_OFF, { verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, to: "staging" }],
  },
  { id: "17077:constant:1", cardCode: "17077", lines: ["17077:B:1"], timing: "constant", condition: ON_TRACK_IN_PLAY, instructions: [{ verb: "ModifyStat", stat: "encounterUncancelable", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 17078 The Spiders' Hive. When Revealed: the first player adds Brood Mother to the staging area, each other player reveals an encounter card, and the objective flips to Off Track. Side B: with 5 or more progress here Brood Mother loses "Cannot take damage."; after the objective flips to Off Track all progress
  // here is removed; the stage cannot be defeated while Brood Mother is in play, and defeating it wins the game.
  {
    id: "17078:whenRevealed:1",
    cardCode: "17078",
    lines: ["17078:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AddSetAsideToStaging", code: BROOD_MOTHER }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter", when: { kind: "not", condition: { kind: "firstPlayer" } } }] }, FLIP_OFF],
  },
  { id: "17078:constant:1", cardCode: "17078", lines: ["17078:B:1"], timing: "constant", condition: { kind: "stageProgress", min: 5 }, instructions: [{ verb: "ModifyStat", stat: "losesNoDamage", amount: 1, until: "whileSourceInPlay", holders: BROOD_MOTHER_IN_PLAY }] },
  { id: "17078:forced:1", cardCode: "17078", lines: ["17078:B:2"], timing: "forced", ...OFF_TRACK_FLIPPED, instructions: [{ verb: "RemoveProgressFrom", amount: { stat: "progress", of: "self" }, target: "self" }] },
  { id: "17078:constant:2", cardCode: "17078", lines: ["17078:B:3"], timing: "constant", condition: { kind: "canPick", pick: BROOD_MOTHER_IN_PLAY }, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "17078:questResolution:1", cardCode: "17078", lines: ["17078:B:3"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },

  // 17079 Off Track (the objective's side with the progress block). Forced: at the end of the quest phase it takes a resource, then the first player returns the topmost location of the encounter discard pile to the staging area or each player raises their threat by the resources here.
  // While it is in play no progress is placed on the main quest (the active location still takes progress).
  {
    id: "17079:forced:1",
    cardCode: OFF_TRACK,
    lines: ["17079:A:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [
      { verb: "PlaceResourceTokens", amount: 1, on: "self" },
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "location", requires: { kind: "canPick", pick: { type: "location", control: "any", from: "encounterDiscard" } }, instructions: [{ verb: "AddTopmostFromDiscard", cardType: "location" }] },
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { stat: "resources", of: "self" }, who: "eachSeat" }] },
        ],
      },
    ],
  },
  { id: "17079:constant:1", cardCode: OFF_TRACK, lines: ["17079:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noMainQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 17080 On Track. Forced: at the end of the quest phase the top 3 cards of the encounter deck are searched for a marked card, which is added to the staging area (the rest are discarded); with none the objective flips. Forced: after the players quest unsuccessfully it flips to Off Track.
  {
    id: "17080:forced:1",
    cardCode: ON_TRACK,
    lines: ["17080:A:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [{ verb: "StageMarkedFromTop", count: 3, marked: ON_TRACK_CARDS }],
  },
  { id: "17080:forced:2", cardCode: ON_TRACK, lines: ["17080:A:2"], timing: "forced", trigger: "questFailed", instructions: [FLIP_OFF] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
