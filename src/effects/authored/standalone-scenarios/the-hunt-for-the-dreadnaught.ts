import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as A_STORM_ON_COBAS_HAVEN } from "../a-storm-on-cobas-haven.ts";
import { AUTHORED_EFFECTS as FLIGHT_OF_THE_STORMCALLER } from "../flight-of-the-stormcaller.ts";
import { AUTHORED_EFFECTS as THE_CITY_OF_CORSAIRS } from "../the-city-of-corsairs.ts";
import { AUTHORED_EFFECTS as VOYAGE_ACROSS_BELEGAER } from "../voyage-across-belegaer.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Hunt for the Dreadnaught (standalone-scenarios cycle part 14, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. The mode cards 40001 (Easy) and 40002 (Standard, the Normal game) are the scenario's `modeCard` and `easyModeCard`: their Setup runs after the quest card's Setup steps as one effect frame
// (the fleet choice asks), then the card is flipped and its back works all game. Reading 3 (docs/brief.md, The Hunt for the Dreadnaught): the fleet is prepared with the rest of the mode card's Setup, after the mulligan, so the
// starting-hand lines of Pride of Lebennin and Silent Mist are Setup draws. The Dreadnaught's global values are the players at the table times the printed number (reading 16).
// Rules: rr.setup, rr.forced, rr.response, rr.action, rr.player-elimination, rr.damage, rr.engaged, rr.attacks-outside-the-combat-phase, rr.first-player, rr.cancel, rr.immune, rr.blank, dcce.ship-objectives, dcce.ship-enemies, dcce.prepare-your-fleet, dcce.corsair-deck, dcce.boarding, dcce.archery, faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.lasting-effects (data/rules/entries.json).
const MODE = "40002";
const EASY = "40001";
const DREADNAUGHT = "40013";
const BLACK_SAILS = "40026";
const CORSAIR_WARSHIP = "40029";
const COBAS_HAVEN = "40035";
const GONDORIAN_WARSHIP = "40012";

const YOUR_HEROES: PickSpec = { type: "hero", control: "you" };
const ANY_CHARACTER: PickSpec = { type: "character", control: "any" };
const YOUR_SHIP: PickSpec = { type: "character", control: "you", trait: "Ship" };
const ANY_SHIP: PickSpec = { type: "character", control: "any", trait: "Ship" };
const SHIP_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Ship", staging: true };
const ANY_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const YOUR_CHARACTER: PickSpec = { type: "character", control: "you" };
const ATTACKER_IS_SHIP: Condition = { kind: "matches", card: "attacker", pick: SHIP_ENEMY };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const DREADNAUGHT_PICK: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Dreadnaught"] };
const SEVEN_ALLIES: Condition = { kind: "count", pick: { type: "ally", control: "you" }, min: 7 };
const NON_UNIQUE_ENGAGED: PickSpec = { type: "enemy", control: "any", nonUnique: true };
const ALL_PLAYERS: PickSpec = { type: "player", control: "any" };
const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);

