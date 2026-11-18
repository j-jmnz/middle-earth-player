import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Old Forest (standalone-scenarios cycle part 4, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) needs no record here.
// Setup: the data's piles set Old Man Willow and Withywindle aside (147001:A:1's first sentence); the four stage 2s lie in the quest deck, a stage 2B returns to it when the quest goes on to a different one (AdvanceToRandomStage `different`).
// Rules: rr.forced, rr.surge, mec109.peril, mec109.indestructible, rr.immune, rr.doomed-x, rr.engaged, rr.victory, rr.in-play-and-out-of-play, rr.play-and-put-into-play, rr.quest-advancement, mec113.saga-staging-rules (data/rules/entries.json); the readings are in docs/brief.md (The Old Forest, Line readings).
const STAGE_2: readonly string[] = ["147002", "147003", "147004", "147005"];
const STAGE_3 = "147006";
const OLD_MAN_WILLOW = "147007";
const WITHYWINDLE = "147011";
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const WILLOW: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Old Man Willow"] };
const LOCATIONS_IN_VICTORY: PickSpec = { type: "location", control: "any", from: "victory" };
const NON_OBJECTIVE_ATTACHMENT: PickSpec = { type: "attachment", control: "you", nonObjective: true };
// X of the stage 2Bs: the Victory points in the victory display against the number of players times 5 (only locations score there, none of the dealt enemies prints Victory).
const ENOUGH_VICTORY: Condition = { kind: "not", condition: { kind: "less", left: { victoryDisplay: true }, right: { players: true, times: 5 } } };
const NOT_ENOUGH_VICTORY: Condition = { kind: "less", left: { victoryDisplay: true }, right: { players: true, times: 5 } };
const ENEMY_RAISES_AFTER_ATTACK: Instruction = { verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat", when: { kind: "x", min: 1 } }] };

// The four stage 2s print the same When Revealed and the same second Forced effect; each has its own first Forced effect.
const stageTwo = (code: string, first: Effect): Effect[] => [
  {
    id: `${code}:whenRevealed:1`,
    cardCode: code,
    lines: [`${code}:A:1`],
    timing: "whenRevealed",
    instructions: [
      { verb: "SearchMove", type: "location", to: "staging", when: { kind: "less", left: { count: { type: "location", control: "any", stagingOnly: true } }, right: { players: true } } },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  first,
  {
    id: `${code}:forced:2`,
    cardCode: code,
    lines: [`${code}:B:2`],
    timing: "forced",
    trigger: "questProgressPlaced",
    instructions: [
      // One X test, decided before the advance: the "Otherwise" branch comes first, so 3A's When Revealed (Swaying Without Wind returns a location from the victory display) cannot turn the test over.
      { verb: "AdvanceToRandomStage", codes: [...STAGE_2], different: true, when: NOT_ENOUGH_VICTORY },
      { verb: "AdvanceToStage", code: STAGE_3, when: ENOUGH_VICTORY },
    ],
  },
];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 147001 Farewell to the Shire. Setup: each player in turn searches the encounter deck for a location of a different title and adds it to the staging area, then the deck is shuffled. Side B opens the game (stage 1A prints no quest points): each player draws 1 card and the quest advances to a random stage 2A.
  { id: "147001:setup:1", cardCode: "147001", lines: ["147001:A:1"], timing: "setup", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "location", to: "staging", different: true }] }, { verb: "ShuffleEncounterDeck" }] },
  {
    id: "147001:whenRevealed:1",
    cardCode: "147001",
    lines: ["147001:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 1 }] }, { verb: "AdvanceToRandomStage", codes: [...STAGE_2], different: true }],
  },

  // 147002 to 147005 The Living Forest. 2B first Forced effects: exhaust a hero each at the end of the planning phase; at the beginning of the round (the Resource phase's start) remove all progress from each location in play; at the end of the round discard a random location from the victory display;
  // the first player reveals 1 additional encounter card during the quest phase.
  ...stageTwo("147002", {
    id: "147002:forced:1",
    cardCode: "147002",
    lines: ["147002:B:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "phase", is: "Planning" },
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] }],
  }),
  ...stageTwo("147003", {
    id: "147003:forced:1",
    cardCode: "147003",
    lines: ["147003:B:1"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Resource" },
    instructions: [{ verb: "RemoveAllProgress", pick: { type: "location", control: "any" } }],
  }),
  ...stageTwo("147004", { id: "147004:forced:1", cardCode: "147004", lines: ["147004:B:1"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "DiscardRandomVictoryLocation" }] }),
  ...stageTwo("147005", { id: "147005:forced:1", cardCode: "147005", lines: ["147005:B:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "RevealMore", amount: 1 }] }),

  // 147006 The Wicked Willow. Old Man Willow and Withywindle come from the set-aside pile to the staging area (added, not revealed), then the first player reveals one encounter card fewer than the players. Side B: Old Man Willow is held in the staging area, considered engaged with each player (it attacks each
  // in turn with a shadow card each, has no Threat in the staging area: rr.engaged) and any character may attack it; defeating the stage wins the game.
  {
    id: "147006:whenRevealed:1",
    cardCode: STAGE_3,
    lines: ["147006:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "AddSetAsideToStaging", code: OLD_MAN_WILLOW },
      { verb: "AddSetAsideToStaging", code: WITHYWINDLE },
      { verb: "Repeat", times: { players: true, plus: -1 }, instructions: [{ verb: "RevealEncounter" }] },
    ],
  },
  {
    id: "147006:constant:1",
    cardCode: STAGE_3,
    lines: ["147006:B:1"],
    timing: "constant",
    instructions: (["cannotLeaveStaging", "engagedWithAll", "cannotBeEngaged", "noThreatContribution", "attackableByAny"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: 1, until: "whileSourceInPlay" as const, holders: WILLOW })),
  },
  { id: "147006:constant:2", cardCode: STAGE_3, lines: ["147006:B:2"], timing: "constant", instructions: [] },

  // 147007 Old Man Willow. Forced: when he attacks, a random location of the victory display is discarded (any trait) and the defending player raises his threat by its Victory points (the effect's X); with none there, nothing.
  {
    id: "147007:forced:1",
    cardCode: OLD_MAN_WILLOW,
    lines: ["147007:A:2"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [{ verb: "DiscardRandomVictoryLocation" }, { verb: "RaiseThreat", amount: { x: true }, when: { kind: "x", min: 1 } }],
  },

  // 147008 Long Trailer. In the staging area, after the active location is explored, it makes an immediate attack against the first player.
  { id: "147008:forced:1", cardCode: "147008", lines: ["147008:A:1"], timing: "forced", trigger: "activeExplored", condition: IN_STAGING, instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] },

  // 147009 Grasping Root. After it engages a player, that player assigns X damage among characters he controls: X the locations in the victory display.
  { id: "147009:forced:1", cardCode: "147009", lines: ["147009:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "AssignDamage", amount: { count: LOCATIONS_IN_VICTORY }, pick: { type: "character", control: "you" } }] },

  // 147010 Army of Flies. After it engages a player, that player discards a non-objective attachment he controls; the Shadow is the same for the defending player.
  { id: "147010:forced:1", cardCode: "147010", lines: ["147010:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: NON_OBJECTIVE_ATTACHMENT }, { verb: "DiscardPicked" }] },
  { id: "147010:shadow:1", cardCode: "147010", lines: ["147010:A:3"], timing: "shadow", instructions: [{ verb: "Pick", pick: NON_OBJECTIVE_ATTACHMENT }, { verb: "DiscardPicked" }] },

  // 147011 Withywindle. The players cannot win while it is in play; while it is the active location the first player reveals 1 additional encounter card during the quest phase.
  { id: "147011:constant:1", cardCode: WITHYWINDLE, lines: ["147011:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "147011:constant:2", cardCode: WITHYWINDLE, lines: ["147011:A:3"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "revealMore", amount: 1, until: "whileSourceInPlay", target: "table" }] },

  // 147012 Misleading Path. The players must travel here when there is no active location. Shadow: the defending player discards each ally card in his hand.
  { id: "147012:constant:1", cardCode: "147012", lines: ["147012:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travelOnly" }] },
  { id: "147012:shadow:1", cardCode: "147012", lines: ["147012:A:3"], timing: "shadow", instructions: [{ verb: "Each", pick: { type: "ally", control: "you", from: "hand" }, instructions: [{ verb: "DiscardPicked" }] }] },

  // 147013 Deep Gulley. In the staging area, after a player optionally engages an enemy, that player raises his threat by the enemy's Attack (read when the Forced effect resolves).
  { id: "147013:forced:1", cardCode: "147013", lines: ["147013:A:1"], timing: "forced", trigger: "optionallyEngaged", condition: IN_STAGING, instructions: [{ verb: "RaiseThreat", amount: { stat: "attack", of: "subject" }, who: "eventSeat" }] },

  // 147014 Strange Woods. No character is healed while it is in the staging area. Shadow: +1 Attack; if the attack destroys a character each player raises his threat by 2.
  { id: "147014:constant:1", cardCode: "147014", lines: ["147014:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
  { id: "147014:shadow:1", cardCode: "147014", lines: ["147014:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, ENEMY_RAISES_AFTER_ATTACK] },

  // 147015 Wall of Trees. Threat X and Victory X, X the number of players (the scan prints X for both; the card's own Victory is none, data/overrides.json), and progress goes on it first while it is in the staging area.
  { id: "147015:constant:1", cardCode: "147015", lines: ["147015:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay" }] },
  { id: "147015:constant:2", cardCode: "147015", lines: ["147015:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "victory" }, instructions: [{ verb: "ModifyStat", stat: "gainsVictory", amount: { players: true }, until: "whileSourceInPlay", target: "self" }] },
  { id: "147015:constant:3", cardCode: "147015", lines: ["147015:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "progressFirstRequired", amount: 1, until: "whileSourceInPlay" }] },

  // 147016 Oppressive Forest. In the staging area each player plays at most 1 card a round (put into play is not played). Shadow: with no location in the staging area it is added there.
  { id: "147016:constant:1", cardCode: "147016", lines: ["147016:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "LimitPlaysPerRound", max: 1 }] },
  { id: "147016:shadow:1", cardCode: "147016", lines: ["147016:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging", when: { kind: "count", pick: { type: "location", control: "any", stagingOnly: true }, max: 0 } }] },

  // 147017 Swaying Without Wind. The revealing player chooses a location in the victory display and returns it to the staging area; if none is returned the card gains surge.
  {
    id: "147017:whenRevealed:1",
    cardCode: "147017",
    lines: ["147017:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: LOCATIONS_IN_VICTORY },
      { verb: "MoveEncounterCard", card: "picked", to: "staging" },
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "matches", card: "picked", pick: { type: "location", control: "any" }, inPlay: true } } },
    ],
  },

  // 147018 Falling Branches. Each player removes a character he controls from the quest and deals 2 damage to it (3 to an ally). Shadow: +1 Attack, +2 when the defending character is an ally.
  {
    id: "147018:whenRevealed:1",
    cardCode: "147018",
    lines: ["147018:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          { verb: "Pick", pick: { type: "character", control: "you", committed: true } },
          { verb: "RemoveFromQuest" },
          { verb: "DamageCard", amount: 3, target: "picked", when: { kind: "matches", card: "picked", pick: { type: "ally", control: "any" } } },
          { verb: "DamageCard", amount: 2, target: "picked", when: { kind: "not", condition: { kind: "matches", card: "picked", pick: { type: "ally", control: "any" } } } },
        ],
      },
    ],
  },
  {
    id: "147018:shadow:1",
    cardCode: "147018",
    lines: ["147018:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "ally", control: "any" } } } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "ally", control: "any" } } },
    ],
  },

  // 147019 Song of Sleep. The revealing player removes a questing hero he controls from the quest and attaches this to it (a Condition with blank text and cannot ready, one per hero).
  {
    id: "147019:whenRevealed:1",
    cardCode: "147019",
    lines: ["147019:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", committed: true, hasAttachment: { names: ["Song of Sleep"], none: true } } }, { verb: "AttachSelfToPicked" }, { verb: "RemoveFromQuest" }],
  },
  {
    id: "147019:constant:1",
    cardCode: "147019",
    lines: ["147019:A:2"],
    timing: "constant",
    instructions: [
      { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
      { verb: "AttachesTo", host: { kind: "hero" }, limitPerHost: true },
      { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" },
    ],
  },

  // 147020 Lost and Witless. All progress on the locations in the staging area is discarded, then, when the active location is not unique, a location of the staging area chosen at random is switched with it.
  {
    id: "147020:whenRevealed:1",
    cardCode: "147020",
    lines: ["147020:A:2"],
    timing: "whenRevealed",
    instructions: [
      { verb: "RemoveAllProgress", pick: { type: "location", control: "any", stagingOnly: true } },
      { verb: "MakeActive", random: true, when: { kind: "canPick", pick: { type: "location", control: "any", active: true, nonUnique: true } } },
    ],
  },

  // 147021 Ending and Failing. At the end of the phase each player raises his threat by the enemies in the staging area, counted then.
  {
    id: "147021:whenRevealed:1",
    cardCode: "147021",
    lines: ["147021:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "Delay", until: "endOfPhase", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "enemy", control: "any", stagingOnly: true } }, who: "eachSeat" }] }],
  },

  // 147022 Tom Bombadil. The first player chooses a player, who takes control of Tom ready and committed; at the end of the round Tom is discarded and then the encounter discard pile is shuffled into the encounter deck. Neither can be canceled.
  {
    id: "147022:whenRevealed:1",
    cardCode: "147022",
    lines: ["147022:A:1"],
    timing: "whenRevealed",
    uncancelable: { kind: "count", pick: { type: "hero", control: "any" }, min: 0 },
    instructions: [
      { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } },
      { verb: "TakeRevealedCard", who: "picked", committed: true },
      { verb: "Delay", until: "endOfRound", uncancelable: { kind: "count", pick: { type: "hero", control: "any" }, min: 0 }, instructions: [{ verb: "Discard", target: { kind: "self" } }, { verb: "ShuffleEncounterDiscard", when: { kind: "not", condition: { kind: "noneDiscarded" } } }] },
    ],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
