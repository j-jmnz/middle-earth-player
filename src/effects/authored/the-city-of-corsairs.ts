import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { copyLines, withCopies } from "./reprint.ts";
import { AUTHORED_EFFECTS as RAID } from "./raid-on-the-grey-havens.ts";

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
const SAHIR_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Captain Sahír"] };
// "That enemy" the stage 4 Forced effects read the resources of: the destroyed card, a hero or an enemy.
const DESTROYED_RESOURCES = { stat: "resources", of: "subject" } as const;
// The resource tokens the destroyed hero or enemy held go to Captain Sahír, who is in play (when he is the one destroyed, no Sahír is in play and nothing is added).
const addToSahir: Effect["instructions"] = [{ verb: "Each", pick: SAHIR, instructions: [{ verb: "PlaceResourceTokens", amount: DESTROYED_RESOURCES, on: "picked" }] }];

// The Raider enemies of the encounter cards: those engaged with a player, those in the staging area, the enemy making the attack in progress and a Shadow effect that reads it.
const RAIDER_ENGAGED: PickSpec = { type: "enemy", control: "any", trait: "Raider" };
const RAIDER_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Raider" };
const ATTACKER: PickSpec = { type: "enemy", control: "any", attackingEnemy: true };
const RAIDER_ATTACKS: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Raider" } };
const HERO_WITH_RESOURCES: PickSpec = { type: "hero", control: "you", hasResources: true };
const ENGAGED_RAIDER_OF_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you", trait: "Raider" };
const RAIDER_WITH_RESOURCE: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Raider", hasResources: true };
const SWORD_WITH_RESOURCES: PickSpec = { type: "card", control: "any", names: ["The Black Sword"], hasResources: true };
// The Modification boons the campaign card's Setup fits to the ships, Black Key (burden) and The Black Sword, Calaerion, Gavin and Send for Help, the copies of Círdan's Blessing: the cards it sets aside.
const MODIFICATIONS = ["11172", "11173", "11174", "11175"];
const CIRDAN = ["11205", "11206", "11207", "11208"];
const BLACK_KEY_BURDEN = "11192";
const BLACK_SWORD = "11216";
const GAVIN = "11210";
const CORSAIR_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Corsair" };
// "If this attack destroys a character" / "an ally": the attack's X is the characters it destroyed, the defender is out of play (the other card of the AfterAttack frame).
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };
const DESTROYED_AN_ALLY: Condition = { kind: "all", conditions: [DESTROYED_A_CHARACTER, { kind: "matches", card: "other", pick: { type: "card", control: "any", cardType: "ally" }, inPlay: false }] };
// The damage an attack dealt to a Ship objective: the defender is a Ship, in play or destroyed by that damage.
const DEALT_TO_A_SHIP: Condition = { kind: "all", conditions: [{ kind: "dealt" }, { kind: "matches", card: "other", pick: SHIP_OBJECTIVES }] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
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

  // 12151 The Stormcaller (Boarding and "Cannot have attachments" are keywords and flags; Black Key is attached to it by the campaign card's Setup all the same). Forced: at the end of the round, if it is engaged with a
  // player, that player either returns it to the staging area or shifts their heading off-course.
  {
    id: "12151:forced:1",
    cardCode: "12151",
    lines: ["12151:A:3"],
    timing: "forced",
    trigger: "endOfRound",
    condition: { kind: "sourceIn", zone: "engaged" },
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "staging", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] },
          { id: "heading", instructions: [{ verb: "ShiftHeading", direction: "offCourse" }] },
        ],
      },
    ],
  },

  // 12152 Slave Ship. For each point of damage its attack deals to a Ship objective, 1 damage to a non-Ship character the defending player controls.
  {
    id: "12152:forced:1",
    cardCode: "12152",
    lines: ["12152:A:3"],
    timing: "forced",
    trigger: "attacks",
    subject: "self",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "AssignDamage", amount: { dealt: true }, pick: YOUR_LAND_CHARACTER, when: DEALT_TO_A_SHIP }] }],
  },

  // 12153 Umbar Slaver: +1 Attack and +1 Threat for each resource on it. Forced: after the engaged player spends resources, 1 of them goes on it.
  {
    id: "12153:constant:1",
    cardCode: "12153",
    lines: ["12153:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "12153:forced:1", cardCode: "12153", lines: ["12153:A:2"], timing: "forced", trigger: "resourcesSpent", eventSeat: "you", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },

  // 12154 Southern Belfalas. Travel: one player reveals the top card of the Corsair deck and engages it. Shadow: if the attack destroys a character, the defending player discards an ally they control.
  { id: "12154:travel:1", cardCode: "12154", lines: ["12154:A:1"], timing: "travel", instructions: [{ verb: "RevealCorsair", who: "anyPlayer" }] },
  {
    id: "12154:shadow:1",
    cardCode: "12154",
    lines: ["12154:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "AfterAttack", instructions: [{ verb: "Pick", pick: { type: "ally", control: "you" }, when: DESTROYED_A_CHARACTER }, { verb: "Discard", target: { kind: "picked" }, when: DESTROYED_A_CHARACTER }] },
    ],
  },

  // 12155 Corsair Waters. While it is the active location, no more than 1 ally enters play each round (LimitEntries: played or put into play). Shadow: either shift your heading off-course or treat the attack as undefended.
  { id: "12155:constant:1", cardCode: "12155", lines: ["12155:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "LimitEntries", cardType: "ally", max: 1 }] },
  {
    id: "12155:shadow:1",
    cardCode: "12155",
    lines: ["12155:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "heading", instructions: [{ verb: "ShiftHeading", direction: "offCourse" }] },
          { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] },
        ],
      },
    ],
  },

  // 12156 Watch Tower. In the staging area it gains "Forced: When a Raider enemy enters play, add 1 resource to it." (the record is heard only while it is there). Shadow: if the attack destroys an ally, a Raider enemy in
  // play gets resources equal to that ally's printed cost.
  {
    id: "12156:forced:1",
    cardCode: "12156",
    lines: ["12156:A:1"],
    timing: "forced",
    trigger: "encounterEnteredPlay",
    subject: RAIDER,
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "subject" }],
  },
  {
    id: "12156:shadow:1",
    cardCode: "12156",
    lines: ["12156:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "AfterAttack",
        instructions: [
          { verb: "Pick", pick: RAIDER, when: DESTROYED_AN_ALLY },
          { verb: "PlaceResourceTokens", amount: { stat: "cost", of: "other" }, on: "picked", when: DESTROYED_AN_ALLY },
        ],
      },
    ],
  },

  // 12157 Serpent's Tail. When Revealed: 1 shadow card to each Ship enemy, then, off-course, each Ship enemy gets -10 engagement cost until the end of the round.
  {
    id: "12157:whenRevealed:1",
    cardCode: "12157",
    lines: ["12157:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Each", pick: SHIP_ENEMIES, instructions: [{ verb: "DealShadowTo", target: "picked" }] },
      { verb: "Each", pick: SHIP_ENEMIES, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "endOfRound", target: "picked" }], when: OFF_COURSE },
    ],
  },

  // 12160 Streets of Umbar. Shadow: a Raider that attacks is dealt 1 additional shadow card for each resource on it, at most 3.
  {
    id: "12160:shadow:1",
    cardCode: "12160",
    lines: ["12160:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Repeat", times: { stat: "resources", of: "attacker", limit: 3 }, instructions: [{ verb: "DealShadowTo", target: "attacker", when: RAIDER_ATTACKS }] }],
  },

  // 12161 City of Corsairs: its Threat is X, the most resources on one Raider enemy in play.
  { id: "12161:constant:1", cardCode: "12161", lines: ["12161:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { resourcesOn: RAIDER, max: true }, until: "whileSourceInPlay", target: "self" }] },

  // 12162 Umbar Harbor. While it is the active location, Corsair enemies get +2 Defense. Shadow: a Raider that attacks takes 1 resource from a hero the defending player controls.
  {
    id: "12162:constant:1",
    cardCode: "12162",
    lines: ["12162:A:1"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "activeLocation" },
    instructions: [{ verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay", holders: CORSAIR_ENEMY }],
  },
  {
    id: "12162:shadow:1",
    cardCode: "12162",
    lines: ["12162:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "Pick", pick: HERO_WITH_RESOURCES, when: RAIDER_ATTACKS },
      { verb: "Pick", pick: ATTACKER, when: RAIDER_ATTACKS },
      { verb: "MoveResources", amount: 1, when: RAIDER_ATTACKS },
    ],
  },

  // 12163 Foes of Ecthelion. When Revealed: 2 resources on a Raider in the staging area, each such Raider gets +1 Threat for each resource on it until the end of the phase; with none, it gains surge.
  {
    id: "12163:whenRevealed:1",
    cardCode: "12163",
    lines: ["12163:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: RAIDER_STAGING },
      { verb: "PlaceResourceTokens", amount: 2, on: "picked" },
      { verb: "Each", pick: RAIDER_STAGING, instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "picked" }, until: "endOfPhase", target: "picked" }] },
      { verb: "GainSurge", when: { kind: "count", pick: RAIDER_STAGING, max: 0 } },
    ],
  },

  // 12164 Umbar Patrol. When Revealed: each player returns an engaged enemy to the staging area; until the end of the round no enemy can be optionally engaged; with no enemy in the staging area, search for one.
  {
    id: "12164:whenRevealed:1",
    cardCode: "12164",
    lines: ["12164:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "choose" } },
      { verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "endOfRound", target: "table" },
      { verb: "SearchMove", type: "enemy", to: "staging", when: { kind: "count", pick: { type: "enemy", control: "any", stagingOnly: true }, max: 0 } },
    ],
  },

  // 12165 Fury and Malice. When Revealed: 1 resource on each engaged Raider, each player assigns damage equal to the resources on the Raiders engaged with them; with no Raider engaged, no damage is assigned and it gains surge.
  {
    id: "12165:whenRevealed:1",
    cardCode: "12165",
    lines: ["12165:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Each", pick: RAIDER_ENGAGED, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "AssignDamage", amount: { resourcesOn: ENGAGED_RAIDER_OF_YOU }, pick: { type: "character", control: "you" } }] },
      { verb: "GainSurge", when: { kind: "count", pick: RAIDER_ENGAGED, max: 0 } },
    ],
  },

  // 12159 The Shattered Monument and its Campaign Mode printing 110129 (both sides of 110129 print the Forced line; its side B drops the immunity line): each Raider enemy with a resource is immune to player events (the flag
  // immuneToPlayerEvents), and at the beginning of the resource phase each Raider enemy gets a resource.
  { id: "12159:constant:1", cardCode: "12159", lines: ["12159:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerEvents", amount: 1, until: "whileSourceInPlay", holders: RAIDER_WITH_RESOURCE }] },
  {
    id: "12159:forced:1",
    cardCode: "12159",
    lines: ["12159:A:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Resource" },
    instructions: [{ verb: "Each", pick: RAIDER, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] }],
  },
  copyLines("12159", "110129", "A:1"),
  {
    id: "110129:forced:1",
    cardCode: "110129",
    lines: ["110129:A:2", "110129:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Resource" },
    instructions: [{ verb: "Each", pick: RAIDER, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "picked" }] }],
  },

  // 12158 Captain Sahír: for every 5 resources on him he makes an additional attack against the engaged player each combat phase (after his attack, once a round: the additional attacks are attacks too).
  {
    id: "12158:forced:2",
    cardCode: "12158",
    lines: ["12158:A:3"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    limit: "oncePerRound",
    condition: { kind: "phase", is: "Combat" },
    instructions: [{ verb: "Repeat", times: { stat: "resources", of: "self", every: 5 }, instructions: [{ verb: "ImmediateAttack" }] }],
  },

  // 12160 Streets of Umbar (the Shadow is above): when the players are faced with the option to travel and it is in the staging area, they either travel to a location with its title or add 2 resources to a Raider enemy.
  { id: "12160:constant:1", cardCode: "12160", lines: ["12160:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "TravelOrAddResources", amount: 2, pick: RAIDER }] },

  // 11215 The City of Corsairs (campaign card). Setup (Campaign Mode), as A Storm on Cobas Haven's: the Modification boons, Black Key (burden), Calaerion, Gavin, Send for Help and The Black Sword are set aside; Thunderstruck is
  // shuffled into the encounter deck and Crowley into the Corsair deck; once the quest card's Setup has put the Stormcaller in the staging area and prepared the fleet (ScenarioDefinition.afterSetup) Black Key is attached to the
  // Stormcaller (it prints "Cannot have attachments"; the Setup's instruction stands, user ruling 2026-11-05, and the Stormcaller has no "Campaign Mode only" side to flip), the ships are fitted, Calaerion comes into play under
  // the player with the Dream-chaser, Gavin under the player the first player names if the log says "Gavin returned", and one player (whichever the players choose) may take a copy of Círdan's Blessing that is not in the
  // Campaign Pool into their hand. "Flip this card over" is the card passing from its Setup to its side B, whose records the engine hears from the start (a campaign card keeps every record).
  {
    id: "11215:campaignSetup:1",
    cardCode: "11215",
    lines: ["11215:A:2", "11215:A:3"],
    timing: "campaignSetup",
    instructions: [
      ...[...MODIFICATIONS, BLACK_KEY_BURDEN, "11193", GAVIN, "11211", "11212", "11213", "11214", BLACK_SWORD].map((code): Instruction => ({ verb: "SetAside", code })),
      { verb: "ShuffleIntoEncounterDeck", code: "11177" },
      { verb: "ShuffleIntoCorsairDeck", code: "11178" },
      { verb: "AttachSetAsideTo", code: BLACK_KEY_BURDEN, to: "Stormcaller" },
      { verb: "FitShips", codes: MODIFICATIONS },
      { verb: "PutSetAsideInPlay", name: "Calaerion", withCard: "Dream-chaser" },
      { verb: "PutSetAsideInPlay", name: "Gavin", to: "anyPlayer", when: { kind: "upgraded", code: GAVIN } },
      { verb: "ChooseCards", codes: CIRDAN, who: "onePlayer", to: "hand", optional: true, unearned: true, afterMulligan: true },
    ],
  },
  // Side B, in force from the start. Forced: when stage 2B is revealed, each boon and non-Ship burden of the encounter deck and its discard pile goes to the second encounter deck. The Forced effect resolves above the stage's
  // When Revealed (rr.forced, the stageRevealed trigger), while the first deck is still the encounter deck: it marks the cards, and the stage's SetAsideEncounterDeck keeps them in the deck when it sets the rest aside, as it keeps
  // the copies of Watch Tower and Battle-hardened. The Corsair deck is shuffled into the second deck by the stage itself, with Crowley (a burden) in it.
  {
    id: "11215:forced:1",
    cardCode: "11215",
    lines: ["11215:B:1"],
    timing: "forced",
    trigger: "stageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: ["Fate of the Dream-chaser"] } },
    instructions: [{ verb: "CarryToSecondDeck", exceptBurdenTrait: "Ship" }],
  },
  // Forced: when Captain Sahír enters play, Black Key (burden) and The Black Sword are attached to him. Black Key leaves the game with the Stormcaller it was attached to (11192:A:1), so none is left to attach by then.
  { id: "11215:forced:2", cardCode: "11215", lines: ["11215:B:2"], timing: "forced", trigger: "encounterEnteredPlay", subject: SAHIR_ENEMY, instructions: [{ verb: "AttachSetAsideTo", code: BLACK_KEY_BURDEN, to: "Captain Sahír" }, { verb: "AttachSetAsideTo", code: BLACK_SWORD, to: "Captain Sahír" }] },
  // Refresh Action (group limit once per round): exhaust a hero to move 1 resource from The Black Sword to that hero's pool; the Sword with no resources left is removed from the game.
  {
    id: "11215:action:1",
    cardCode: "11215",
    lines: ["11215:B:3"],
    timing: "action",
    anyPlayer: true,
    limit: "oncePerRound",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, { kind: "canPick", pick: SWORD_WITH_RESOURCES }, { kind: "canPick", pick: { type: "hero", control: "you", state: "ready" } }] },
    instructions: [
      { verb: "Pick", pick: SWORD_WITH_RESOURCES },
      { verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } },
      { verb: "Exhaust", target: { kind: "picked" } },
      { verb: "MoveResources", amount: 1 },
      { verb: "RemoveNamedFromGame", name: "The Black Sword", when: { kind: "count", pick: SWORD_WITH_RESOURCES, max: 0 } },
    ],
  },
  // Resolution: the players win the campaign. The scenario is the last of its campaign, so winning it leaves no scenario unwon and the path is finished (src/campaign/path.ts nextStep); nothing else is written.
  { id: "11215:resolution:1", cardCode: "11215", lines: ["11215:B:4"], timing: "resolution", instructions: [] },
  { id: "11215:resolution:3", cardCode: "11215", lines: ["11215:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "inVictory", codes: ["11058", "12159", "110129", "11178", "12151"] } }] },

  // 12158 Captain Sahír engages the first player and pays a resource for each point of damage, as his objective-side twin 11076 does.
  copyLines("11076", "12158", "A:1", "A:2"),
], { pool: RAID });

export const AUTHORED_REPLACES: readonly string[] = [];
