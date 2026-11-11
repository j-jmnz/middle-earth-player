import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { MANY_PLAYERS } from "./conditions.ts";
import { copyLine, copyLines, withCopies } from "./reprint.ts";
import { AUTHORED_EFFECTS as VOYAGE } from "./voyage-across-belegaer.ts";

// Records for A Storm on Cobas Haven (dream-chaser part 8, campaign card 11209). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. `pnpm effects draft a-storm-on-cobas-haven` writes the bundle of open lines and the effect-author agent turns it into records.
// The four Dol Amroth towers, Guarded by Ship enemies (the objectives family, src/rules/families/objectives/) and the cards that attach a Ship enemy to an objective, guarding it.
// Rules: rr.guarded, wor.guarded-x, rr.objective-cards, rr.ownership-and-control, rr.action, mec109.archery, dcce.ship-enemies, dcce.ships, dcce.sailing-tests, dcce.heading, dcce.corsair-deck, dcce.boarding,
// rr.engagement-check, rr.in-play-and-out-of-play, rr.travel, rr.search (data/rules/entries.json).

// An objective in the staging area that no encounter card guards; one that does; a Ship enemy in play (staging or engaged) that guards nothing; a non-unique one in the staging area that guards
// nothing; a non-unique one in play.
const UNGUARDED_OBJECTIVE: PickSpec = { type: "objective", control: "any", stagingOnly: true, hasGuard: false };
const GUARDED_OBJECTIVE: PickSpec = { type: "objective", control: "any", stagingOnly: true, hasGuard: true };
const FREE_SHIP_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Ship", isGuard: false };
const FREE_STAGING_SHIP: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Ship", nonUnique: true, isGuard: false };
const NONUNIQUE_SHIP: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Ship", nonUnique: true };
const OFF_COURSE: Condition = { kind: "heading", is: "offCourse" };
const ON_COURSE: Condition = { kind: "heading", is: "onCourse" };
const WORST: Condition = { kind: "heading", is: "worst" };
// A Ship objective (a character with the Ship trait) a player controls, and a ready one anyone controls; a Ship enemy in play, staging or engaged.
const YOUR_SHIP: PickSpec = { type: "character", control: "you", trait: "Ship" };
const READY_SHIP: PickSpec = { type: "character", control: "any", trait: "Ship", state: "ready" };
// A ready character the actor controls (Taking on Water's Action), and the Ship enemy engaged with the actor that has the highest Attack (Ramming Speed!).
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const ENGAGED_RAMMER: PickSpec = { type: "enemy", control: "any", engaged: "you", trait: "Ship", highestAttack: true };
const SHIP_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Ship" };
const FLAGSHIP: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Raider Flagship"] };
const CAN_GUARD: Condition = { kind: "canPick", pick: UNGUARDED_OBJECTIVE };

// "Guarded." and "If {self} is free of encounters, the first player takes control of it." of the four towers (12134 to 12137) are written once, on Sea-ward Tower, and copied: the second
// line names its card, and the copy check (src/effects/copies.test.ts) reads each tower's own name as {self}.
const guardedTower: Effect = { id: "12134:whenRevealed:1", cardCode: "12134", lines: ["12134:A:1"], timing: "whenRevealed", instructions: [{ verb: "GuardObjective" }] };
const freeTower: Effect = { id: "12134:constant:1", cardCode: "12134", lines: ["12134:A:2"], timing: "constant", instructions: [{ verb: "ControlWhenFree" }] };

