import type { Effect } from "../../../../catalog/boundary.ts";
import { copyLine, type Copy } from "../../reprint.ts";
import * as H from "./shared.ts";

// The Corsair deck, the Corsair ship-enemies, the locations and the treacheries.
const { BLACK_SAILS, YOUR_HEROES, YOUR_SHIP, ANY_SHIP, SHIP_ENEMY, ANY_ENEMY, READY_CHARACTER, YOUR_CHARACTER, ATTACKER_IS_SHIP, IN_STAGING, SEVEN_ALLIES, EACH_PLAYER, pillaged, pillageKeyword, threatOrBoarding, PLAYERS } = H;

export const ENCOUNTER: readonly (Effect | Copy)[] = [
  // The Corsair deck: non-unique Corsairs, which enter play only by card effects.
  // 40020 Brash Corsair: each time the engaged player exhausts a Ship objective, it attacks them.
  { id: "40020:forced:1", cardCode: "40020", lines: ["40020:A:1"], timing: "forced", trigger: "shipExhausted", subject: YOUR_SHIP, condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ImmediateAttackBy", target: "self" }] },
  // 40021 to 40023 Pillage 2, 3 and 3 and the Forced effect for each event card their Pillage discards.
  pillageKeyword("40021", "40021:A:1"),
  pillaged("40021", "40021:A:2", [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }]),
  pillageKeyword("40022", "40022:A:1"),
  pillaged("40022", "40022:A:2", [{ verb: "Pick", pick: YOUR_CHARACTER }, { verb: "DamageCard", amount: 1, target: "picked" }]),
  pillageKeyword("40023", "40023:A:1"),
  pillaged("40023", "40023:A:2", [{ verb: "Pick", pick: { ...YOUR_HEROES, hasResources: true } }, { verb: "DiscardResources", amount: 1, target: "picked" }]),
  // 40024 Southron Sailor, 40025 Umbar Captain.
  copyLine("11060:A:1", "40024:A:1"),
  { id: "40025:constant:1", cardCode: "40025", lines: ["40025:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "cannotAttackShips", amount: 1, until: "whileSourceInPlay", holders: YOUR_CHARACTER }] },

  // The Corsair ship-enemies. 40026 Black Sails: archery 3 in the staging area; Shadow: a Ship attacker returns to the staging area after the attack.
  { id: "40026:constant:2", cardCode: BLACK_SAILS, lines: ["40026:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "archery", amount: 3, until: "whileSourceInPlay", target: "self" }] },
  { id: "40026:shadow:1", cardCode: BLACK_SAILS, lines: ["40026:A:3"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: ATTACKER_IS_SHIP, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] },
  copyLine("12022:A:3", "40027:A:2"),
  // 40028 Corsair Skirmisher (as 12125:A:3 reads): after it is destroyed as an enemy the engaged player may discard allies with a total Willpower of 3 to take control of it as a Ship objective with Willpower equal to its Threat.
  {
    id: "40028:response:1",
    cardCode: "40028",
    lines: ["40028:A:2"],
    timing: "response",
    trigger: "enemyDestroyed",
    subject: "self",
    answeredBy: "eventSeat",
    condition: { kind: "alliesWillpower", min: 3 },
    instructions: [{ verb: "DiscardAlliesForWillpower", willpower: 3 }, { verb: "TakeControlAsShip" }],
  },
  // 40029 Corsair Warship: in the staging area it cannot be damaged and gains archery 4.
  { id: "40029:constant:2", cardCode: "40029", lines: ["40029:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "archery", amount: 4, until: "whileSourceInPlay", target: "self" }] },
  // 40030 Ramming Ship: after it engages you it gets +4 Attack until the end of the round; Shadow: the top card of the Corsair deck enters play engaged with you, dealt 1 shadow card.
  { id: "40030:forced:1", cardCode: "40030", lines: ["40030:A:2"], timing: "forced", trigger: "engaged", subject: "self", eventSeat: "you", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 4, until: "endOfRound", target: "self" }] },
  { id: "40030:shadow:1", cardCode: "40030", lines: ["40030:A:3"], timing: "shadow", instructions: [{ verb: "RevealCorsair", shadow: 1 }] },
  copyLine("12152:A:3", "40031:A:2"),
  threatOrBoarding("40032", "40032:A:2", 4),
  // 40033 Sea Monster (a Creature enemy): Ship objectives may attack and defend against it; When Revealed: 4 damage to the Ship enemy or Ship objective with the fewest remaining hit points.
  { id: "40033:constant:1", cardCode: "40033", lines: ["40033:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "shipFightable", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "40033:whenRevealed:1", cardCode: "40033", lines: ["40033:A:2"], timing: "whenRevealed", instructions: [{ verb: "PickFewestHitPoints" }, { verb: "DamageCard", amount: 4, target: "picked" }] },

  // The locations. 40034 Belfalas Shipyard: after it is explored as the active location the players as a group spend 5 resources to heal 5 damage from a Ship objective, ready it and flip it to its Upgraded side; Shadow: +1 Attack and Pillage 3.
  {
    id: "40034:response:1",
    cardCode: "40034",
    lines: ["40034:A:1"],
    timing: "response",
    trigger: "activeExplored",
    subject: "self",
    condition: { kind: "all", conditions: [{ kind: "resources", min: 5, group: true }, { kind: "canPick", pick: ANY_SHIP }] },
    instructions: [{ verb: "SpendResources", amount: 5, group: true }, { verb: "Pick", pick: { ...ANY_SHIP, who: "firstPlayer" } }, { verb: "Heal", amount: 5, target: "picked" }, { verb: "Ready", target: "picked" }, { verb: "FlipShip" }],
  },
  {
    id: "40034:shadow:1",
    cardCode: "40034",
    lines: ["40034:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "ModifyStat", stat: "pillage", amount: 3, until: "endOfAttack", target: "attacker" }],
  },
  // 40035 Cobas Haven: while it is the active location the Boarding value of each Ship enemy is 1 lower.
  { id: "40035:constant:1", cardCode: "40035", lines: ["40035:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "boarding", amount: -1, until: "whileSourceInPlay", holders: SHIP_ENEMY }] },
  // 40036 Isle of Fortune: enters play with 1 resource for each player; discards 1 when a Ship enemy enters play; when explored as the active location the resources go to a hero's pool.
  { id: "40036:triggered:1", cardCode: "40036", lines: ["40036:A:1"], timing: "triggered", trigger: "enteredPlay", subject: "self", instructions: [{ verb: "PlaceResourceTokens", amount: PLAYERS, on: "self" }] },
  { id: "40036:forced:1", cardCode: "40036", lines: ["40036:A:2"], timing: "forced", trigger: "enteredPlay", subject: { type: "enemy", control: "any", trait: "Ship", staging: true }, instructions: [{ verb: "RemoveResourceTokens", amount: 1, code: "40036" }] },
  { id: "40036:response:1", cardCode: "40036", lines: ["40036:A:3"], timing: "response", trigger: "activeExplored", subject: "self", instructions: [{ verb: "Pick", pick: { ...YOUR_HEROES, control: "any", who: "firstPlayer" } }, { verb: "MoveResources", all: true }] },
  // 40037 Mouths of Anduin: in the staging area it reveals a card after a When Revealed effect is canceled; Shadow: an undefended attack reveals a card.
  { id: "40037:forced:1", cardCode: "40037", lines: ["40037:A:1"], timing: "forced", trigger: "whenRevealedCanceled", condition: IN_STAGING, instructions: [{ verb: "RevealEncounter" }] },
  { id: "40037:shadow:1", cardCode: "40037", lines: ["40037:A:2"], timing: "shadow", instructions: [{ verb: "RevealEncounter", when: { kind: "undefended" } }] },
  // 40038 Tolfalas Landing: in the staging area it raises the threat of a player who draws cards by a player card effect; Shadow: raise your threat by 1 (3 with 5 or more cards in hand).
  { id: "40038:forced:1", cardCode: "40038", lines: ["40038:A:1"], timing: "forced", trigger: "cardsDrawn", condition: { kind: "all", conditions: [IN_STAGING, { kind: "byPlayerCard" }] }, instructions: [{ verb: "RaiseThreat", amount: { x: true } }] },
  {
    id: "40038:shadow:1",
    cardCode: "40038",
    lines: ["40038:A:2"],
    timing: "shadow",
    instructions: [{ verb: "RaiseThreat", amount: 1, when: { kind: "less", left: { hand: true }, right: 5 } }, { verb: "RaiseThreat", amount: 3, when: { kind: "less", left: 4, right: { hand: true } } }],
  },
  // 40039 Wicked Cove: each location in the staging area is immune to player card effects; Shadow: until the end of the round the attacker is immune to player card effects and gets +2 Defense.
  { id: "40039:constant:1", cardCode: "40039", lines: ["40039:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  {
    id: "40039:shadow:1",
    cardCode: "40039",
    lines: ["40039:A:2"],
    timing: "shadow",
    instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "endOfRound", target: "attacker" }, { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfRound", target: "attacker" }],
  },

  // The treacheries. 40040 Ballista Barrage: Doomed 1; each Ship enemy gains Archery 2 until the end of the round; Shadow: 2 damage among your characters (3 with 10 or more cards in your discard pile).
  { id: "40040:whenRevealed:1", cardCode: "40040", lines: ["40040:A:1", "40040:A:2"], timing: "whenRevealed", instructions: [{ verb: "Doomed", amount: 1 }, { verb: "ModifyStat", stat: "archery", amount: 2, until: "endOfRound", holders: { type: "enemy", control: "any", trait: "Ship", staging: true } }] },
  {
    id: "40040:shadow:1",
    cardCode: "40040",
    lines: ["40040:A:3"],
    timing: "shadow",
    instructions: [
      { verb: "AssignDamage", amount: 2, pick: YOUR_CHARACTER, when: { kind: "count", pick: { type: "card", control: "you", from: "discard" }, max: 9 } },
      { verb: "AssignDamage", amount: 3, pick: YOUR_CHARACTER, when: { kind: "count", pick: { type: "card", control: "you", from: "discard" }, min: 10 } },
    ],
  },
  // 40041 Boarding Party: each player puts the top card of the Corsair deck into play engaged with them.
  { id: "40041:whenRevealed:1", cardCode: "40041", lines: ["40041:A:1"], timing: "whenRevealed", instructions: [{ verb: "RevealCorsair", who: "eachSeat" }] },
  copyLine("11059:A:2", "40041:A:2"),
  // 40042 Grappled!: attaches to a Ship objective as a Condition; the host cannot ready; Action: exhaust 3 characters to discard it. Shadow: it attaches to a defending Ship.
  { id: "40042:whenRevealed:1", cardCode: "40042", lines: ["40042:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "ship" } }] },
  { id: "40042:constant:1", cardCode: "40042", lines: ["40042:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "40042:constant:2", cardCode: "40042", lines: ["40042:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "doesNotReady", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  {
    id: "40042:action:1",
    cardCode: "40042",
    lines: ["40042:A:1"],
    timing: "action",
    condition: { kind: "count", pick: READY_CHARACTER, min: 3 },
    instructions: [{ verb: "Repeat", times: 3, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] }, { verb: "Discard", target: { kind: "self" } }],
  },
  { id: "40042:shadow:1", cardCode: "40042", lines: ["40042:A:2"], timing: "shadow", instructions: [{ verb: "AttachSelf", to: { kind: "ship", defender: true } }] },
  // 40043 Out of the Mist: the staged enemy with the highest engagement cost engages the first player and attacks them; with no attack made, it gains surge. Shadow: raise your threat by 4 or the attacker makes an additional attack.
  {
    id: "40043:whenRevealed:1",
    cardCode: "40043",
    lines: ["40043:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { ...ANY_ENEMY, stagingOnly: true, highestEngagementCost: true, who: "firstPlayer" } },
      { verb: "EngageFirstPlayer", target: "picked" },
      { verb: "AttackWithPicked", who: "firstPlayer" },
      { verb: "GainSurge", when: { kind: "noneReturned" } },
    ],
  },
  {
    id: "40043:shadow:1",
    cardCode: "40043",
    lines: ["40043:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 4 }] }, { id: "attack", instructions: [{ verb: "ImmediateAttack", afterThis: true }] }] }],
  },
  // 40044 Overworked: until the end of the round the text boxes of the non-Ship allies are blank (Traits stay); surge when a player controls 7 or more allies. Shadow: +1 Attack (+3 with 7 or more allies).
  {
    id: "40044:whenRevealed:1",
    cardCode: "40044",
    lines: ["40044:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "endOfRound", holders: { type: "ally", control: "any", notTraits: ["Ship"] } }, EACH_PLAYER([{ verb: "GainSurge", when: SEVEN_ALLIES }])],
  },
  {
    id: "40044:shadow:1",
    cardCode: "40044",
    lines: ["40044:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "count", pick: { type: "ally", control: "you" }, max: 6 } },
      { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: SEVEN_ALLIES },
    ],
  },
  // 40045 Taking on Water: attaches to a Ship objective as a Condition; when the attached objective exhausts it takes 2 damage (an encounter card's, which the Ship's immunity does not stop); Action: exhaust 3 characters to discard it.
  { id: "40045:whenRevealed:1", cardCode: "40045", lines: ["40045:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "ship" } }] },
  { id: "40045:constant:1", cardCode: "40045", lines: ["40045:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  { id: "40045:forced:1", cardCode: "40045", lines: ["40045:A:1"], timing: "forced", trigger: "shipExhausted", subject: "host", instructions: [{ verb: "DamageCard", amount: 2, target: "host" }] },
  {
    id: "40045:action:1",
    cardCode: "40045",
    lines: ["40045:A:1"],
    timing: "action",
    condition: { kind: "count", pick: READY_CHARACTER, min: 3 },
    instructions: [{ verb: "Repeat", times: 3, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] }, { verb: "Discard", target: { kind: "self" } }],
  },
  copyLine("12132:A:2", "40045:A:2"),
  // 40046 Violent Tempest: 1 damage to each enemy; each player assigns X damage among their characters, X their exhausted characters. Shadow: 1 damage to the defending character.
  {
    id: "40046:whenRevealed:1",
    cardCode: "40046",
    lines: ["40046:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "DamageEach", amount: 1, pick: ANY_ENEMY }, EACH_PLAYER([{ verb: "AssignDamage", amount: { count: { type: "character", control: "you", state: "exhausted" } }, pick: YOUR_CHARACTER }])],
  },
  { id: "40046:shadow:1", cardCode: "40046", lines: ["40046:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },
];
