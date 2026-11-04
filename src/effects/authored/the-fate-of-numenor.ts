import type { Effect, PickSpec } from "../../catalog/boundary.ts";

import { copyLine, copyLines, withCopies } from "./reprint.ts";

// Records for The Fate of Númenor (Dream-chaser part 2, campaign card 11179): the two quest stages, the Fate of Númenor, Drowned Dead and Ruins of Númenor encounter cards no template or
// earlier record reads, the Lost Island and real sides of the double-sided locations, Calphon, and the campaign card. Spyglass and Revenant, which the campaign card places, are in
// pool/DCCE.ts. Every line is read from the scan ledger (data/printed/dream-chaser.json).
// Rules: dcce.uncharted, dcce.uncharted-deck, dcce.encounter-cards, dcce.scalable-upgradable, dcce.gaining-xp, dcce.setup-the-fate-of-numenor, dcce.campaign-setup-the-fate-of-numenor,
// rr.explored, rr.search, rr.active-location, rr.travel (data/rules/entries.json).
const ACTIVE = { kind: "sourceIn", zone: "activeLocation" } as const;
const IN_STAGING = { kind: "sourceIn", zone: "staging" } as const;
const MANY_PLAYERS = { kind: "count", pick: { type: "player", control: "any" }, min: 3 } as const;
const FEW_PLAYERS = { kind: "not", condition: MANY_PLAYERS } as const;
// The card DiscardBottom discarded has a printed cost of 2 or less ("If that card's printed cost is 2 or less").
const CHEAP = { kind: "discardedCost", max: 2 } as const;
// The card LookAtTop looked at (the picked card) has a printed cost of 2 or less.
const TOP_CHEAP = { kind: "matches", card: "picked", pick: { type: "card", control: "any", maxCost: 2 } } as const;
const ANY_LOCATION: PickSpec = { type: "location", control: "any" };
// A Lost Island in the staging area, and a non-objective ally with a printed cost of 2 or less.
const STAGED_LOST_ISLAND: PickSpec = { type: "location", control: "any", uncharted: true, stagingOnly: true };
const CHEAP_ALLY: PickSpec = { type: "ally", control: "any", cardType: "ally", maxCost: 2 };

// "Forced: After X is flipped over while active, ..." of the real side of a double-sided location.
export const flippedActive = (code: string, line: string, id: number, instructions: Effect["instructions"]): Effect => ({ id: `${code}:forced:${id}`, cardCode: code, lines: [line], timing: "forced", trigger: "flippedOver", subject: "self", condition: ACTIVE, instructions });

// "Shadow: Discard the bottom card of the defending player's deck. If that card's printed cost is 2 or less, attacking enemy gets +2 Attack." (the shadow effect resolves for the defending player)
const bottomAttack = (code: string, line: string): Effect => ({
  id: `${code}:shadow:1`,
  cardCode: code,
  lines: [line],
  timing: "shadow",
  instructions: [{ verb: "DiscardBottom" }, { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: CHEAP }],
}) satisfies Effect;

// "If Calphon leaves play, the players lose the game."

