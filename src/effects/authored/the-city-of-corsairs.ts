import type { Condition, Effect, PickSpec } from "../../catalog/boundary.ts";

// Records for The City of Corsairs (dream-chaser part 9, campaign card 11215): the four quest stages, the quest's two decks and the swap between them. Every line is read from the scan ledger (data/printed/); a line a template already
// writes (pnpm data:build) or another card prints word for word needs no record here. `pnpm effects:draft the-city-of-corsairs` writes the bundle of open lines.
// The scenario's piles deal the Corsair deck, the second encounter deck (The City of Corsairs set, set aside as the inactive second deck), the fleet, the Stormcaller and Southern Belfalas to the staging area
// (data/scenarios/the-city-of-corsairs.json); the stage 2B record makes the second deck the active one.
// Rules: dcce.from-sea-to-land, dcce.setup-the-city-of-corsairs, dcce.corsair-deck, dcce.heading, dcce.indestructible, dcce.ship-objectives, dcce.campaign-mode, rr.victory, rr.search, rr.quest-advancement, rr.destroy
// (data/rules/entries.json).

const OFF_COURSE: Condition = { kind: "heading", is: "offCourse" };
const STORMCALLER: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Stormcaller"] };
const SAHIR: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Captain Sahír"] };
const RAIDER: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Raider" };
// The Ship objectives a player controls, and the characters that are not Ships the same player controls (dcce.ship-objectives: a Ship objective is a character).
const YOUR_SHIP: PickSpec = { type: "character", control: "you", trait: "Ship" };
const YOUR_LAND_CHARACTER: PickSpec = { type: "character", control: "you", notTraits: ["Ship"] };
// "All Ship enemies, Ship objectives, and Ocean locations in play" (12148:A:1).
const SHIP_ENEMIES: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Ship" };
const SHIP_OBJECTIVES: PickSpec = { type: "character", control: "any", trait: "Ship" };
const OCEAN_LOCATIONS: PickSpec = { type: "location", control: "any", trait: "Ocean" };
// The Stormcaller was not destroyed at stage 1: a destroyed enemy with a Victory value is in the victory display.
const STORMCALLER_SURVIVED: Condition = { kind: "inVictory", code: "12151", is: false };
// Watch Tower (12156) and Battle-hardened (11067) of the first encounter deck, the cards stage 2B's search carries to the second.
const WATCH_TOWER = "12156";
const BATTLE_HARDENED = "11067";
// The Shattered Monument is dealt as 12159, or as 110129 in a campaign game (the scenario's `reprints`); a Setup effect names the card, so each code is asked for.
const MONUMENT_CODES = ["12159", "110129"] as const;
const SAHIR_CODE = "12158";
// "That enemy" the stage 4 Forced effects read the resources of: the destroyed card, a hero or an enemy.
const DESTROYED_RESOURCES = { stat: "resources", of: "subject" } as const;
// The resource tokens the destroyed hero or enemy held go to Captain Sahír, who is in play (when he is the one destroyed, no Sahír is in play and nothing is added).
const addToSahir: Effect["instructions"] = [{ verb: "Each", pick: SAHIR, instructions: [{ verb: "PlaceResourceTokens", amount: DESTROYED_RESOURCES, on: "picked" }] }];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 12147 The Coast of Umbar. Setup: the first encounter deck is built from the scenario's piles (the Coast of Umbar, Corsair Raiders, Stormy Weather, Umbar Fleet and Voyage Across Belegaer sets) and The City of Corsairs
  // set waits set aside; the Stormcaller and Southern Belfalas (1, 2 with three or four players: the piles' byPlayers) are added to the staging area by the piles. What is left is to prepare the Corsair deck and the
  // fleet and to shuffle the encounter deck. Side B (Sailing is a keyword): no progress off-course; destroying the Stormcaller advances to stage 2 (15 progress is the stage's quest points: it advances by the quest rule).
  { id: "12147:setup:1", cardCode: "12147", lines: ["12147:A:1"], timing: "setup", instructions: [{ verb: "PrepareCorsairDeck" }, { verb: "PrepareFleet" }, { verb: "ShuffleEncounterDeck" }] },
  { id: "12147:constant:1", cardCode: "12147", lines: ["12147:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table", when: OFF_COURSE }] },
  { id: "12147:triggered:1", cardCode: "12147", lines: ["12147:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: STORMCALLER, instructions: [{ verb: "AdvanceStage" }] },

  // 12148 Fate of the Dream-chaser (no quest points: both sides resolve as it is revealed, A then B). A: each player assigns damage among the non-Ship characters they control equal to the damage on the Ship objectives
  // they control (read before the ships leave), then every Ship enemy, Ship objective and Ocean location in play is discarded (From Sea to Land: the ships leave). B: the encounter deck and its discard pile are set
  // aside, inactive, but for the copies of Watch Tower and Battle-hardened the stage's search carries across; the second encounter deck (The City of Corsairs set) joins what is left and the Corsair deck and its
  // discard pile are shuffled into it; it is now the active encounter deck, and the quest advances to stage 3.
  {
    id: "12148:whenRevealed:1",
    cardCode: "12148",
    lines: ["12148:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "AssignDamage", amount: { damageOn: YOUR_SHIP }, pick: YOUR_LAND_CHARACTER }] },
      { verb: "DiscardAllInPlay", pick: SHIP_ENEMIES },
      { verb: "DiscardAllInPlay", pick: SHIP_OBJECTIVES },
      { verb: "DiscardAllInPlay", pick: OCEAN_LOCATIONS },
    ],
  },
  {
    id: "12148:whenRevealed:2",
    cardCode: "12148",
    lines: ["12148:B:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "SetAsideEncounterDeck", carry: [WATCH_TOWER, BATTLE_HARDENED] },
      { verb: "ShuffleSetAsideSet", set: "The City of Corsairs" },
      { verb: "EndCorsairDeck" },
      { verb: "AdvanceStage" },
    ],
  },

  // 12149 The Haven of Umbar. When Revealed: The Shattered Monument and Captain Sahír found in the encounter deck are set aside, out of play; each player's search adds an enemy and a location to the staging area;
  // unless the Stormcaller was destroyed at stage 1, each Raider enemy in play gets a resource. (Side B prints flavor text only.)
  {
    id: "12149:whenRevealed:1",
    cardCode: "12149",
    lines: ["12149:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "SetAsideFromDeck", code: SAHIR_CODE },
      ...MONUMENT_CODES.map((code) => ({ verb: "SetAsideFromDeck" as const, code })),
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", to: "staging" }, { verb: "SearchMove", type: "location", to: "staging" }] },
      { verb: "Each", pick: RAIDER, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }], when: STORMCALLER_SURVIVED },
    ],
  },

  // 12150 Final Confrontation. When Revealed: The Shattered Monument is added to the staging area, Captain Sahír is put into play engaged with the first player, each player's search adds an enemy to the staging area,
  // the encounter deck is shuffled, and each Raider enemy in play (Sahír among them) gets a resource. Side B: while any enemy holds a resource Sahír is indestructible; the resources of a hero or enemy destroyed
  // go to him; destroying him wins the game.
  {
    id: "12150:whenRevealed:1",
    cardCode: "12150",
    lines: ["12150:A:1"],
    timing: "whenRevealed",
    instructions: [
      ...MONUMENT_CODES.map((code) => ({ verb: "AddSetAsideToStaging" as const, code })),
      { verb: "EngageSetAside", code: SAHIR_CODE },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", to: "staging" }] },
      { verb: "ShuffleEncounterDeck" },
      { verb: "Each", pick: RAIDER, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] },
    ],
  },
  {
    id: "12150:constant:1",
    cardCode: "12150",
    lines: ["12150:B:1"],
    timing: "constant",
    condition: { kind: "count", pick: { type: "enemy", control: "any", staging: true, hasResources: true }, min: 1 },
    instructions: [{ verb: "ModifyStat", stat: "indestructible", amount: 1, until: "whileSourceInPlay", holders: SAHIR }],
  },
  { id: "12150:forced:1", cardCode: "12150", lines: ["12150:B:2"], timing: "forced", trigger: "characterDestroyed", subject: { type: "hero", control: "any" }, instructions: addToSahir },
  { id: "12150:forced:2", cardCode: "12150", lines: ["12150:B:2"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any" }, instructions: addToSahir },
  { id: "12150:triggered:1", cardCode: "12150", lines: ["12150:B:3"], timing: "triggered", trigger: "enemyDestroyed", subject: SAHIR, instructions: [{ verb: "WinGame" }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
