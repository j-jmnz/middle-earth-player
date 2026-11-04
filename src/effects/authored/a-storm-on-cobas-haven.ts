import type { Condition, Effect, PickSpec } from "../../catalog/boundary.ts";

import { MANY_PLAYERS } from "./conditions.ts";
import { copyLines, withCopies } from "./reprint.ts";

// Records for A Storm on Cobas Haven (dream-chaser part 8, campaign card 11209). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data:build) or another card prints
// word for word needs no record here. `pnpm effects:draft a-storm-on-cobas-haven` writes the bundle of open lines and the effect-author agent turns it into records.
// The four Dol Amroth towers, Guarded by Ship enemies (the objectives family, src/rules/families/objectives/) and the cards that attach a Ship enemy to an objective, guarding it.
// Rules: rr.guarded, wor.guarded-x, rr.objective-cards, rr.ownership-and-control, rr.action, mec109.archery, dcce.ship-enemies, dcce.ships, dcce.sailing-tests (data/rules/entries.json).

// An objective in the staging area that no encounter card guards; one that does; a Ship enemy in play (staging or engaged) that guards nothing; a non-unique one in the staging area that guards
// nothing; a non-unique one in play.
const UNGUARDED_OBJECTIVE: PickSpec = { type: "objective", control: "any", stagingOnly: true, hasGuard: false };
const GUARDED_OBJECTIVE: PickSpec = { type: "objective", control: "any", stagingOnly: true, hasGuard: true };
const FREE_SHIP_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Ship", isGuard: false };
const FREE_STAGING_SHIP: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Ship", nonUnique: true, isGuard: false };
const NONUNIQUE_SHIP: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Ship", nonUnique: true };
const CAN_GUARD: Condition = { kind: "canPick", pick: UNGUARDED_OBJECTIVE };

// "Guarded." of the four towers (12134 to 12137) is written once and copied. Their second line names the card ("If Sea-ward Tower is free of encounters ..."), which the copy check (src/effects/copies.test.ts)
// does not read as the same sentence on another card, so each tower has its own record of it.
const TOWERS = ["12134", "12135", "12136", "12137"] as const;
const guardedTower: Effect = { id: "12134:whenRevealed:1", cardCode: "12134", lines: ["12134:A:1"], timing: "whenRevealed", instructions: [{ verb: "GuardObjective" }] };
const freeTower = (code: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "ControlWhenFree" }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  guardedTower,
  copyLines("12134", "12135", "A:1"),
  copyLines("12134", "12136", "A:1"),
  copyLines("12134", "12137", "A:1"),
  ...TOWERS.map(freeTower),

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
    instructions: [{ verb: "TakeSetAsideShip", name: "Dol Amroth Warship" }],
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
]);

export const AUTHORED_REPLACES: readonly string[] = [];