// "Action: Exhaust Calphon to look at the bottom card (the bottom 5 cards) of your deck. Then, you may switch that card (one of them) with a card in your hand."
const calphonAction = (code: string, line: string, id: number, count: number): Effect => ({
  id: `${code}:action:${id}`,
  cardCode: code,
  lines: [line],
  timing: "action",
  cost: { kind: "exhaustSelf" },
  instructions: [
    { verb: "LookAtBottom", count },
    {
      verb: "Choose",
      who: "actor",
      options: [
        {
          id: "switch",
          requires: { kind: "handHasCard" },
          instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", looked: true } }, { verb: "Pick", pick: { type: "card", control: "you", from: "hand" } }, { verb: "SwapPicked" }],
        },
        { id: "keep", instructions: [] },
      ],
    },
  ],
});

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 11025 Explore the Island. Setup: Shrine to Morgoth is set aside by the scenario's piles; the Uncharted deck is prepared, 2 Lost Islands (3 with 3 or 4 players) join the staging area,
  // the first player takes control of Calphon, the encounter deck is shuffled. Side B: no progress can be placed on the stage except by its own effect; an explored location adds its printed
  // quest points; an Uncharted location becoming active brings another Lost Island.
  {
    id: "11025:setup:1",
    cardCode: "11025",
    lines: ["11025:A:1"],
    timing: "setup",
    instructions: [
      { verb: "PrepareUnchartedDeck" },
      { verb: "AddLostIslands", count: 2, when: FEW_PLAYERS },
      { verb: "AddLostIslands", count: 3, when: MANY_PLAYERS },
      { verb: "PutSetAsideInPlay", name: "Calphon" },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "11025:constant:1", cardCode: "11025", lines: ["11025:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "11025:forced:1",
    cardCode: "11025",
    lines: ["11025:B:2"],
    timing: "forced",
    trigger: "leftPlay",
    subject: ANY_LOCATION,
    condition: { kind: "subjectExplored" },
    instructions: [{ verb: "AddStageProgress", amount: { stat: "questPoints", of: "subject", printed: true } }],
  },
  {
    id: "11025:forced:2",
    cardCode: "11025",
    lines: ["11025:B:3"],
    timing: "forced",
    trigger: "becameActive",
    subject: { type: "location", control: "any", uncharted: true },
    instructions: [{ verb: "AddLostIslands", count: 1 }],
  },

  // 11026 A Fateful Discovery. When Revealed: 2 Lost Islands and the Shrine to Morgoth (Lost Island side up) join the staging area, and the Lost Islands there lose their progress and are
  // shuffled. Side B: an explored double-sided location goes to the victory display instead of back into the Uncharted deck; the stage has no quest points, and the players win once the
  // Shrine to Morgoth is in the victory display.
  {
    id: "11026:whenRevealed:1",
    cardCode: "11026",
    lines: ["11026:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AddLostIslands", count: 2 }, { verb: "AddSetAsideLostIsland", code: "11027" }, { verb: "ScrambleUncharted" }],
  },
  {
    id: "11026:forced:1",
    cardCode: "11026",
    lines: ["11026:B:1"],
    timing: "forced",
    trigger: "leftPlay",
    subject: ANY_LOCATION,
    condition: { kind: "all", conditions: [{ kind: "subjectExplored" }, { kind: "matches", card: "subject", pick: { type: "location", control: "any", uncharted: true } }] },
    instructions: [{ verb: "AddToVictory", target: "subject" }],
  },
  { id: "11026:constant:1", cardCode: "11026", lines: ["11026:B:2"], timing: "constant", condition: { kind: "inVictory", code: "11027", is: true }, instructions: [{ verb: "WinGame" }] },

  // 11027 Shrine to Morgoth. While active nobody draws or searches a deck. Forced: once flipped over while active, every ally with a printed cost of 2 or less is exhausted and each player
  // searches the encounter deck and discard pile for an Undead enemy that engages them. The Lost Island side is the same on every double-sided location.
  { id: "11027:constant:1", cardCode: "11027", lines: ["11027:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "cannotDraw", amount: 1, until: "whileSourceInPlay", target: "table" }, { verb: "ModifyStat", stat: "noDeckSearch", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  flippedActive("11027", "11027:A:2", 1, [
    { verb: "ExhaustEach", pick: CHEAP_ALLY },
    { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", trait: "Undead", type: "enemy", to: "engaged" }] },
    { verb: "ShuffleEncounterDeck" },
  ]),
  // The Lost Island side, printed the same on every double-sided location (Uncharted is a keyword): no player card attachments, flip it over once it is the active location, and the Action that looks at
  // the facedown side for 4 progress. The other locations take these records by copy (copyLines, authored/reprint.ts), here and in temple-of-the-deceived.ts.
  { id: "11027:constant:2", cardCode: "11027", lines: ["11027:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay" }] },
  { id: "11027:forced:2", cardCode: "11027", lines: ["11027:B:3"], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "FlipUncharted" }] },
  {
    id: "11027:action:1",
    cardCode: "11027",
    lines: ["11027:B:4"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "matches", card: "self", pick: { type: "location", control: "any", minProgress: 4 } },
    instructions: [{ verb: "LookAtFacedown", remove: 4 }],
  },

  // 11028 Calphon: the first player controls him; his Action looks at the bottom card of the owner's deck and may switch it with a card in hand; the players lose when he leaves play (a template writes it).
  { id: "11028:constant:1", cardCode: "11028", lines: ["11028:A:1"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "self" }] },
  calphonAction("11028", "11028:A:2", 1, 1),
  // 110013 Calphon (the Campaign Expansion's reprint): the same on its front side; its Upgraded side looks at the bottom 5 cards and switches one of them.
  copyLines("11028", "110013", "A:1", "A:2"),
  copyLine("11028:A:1", "110013:B:2"),
  calphonAction("110013", "110013:B:3", 2, 5),

  // 11029 Servant of the Deceiver. Forced: when it engages you, you look at the top card of your deck; at a printed cost of 2 or less it goes to the bottom and the Servant gets +2 Attack
  // until the end of the round.
  {
    id: "11029:forced:1",
    cardCode: "11029",
    lines: ["11029:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    eventSeat: "you",
    instructions: [
      { verb: "LookAtTop", count: 1, deck: "own" },
      { verb: "MoveCard", card: "picked", to: "deckBottom", from: ["deck"], when: TOP_CHEAP },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfRound", target: "self", when: TOP_CHEAP },
    ],
  },

  // 11030 Lush Jungle. In the staging area characters get -1 Attack and lose ranged. Forced: once flipped over while active it returns to the staging area unless each player exhausts each
  // ready hero they control.
  {
    id: "11030:constant:1",
    cardCode: "11030",
    lines: ["11030:A:1"],
    timing: "constant",
    condition: IN_STAGING,
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: -1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } },
      { verb: "ModifyStat", stat: "loseRanged", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } },
    ],
  },
  flippedActive("11030", "11030:A:2", 1, [
    {
      verb: "Choose",
      who: "firstPlayer",
      options: [
        { id: "exhaust", instructions: [{ verb: "ExhaustEach", pick: { type: "hero", control: "any", state: "ready" } }] },
        { id: "return", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },
      ],
    },
  ]),
  copyLines("11027", "11030", "B:2", "B:3", "B:4"),

  // 11031 Forbidden Coast. Forced: once flipped over while active each player may draw a card; then each player puts a card from their hand on the bottom of their deck.
  flippedActive("11031", "11031:A:1", 1, [
    { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Choose", who: "actor", options: [{ id: "draw", instructions: [{ verb: "Draw", amount: 1 }] }, { id: "skip", instructions: [] }] }] },
    { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "hand" } }, { verb: "MoveCard", card: "picked", to: "deckBottom", from: ["hand"] }] },
  ]),
  copyLines("11027", "11031", "B:3", "B:4"),

  // 11032 Steep Plateau. Response: after it is explored, look at the facedown side of an Uncharted location in the staging area. Shadow: the bottom card of the defending player's deck is
  // discarded; at a printed cost of 2 or less the attacker gets +2 Attack.
  {
    id: "11032:response:1",
    cardCode: "11032",
    lines: ["11032:A:1"],
    timing: "response",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "all", conditions: [{ kind: "subjectExplored" }, { kind: "canPick", pick: STAGED_LOST_ISLAND }] },
    instructions: [{ verb: "Pick", pick: STAGED_LOST_ISLAND }, { verb: "LookAtFacedown", target: "picked" }],
  },
  bottomAttack("11032", "11032:A:2"),

  // 11033 Mysterious Fog. When Revealed: either each player exhausts a character they control, or each Lost Island in the staging area gets +1 Threat until the end of the phase. Shadow: the
  // bottom card of your deck is discarded; at a printed cost of 2 or less you exhaust a character you control.
  {
    id: "11033:whenRevealed:1",
    cardCode: "11033",
    lines: ["11033:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "exhaust", instructions: [{ verb: "EachExhaustsOne" }] },
          { id: "threat", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", holders: STAGED_LOST_ISLAND }] },
        ],
      },
    ],
  },
  {
    id: "11033:shadow:1",
    cardCode: "11033",
    lines: ["11033:A:2"],
    timing: "shadow",
    instructions: [{ verb: "DiscardBottom" }, { verb: "Pick", pick: { type: "character", control: "you", state: "ready" }, when: CHEAP }, { verb: "Exhaust", target: { kind: "picked" }, when: CHEAP }],
  },

  // 11034 Lingering Malevolence. When Revealed: the first player discards the bottom card of their deck, then each card in their hand with a printed cost higher than it. Shadow as 11032.
  {
    id: "11034:whenRevealed:1",
    cardCode: "11034",
    lines: ["11034:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "DiscardBottom", who: "firstPlayer" }, { verb: "DiscardCostlier", who: "firstPlayer" }],
  },
  bottomAttack("11034", "11034:A:2"),

  // 11035 Ruins of Ages Past (Surge and Doomed are keywords). When Revealed: another Lost Island joins the staging area, and the Lost Islands there lose their progress and are shuffled.
  { id: "11035:whenRevealed:1", cardCode: "11035", lines: ["11035:A:2"], timing: "whenRevealed", instructions: [{ verb: "AddLostIslands", count: 1 }, { verb: "ScrambleUncharted" }] },

  // 11068 Drowned Dead. Forced: when it attacks and destroys an ally, that ally goes to the bottom of its owner's deck; Shadow: if this attack destroys an ally, the same.
  {
    id: "11068:forced:1",
    cardCode: "11068",
    lines: ["11068:A:1"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    condition: { kind: "matches", card: "other", pick: { type: "card", control: "any", cardType: "ally" }, inPlay: false },
    instructions: [{ verb: "MoveCard", card: "other", to: "deckBottom", from: ["discard"] }],
  },
  {
    id: "11068:shadow:1",
    cardCode: "11068",
    lines: ["11068:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "AfterAttack",
        instructions: [
          {
            verb: "MoveCard",
            card: "other",
            to: "deckBottom",
            from: ["discard"],
            when: { kind: "all", conditions: [{ kind: "x", min: 1 }, { kind: "matches", card: "other", pick: { type: "card", control: "any", cardType: "ally" }, inPlay: false }] },
          },
        ],
      },
    ],
  },

  // 11069 Soulless Cadaver. While you are engaged with it your deck cannot be searched. Forced: when it engages you, each card in your hand with a printed cost of 2 or less goes to the bottom
  // of your deck.
  { id: "11069:constant:1", cardCode: "11069", lines: ["11069:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "noDeckSearch", amount: 1, until: "whileSourceInPlay", target: "engagedSeat" }] },
  {
    id: "11069:forced:1",
    cardCode: "11069",
    lines: ["11069:A:2"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    eventSeat: "you",
    instructions: [{ verb: "Each", pick: { type: "card", control: "you", from: "hand", maxCost: 2 }, instructions: [{ verb: "MoveCard", card: "picked", to: "deckBottom", from: ["hand"] }] }],
  },

  // 11070 Throngs of Unfaithful (Surge is a keyword). Forced: when it is destroyed, the bottom card of the engaged player's deck is discarded; at a printed cost of 2 or less it returns to the
  // top of the encounter deck.
  {
    id: "11070:forced:1",
    cardCode: "11070",
    lines: ["11070:A:2"],
    timing: "forced",
    trigger: "enemyDestroyed",
    subject: "self",
    instructions: [{ verb: "DiscardBottom" }, { verb: "MoveEncounterCard", card: "self", to: "deckTop", when: CHEAP }],
  },

  // 11071 Curse of the Downfallen. When Revealed: 1 damage to each non-objective ally with a printed cost of 2 or less; an ally destroyed by it goes to the bottom of its owner's deck. Shadow: the
  // bottom card of your deck is discarded; at a printed cost of 2 or less the attacking enemy makes an additional attack.
  {
    id: "11071:whenRevealed:1",
    cardCode: "11071",
    lines: ["11071:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Each", pick: CHEAP_ALLY, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }, { verb: "MoveCard", card: "picked", to: "deckBottom", from: ["discard"] }] }],
  },
  { id: "11071:shadow:1", cardCode: "11071", lines: ["11071:A:2"], timing: "shadow", instructions: [{ verb: "DiscardBottom" }, { verb: "AfterAttack", when: CHEAP, instructions: [{ verb: "ImmediateAttack" }] }] },

  // 11072 Flooded Ruins. While active it contributes its Threat to the staging area.
  { id: "11072:constant:1", cardCode: "11072", lines: ["11072:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "activeThreat", amount: 1, until: "whileSourceInPlay" }] },
  copyLines("11027", "11072", "B:2", "B:3", "B:4"),

  // 11073 Drowned Graves. Forced: once flipped over while active, the top X cards of the encounter deck are discarded (X is 2 more than the number of players) and each player adds an Undead
  // enemy among them to the staging area.
  flippedActive("11073", "11073:A:1", 1, [{ verb: "DiscardEncounterTop", count: { players: true, plus: 2 } }, { verb: "StageLooked", trait: "Undead", type: "enemy" }]),
  copyLines("11027", "11073", "B:3", "B:4"),

  // 11074 Cursed Temple. While active, characters with less than 2 Willpower do not ready during the refresh phase.
  {
    id: "11074:constant:1",
    cardCode: "11074",
    lines: ["11074:A:1"],
    timing: "constant",
    condition: ACTIVE,
    instructions: [{ verb: "ModifyStat", stat: "doesNotReady", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any", maxWillpower: 1 } }],
  },
  copyLines("11027", "11074", "B:2", "B:3", "B:4"),

  // 11075 Aimless Wandering. When Revealed: the players remove characters with a total of at least X Willpower from the quest (X is the number of Uncharted locations in the staging area).
  // The first player may give it doomed 2 to look at the facedown side of an Uncharted location in the staging area.
  {
    id: "11075:whenRevealed:1",
    cardCode: "11075",
    lines: ["11075:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "RemoveWillpowerFromQuest", amount: { count: STAGED_LOST_ISLAND } },
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "look", requires: { kind: "canPick", pick: STAGED_LOST_ISLAND }, instructions: [{ verb: "Doomed", amount: 2 }, { verb: "Pick", pick: STAGED_LOST_ISLAND }, { verb: "LookAtFacedown", target: "picked" }] },
          { id: "skip", instructions: [] },
        ],
      },
    ],
  },

  // 11179 The Fate of Númenor (campaign card). Setup (Campaign Mode): Spyglass is set aside and attached to Calphon once the quest card's Setup has put him into play, Revenant is shuffled
  // into the encounter deck, and each character in play may take 1 damage to lower its controller's threat by 1. The card stays in the game because Revenant places resources on it.
  // Resolution: the XP list.
  {
    id: "11179:campaignSetup:1",
    cardCode: "11179",
    lines: ["11179:A:2"],
    timing: "campaignSetup",
    instructions: [
      { verb: "KeepCampaignCard" },
      { verb: "SetAside", code: "11180" },
      { verb: "ShuffleIntoEncounterDeck", code: "11181" },
      { verb: "AttachSetAsideTo", code: "11180", to: "Calphon" },
      { verb: "TradeDamageForThreat", damage: 1, threat: 1 },
    ],
  },
  { id: "11179:resolution:2", cardCode: "11179", lines: ["11179:B:3"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: ["11030", "11073"] } }] },
  { id: "11179:resolution:3", cardCode: "11179", lines: ["11179:B:4"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "tokens", code: "11179" }, max: 3 }] },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
