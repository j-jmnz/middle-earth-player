import type { Effect } from "../../../../catalog/boundary.ts";
import { copyLine, type Copy } from "../../reprint.ts";
import * as H from "./shared.ts";

// The six ship-objectives, the Gondorian Warship, the Dreadnaught and the six unique Corsairs.
const { DREADNAUGHT, YOUR_HEROES, ANY_CHARACTER, ANY_ENEMY, DREADNAUGHT_PICK, ALL_PLAYERS, EACH_PLAYER, heroStat, flipResponse, noDreadnaught, afterAttacks, pillageKeyword, setup, RANGED_HERO, EXHAUSTED_CHARACTER, playAllyOrAttachment, STARTED } = H;

export const SHIPS: readonly (Effect | Copy)[] = [
  // The six ship-objectives (Immune and Sentinel are keywords). Side A is Basic, side B Upgraded (flipped once, by Belfalas Shipyard); each side's constant is for its controller's heroes and the Response of side B hears "after X flips".
  // 40006 Eithiliant. Setup: a hero gains the printed Traits of another hero until the end of the game (a lone hero gains nothing). B: shuffle up to 6 cards of the discard pile into the deck and 6 progress on a location.
  heroStat("40006", "40006:A:2", 1, "willpower", 1),
  setup("40006", 1, ["40006:A:3"], [{ verb: "Pick", pick: YOUR_HEROES }, { verb: "Pick", pick: { ...YOUR_HEROES, different: true } }, { verb: "GainHeroTraits" }]),
  heroStat("40006", "40006:B:2", 2, "willpower", 2),
  flipResponse("40006", "40006:B:3", [
    { verb: "Each", pick: { type: "card", control: "you", from: "discard" }, upTo: 6, instructions: [{ verb: "PutOnDeck", position: "shuffle", target: "picked" }] },
    { verb: "Pick", pick: { type: "location", control: "any" } },
    { verb: "PlaceProgressOn", amount: 6, target: "picked" },
  ]),

  // 40007 Golden Wing. Setup: threat 3 lower, a hero gains ranged until the end of the game. B: the heroes gain ranged; 6 damage to an enemy.
  heroStat("40007", "40007:A:2", 1, "hitPoints", 1),
  setup("40007", 1, ["40007:A:3"], [{ verb: "LowerThreat", amount: 3, who: "actor" }, ...RANGED_HERO]),
  heroStat("40007", "40007:B:2", 2, "hitPoints", 2, [{ verb: "ModifyStat", stat: "ranged", amount: 1, until: "whileSourceInPlay", holders: YOUR_HEROES }]),
  flipResponse("40007", "40007:B:3", [{ verb: "Pick", pick: ANY_ENEMY }, { verb: "DamageCard", amount: 6, target: "picked" }], { kind: "canPick", pick: ANY_ENEMY }),

  // 40008 Pride of Lebennin. The starting-hand line is a Setup draw after the mulligan (reading 3): the hand is shuffled into the deck and 6 cards are drawn again (so a mulligan taken before the ship was chosen has no effect: "You cannot take a mulligan"), then 5 more cards, then 5 cards of the hand are shuffled into the deck. B: heal 2 from a character, up to 2 cards of the encounter discard pile to the victory display.
  heroStat("40008", "40008:A:2", 1, "defense", 1),
  { id: "40008:forced:1", cardCode: "40008", lines: ["40008:A:3"], timing: "forced", trigger: "setupHandDrawn", instructions: [{ verb: "ShuffleHandIntoDeck" }, { verb: "Draw", amount: 6 }, { verb: "Draw", amount: 5 }, { verb: "Each", pick: { type: "card", control: "you", from: "hand" }, upTo: 5, rest: [], instructions: [{ verb: "PutOnDeck", position: "shuffle", target: "picked" }] }] },
  heroStat("40008", "40008:B:2", 2, "defense", 2),
  flipResponse("40008", "40008:B:3", [
    { verb: "Pick", pick: ANY_CHARACTER },
    { verb: "Heal", amount: 2, target: "picked" },
    { verb: "Each", pick: { type: "card", control: "any", from: "encounterDiscard" }, upTo: 2, instructions: [{ verb: "AddToVictory", target: "picked" }] },
  ]),

  // 40009 Silent Mist. A: the starting hand is 8 cards, a Setup draw of 2 after the mulligan (reading 3); Action: an event costing 3 or more is played for 1 less. B: up to 2 events of the discard pile (and the collection) go to the hand; the Action is 2 cheaper.
  { id: "40009:constant:1", cardCode: "40009", lines: ["40009:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "startingHand", amount: 2, until: "whileSourceInPlay", target: "actorSeat" }] },
  flipResponse("40009", "40009:B:2", [{ verb: "AddEventsToHand", upTo: 2 }]),
  { id: "40009:action:1", cardCode: "40009", lines: ["40009:A:3"], timing: "action", instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "event", minCost: 3 }, reduce: 1, min: 0 }] },
  { id: "40009:action:2", cardCode: "40009", lines: ["40009:B:3"], timing: "action", instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "event", minCost: 3 }, reduce: 2, min: 0 }] },

  // 40010 Swan Ship of Dol Amroth. Setup: 1 resource on each hero; Action: spend 2 resources (1 on B) to ready a character (a card on B), once a round. B: 2 resources on a hero and a card readied.
  setup("40010", 1, ["40010:A:2"], [{ verb: "HeroesGainResources", amount: 1 }]),
  {
    id: "40010:action:1",
    cardCode: "40010",
    lines: ["40010:A:3"],
    timing: "action",
    limit: "oncePerRound",
    condition: { kind: "all", conditions: [{ kind: "resources", min: 2 }, { kind: "canPick", pick: EXHAUSTED_CHARACTER }] },
    instructions: [{ verb: "SpendResources", amount: 2 }, { verb: "Pick", pick: EXHAUSTED_CHARACTER }, { verb: "Ready", target: "picked" }],
  },
  flipResponse("40010", "40010:B:2", [{ verb: "Pick", pick: { ...YOUR_HEROES, control: "any" } }, { verb: "AddResources", amount: 2, to: "picked" }, { verb: "Pick", pick: { type: "card", control: "any", state: "exhausted" } }, { verb: "Ready", target: "picked" }]),
  {
    id: "40010:action:2",
    cardCode: "40010",
    lines: ["40010:B:3"],
    timing: "action",
    limit: "oncePerRound",
    condition: { kind: "all", conditions: [{ kind: "resources", min: 1 }, { kind: "canPick", pick: { type: "card", control: "any", state: "exhausted" } }] },
    instructions: [{ verb: "SpendResources", amount: 1 }, { verb: "Pick", pick: { type: "card", control: "any", state: "exhausted" } }, { verb: "Ready", target: "picked" }],
  },

  // 40011 Twilight's Call. The first card played each round (every card on B) needs no resource match; Action: play an ally or attachment from the hand (once a round on A). B: draw 3 cards.
  { id: "40011:constant:1", cardCode: "40011", lines: ["40011:A:2"], timing: "constant", instructions: [{ verb: "IgnoreResourceMatch", pick: { type: "card", control: "you" }, firstEachRound: true }] },
  { id: "40011:action:1", cardCode: "40011", lines: ["40011:A:3"], timing: "action", limit: "oncePerRound", instructions: [playAllyOrAttachment] },
  { id: "40011:constant:2", cardCode: "40011", lines: ["40011:B:2"], timing: "constant", instructions: [{ verb: "IgnoreResourceMatch", pick: { type: "card", control: "you" } }] },
  flipResponse("40011", "40011:B:3", [{ verb: "Draw", amount: 3 }]),
  { id: "40011:action:2", cardCode: "40011", lines: ["40011:B:4"], timing: "action", instructions: [playAllyOrAttachment] },

  // 40012 Gondorian Warship (a Ship objective in the encounter deck once stage 2B has shuffled it in). When Revealed: the first player chooses the player who controls it. Destroyed it is set aside; as a shadow card it deals 5 damage to the attacker.
  { id: "40012:whenRevealed:1", cardCode: "40012", lines: ["40012:A:2"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { ...ALL_PLAYERS, who: "firstPlayer" } }, { verb: "SwitchActor", to: "picked" }, { verb: "TakeControl", who: "actor" }] },
  copyLine("12123:A:3", "40012:A:3"),
  { id: "40012:shadow:1", cardCode: "40012", lines: ["40012:A:4"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 5, target: "attacker" }] },

  // 40013 The Dreadnaught. Elite side: Archery 1 for each player, Massive (engaged with every player, stays in the staging area), no more than 5 damage for each player each round, 15 hit points for each player. At the end of the round with under half its hit
  // points left it flips (reading 18); the Damaged side has Massive, the same cap and hit points, and each player puts a random set-aside unique Corsair into play engaged with them.
  {
    id: "40013:constant:1",
    cardCode: DREADNAUGHT,
    lines: ["40013:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "archery", amount: STARTED, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "leavesStagingWhenDefeated", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "damageCap", amount: { ...STARTED, times: 5 }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "40013:constant:2", cardCode: DREADNAUGHT, lines: ["40013:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: { ...STARTED, times: 15 }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "40013:forced:1",
    cardCode: DREADNAUGHT,
    lines: ["40013:A:3"],
    timing: "forced",
    trigger: "endOfRound",
    condition: { kind: "less", left: { stat: "hitPoints", of: "self", remaining: true, times: 2 }, right: { stat: "hitPoints", of: "self" } },
    instructions: [{ verb: "FlipCard" }],
  },
  {
    id: "40013:constant:3",
    cardCode: DREADNAUGHT,
    lines: ["40013:B:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "leavesStagingWhenDefeated", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "damageCap", amount: { ...STARTED, times: 5 }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "40013:constant:4", cardCode: DREADNAUGHT, lines: ["40013:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: { ...STARTED, times: 15 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "40013:forced:2", cardCode: DREADNAUGHT, lines: ["40013:B:3"], timing: "forced", trigger: "flipped", subject: "self", instructions: [EACH_PLAYER([{ verb: "EngageRandomSetAside", trait: "Corsair" }])] },

  // The six unique Corsairs (Victory 10, immune to player card effects).
  // 40014 Captain of the Haven: Pillage 8; Forced: at the end of the combat phase the engaged player with no cards in their deck is eliminated.
  pillageKeyword("40014", "40014:A:1"),
  noDreadnaught("40014", "40014:A:2", 2),
  {
    id: "40014:forced:1",
    cardCode: "40014",
    lines: ["40014:A:3"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "engaged" }, { kind: "count", pick: { type: "card", control: "you", from: "deck" }, max: 0 }] },
    instructions: [{ verb: "EliminatePlayer" }],
  },
  // 40015 Commander of the Dreadnaught: after it attacks you, the Dreadnaught attacks you.
  noDreadnaught("40015", "40015:A:2"),
  afterAttacks("40015", "40015:A:3", 1, [{ verb: "Pick", pick: DREADNAUGHT_PICK }, { verb: "AttackWithPicked" }]),
  // 40016 Descendant of Castamir: after it engages you, the top 2 Corsair cards go into play engaged with you, each dealt 1 shadow card.
  noDreadnaught("40016", "40016:A:2"),
  { id: "40016:forced:1", cardCode: "40016", lines: ["40016:A:3"], timing: "forced", trigger: "engaged", subject: "self", eventSeat: "you", instructions: [{ verb: "RevealCorsair", count: 2, shadow: 1 }] },
  // 40017 Hydraken: after he attacks, once each round, an additional attack dealt its usual shadow card and 2 more (all three resolve), and the engaged player raises their threat by 4 (reading 22).
  noDreadnaught("40017", "40017:A:2"),
  {
    id: "40017:forced:1",
    cardCode: "40017",
    lines: ["40017:A:3"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    limit: "oncePerRound",
    instructions: [{ verb: "RaiseThreat", amount: 4, who: "actor" }, { verb: "ImmediateAttackBy", target: "self", extraShadow: 2 }],
  },
  // 40018 Ophidian: no more than 1 character can attack him each round (one at a time, and no other once one was declared); a character that defends against him takes 2 damage.
  {
    id: "40018:constant:1",
    cardCode: "40018",
    lines: ["40018:A:1"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "singleAttacker", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },
  {
    id: "40018:triggered:1",
    cardCode: "40018",
    lines: ["40018:A:1"],
    timing: "triggered",
    trigger: "declaredAttacker",
    subject: { type: "character", control: "any" },
    condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
    instructions: [{ verb: "ModifyStat", stat: "cannotBeAttacked", amount: 1, until: "endOfRound", target: "other" }],
  },
  noDreadnaught("40018", "40018:A:2", 2),
  {
    id: "40018:forced:1",
    cardCode: "40018",
    lines: ["40018:A:3"],
    timing: "forced",
    trigger: "declaredDefender",
    subject: { type: "character", control: "any" },
    condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
    instructions: [{ verb: "DamageCard", amount: 2, target: "subject" }],
  },
  // 40019 Varjax: for each excess point of combat damage he deals, the defending player deals 1 damage to a Ship they control.
  noDreadnaught("40019", "40019:A:2"),
  { id: "40019:constant:2", cardCode: "40019", lines: ["40019:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessDamagesShip", amount: 1, until: "whileSourceInPlay", target: "self" }] },

];