// "Each hero you control gets +N <stat>" (the six ships' constants).
const heroStat = (code: string, line: string, n: number, stat: "willpower" | "hitPoints" | "defense", amount: number, more: Instruction[] = []): Effect => ({
  id: `${code}:constant:${n}`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  instructions: [{ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", holders: YOUR_HEROES }, ...more],
});
// "Response: After <ship> flips, ..." (side B of each ship).
const flipResponse = (code: string, line: string, instructions: Instruction[], condition?: Condition): Effect => ({
  id: `${code}:response:1`,
  cardCode: code,
  lines: [line],
  timing: "response",
  trigger: "flipped",
  subject: "self",
  ...(condition ? { condition } : {}),
  instructions,
});
// "Engaged player cannot attack the Dreadnaught." (the six unique Corsairs, reading 20): the characters the engaged player controls are barred from attacks against the Dreadnaught.
const noDreadnaught = (code: string, line: string, n = 1): Effect => ({
  id: `${code}:constant:${n}`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  condition: { kind: "sourceIn", zone: "engaged" },
  instructions: [{ verb: "ModifyStat", stat: "cannotAttackDreadnaught", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "you" } }],
});
// An enemy's Forced effect "After <enemy> attacks you" and the like.
const afterAttacks = (code: string, line: string, n: number, instructions: Instruction[]): Effect => ({ id: `${code}:forced:${n}`, cardCode: code, lines: [line], timing: "forced", trigger: "attackResolved", subject: "self", instructions });
// "Forced: After an event card is discarded from your deck by <enemy>'s Pillage keyword, ..." (reading 21): one Forced effect for each event card Pillage discards.
const pillaged = (code: string, line: string, instructions: Instruction[]): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "pillaged",
  subject: "self",
  condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", cardType: "event", from: "discard" } },
  instructions,
});
// "Pillage X." keyword lines: the keyword is the card's printed field (overrides.cards), the attack's end runs it (families/sea/pillage.ts).
const pillageKeyword = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [] });
// A mode card's Setup line a record of its own implements (the steps the data or the engine do carry no instruction).
const setup = (code: string, n: number, lines: string[], instructions: Instruction[]): Effect => ({ id: `${code}:setup:${n}`, cardCode: code, lines, timing: "setup", instructions });
// "If a player controls no ship-objective, that player is eliminated from the game." (reading 14), the last line of each mode card's back.
const noShipEliminated = (code: string, line: string): Effect => ({ id: `${code}:constant:3`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "EliminateWithoutShip" }] });
// The mode card's Quest Action (reading 15): 10 damage to a non-unique enemy engaged with a player; Standard Mode reveals the top card of the encounter deck as well.
const questAction = (code: string, line: string, reveal: boolean): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [line],
  timing: "action",
  limit: "oncePerGameGroup",
  condition: { kind: "canPick", pick: NON_UNIQUE_ENGAGED },
  instructions: [{ verb: "Pick", pick: NON_UNIQUE_ENGAGED }, { verb: "DamageCard", amount: 10, target: "picked" }, ...(reveal ? [{ verb: "RevealEncounter" } as Instruction] : [])],
});
// "Choose a hero you control" then "Until the end of the game, that hero gains ranged" (Golden Wing, A:3).
const RANGED_HERO: Instruction[] = [{ verb: "Pick", pick: YOUR_HEROES }, { verb: "ModifyStat", stat: "ranged", amount: 1, until: "endOfGame", target: "picked" }];
// "Ready a character": any exhausted character (Swan Ship of Dol Amroth).
const EXHAUSTED_CHARACTER: PickSpec = { type: "character", control: "any", state: "exhausted" };
// "Play an ally or attachment from your hand": the player takes one kind.
const playAllyOrAttachment: Instruction = {
  verb: "Choose",
  who: "actor",
  options: [
    { id: "ally", requires: { kind: "canPick", pick: { type: "card", control: "you", cardType: "ally", from: "hand" } }, instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "ally" } }] },
    { id: "attachment", requires: { kind: "canPick", pick: { type: "card", control: "you", cardType: "attachment", from: "hand" } }, instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "attachment" } }] },
  ],
};
// "either raise your threat by N or it gains Boarding 1" (War Galley; Corsair Skiff is the copy of 12022): the engaged player chooses; the Boarding branch is offered while the Corsair deck holds a card (rr.effects).
const threatOrBoarding = (code: string, line: string, threat: number): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "engaged",
  subject: "self",
  eventSeat: "you",
  condition: { kind: "fromStaging" },
  instructions: [
    {
      verb: "Choose",
      who: "actor",
      options: [
        { id: "threat", instructions: [{ verb: "RaiseThreat", amount: threat }] },
        { id: "boarding", requires: { kind: "corsairHas" }, instructions: [{ verb: "ModifyStat", stat: "boarding", amount: 1, until: "whileSourceInPlay", target: "self" }] },
      ],
    },
  ],
});

