import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { ALWAYS } from "../conditions.ts";

// Records for The Battle of Lake-town (standalone-scenarios cycle part 2, no campaign card). Every line is read from the scan ledger (data/printed/); the Burn X lines are read by the keyword (pnpm data build) and "Immune to player card effects" by its template.
// The Smaug deck, Burn X and the way a Smaug enters play are not printed on the cards: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town) holds them with their sources (the Quest Companion), and src/catalog/families/smaug.ts the vocabulary.
// Rules: none printed outside the cards (no rulesheet): docs/scenarios/standalone-scenarios.md (The Battle of Lake-town).

const LAKE_TOWN = "50207";
// Smaug is a Dragon, the only one in the scenario: the three Smaug cards in the staging area or engaged.
const SMAUG: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Dragon" };
const SMAUG_PLAYING: Condition = { kind: "enemyInPlay", trait: "Dragon", is: true };
const HERO_YOU: PickSpec = { type: "hero", control: "you" };
const ALLY_YOU: PickSpec = { type: "ally", control: "you" };
const PIER_IN_VICTORY: PickSpec = { type: "location", control: "any", from: "victory", trait: "Pier" };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const ONE_ACTIVE: Condition = { kind: "count", pick: { type: "location", control: "any", active: true }, min: 1 };
// "If this attack destroys a character": the X of the effect an attack leaves for its end is the characters it destroyed.
const DESTROYED: Condition = { kind: "x", min: 1 };
const DESTROYED_AND_NEXT: Condition = { kind: "all", conditions: [DESTROYED, { kind: "otherPlayer" }] };

// "Any player may discard a hero to cancel this effect" (50209:A:2, 50210:A:2): each player in turn from the first player is offered it; the first to discard one cancels the effect, and the rest of it does not resolve (the pattern of 02047:A:1).
const ANY_PLAYER_MAY_DISCARD_A_HERO: Instruction = {
  verb: "ForEachPlayer",
  order: "firstFirst",
  instructions: [
    {
      verb: "Choose",
      who: "actor",
      options: [
        { id: "discard", requires: { kind: "canPick", pick: HERO_YOU }, instructions: [{ verb: "Pick", pick: HERO_YOU }, { verb: "DiscardPicked" }, { verb: "CancelEffect" }] },
        { id: "keep", instructions: [] },
      ],
    },
  ],
};

