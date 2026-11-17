import type { Effect } from "../../../catalog/boundary.ts";

import { ALWAYS } from "../conditions.ts";
import { CONTRACT_RECORDS } from "./sidequests-contracts.ts";

// Authored records for player side quests, contracts, encounter-keyword player cards and the victory display (docs/agents/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.

// "While this side quest is in the victory display": the quest's constants work from there, for every seat.
const IN_VICTORY = { kind: "sourceIn", zone: "victory" } as const;
// The side of a contract a record belongs to.
const SIDE_A = { kind: "faceUp", side: "A" } as const;
const SIDE_B = { kind: "faceUp", side: "B" } as const;
// The Grey Wanderer's choose two: the player's only hero is the starting hero.
const OWN_HERO = { type: "hero", control: "you" } as const;
const GREY_WANDERER_OPTIONS: Extract<Effect["instructions"][number], { verb: "Choose" }>["options"] = [
  { id: "ready", requires: { kind: "canPick", pick: { ...OWN_HERO, state: "exhausted" } }, instructions: [{ verb: "Pick", pick: OWN_HERO }, { verb: "Ready", target: "picked" }] },
  { id: "resources", requires: { kind: "canPick", pick: OWN_HERO }, instructions: [{ verb: "Pick", pick: OWN_HERO }, { verb: "AddResources", amount: 2, to: "picked" }] },
  { id: "heal", requires: { kind: "canPick", pick: { ...OWN_HERO, damaged: true } }, instructions: [{ verb: "Pick", pick: OWN_HERO }, { verb: "Heal", amount: 3, target: "picked" }] },
];
// Council of the Wise: a seat's option already taken this round is a flag it holds until the end of the round.
const COUNCIL = ["councilThreat", "councilDraw", "councilResource"] as const;
const notTaken = (flag: (typeof COUNCIL)[number]) => ({ kind: "flag", stat: flag, holder: "seat", is: false }) as const;
const taken = (flag: (typeof COUNCIL)[number]) => ({ verb: "ModifyStat", stat: flag, amount: 1, until: "endOfRound", target: "actorSeat" }) as const;
// The first player chooses a player (rr.first-player): "The first player chooses a player to take control of ~."
const FIRST_PLAYER_CHOOSES = { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } } as const;
const encounterKeyword = (code: string, line: string, n: number): Effect => ({ id: `${code}:constant:${n}`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "EncounterKeyword" }] });
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
        when: { kind: "count", pick: { type: "location", control: "any", from: "victory", sharesTrait: "activeLocation" }, min: 1 },
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
        when: { kind: "count", pick: { type: "enemy", control: "any", from: "victory", sharesTrait: "attackingEnemy" }, min: 1 },
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
  // The Encounter keyword: the card is set aside at the start of the game and shuffled into the encounter deck by a card.
  encounterKeyword("09015", "09015:A:1", 1),
  encounterKeyword("19035", "19035:A:1", 2),
  encounterKeyword("22010", "22010:A:1", 1),
  encounterKeyword("17144", "17144:A:1", 1),
  // Ranger of the North: "When Revealed: The first player chooses a player to take control of Ranger of the North. Then, either deal
  // 2 damage to an enemy or place 2 progress tokens on a location."
  {
    id: "09015:whenRevealed:1",
    cardCode: "09015",
    lines: ["09015:A:2"],
    timing: "whenRevealed",
    instructions: [
      FIRST_PLAYER_CHOOSES,
      { verb: "TakeRevealedCard", who: "picked" },
      {
        verb: "Choose",
        who: "actor",
        options: [
          {
            id: "damage",
            requires: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true } },
            instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DamageCard", amount: 2, target: "picked" }],
          },
          {
            id: "progress",
            requires: { kind: "canPick", pick: { type: "location", control: "any" } },
            instructions: [{ verb: "Pick", pick: { type: "location", control: "any" } }, { verb: "PlaceProgressOn", amount: 2, target: "picked" }],
          },
        ],
      },
    ],
  },
  // Eagle of the North: "When Revealed: The first player chooses a player to take control of Eagle of the North. The chosen player
  // may choose and discard a non-unique enemy in the staging area."
  {
    id: "19035:whenRevealed:1",
    cardCode: "19035",
    lines: ["19035:A:3"],
    timing: "whenRevealed",
    instructions: [
      FIRST_PLAYER_CHOOSES,
      { verb: "TakeRevealedCard", who: "picked" },
      { verb: "SwitchActor", to: "picked" },
      { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, nonUnique: true } },
      { verb: "Discard", target: { kind: "picked" } },
    ],
  },
  // Tom Bombadil: "When Revealed: Choose a player. That player gains control of Tom Bombadil, ready and committed to the quest. At
  // the end of the round, remove Tom Bombadil and a copy of Tom Bombadillo! in the victory display from the game. This effect cannot
  // be cancelled."
  {
    id: "22010:whenRevealed:1",
    cardCode: "22010",
    lines: ["22010:A:2"],
    timing: "whenRevealed",
    uncancelable: ALWAYS,
    instructions: [
      FIRST_PLAYER_CHOOSES,
      { verb: "TakeRevealedCard", who: "picked", committed: true },
      {
        verb: "Delay",
        until: "endOfRound",
        uncancelable: ALWAYS,
        instructions: [
          { verb: "MoveCard", card: "self", to: "removed" },
          { verb: "Pick", pick: { type: "card", control: "any", from: "victory", names: ["Tom Bombadillo!"] } },
          { verb: "MoveCard", card: "picked", to: "removed" },
        ],
      },
    ],
  },
  // Wind from the Sea: "When Revealed: Ready each hero committed to the quest and remove Wind from the Sea from the game."
  {
    id: "17144:whenRevealed:1",
    cardCode: "17144",
    lines: ["17144:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "Each", pick: { type: "hero", control: "any", committed: true }, instructions: [{ verb: "Ready", target: "picked" }] }, { verb: "MoveCard", card: "self", to: "removed" }],
  },
  // Ranger Summons: "Planning Action: Shuffle 1 of your set aside Ranger of the North allies with the encounter keyword into the
  // encounter deck. Then, remove Ranger Summons from the game."
  {
    id: "09007:action:1",
    cardCode: "09007",
    lines: ["09007:A:2"],
    timing: "action",
    condition: { kind: "phase", is: "Planning" },
    instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: "09015", own: true }, { verb: "MoveCard", card: "self", to: "removed" }],
  },
  // Flight to the Sea: "Planning Action: Shuffle a set aside Wind from the Sea into the encounter deck. Then, remove Flight to the Sea
  // from the game."
  {
    id: "17140:action:1",
    cardCode: "17140",
    lines: ["17140:A:2"],
    timing: "action",
    condition: { kind: "phase", is: "Planning" },
    instructions: [{ verb: "ShuffleSetAsideIntoEncounterDeck", code: "17144" }, { verb: "MoveCard", card: "self", to: "removed" }],
  },
  // Flight of the Eagles: "Action: Return an Eagle ally to your hand to shuffle a set-aside Eagle of the North into the encounter
  // deck. Then, remove Flight of the Eagles from the game."
  {
    id: "19032:action:1",
    cardCode: "19032",
    lines: ["19032:A:1"],
    timing: "action",
    condition: { kind: "canPick", pick: { type: "ally", control: "you", trait: "Eagle" } },
    instructions: [
      { verb: "Pick", pick: { type: "ally", control: "you", trait: "Eagle" } },
      { verb: "ReturnToHand", target: "picked" },
      { verb: "ShuffleSetAsideIntoEncounterDeck", code: "19035" },
      { verb: "MoveCard", card: "self", to: "removed" },
    ],
  },
  // Tom Bombadillo!: "Planning Action: Add Tom Bombadillo! to the victory display to shuffle a set-aside copy of Tom Bombadil into the
  // encounter deck."
  {
    id: "22005:action:1",
    cardCode: "22005",
    lines: ["22005:A:2"],
    timing: "action",
    condition: { kind: "phase", is: "Planning" },
    instructions: [{ verb: "AddSourceToVictory" }, { verb: "ShuffleSetAsideIntoEncounterDeck", code: "22010" }],
  },
  // Fellowship (contract). Side A: "You cannot play non-unique allies or put non-unique allies into play." "Forced: When you control
  // exactly 9 unique characters, flip this card over." Side B: "You cannot play allies or put allies into play. Each character you
  // control gets +1 Willpower, +1 Attack, +1 Defense." "Forced: After a character you control leaves play, flip this card over."
  {
    id: "21074:constant:1",
    cardCode: "21074",
    lines: ["21074:A:1"],
    timing: "constant",
    condition: SIDE_A,
    instructions: [{ verb: "CannotPlay", pick: { type: "ally", control: "any", nonUnique: true } }],
  },
  ...(["enteredPlay", "leftPlay"] as const).map(
    (trigger, at): Effect => ({
      id: `21074:forced:${at + 1}`,
      cardCode: "21074",
      lines: ["21074:A:2"],
      timing: "forced",
      trigger,
      subject: { type: "character", control: "you", unique: true },
      condition: { kind: "all", conditions: [SIDE_A, { kind: "count", pick: { type: "character", control: "you", unique: true }, min: 9, max: 9 }] },
      instructions: [{ verb: "FlipCard" }],
    }),
  ),
  {
    id: "21074:constant:2",
    cardCode: "21074",
    lines: ["21074:B:1"],
    timing: "constant",
    condition: SIDE_B,
    instructions: [
      { verb: "CannotPlay", pick: { type: "ally", control: "any" } },
      ...(["willpower", "attack", "defense"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: 1, until: "whileSourceInPlay" as const, holders: { type: "character" as const, control: "you" as const } })),
    ],
  },
  {
    id: "21074:forced:3",
    cardCode: "21074",
    lines: ["21074:B:2"],
    timing: "forced",
    trigger: "leftPlay",
    subject: { type: "character", control: "you" },
    condition: SIDE_B,
    instructions: [{ verb: "FlipCard" }],
  },
  // Forth, The Three Hunters! Side A: "Your deck cannot include ally cards." "Each of your heroes can have 1 additional restricted
  // attachment. Reduce the cost of the first restricted attachment you play on each of your heroes each round by 1." "Refresh Action:
  // If each of your heroes has at least 2 restricted attachments, flip this card over." Side B: "Each of your heroes can have 1
  // additional restricted attachment and gets +1 Willpower for each restricted attachment on it." "Action: Exhaust this card to heal
  // 1 damage from each of your heroes."
  { id: "22049:constant:1", cardCode: "22049", lines: ["22049:A:1"], timing: "constant", instructions: [{ verb: "DeckRule", rule: { kind: "noCards", type: "ally" } }] },
  {
    id: "22049:constant:2",
    cardCode: "22049",
    lines: ["22049:A:2"],
    timing: "constant",
    condition: SIDE_A,
    instructions: [
      { verb: "ModifyStat", stat: "extraRestricted", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "you" } },
      { verb: "ReduceFirstOnEachHero", pick: { type: "attachment", control: "you", keyword: "restricted" }, amount: 1 },
    ],
  },
  {
    id: "22049:action:1",
    cardCode: "22049",
    lines: ["22049:A:3"],
    timing: "action",
    condition: { kind: "all", conditions: [SIDE_A, { kind: "phase", is: "Refresh" }, { kind: "allMatch", of: { type: "hero", control: "you" }, match: { type: "hero", control: "you", restrictedAttachments: 2 } }] },
    instructions: [{ verb: "FlipCard" }],
  },
  {
    id: "22049:constant:3",
    cardCode: "22049",
    lines: ["22049:B:1"],
    timing: "constant",
    condition: SIDE_B,
    instructions: [
      { verb: "ModifyStat", stat: "extraRestricted", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "you" } },
      { verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "you" }, eachAttached: { type: "attachment", control: "any", keyword: "restricted" } },
    ],
  },
  {
    id: "22049:action:2",
    cardCode: "22049",
    lines: ["22049:B:2"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    condition: SIDE_B,
    instructions: [{ verb: "Each", pick: { type: "hero", control: "you" }, instructions: [{ verb: "Heal", amount: 1, target: "picked" }] }],
  },
  // The Grey Wanderer. Side A: "You cannot choose more than 1 starting hero." "Setup: Search your deck for an attachment with a
  // printed cost of 1 and put it into play. Then, flip this card over." Side B: "The first non-unique card you play each planning
  // phase does not require a resource match." "Action: Exhaust this card and raise your threat by 1 to (choose two): Ready your
  // starting hero, add 2 resources to your starting hero's resource pool, or heal 3 damage from your starting hero."
  { id: "22074:constant:1", cardCode: "22074", lines: ["22074:A:1"], timing: "constant", instructions: [{ verb: "DeckRule", rule: { kind: "heroes", max: 1 } }] },
  {
    id: "22074:setup:1",
    cardCode: "22074",
    lines: ["22074:A:2"],
    timing: "setup",
    instructions: [
      { verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", cost: 1, intoPlay: true } },
      { verb: "PutIntoPlay", card: "picked" },
      { verb: "FlipCard" },
    ],
  },
  {
    id: "22074:constant:2",
    cardCode: "22074",
    lines: ["22074:B:1"],
    timing: "constant",
    condition: SIDE_B,
    instructions: [{ verb: "IgnoreResourceMatch", pick: { type: "card", control: "you", nonUnique: true }, firstEachPhase: true, when: { kind: "phase", is: "Planning" } }],
  },
  {
    id: "22074:action:1",
    cardCode: "22074",
    lines: ["22074:B:2"],
    timing: "action",
    cost: [{ kind: "exhaustSelf" }, { kind: "raiseThreat", amount: 1 }],
    condition: SIDE_B,
    instructions: [
      { verb: "Choose", who: "actor", different: true, options: GREY_WANDERER_OPTIONS },
      { verb: "Choose", who: "actor", different: true, options: GREY_WANDERER_OPTIONS },
    ],
  },
  // Council of the Wise. Side A: "You cannot include more than 1 copy of a card, by title, in your deck." "Response: After you play
  // an event from your hand, choose one: reduce your threat by 1, draw 1 card, or add 1 resource to your hero's resource pool. You
  // can only choose each option once per round."
  { id: "22091:constant:1", cardCode: "22091", lines: ["22091:A:1"], timing: "constant", instructions: [{ verb: "DeckRule", rule: { kind: "copies", max: 1 } }] },
  {
    id: "22091:response:1",
    cardCode: "22091",
    lines: ["22091:A:2"],
    timing: "response",
    trigger: "played",
    eventSeat: "you",
    subject: { type: "card", control: "you", cardType: "event" },
    condition: { kind: "any", conditions: COUNCIL.map((flag) => ({ kind: "flag" as const, stat: flag, holder: "seat" as const, is: false })) },
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "threat", requires: notTaken("councilThreat"), instructions: [{ verb: "LowerThreat", amount: 1, who: "actor" }, taken("councilThreat")] },
          { id: "draw", requires: notTaken("councilDraw"), instructions: [{ verb: "Draw", amount: 1 }, taken("councilDraw")] },
          {
            id: "resource",
            requires: { kind: "all", conditions: [notTaken("councilResource"), { kind: "canPick", pick: { type: "hero", control: "you" } }] },
            instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "AddResources", amount: 1, to: "picked" }, taken("councilResource")],
          },
        ],
      },
    ],
  },
  // Bond of Friendship: "Your deck must be exactly 50 players cards and include exactly 10 cards from each of these four spheres:
  // Leadership, Lore, Spirit, and Tactics. You cannot include more than 2 copies of any card by title in your deck." "When choosing
  // your starting heroes, you may choose 4 heroes instead of 3. Each of your heroes must belong to a different sphere."
  {
    id: "22147:constant:1",
    cardCode: "22147",
    lines: ["22147:A:1"],
    timing: "constant",
    instructions: [{ verb: "DeckRule", rule: { kind: "size", exactly: 50 } }, { verb: "DeckRule", rule: { kind: "perSphere", count: 10 } }, { verb: "DeckRule", rule: { kind: "copies", max: 2 } }],
  },
  { id: "22147:constant:2", cardCode: "22147", lines: ["22147:A:2"], timing: "constant", instructions: [{ verb: "DeckRule", rule: { kind: "heroes", max: 4, differentSpheres: true } }] },
  // A Perilous Voyage. Side A: "Your minimum deck size is 100 cards. Your threat cannot be reduced by player card effects. Action:
  // Exhaust this card and raise your threat by 1 to look at the top 2 cards of your deck, draw 1, and place the other on the bottom
  // of your deck." "Forced: When you would be eliminated by reaching your threat elimination level, flip this card over instead."
  // Side B: "Your threat cannot be reduced by non-contract player card effects. Heroes you control do not exhaust to quest." "Forced:
  // When this card is flipped to this side, reduce your threat by 10. Search your deck for a card and either add it to your hand or
  // play it, reducing its cost by 3. Shuffle your deck."
  { id: "40047:constant:1", cardCode: "40047", lines: ["40047:A:1"], timing: "constant", instructions: [{ verb: "DeckRule", rule: { kind: "size", min: 100 } }] },
  {
    id: "40047:constant:2",
    cardCode: "40047",
    lines: ["40047:A:1"],
    timing: "constant",
    condition: SIDE_A,
    instructions: [{ verb: "ModifyStat", stat: "noThreatReduction", amount: 1, until: "whileSourceInPlay", target: "actorSeat" }],
  },
  {
    id: "40047:action:1",
    cardCode: "40047",
    lines: ["40047:A:1"],
    timing: "action",
    cost: [{ kind: "exhaustSelf" }, { kind: "raiseThreat", amount: 1 }],
    condition: SIDE_A,
    instructions: [
      { verb: "LookAtTop", count: 2, deck: "own" },
      { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 2 } },
      { verb: "MovePicked", to: "hand" },
      { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 1 } },
      { verb: "MoveCard", card: "picked", to: "deckBottom" },
    ],
  },
  {
    id: "40047:forced:1",
    cardCode: "40047",
    lines: ["40047:A:2"],
    timing: "forced",
    trigger: "wouldBeEliminated",
    eventSeat: "you",
    condition: SIDE_A,
    instructions: [{ verb: "FlipCard" }],
  },
  {
    id: "40047:constant:3",
    cardCode: "40047",
    lines: ["40047:B:1"],
    timing: "constant",
    condition: SIDE_B,
    instructions: [
      { verb: "ModifyStat", stat: "noThreatReduction", amount: 2, until: "whileSourceInPlay", target: "actorSeat" },
      { verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "you" } },
    ],
  },
  {
    id: "40047:forced:2",
    cardCode: "40047",
    lines: ["40047:B:2"],
    timing: "forced",
    trigger: "flipped",
    subject: "self",
    condition: SIDE_B,
    instructions: [
      { verb: "LowerThreat", amount: 10, who: "actor" },
      { verb: "Pick", pick: { type: "card", control: "you", from: "deck" } },
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "hand", instructions: [{ verb: "MovePicked", to: "hand" }] },
          { id: "play", instructions: [{ verb: "MovePicked", to: "hand" }, { verb: "PlayFromHand", pick: { type: "card", control: "you" }, picked: true, reduce: 3 }] },
        ],
      },
      { verb: "ShuffleDeck" },
    ],
  },
  // The contracts that build a loot deck or turn an ally into a hero (sidequests-contracts.ts).
  ...CONTRACT_RECORDS,
  // Out of the Wild: "Action: Search the top 5 cards of the encounter deck for any 1 non-objective card worth no victory points and
  // add it to your victory display. Shuffle the encounter deck. Add Out of the Wild to the victory display."
  {
    id: "04036:action:1",
    cardCode: "04036",
    lines: ["04036:A:2"],
    timing: "action",
    instructions: [
      { verb: "PickEncounter", from: "deck", top: 5, notType: "objective", noVictory: true },
      { verb: "MoveEncounterCard", to: "victory" },
      { verb: "ShuffleEncounterDeck" },
      { verb: "AddSourceToVictory" },
    ],
  },
  // The Red Arrow: "Valour Response: After attached hero quests successfully, add The Red Arrow to the victory display to search the
  // top 5 cards of your deck for an ally and put it into play."
  {
    id: "17058:response:1",
    cardCode: "17058",
    lines: ["17058:A:3"],
    timing: "response",
    trigger: "questedSuccessfully",
    subject: "host",
    cost: { kind: "addSelfToVictory" },
    condition: { kind: "threat", min: 40, valour: true },
    instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: 5, cardType: "ally", intoPlay: true } }, { verb: "MovePicked", to: "play" }],
  },
  // Black Arrow: "Response: After attached hero declares an attack, add Black Arrow to the victory display to give attached hero +5
  // Attack for this attack."
  {
    id: "132015:response:1",
    cardCode: "132015",
    lines: ["132015:A:2"],
    timing: "response",
    trigger: "declaredAttacker",
    subject: "host",
    cost: { kind: "addSelfToVictory" },
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 5, until: "endOfAttack", target: "subject" }],
  },
  // Friend of Friends: "Attach to a Hobbit hero. Limit 2 copies of Friend of Friends in play."
  {
    id: "146012:constant:2",
    cardCode: "146012",
    lines: ["146012:A:1"],
    timing: "constant",
    instructions: [{ verb: "AttachesTo", host: { kind: "hero" }, hosts: [{ type: "hero", control: "any", trait: "Hobbit" }] }, { verb: "InPlayLimit", copies: 2 }],
  },
  // The Road Goes Ever On: "Response: When attached quest is defeated, the first player chooses a player. That player searches his
  // deck for a side quest, adds it to his hand, and shuffles his deck."
  {
    id: "16012:response:1",
    cardCode: "16012",
    lines: ["16012:A:2"],
    timing: "response",
    trigger: "hostDefeated",
    instructions: [
      { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } },
      { verb: "ActAs", who: "pickedPlayer" },
      { verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "player-side-quest" } },
      { verb: "MovePicked", to: "hand" },
      { verb: "ShuffleDeck" },
    ],
  },
  // Setup lines of heroes. Denethor: "Setup: Add 2 resources to Denethor's resource pool." Éowyn: "Setup: Reduce your threat by 3."
  // Thurindir: "Setup: Search your deck for a side quest and add it to your hand. Shuffle your deck."
  { id: "12001:setup:1", cardCode: "12001", lines: ["12001:A:1"], timing: "setup", instructions: [{ verb: "AddResources", amount: 2, to: "self" }] },
  { id: "145002:setup:1", cardCode: "145002", lines: ["145002:A:1"], timing: "setup", instructions: [{ verb: "LowerThreat", amount: 3, who: "actor" }] },
  {
    id: "17028:setup:1",
    cardCode: "17028",
    lines: ["17028:A:2"],
    timing: "setup",
    instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "player-side-quest" } }, { verb: "MovePicked", to: "hand" }, { verb: "ShuffleDeck" }],
  },
  // The Lórien gifts: "Setup: Attach to a hero in play." (the campaign pool shuffles one into its player's deck: the Setup search finds
  // it and attaches it). Each Action adds the gift to the victory display and removes it from the campaign pool.
  ...["142015", "142016", "142017", "142018"].map(
    (code): Effect => ({ id: `${code}:setup:1`, cardCode: code, lines: [`${code}:A:1`], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero" } }] }),
  ),
  // Phial of Galadriel: "Action: Add Phial of Galadriel to the victory display and remove it from the campaign pool, to give each enemy
  // engaged with you -4 Attack until the end of the round."
  {
    id: "142015:action:1",
    cardCode: "142015",
    lines: ["142015:A:2"],
    timing: "action",
    cost: { kind: "addSelfToVictory" },
    instructions: [{ verb: "RemoveFromCampaignPool" }, { verb: "ModifyStat", stat: "attack", amount: -4, until: "endOfRound", holders: { type: "enemy", control: "any", engaged: "you" } }],
  },
  // Three Golden Hairs: "Action: Add Three Golden Hairs to the victory display and remove it from the campaign pool, to lower each
  // player's threat by 3. Then, each player draws 3 cards."
  {
    id: "142016:action:1",
    cardCode: "142016",
    lines: ["142016:A:2"],
    timing: "action",
    cost: { kind: "addSelfToVictory" },
    instructions: [
      { verb: "RemoveFromCampaignPool" },
      { verb: "LowerThreat", amount: 3, who: "eachSeat" },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", amount: 3 }] },
    ],
  },
  // Lórien Rope: "Action: Add Lórien Rope to the victory display, and remove it from the campaign pool to give each location in the
  // staging area -2 Threat until the end of the phase."
  {
    id: "142017:action:1",
    cardCode: "142017",
    lines: ["142017:A:2"],
    timing: "action",
    cost: { kind: "addSelfToVictory" },
    instructions: [{ verb: "RemoveFromCampaignPool" }, { verb: "ModifyStat", stat: "threat", amount: -2, until: "endOfPhase", holders: { type: "location", control: "any", stagingOnly: true } }],
  },
  // Leaf-wrapped Lembas: "Action: Add Leaf-wrapped Lembas to the victory display and remove it from the campaign pool, to ready all
  // heroes in play."
  {
    id: "142018:action:1",
    cardCode: "142018",
    lines: ["142018:A:2"],
    timing: "action",
    cost: { kind: "addSelfToVictory" },
    instructions: [{ verb: "RemoveFromCampaignPool" }, { verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "Ready", target: "picked" }] }],
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