// "If your current heading is at the worst setting (Storm), Raider Flagship gets -50 engagement cost." (12120:B:3, copied to 12121:B:2), and "Raider Flagship gets -50 engagement cost." (12122:B:2).
const FLAGSHIP_CHEAPER: Instruction = { verb: "ModifyStat", stat: "engagementCost", amount: -50, until: "whileSourceInPlay", holders: FLAGSHIP };
// "If you are on-course (Sun), Dol Amroth Warship gets +2 Willpower, +2 Attack, and +2 Defense." and "Forced: When Dol Amroth Warship is destroyed, set it aside, out of play." (12123, copied to both sides of 110102).
const warshipBonus = (stat: "willpower" | "attack" | "defense"): Instruction => ({ verb: "ModifyStat", stat, amount: 2, until: "whileSourceInPlay", target: "self", when: ON_COURSE });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    guardedTower,
    copyLines("12134", "12135", "A:1"),
    copyLines("12134", "12136", "A:1"),
    copyLines("12134", "12137", "A:1"),
    freeTower,
    copyLines("12134", "12135", "A:2"),
    copyLines("12134", "12136", "A:2"),
    copyLines("12134", "12137", "A:2"),

    // 12134 Sea-ward Tower: while the players control it, each Sailing test looks at 2 more cards of the encounter deck.
    { id: "12134:constant:2", cardCode: "12134", lines: ["12134:A:3"], timing: "constant", condition: { kind: "controlledByPlayers" }, instructions: [{ verb: "ModifyStat", stat: "sailingLook", amount: 2, until: "whileSourceInPlay", target: "table" }] },

    // 12135 Tower of the Gull: Combat Action, exhaust it to deal 2 damage to a non-unique Ship enemy. Any player may trigger it (an objective's Action is any player's, rr.action).
    {
      id: "12135:action:1",
      cardCode: "12135",
      lines: ["12135:A:3"],
      timing: "action",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "controlledByPlayers" }, { kind: "canPick", pick: NONUNIQUE_SHIP }] },
      cost: { kind: "exhaustSelf" },
      instructions: [{ verb: "Pick", pick: NONUNIQUE_SHIP }, { verb: "DamageCard", amount: 2, target: "picked" }],
    },

    // 12136 The Beacon: Planning Action, exhaust it and spend 5 resources to take control of a set aside Dol Amroth Warship. Any player may trigger it.
    {
      id: "12136:action:1",
      cardCode: "12136",
      lines: ["12136:A:3"],
      timing: "action",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, { kind: "controlledByPlayers" }] },
      cost: [{ kind: "exhaustSelf" }, { kind: "resources", amount: 5 }],
      instructions: [{ verb: "PutSetAsideInPlay", name: "Dol Amroth Warship", to: "actor" }],
    },

    // 12137 Tower of the Heron: while the players control it, the archery total is 4 lower (never below 0).
    { id: "12137:constant:2", cardCode: "12137", lines: ["12137:A:3"], timing: "constant", condition: { kind: "controlledByPlayers" }, instructions: [{ verb: "ModifyStat", stat: "archeryBonus", amount: -4, until: "whileSourceInPlay" }] },

    // 12121 Battle in the Bay. When Revealed: the first player's search adds a Ship enemy (2 with 3 or more players) to the staging area, the encounter deck is shuffled, and each unguarded objective in the
    // staging area gets a non-unique Ship enemy of the staging area as its guard (one that guards nothing already: an enemy moved off an objective would free it).
    // Side B: it cannot advance while an objective is guarded by an encounter. (B:2, the Raider Flagship's engagement cost, is the second stage's twin of 12120:B:3.)
    {
      id: "12121:whenRevealed:1",
      cardCode: "12121",
      lines: ["12121:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "SearchMove", type: "enemy", trait: "Ship", to: "staging" },
        { verb: "SearchMove", type: "enemy", trait: "Ship", to: "staging", when: MANY_PLAYERS },
        { verb: "ShuffleEncounterDeck" },
        { verb: "Each", pick: UNGUARDED_OBJECTIVE, instructions: [{ verb: "Pick", pick: FREE_STAGING_SHIP }, { verb: "AttachGuard", guard: "picked", to: "previous" }] },
      ],
    },
    { id: "12121:constant:2", cardCode: "12121", lines: ["12121:B:3"], timing: "constant", condition: { kind: "count", pick: GUARDED_OBJECTIVE, min: 1 }, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 12126 Siege Ship: in the staging area it gains a Forced effect: at the end of the quest phase, when it guards nothing and an unguarded objective is in the staging area, it attaches to that objective.
    {
      id: "12126:forced:1",
      cardCode: "12126",
      lines: ["12126:A:3"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "sourceIn", zone: "staging" }, { kind: "matches", card: "self", pick: { type: "enemy", control: "any", isGuard: false } }, CAN_GUARD] },
      instructions: [{ verb: "Pick", pick: UNGUARDED_OBJECTIVE }, { verb: "AttachGuard", to: "picked" }],
    },

    // 12127 Heavy Cruiser. When Revealed: a Dol Amroth objective found in the encounter deck or discard pile joins the staging area, Heavy Cruiser attaches to it as its guard, the deck is shuffled.
    {
      id: "12127:whenRevealed:1",
      cardCode: "12127",
      lines: ["12127:A:3"],
      timing: "whenRevealed",
      instructions: [{ verb: "SearchMove", type: "objective", trait: "Dol Amroth", to: "staging", remember: true }, { verb: "AttachGuard", to: "picked" }, { verb: "ShuffleEncounterDeck" }],
    },

    // 12133 The Raiders' Assault. When Revealed: a Ship enemy that guards nothing, engaged or not, attaches to an unguarded objective in the staging area (it returns to the staging area first if it is engaged);
    // with no objective to guard, nothing is chosen or returned. When no Ship enemy was returned to the staging area, it gains surge.
    {
      id: "12133:whenRevealed:1",
      cardCode: "12133",
      lines: ["12133:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: FREE_SHIP_ENEMY, when: CAN_GUARD },
        { verb: "ReturnToStaging", target: { kind: "picked" }, when: CAN_GUARD },
        { verb: "Pick", pick: UNGUARDED_OBJECTIVE },
        { verb: "AttachGuard", guard: "previous", to: "picked" },
        { verb: "GainSurge", when: { kind: "noneReturned" } },
      ],
    },

    // 12120 Outmaneuver the Enemy. Setup: the Corsair deck is prepared and each player takes a ship; the Warships set aside, Raider Flagship and the Scouting Ship added to the staging area are dealt by the
    // scenario's piles (data/scenarios/a-storm-on-cobas-haven.json: setAside, staging) before this record runs, so only what the piles cannot say is here: the first player's choice of a Dol Amroth objective in the
    // encounter deck, which joins the staging area, the shuffle, and the Guarded keyword resolved on that objective (the picked card).
    {
      id: "12120:setup:1",
      cardCode: "12120",
      lines: ["12120:A:1"],
      timing: "setup",
      instructions: [
        { verb: "PrepareCorsairDeck" },
        { verb: "PrepareFleet" },
        { verb: "SearchMove", type: "objective", trait: "Dol Amroth", to: "staging", remember: true },
        { verb: "ShuffleEncounterDeck" },
        { verb: "GuardObjective", target: "picked" },
      ],
    },
    // Forced: a Ship enemy that engages a player deals 2 damage to a Ship objective that player controls when off-course, to itself when on-course (the engaged player is the actor: the event's seat).
    {
      id: "12120:forced:1",
      cardCode: "12120",
      lines: ["12120:B:2"],
      timing: "forced",
      trigger: "engaged",
      subject: SHIP_ENEMY,
      instructions: [
        { verb: "Pick", pick: YOUR_SHIP, when: OFF_COURSE },
        { verb: "DamageShip", amount: 2, when: OFF_COURSE },
        { verb: "DamageCard", amount: 2, target: "subject", when: ON_COURSE },
      ],
    },
    { id: "12120:constant:1", cardCode: "12120", lines: ["12120:B:3"], timing: "constant", instructions: [FLAGSHIP_CHEAPER], condition: WORST },
    copyLine("12120:B:3", "12121:B:2"),

    // 12122 Break Through the Fleet! When Revealed: the players make engagement checks against each enemy in the staging area, Raider Flagship with 50 less engagement cost for these checks. The stage's side B: the
    // Flagship stays 50 cheaper, the stage has 5 more quest points for each Ship enemy in play, and the Flagship in the victory display wins the game (a defeated last stage wins it by the rules).
    { id: "12122:whenRevealed:1", cardCode: "12122", lines: ["12122:A:1"], timing: "whenRevealed", instructions: [{ verb: "MakeEngagementChecks", lower: { name: "Raider Flagship", amount: 50 } }] },
    { id: "12122:constant:1", cardCode: "12122", lines: ["12122:B:2"], timing: "constant", instructions: [FLAGSHIP_CHEAPER] },
    { id: "12122:constant:2", cardCode: "12122", lines: ["12122:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { count: SHIP_ENEMY, times: 5 }, until: "whileSourceInPlay" }] },
    { id: "12122:constant:3", cardCode: "12122", lines: ["12122:B:4"], timing: "constant", condition: { kind: "inVictory", code: "12124", is: true }, instructions: [{ verb: "WinGame" }] },

    // 12123 Dol Amroth Warship (the Campaign Mode version 110102 prints both lines on each side).
    { id: "12123:constant:1", cardCode: "12123", lines: ["12123:A:2"], timing: "constant", instructions: [warshipBonus("willpower"), warshipBonus("attack"), warshipBonus("defense")] },
    { id: "12123:forced:1", cardCode: "12123", lines: ["12123:A:3"], timing: "forced", trigger: "characterDestroyed", subject: "self", instructions: [{ verb: "SetAsideSelf" }] },
    copyLines("12123", "110102", "A:2", "A:3"),
    copyLine("12123:A:2", "110102:B:4"),
    copyLine("12123:A:3", "110102:B:5"),

    // 12124 Raider Flagship. Only Ship objectives can be declared as attackers against it. Forced: at the end of the encounter phase, while engaged, the engaged player reveals the top card of the Corsair deck and
    // engages it (the Corsair enemy enters play engaged with that player).
    { id: "12124:constant:1", cardCode: "12124", lines: ["12124:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "shipAttackersOnly", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "12124:forced:1",
      cardCode: "12124",
      lines: ["12124:A:4"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Encounter" }, { kind: "sourceIn", zone: "engaged" }] },
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealCorsair", when: { kind: "engagedWithActor" } }] }],
    },

    // 12128 Coast of Anfalas: +2 Threat off-course; Travel: exhaust a Ship objective (the cost cannot be paid without a ready one, rr.travel); the Shadow is Rough Waters' (11053:A:2).
    { id: "12128:constant:1", cardCode: "12128", lines: ["12128:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self", when: OFF_COURSE }] },
    { id: "12128:travel:1", cardCode: "12128", lines: ["12128:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: READY_SHIP }, { verb: "Exhaust", target: { kind: "picked" } }] },
    copyLine("11053:A:2", "12128:A:3"),

    // 12129 Belfalas Islet: it cannot be traveled to off-course. Response: after the players travel to it, a Ship enemy that guards nothing is out of play while the Islet is the active location.
    { id: "12129:constant:1", cardCode: "12129", lines: ["12129:A:1"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", when: OFF_COURSE }] },
    {
      id: "12129:response:1",
      cardCode: "12129",
      lines: ["12129:A:2"],
      timing: "response",
      trigger: "traveled",
      subject: "self",
      condition: { kind: "canPick", pick: FREE_SHIP_ENEMY },
      instructions: [{ verb: "Pick", pick: FREE_SHIP_ENEMY }, { verb: "ConsiderOutOfPlay" }],
    },

    // 12130 Cobas Haven: while it is the active location, each Ship enemy has its Boarding value reduced by 1 (never below 0, families/sea/boarding.ts).
    { id: "12130:constant:1", cardCode: "12130", lines: ["12130:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "boarding", amount: -1, until: "whileSourceInPlay", holders: SHIP_ENEMY }] },

    // 12125 Corsair Skirmisher. Response: after it is destroyed as an enemy, the engaged player (not the first player) may discard allies with a total of at least 3 Willpower to take control of it as a Ship-objective
    // with Willpower equal to its Threat (families/sea/skirmisher.ts). The Response is offered only while the allies total enough.
    {
      id: "12125:response:1",
      cardCode: "12125",
      lines: ["12125:A:3"],
      timing: "response",
      trigger: "enemyDestroyed",
      subject: "self",
      answeredBy: "eventSeat",
      condition: { kind: "alliesWillpower", min: 3 },
      instructions: [{ verb: "DiscardAlliesForWillpower", willpower: 3 }, { verb: "TakeControlAsShip" }],
    },

    // 12131 Ramming Speed!: off-course, the engaged Ship enemy with the highest Attack (the revealing player chooses among those tied) makes an immediate attack, and the total Threat in the staging area is raised until the end
    // of the phase by the damage it dealt. No attack made (on-course, or no Ship enemy engaged with you) and the card gains doomed 2.
    {
      id: "12131:whenRevealed:1",
      cardCode: "12131",
      lines: ["12131:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: ENGAGED_RAMMER, when: OFF_COURSE },
        { verb: "AttackWithPicked", raiseStagingThreat: "endOfPhase", when: OFF_COURSE },
        { verb: "Doomed", amount: 2, when: { kind: "noneReturned" } },
      ],
    },

    // 12132 Taking on Water: attaches to a Ship objective the first player chooses, as a Condition attachment; Forced: when the attached objective exhausts it takes 2 damage (an encounter card's damage, which a Ship's immunity to
    // player card effects does not stop); Action (the Ship's controller): exhaust 3 characters you control to discard it. Shadow: it attaches to the defending character if that is a Ship.
    { id: "12132:whenRevealed:1", cardCode: "12132", lines: ["12132:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "ship" } }] },
    { id: "12132:constant:1", cardCode: "12132", lines: ["12132:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    { id: "12132:forced:1", cardCode: "12132", lines: ["12132:A:1"], timing: "forced", trigger: "shipExhausted", subject: "host", instructions: [{ verb: "DamageCard", amount: 2, target: "host" }] },
    {
      id: "12132:action:1",
      cardCode: "12132",
      lines: ["12132:A:1"],
      timing: "action",
      condition: { kind: "count", pick: READY_CHARACTER, min: 3 },
      instructions: [{ verb: "Repeat", times: 3, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] }, { verb: "Discard", target: { kind: "self" } }],
    },
    { id: "12132:shadow:1", cardCode: "12132", lines: ["12132:A:2"], timing: "shadow", instructions: [{ verb: "AttachSelf", to: { kind: "ship", defender: true } }] },

    // 11209 A Storm on Cobas Haven (campaign card). Setup (Campaign Mode): the Modification boons, Black Key (burden), Calaerion, Gavin and the four Send for Help cards are set aside (each facedown); once the quest card's Setup has put the
    // Raider Flagship in the staging area and prepared the fleet (ScenarioDefinition.afterSetup) Black Key is attached to the Flagship, the ships are fitted, Calaerion comes into play under the player with the Dream-chaser and Gavin under
    // the player the first player names; Thunderstruck is shuffled into the encounter deck and Crowley into the Corsair deck, and one player (whichever the players choose) may take a copy of Círdan's Blessing that is not in the Campaign
    // Pool into their hand (the campaign checklist asks each seat in turn until one takes it; the copy is earned at the Resolution).
    {
      id: "11209:campaignSetup:1",
      cardCode: "11209",
      lines: ["11209:A:2", "11209:A:3"],
      timing: "campaignSetup",
      instructions: [
        ...["11172", "11173", "11174", "11175", "11192", "11193", "11210", "11211", "11212", "11213", "11214"].map((code): Instruction => ({ verb: "SetAside", code })),
        { verb: "ShuffleIntoEncounterDeck", code: "11177" },
        { verb: "ShuffleIntoCorsairDeck", code: "11178" },
        { verb: "AttachSetAsideTo", code: "11192", to: "Raider Flagship" },
        { verb: "FitShips", codes: ["11172", "11173", "11174", "11175"] },
        { verb: "PutSetAsideInPlay", name: "Calaerion", withCard: "Dream-chaser" },
        { verb: "PutSetAsideInPlay", name: "Gavin", to: "anyPlayer" },
        { verb: "ChooseCards", codes: ["11205", "11206", "11207", "11208"], who: "onePlayer", to: "hand", optional: true, unearned: true, afterMulligan: true },
      ],
    },
    // Resolution. B:1: the Círdan's Blessing chosen during setup joins the Campaign Pool (EarnDealt, as The Drowned Ruins'). Its second sentence, "The players may spend 4 XP on Gavin to record in the Campaign Log that \"Gavin returned\"",
    // is the XP model's: Gavin's four boxes are one pick once this scenario is won (src/campaign/xp.ts, XP_ROWS, gavinReturned), made on the XP screen between scenarios, so the record has nothing to run.
    { id: "11209:resolution:1", cardCode: "11209", lines: ["11209:B:1"], timing: "resolution", instructions: [{ verb: "EarnDealt", codes: ["11205", "11206", "11207", "11208"] }] },
    copyLine("11171:B:5", "11209:B:4"),
    { id: "11209:resolution:4", cardCode: "11209", lines: ["11209:B:5"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "character", control: "any", names: ["Dol Amroth Warship"] }, min: 2 } }] },
    { id: "11209:resolution:5", cardCode: "11209", lines: ["11209:B:6"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "character", control: "any", names: ["Corsair Skirmisher"] }, min: 2 } }] },
    { id: "11209:resolution:6", cardCode: "11209", lines: ["11209:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: { type: "objective", control: "any", trait: "Dol Amroth", controlled: true }, min: 4 } }] },
    copyLine("11171:B:7", "11209:B:8"),
  ],
  { pool: VOYAGE },
);

export const AUTHORED_REPLACES: readonly string[] = [];