// "Each ... resolves": the burn damage of the locations in play.
const RESOLVE_BURN: Instruction = { verb: "ResolveBurn" };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 50201 Terror from the Mountain. Setup: the Smaug deck is shuffled (the nine Smaug cards are dealt into it by the data), Lake-town is staged by the data, the encounter deck is shuffled and each player reveals 1 card, which is added to the staging area.
  // Smaug himself comes at the beginning of the first quest phase (families/smaug/deck.ts). Smaug cannot have more than 6 damage on him. When Revealed: 1 damage on Lake-town for each player.
  {
    id: "50201:setup:1",
    cardCode: "50201",
    lines: ["50201:A:1"],
    timing: "setup",
    instructions: [{ verb: "ShufflePile", pile: "smaug" }, { verb: "ShuffleEncounterDeck" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
  },
  { id: "50201:constant:1", cardCode: "50201", lines: ["50201:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageCeiling", amount: 6, until: "whileSourceInPlay", holders: SMAUG }] },
  { id: "50201:whenRevealed:1", cardCode: "50201", lines: ["50201:B:2"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "PlaceDamageOn", code: LAKE_TOWN, amount: 1 }] }] },

  // 50202 Fire and Water. Smaug cannot have more than 12 damage on him. When the players quest successfully, any number of the progress tokens that would be placed on this quest may be discarded to remove as many damage tokens from Lake-town: the stage holds
  // the progress back (`progressHealsLakeTown`) and its record asks the first player how many to discard, the rest going on the quest.
  { id: "50202:constant:1", cardCode: "50202", lines: ["50202:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageCeiling", amount: 12, until: "whileSourceInPlay", holders: SMAUG }] },
  { id: "50202:constant:2", cardCode: "50202", lines: ["50202:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressHealsLakeTown", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "50202:triggered:1", cardCode: "50202", lines: ["50202:B:2"], timing: "triggered", trigger: "progressReplaced", instructions: [{ verb: "HealLakeTownByProgress" }] },

  // 50203 The Dragon's Wrath. Forced: during the quest phase 1 additional card is revealed. Refresh Action: reset the quest deck to stage 2B. The stage has no quest points: it is defeated by defeating Smaug, and then the players win if the victory display
  // holds more Victory points than Lake-town has damage, and lose otherwise (a tie loses).
  { id: "50203:forced:1", cardCode: "50203", lines: ["50203:B:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "RevealMore", amount: 1 }] },
  { id: "50203:action:1", cardCode: "50203", lines: ["50203:B:2"], timing: "action", condition: { kind: "phase", is: "Refresh" }, instructions: [{ verb: "ReturnToStage", stage: 2 }] },
  {
    id: "50203:triggered:1",
    cardCode: "50203",
    lines: ["50203:B:3"],
    timing: "triggered",
    trigger: "enemyDestroyed",
    subject: SMAUG,
    instructions: [
      { verb: "WinGame", when: { kind: "less", left: { lakeTownDamage: true }, right: { victoryDisplay: true } } },
      { verb: "LoseGame", reason: "Smaug was defeated, but the victory display holds no more Victory points than the damage on Lake-town", when: { kind: "not", condition: { kind: "less", left: { lakeTownDamage: true }, right: { victoryDisplay: true } } } },
    ],
  },

  // 50204 Smaug the Mighty. When Revealed: he makes an immediate attack against each player in turn, from the first player, each dealt a shadow card (from the staging area, or engaged with the first player).
  { id: "50204:whenRevealed:1", cardCode: "50204", lines: ["50204:A:2"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "AttackFromStaging", target: "self", orEngaged: true }] }] },
  // 50205 Smaug the Terrible. When Revealed: resolve all burn damage.
  { id: "50205:whenRevealed:1", cardCode: "50205", lines: ["50205:A:2"], timing: "whenRevealed", instructions: [RESOLVE_BURN] },
  // 50206 Smaug the Magnificent. The damage beyond a defender's hit points goes on Lake-town. When Revealed: up to 3 damage moves from him to Lake-town (he took all the old Smaug's damage as he was revealed).
  { id: "50206:constant:1", cardCode: "50206", lines: ["50206:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessToLakeTown", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "50206:whenRevealed:1", cardCode: "50206", lines: ["50206:A:3"], timing: "whenRevealed", instructions: [{ verb: "MoveDamageTo", from: "self", to: "lakeTown", amount: 3 }] },

  // 50207 Lake-town. The players lose the game when it has 50 or more damage on it.
  { id: "50207:constant:1", cardCode: "50207", lines: ["50207:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "loseAtDamage", amount: 50, until: "whileSourceInPlay", target: "self" }] },

  // 50208 The Old Thrush. Guarded. Action: a player exhausts a ready hero to claim it when it is free of encounters, attaching it to that hero. Response: after the attached hero is declared as an attacker against Smaug, its player chooses X, discards that many
  // cards from his hand and Smaug's Defense is reduced by X until the end of the attack.
  { id: "50208:whenRevealed:1", cardCode: "50208", lines: ["50208:A:1"], timing: "whenRevealed", instructions: [{ verb: "GuardObjective" }] },
  {
    id: "50208:action:1",
    cardCode: "50208",
    lines: ["50208:A:2"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "staging" }, { kind: "freeOfEncounters" }, { kind: "canPick", pick: READY_HERO }] },
    instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
  },
  // "Counts as an attachment with the text: If detached, discard The Old Thrush": a card that counts or targets attachments finds it, and any detach (its hero leaves play, a card discards it) discards it to the encounter discard pile.
  {
    id: "50208:constant:1",
    cardCode: "50208",
    lines: ["50208:A:2"],
    timing: "constant",
    instructions: [{ verb: "CountsAs", cardType: "attachment" }, { verb: "ModifyStat", stat: "discardedWhenDetached", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  {
    id: "50208:response:1",
    cardCode: "50208",
    lines: ["50208:A:2"],
    timing: "response",
    trigger: "declaredAttacker",
    subject: "host",
    condition: { kind: "matches", card: "other", pick: SMAUG },
    instructions: [
      { verb: "ChooseX", max: [{ count: { type: "card", control: "you", from: "hand" } }], min: 1 },
      { verb: "DiscardFromHand", amount: { x: true } },
      { verb: "ModifyStat", stat: "defense", amount: { x: true, negative: true }, until: "endOfAttack", target: "other" },
    ],
  },

  // 50209 Close to the Flame. When Revealed: 1 damage to each character in play. Shadow: the same, unless any player discards a hero to cancel it.
  { id: "50209:whenRevealed:1", cardCode: "50209", lines: ["50209:A:1"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any" } }] },
  {
    id: "50209:shadow:1",
    cardCode: "50209",
    lines: ["50209:A:2"],
    timing: "shadow",
    instructions: [ANY_PLAYER_MAY_DISCARD_A_HERO, { verb: "DamageEach", amount: 1, pick: { type: "character", control: "any" } }],
  },
  // 50210 Scorching Blast. When Revealed: resolve all burn damage. Shadow: the same, unless any player discards a hero to cancel it.
  { id: "50210:whenRevealed:1", cardCode: "50210", lines: ["50210:A:1"], timing: "whenRevealed", instructions: [RESOLVE_BURN] },
  { id: "50210:shadow:1", cardCode: "50210", lines: ["50210:A:2"], timing: "shadow", instructions: [ANY_PLAYER_MAY_DISCARD_A_HERO, RESOLVE_BURN] },
  // 50211 Town-Baiting. When Revealed (it cannot be canceled): Smaug attacks Lake-town, the last player may declare a defender, excess damage goes on Lake-town. Nothing with no Smaug in play.
  { id: "50211:whenRevealed:1", cardCode: "50211", lines: ["50211:A:1"], timing: "whenRevealed", uncancelable: ALWAYS, instructions: [{ verb: "AttackLakeTown" }] },
  // 50212 Dire Magnificence. When Revealed: each player chooses and discards an ally he controls; 2 damage on Lake-town for each who cannot. Shadow: if this attack destroys a character, Smaug engages the next player and attacks him at once.
  {
    id: "50212:whenRevealed:1",
    cardCode: "50212",
    lines: ["50212:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "discard", requires: { kind: "canPick", pick: ALLY_YOU }, instructions: [{ verb: "Pick", pick: ALLY_YOU }, { verb: "DiscardPicked" }] },
              { id: "cannot", requires: { kind: "not", condition: { kind: "canPick", pick: ALLY_YOU } }, instructions: [{ verb: "PlaceDamageOn", code: LAKE_TOWN, amount: 2 }] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "50212:shadow:1",
    cardCode: "50212",
    lines: ["50212:A:2"],
    timing: "shadow",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "EngageNextPlayer", when: DESTROYED_AND_NEXT }, { verb: "ImmediateAttack", when: DESTROYED_AND_NEXT }] }],
  },
  // 50213 Catching Fire. When Revealed: a Pier location from the victory display is chosen and shuffled into the encounter deck; with none, it gains surge. Shadow: the defending character gets -2 Defense.
  {
    id: "50213:whenRevealed:1",
    cardCode: "50213",
    lines: ["50213:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "shuffle", requires: { kind: "canPick", pick: PIER_IN_VICTORY }, instructions: [{ verb: "Pick", pick: PIER_IN_VICTORY }, { verb: "MoveEncounterCard", card: "picked", to: "shuffle" }] },
          { id: "none", requires: { kind: "not", condition: { kind: "canPick", pick: PIER_IN_VICTORY } }, instructions: [{ verb: "GainSurge" }] },
        ],
      },
    ],
  },
  { id: "50213:shadow:1", cardCode: "50213", lines: ["50213:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfAttack", target: "defender" }] },
  // 50214 Reckless in His Rage. When Revealed: with Smaug in play he gets +2 Threat, +2 Attack and -2 Defense, and allies cannot be declared as defenders against him, until the end of the round. Shadow: if this attack destroys a character, resolve all burn damage.
  {
    id: "50214:whenRevealed:1",
    cardCode: "50214",
    lines: ["50214:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: SMAUG, when: SMAUG_PLAYING },
      { verb: "ModifyStat", stat: "threat", amount: 2, until: "endOfRound", target: "picked", when: SMAUG_PLAYING },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfRound", target: "picked", when: SMAUG_PLAYING },
      { verb: "ModifyStat", stat: "defense", amount: -2, until: "endOfRound", target: "picked", when: SMAUG_PLAYING },
      { verb: "ModifyStat", stat: "alliesCannotDefend", amount: 1, until: "endOfRound", target: "picked", when: SMAUG_PLAYING },
    ],
  },
  { id: "50214:shadow:1", cardCode: "50214", lines: ["50214:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ResolveBurn", when: DESTROYED }] }] },

  // 50215 West Pier. Each location in play gains Burn 1 (itself included).
  { id: "50215:constant:1", cardCode: "50215", lines: ["50215:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "locationsGainBurn", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  // 50216 The Master's Manor. When Revealed: all damage on Smaug moves to Lake-town. Shadow: if this attack destroys a character, the defending player discards his hand.
  { id: "50216:whenRevealed:1", cardCode: "50216", lines: ["50216:A:2"], timing: "whenRevealed", instructions: [{ verb: "MoveDamageTo", from: "smaug", to: "lakeTown" }] },
  { id: "50216:shadow:1", cardCode: "50216", lines: ["50216:A:3"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "DiscardHand", when: DESTROYED }] }] },
  // 50217 South Pier. While it is in play the players cannot travel to any other location.
  { id: "50217:constant:1", cardCode: "50217", lines: ["50217:A:2"], timing: "constant", instructions: [{ verb: "Restrict", what: "travel", exceptSelf: true }] },
  // 50218 North Pier. While it is in play no damage can be placed on Smaug.
  { id: "50218:constant:1", cardCode: "50218", lines: ["50218:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: SMAUG }] },
  // 50219 Merchant's District. Travel Action (an Action of the Travel phase, taken in the window after the travel option, from the staging area or as the active location, as often as there are copies; it is not traveling): 2 damage per player on Lake-town to add this location to the victory display. Shadow: 1 damage on Lake-town, 4 if the attack is undefended.
  {
    id: "50219:action:1",
    cardCode: "50219",
    lines: ["50219:A:2"],
    timing: "action",
    condition: { kind: "phase", is: "Travel" },
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "PlaceDamageOn", code: LAKE_TOWN, amount: 2 }] }, { verb: "AddSourceToVictory" }],
  },
  {
    id: "50219:shadow:1",
    cardCode: "50219",
    lines: ["50219:A:3"],
    timing: "shadow",
    instructions: [
      { verb: "PlaceDamageOn", code: LAKE_TOWN, amount: 1, when: { kind: "undefended", is: false } },
      { verb: "PlaceDamageOn", code: LAKE_TOWN, amount: 4, when: { kind: "undefended", is: true } },
    ],
  },
  // 50220 East Pier. While it is in play no "When Revealed" effect can be canceled.
  { id: "50220:constant:1", cardCode: "50220", lines: ["50220:A:2"], timing: "constant", instructions: [{ verb: "UncancelableWhenRevealed" }] },
  // 50221 Great House. When Revealed: resolve all burn damage (its own Burn 3 counts).
  { id: "50221:whenRevealed:1", cardCode: "50221", lines: ["50221:A:2"], timing: "whenRevealed", instructions: [RESOLVE_BURN] },
  // 50222 Great Bridge. When Revealed: each player discards X cards from his deck, X the damage on Lake-town; with no card discarded it gains surge.
  {
    id: "50222:whenRevealed:1",
    cardCode: "50222",
    lines: ["50222:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: { lakeTownDamage: true } }] }, { verb: "GainSurge", when: { kind: "noneDiscarded" } }],
  },
  // 50223 Fisherman's Dock. Travel: with 1 active location, exhaust a hero to travel here and have 2 active locations (families/smaug/travel.ts). Shadow: add this location to the staging area.
  {
    id: "50223:travel:1",
    cardCode: "50223",
    lines: ["50223:A:2"],
    timing: "travel",
    instructions: [{ verb: "Pick", pick: READY_HERO, when: ONE_ACTIVE }, { verb: "Exhaust", target: { kind: "picked" }, when: ONE_ACTIVE }],
  },
  { id: "50223:shadow:1", cardCode: "50223", lines: ["50223:A:3"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },
  // 50224 Esgaroth Wharf. All locations in play, the staging area's and the active ones, are immune to player card effects. Shadow: the attacking enemy gets +2 Attack and makes an additional attack after this one.
  { id: "50224:constant:1", cardCode: "50224", lines: ["50224:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", staging: true } }] },
  {
    id: "50224:shadow:1",
    cardCode: "50224",
    lines: ["50224:A:3"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" }, { verb: "ImmediateAttack", afterThis: true }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
