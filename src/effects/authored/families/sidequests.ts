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

void SIDE_QUEST_IN_VICTORY;

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
