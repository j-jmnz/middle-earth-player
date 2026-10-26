import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for player side quests, contracts, encounter-keyword player cards and the victory display (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.

// "While this side quest is in the victory display": the quest's constants work from there, for every seat.
const IN_VICTORY = { kind: "sourceIn", zone: "victory" } as const;
// Each side quest in the victory display.
const SIDE_QUESTS_IN_VICTORY = { type: "card", control: "any", from: "victory", cardType: "player-side-quest" } as const;
const SIDE_QUEST_IN_VICTORY = { kind: "count", pick: SIDE_QUESTS_IN_VICTORY, min: 1 } as const;
// "Response: When/After this stage is defeated, ...": the side quest hears it from the victory display or its owner's discard pile.
const defeated = { timing: "response", trigger: "questDefeated", subject: "self" } as const;

export const RECORDS: readonly Effect[] = [
  // Gather Information: "Response: After this stage is defeated, each player may search his deck for 1 card and add it to his hand.
  // Each player shuffles his deck."
  {
    id: "09014:response:1",
    cardCode: "09014",
    lines: ["09014:A:2"],
    ...defeated,
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck" } }, { verb: "MovePicked", to: "hand" }, { verb: "ShuffleDeck" }],
      },
    ],
  },
  // Scout Ahead: "Response: When this stage is defeated, the first player searches the top X cards of the encounter deck for 1
  // non-objective card worth no victory points and adds it to the victory display. Put the remaining cards back in any order. X is
  // the number of players in the game plus 4."
  {
    id: "10009:response:1",
    cardCode: "10009",
    lines: ["10009:A:2"],
    ...defeated,
    instructions: [
      { verb: "LookAtTop", count: { players: true, plus: 4 }, deck: "encounter" },
      { verb: "PickEncounter", from: "looked", notType: "objective", noVictory: true },
      { verb: "MoveEncounterCard", to: "victory" },
      { verb: "ArrangeEncounter" },
    ],
  },
  // Double Back: "Response: When this stage is defeated, reduce each player's threat by 5."
  { id: "10034:response:1", cardCode: "10034", lines: ["10034:A:2"], ...defeated, instructions: [{ verb: "LowerThreat", amount: 5, who: "eachSeat" }] },
  // Delay the Enemy: "Battle." (the characters committed to it quest with their Attack), "Response: When this stage is defeated, each
  // player may choose and discard a non-unique enemy engaged with him."
  { id: "10058:constant:2", cardCode: "10058", lines: ["10058:A:1"], timing: "constant", instructions: [{ verb: "QuestsWith", stat: "attack" }] },
  {
    id: "10058:response:1",
    cardCode: "10058",
    lines: ["10058:A:3"],
    ...defeated,
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [{ verb: "Pick", pick: { type: "enemy", control: "you", engaged: "you", nonUnique: true } }, { verb: "Discard", target: { kind: "picked" } }],
      },
    ],
  },
  // Send for Aid: "Response: When this stage is defeated, each player may search the top 10 cards of his deck for an ally and put it
  // into play under his control. Each player who did shuffles his deck."
  {
    id: "10086:response:1",
    cardCode: "10086",
    lines: ["10086:A:2"],
    ...defeated,
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 10, cardType: "ally", intoPlay: true } },
          { verb: "MovePicked", to: "play" },
          { verb: "ShuffleDeck", when: { kind: "matches", card: "picked", pick: { type: "ally", control: "you" } } },
        ],
      },
    ],
  },
  // The Storm Comes: "Limit 1 copy in the victory display." "While this quest is in the victory display, the first ally played by each
  // player each round does not require a resource match."
  {
    id: "16013:constant:1",
    cardCode: "16013",
    lines: ["16013:A:1"],
    timing: "constant",
    instructions: [{ verb: "VictoryLimit", copies: 1 }],
  },
  {
    id: "16013:constant:2",
    cardCode: "16013",
    lines: ["16013:A:2"],
    timing: "constant",
    condition: IN_VICTORY,
    instructions: [{ verb: "IgnoreResourceMatch", pick: { type: "ally", control: "you" }, firstEachRound: true }],
  },
  // Prepare for Battle: "While this quest is in the victory display, the first player draws an additional card during the resource phase."
  { id: "17003:constant:1", cardCode: "17003", lines: ["17003:A:1"], timing: "constant", instructions: [{ verb: "VictoryLimit", copies: 1 }] },
  {
    id: "17003:constant:2",
    cardCode: "17003",
    lines: ["17003:A:2"],
    timing: "constant",
    condition: IN_VICTORY,
    instructions: [{ verb: "ModifyStat", stat: "extraDraw", amount: 1, until: "whileSourceInPlay", holders: { type: "player", control: "you", who: "firstPlayer" } }],
  },
  // Explore Secret Ways: "While this side quest is in the victory display, each location in the staging area with the same title as
  // the active location does not contribute its Threat to the total Threat of the staging area."
  { id: "17036:constant:1", cardCode: "17036", lines: ["17036:A:1"], timing: "constant", instructions: [{ verb: "VictoryLimit", copies: 1 }] },
  {
    id: "17036:constant:2",
    cardCode: "17036",
    lines: ["17036:A:2"],
    timing: "constant",
    condition: IN_VICTORY,
    instructions: [{ verb: "ModifyStat", stat: "noThreatContribution", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true, sameTitleAs: "activeLocation" } }],
  },
  // Keep Watch: "While Keep Watch is in the victory display, each non-unique enemy engaged with a player gets -1 Attack."
  { id: "17059:constant:1", cardCode: "17059", lines: ["17059:A:1"], timing: "constant", instructions: [{ verb: "VictoryLimit", copies: 1 }] },
  {
    id: "17059:constant:2",
    cardCode: "17059",
    lines: ["17059:A:2"],
    timing: "constant",
    condition: IN_VICTORY,
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: -1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", nonUnique: true } }],
  },
  // Rally the West: "Limit 1 copy of Rally the West in the victory display. While this side quest is in the victory display, each hero
  // gets +1 Willpower."
  {
    id: "17087:constant:1",
    cardCode: "17087",
    lines: ["17087:A:1"],
    timing: "constant",
    condition: IN_VICTORY,
    instructions: [{ verb: "VictoryLimit", copies: 1 }, { verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any" } }],
  },
  // Leave No Trace: "Limit 3 copies of Leave No Trace in the victory display."
  { id: "10035:constant:1", cardCode: "10035", lines: ["10035:A:1"], timing: "constant", instructions: [{ verb: "VictoryLimit", copies: 3 }] },
  // Keen as Lances: "Reduce the cost to play Keen as Lances by 1 for each card worth no victory points in the victory display."
  {
    id: "10037:constant:1",
    cardCode: "10037",
    lines: ["10037:A:1"],
    timing: "constant",
    instructions: [{ verb: "ReduceCost", amount: { count: { type: "card", control: "any", from: "victory", noVictory: true } } }],
  },
  // Rossiel: "If the active location shares a Trait with a location in the victory display, Rossiel gets +2 Willpower." "If the
  // attacking enemy shares a Trait with an enemy in the victory display, Rossiel gets +2 Defense."
  {
    id: "10028:constant:1",
    cardCode: "10028",
    lines: ["10028:A:1"],
    timing: "constant",
    instructions: [
      {
        verb: "ModifyStat",
        stat: "willpower",
        amount: 2,
        until: "whileSourceInPlay",
        when: { kind: "count", pick: { type: "location", control: "any", from: "victory", sharesTraitWith: "activeLocation" }, min: 1 },
      },
    ],
  },
  {
    id: "10028:constant:2",
    cardCode: "10028",
    lines: ["10028:A:2"],
    timing: "constant",
    instructions: [
      {
        verb: "ModifyStat",
        stat: "defense",
        amount: 2,
        until: "whileSourceInPlay",
        when: { kind: "count", pick: { type: "enemy", control: "any", from: "victory", sharesTraitWith: "attackingEnemy" }, min: 1 },
      },
    ],
  },
  // The Door is Closed!: "Response: After an encounter card is revealed from the encounter deck, cancel its effects and discard it if
  // there is a card with the same title in the victory display."
  {
    id: "10092:response:1",
    cardCode: "10092",
    lines: ["10092:A:1"],
    timing: "response",
    trigger: "encounterRevealed",
    cost: { kind: "playEvent" },
    condition: { kind: "copyInVictory", card: "subject" },
    instructions: [{ verb: "CancelEffect" }, { verb: "MoveEncounterCard", card: "subject", to: "discard" }],
  },
  // Halfling Bounder: "While there is a side quest in the victory display, Halfling Bounder gains: 'Response: Discard Halfling
  // Bounder to cancel the "when revealed" effects of an encounter card that was just revealed from the encounter deck.'"
  {
    id: "16005:response:1",
    cardCode: "16005",
    lines: ["16005:A:1"],
    timing: "response",
    trigger: "whenRevealedPending",
    cost: { kind: "discardSelf" },
    condition: SIDE_QUEST_IN_VICTORY,
    instructions: [{ verb: "CancelEffect" }],
  },
  // Vigilant Dúnadan: "While there is a side quest in the victory display, Vigilant Dúnadan does not exhaust to defend."
  {
    id: "16006:constant:1",
    cardCode: "16006",
    lines: ["16006:A:1"],
    timing: "constant",
    condition: SIDE_QUEST_IN_VICTORY,
    instructions: [{ verb: "ModifyStat", stat: "noExhaustDefend", amount: 1, until: "whileSourceInPlay" }],
  },
  // Rider of Rohan: "While a side quest is in the victory display, Rider of Rohan does not exhaust to quest."
  {
    id: "17060:constant:1",
    cardCode: "17060",
    lines: ["17060:A:1"],
    timing: "constant",
    condition: SIDE_QUEST_IN_VICTORY,
    instructions: [{ verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "whileSourceInPlay" }],
  },
  // East Road Ranger: "East Road Ranger gets +2 Willpower while committed to a side quest."
  {
    id: "10008:constant:1",
    cardCode: "10008",
    lines: ["10008:A:1"],
    timing: "constant",
    condition: { kind: "matches", card: "self", pick: { type: "ally", control: "any", committedTo: "sideQuest" } },
    instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 2, until: "whileSourceInPlay" }],
  },
  // Legacy Blade: "Attached hero gets +1 Attack for each side quest in the victory display. (Limit +3 Attack.)"
  {
    id: "17117:constant:2",
    cardCode: "17117",
    lines: ["17117:A:2"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: SIDE_QUESTS_IN_VICTORY, limit: 3 }, until: "whileSourceInPlay", target: "host" }],
  },
  // Thalion: "While there is at least 1 side quest in the victory display, ready Thalion at the beginning of the combat phase."
  // "While there are at least 3 side quests in the victory display, Thalion loses the ally card type, gains the hero card type and
  // the resource icons of each sphere on a side quest in the victory display."
  {
    id: "19065:triggered:1",
    cardCode: "19065",
    lines: ["19065:A:1"],
    timing: "triggered",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, SIDE_QUEST_IN_VICTORY] },
    instructions: [{ verb: "Ready" }],
  },
  {
    id: "19065:constant:1",
    cardCode: "19065",
    lines: ["19065:A:2"],
    timing: "constant",
    condition: { kind: "count", pick: SIDE_QUESTS_IN_VICTORY, min: 3 },
    instructions: [
      { verb: "ModifyStat", stat: "heroType", amount: 1, until: "whileSourceInPlay" },
      ...(["leadership", "lore", "tactics", "spirit"] as const).map((sphere) => ({
        verb: "ModifyStat" as const,
        stat: `${sphere}Icon` as const,
        amount: 1,
        until: "whileSourceInPlay" as const,
        when: { kind: "count" as const, pick: { ...SIDE_QUESTS_IN_VICTORY, sphere }, min: 1 },
      })),
    ],
  },
  // Woodland Sentry: "Response: After you play Woodland Sentry from your hand, choose an enemy or location in play. If there is a
  // copy of that card in the victory display, discard the chosen card."
  {
    id: "22030:response:1",
    cardCode: "22030",
    lines: ["22030:A:1"],
    timing: "response",
    trigger: "played",
    subject: "self",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          {
            id: "enemy",
            requires: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true } },
            instructions: [
              { verb: "Pick", pick: { type: "enemy", control: "any", staging: true } },
              { verb: "Discard", target: { kind: "picked" }, when: { kind: "copyInVictory", card: "picked" } },
            ],
          },
          {
            id: "location",
            requires: { kind: "canPick", pick: { type: "location", control: "any" } },
            instructions: [
              { verb: "Pick", pick: { type: "location", control: "any" } },
              { verb: "Discard", target: { kind: "picked" }, when: { kind: "copyInVictory", card: "picked" } },
            ],
          },
        ],
      },
    ],
  },
  // The Fall of Gil-Galad: "Response: When attached hero is destroyed, add The Fall of Gil-Galad to the victory display to reduce
  // your threat by X, where X is the attached hero's threat cost."
  {
    id: "08007:response:1",
    cardCode: "08007",
    lines: ["08007:A:2"],
    timing: "response",
    trigger: "hostDefeated",
    cost: { kind: "addSelfToVictory" },
    instructions: [{ verb: "LowerThreat", amount: { stat: "threatCost", of: "other" }, who: "actor" }],
  },
  // Justice Shall Be Done: "Planning Action: Add Justice Shall Be Done to the victory display to draw 3 cards and add 3 resources to
  // the resource pool of each hero you control. At the end of the round, you are eliminated from the game."
  {
    id: "12119:action:1",
    cardCode: "12119",
    lines: ["12119:A:2"],
    timing: "action",
    condition: { kind: "phase", is: "Planning" },
    instructions: [
      { verb: "AddSourceToVictory" },
      { verb: "Draw", amount: 3 },
      { verb: "HeroesGainResources", amount: 3 },
      { verb: "Delay", until: "endOfRound", instructions: [{ verb: "EliminatePlayer" }] },
    ],
  },
  // Dour Handed: "Action: Deal X damage to an enemy engaged with you. X is the number of side quests in the victory display."
  {
    id: "16009:action:1",
    cardCode: "16009",
    lines: ["16009:A:1"],
    timing: "action",
    instructions: [
      { verb: "Pick", pick: { type: "enemy", control: "you", engaged: "you" } },
      { verb: "DamageCard", amount: { count: SIDE_QUESTS_IN_VICTORY }, target: "picked" },
    ],
  },
];


// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