const PLAYERS = { players: true } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 40002 Standard Mode (the Normal game). Front: the fleet is chosen, the Corsair deck prepared (only Corsairs: the Sea Monster stays in the encounter deck), the 7 unique enemies are set aside by the piles, the encounter deck is shuffled
  // and cards are discarded from the top until 2 locations are discarded (the piles list 3 locations from 3 players), which go to the staging area; the card is flipped by the end of Setup. Back: the Quest Action and the elimination.
  setup(MODE, 1, ["40002:A:1", "40002:A:2"], [{ verb: "PrepareFleet", own: true }]),
  setup(MODE, 2, ["40002:A:3"], [{ verb: "PrepareCorsairDeck", trait: "Corsair" }]),
  setup(MODE, 3, ["40002:A:4"], []),
  setup(MODE, 4, ["40002:A:5"], [{ verb: "ShuffleEncounterDeck" }, { verb: "DiscardUntilEnemies", perPlayer: 1, atLeast: 2, to: "staging", cardType: "location" }]),
  setup(MODE, 5, ["40002:A:6"], []),
  questAction(MODE, "40002:B:1", true),
  noShipEliminated(MODE, "40002:B:2"),

  // 40001 Easy Mode (the Easy game): two Black Sails and the Corsair Warship are set aside, Cobas Haven goes to the staging area (no cards are discarded for locations), each hero gets 1 resource, and each player draws 1 more card in the
  // resource phase. The Quest Action does not reveal a card.
  setup(EASY, 1, ["40001:A:1", "40001:A:2"], [{ verb: "PrepareFleet", own: true }]),
  setup(EASY, 2, ["40001:A:3"], [{ verb: "PrepareCorsairDeck", trait: "Corsair" }]),
  setup(EASY, 3, ["40001:A:4"], [{ verb: "SetAsideFromDeck", code: BLACK_SAILS }, { verb: "SetAsideFromDeck", code: CORSAIR_WARSHIP }]),
  setup(EASY, 4, ["40001:A:5"], [{ verb: "SearchToStaging", code: COBAS_HAVEN }, { verb: "ShuffleEncounterDeck" }]),
  setup(EASY, 5, ["40001:A:6"], [EACH_PLAYER([{ verb: "HeroesGainResources", amount: 1 }])]),
  setup(EASY, 6, ["40001:A:7"], []),
  { id: `${EASY}:constant:1`, cardCode: EASY, lines: ["40001:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "extraDraw", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  questAction(EASY, "40001:B:2", false),
  noShipEliminated(EASY, "40001:B:3"),

  // 40004 Searching the High Seas, stage 1B: global quest points 8 for each player; no more than 5 progress for each player each round; the players advance only after the quest phase has ended (reading 29).
  { id: "40004:constant:1", cardCode: "40004", lines: ["40004:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { ...PLAYERS, times: 8 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "40004:constant:2", cardCode: "40004", lines: ["40004:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: { ...PLAYERS, times: 5 }, until: "whileSourceInPlay", target: "table" }] },
  { id: "40004:constant:3", cardCode: "40004", lines: ["40004:B:3"], timing: "constant", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 40005 Destroy the Dreadnaught, stage 2. A: the set-aside Dreadnaught joins the staging area, Elite side up. B: the same progress cap; the Action shuffles a set-aside Gondorian Warship into the encounter deck for 5 progress for each
  // player; the Response cancels the Dreadnaught's attack for 4 threat; the players win when it is destroyed.
  { id: "40005:whenRevealed:1", cardCode: "40005", lines: ["40005:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: DREADNAUGHT }] },
  { id: "40005:constant:1", cardCode: "40005", lines: ["40005:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: { ...PLAYERS, times: 5 }, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "40005:action:1",
    cardCode: "40005",
    lines: ["40005:B:2"],
    timing: "action",
    condition: { kind: "setAsideHas", code: GONDORIAN_WARSHIP },
    instructions: [{ verb: "RemoveQuestProgress", amount: { ...PLAYERS, times: 5 } }, { verb: "ShuffleRandomSetAside", name: "Gondorian Warship" }, { verb: "ShuffleEncounterDeck" }],
  },
  {
    id: "40005:response:1",
    cardCode: "40005",
    lines: ["40005:B:3"],
    timing: "response",
    trigger: "enemyAttacks",
    subject: { type: "enemy", control: "any", names: ["Dreadnaught"] },
    cost: { kind: "raiseThreat", amount: 4 },
    instructions: [{ verb: "CancelAttack" }],
  },
  { id: "40005:triggered:1", cardCode: "40005", lines: ["40005:B:4"], timing: "triggered", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", names: ["Dreadnaught"] }, instructions: [{ verb: "WinGame" }] },

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

  // 40008 Pride of Lebennin. The starting-hand line is a Setup draw after the mulligan (reading 3): 5 more cards, then 5 cards of the hand are shuffled into the deck. B: heal 2 from a character, up to 2 cards of the encounter discard pile to the victory display.
  heroStat("40008", "40008:A:2", 1, "defense", 1),
  setup("40008", 1, ["40008:A:3"], [{ verb: "Draw", amount: 5 }, { verb: "Each", pick: { type: "card", control: "you", from: "hand" }, upTo: 5, rest: [], instructions: [{ verb: "PutOnDeck", position: "shuffle", target: "picked" }] }]),
  heroStat("40008", "40008:B:2", 2, "defense", 2),
  flipResponse("40008", "40008:B:3", [
    { verb: "Pick", pick: ANY_CHARACTER },
    { verb: "Heal", amount: 2, target: "picked" },
    { verb: "Each", pick: { type: "card", control: "any", from: "encounterDiscard" }, upTo: 2, instructions: [{ verb: "AddToVictory", target: "picked" }] },
  ]),

  // 40009 Silent Mist. A: the starting hand is 8 cards, a Setup draw of 2 after the mulligan (reading 3); Action: an event costing 3 or more is played for 1 less. B: up to 2 events of the discard pile (and the collection) go to the hand; the Action is 2 cheaper.
  setup("40009", 1, ["40009:A:2"], [{ verb: "Draw", amount: 2 }]),
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
  flipResponse("40010", "40010:B:2", [{ verb: "Pick", pick: YOUR_HEROES }, { verb: "AddResources", amount: 2, to: "picked" }, { verb: "Pick", pick: { type: "card", control: "any", state: "exhausted" } }, { verb: "Ready", target: "picked" }]),
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
      { verb: "ModifyStat", stat: "archeryPlayers", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "engagedWithAll", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "leavesStagingWhenDefeated", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "damageCap", amount: { ...PLAYERS, times: 5 }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "40013:constant:2", cardCode: DREADNAUGHT, lines: ["40013:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: { ...PLAYERS, times: 15 }, until: "whileSourceInPlay", target: "self" }] },
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
      { verb: "ModifyStat", stat: "damageCap", amount: { ...PLAYERS, times: 5 }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "40013:constant:4", cardCode: DREADNAUGHT, lines: ["40013:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: { ...PLAYERS, times: 15 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "40013:forced:2", cardCode: DREADNAUGHT, lines: ["40013:B:3"], timing: "forced", trigger: "flipped", subject: "self", instructions: [EACH_PLAYER([{ verb: "EngageRandomSetAside", trait: "Corsair" }])] },

  // The six unique Corsairs (Victory 10, immune to player card effects).
  // 40014 Captain of the Haven: Pillage 8; Forced: at the end of the combat phase the engaged player with no cards in their deck is eliminated.
  pillageKeyword("40014", "40014:A:1"),
  noDreadnaught("40014", "40014:A:2"),
  {
    id: "40014:forced:1",
    cardCode: "40014",
    lines: ["40014:A:3"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "sourceIn", zone: "engaged" }, { kind: "not", condition: { kind: "count", pick: { type: "card", control: "you", from: "deck" }, min: 1 } }] },
    instructions: [{ verb: "EliminatePlayer" }],
  },
  // 40015 Commander of the Dreadnaught: after it attacks you, the Dreadnaught attacks you.
  noDreadnaught("40015", "40015:A:2"),
  afterAttacks("40015", "40015:A:3", 1, [{ verb: "Pick", pick: DREADNAUGHT_PICK }, { verb: "ImmediateAttackBy", target: "picked" }]),
  // 40016 Descendant of Castamir: after it engages you, the top 2 Corsair cards go into play engaged with you, each dealt 1 shadow card.
  noDreadnaught("40016", "40016:A:2"),
  { id: "40016:forced:1", cardCode: "40016", lines: ["40016:A:3"], timing: "forced", trigger: "engaged", subject: "self", eventSeat: "you", instructions: [{ verb: "RevealCorsair", count: 2, shadow: 1 }] },
  // 40017 Hydraken: after he attacks, once each round, an additional attack with 2 shadow cards, and the engaged player raises their threat by 4.
  noDreadnaught("40017", "40017:A:2"),
  {
    id: "40017:forced:1",
    cardCode: "40017",
    lines: ["40017:A:3"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    limit: "oncePerRound",
    instructions: [{ verb: "DealShadowTo", target: "self" }, { verb: "DealShadowTo", target: "self" }, { verb: "RaiseThreat", amount: 4, who: "actor" }, { verb: "ImmediateAttackBy", target: "self" }],
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
  noDreadnaught("40018", "40018:A:2"),
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
  copyLine("12125:A:3", "40028:A:2"),
  copyLine("11058:A:3", "40029:A:2"),
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
  copyLine("12130:A:1", "40035:A:1"),
  // 40036 Isle of Fortune: enters play with 1 resource for each player; discards 1 when a Ship enemy enters play; when explored as the active location the resources go to a hero's pool.
  { id: "40036:triggered:1", cardCode: "40036", lines: ["40036:A:1"], timing: "triggered", trigger: "enteredPlay", subject: "self", instructions: [{ verb: "PlaceResourceTokens", amount: PLAYERS, target: "self" }] },
  { id: "40036:forced:1", cardCode: "40036", lines: ["40036:A:2"], timing: "forced", trigger: "enteredPlay", subject: { type: "enemy", control: "any", trait: "Ship", staging: true }, instructions: [{ verb: "RemoveResourceTokens", amount: 1, target: "self" }] },
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
    instructions: [{ verb: "RaiseThreat", amount: 1, when: { kind: "less", left: { hand: true }, right: 5 } }, { verb: "RaiseThreat", amount: 3, when: { kind: "not", condition: { kind: "less", left: { hand: true }, right: 5 } } }],
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
      { verb: "AssignDamage", amount: 2, pick: YOUR_CHARACTER, when: { kind: "not", condition: { kind: "count", pick: { type: "card", control: "you", from: "discard" }, min: 10 } } },
      { verb: "AssignDamage", amount: 3, pick: YOUR_CHARACTER, when: { kind: "count", pick: { type: "card", control: "you", from: "discard" }, min: 10 } },
    ],
  },
  copyLine("11059:A:1", "40041:A:1"),
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
      { verb: "AttackWithPicked" },
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
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: SEVEN_ALLIES } },
      { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: SEVEN_ALLIES },
    ],
  },
  copyLine("12132:A:1", "40045:A:1"),
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
] as readonly (Effect | ReturnType<typeof copyLine>)[], { pool: [...A_STORM_ON_COBAS_HAVEN, ...FLIGHT_OF_THE_STORMCALLER, ...THE_CITY_OF_CORSAIRS, ...VOYAGE_ACROSS_BELEGAER] });

export const AUTHORED_REPLACES: readonly string[] = [];
