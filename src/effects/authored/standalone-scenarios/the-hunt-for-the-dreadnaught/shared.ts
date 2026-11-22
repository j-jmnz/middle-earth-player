import type { Condition, Effect, Instruction, PickSpec } from "../../../../catalog/boundary.ts";

// What the records of The Hunt for the Dreadnaught share: the cards they name, the pick filters and the builders of the lines several cards print alike (docs/scenarios/standalone-scenarios.md, The Hunt for the Dreadnaught).
export const MODE = "40002";
export const EASY = "40001";
export const DREADNAUGHT = "40013";
export const BLACK_SAILS = "40026";
export const CORSAIR_WARSHIP = "40029";
export const COBAS_HAVEN = "40035";
export const GONDORIAN_WARSHIP = "40012";

export const YOUR_HEROES: PickSpec = { type: "hero", control: "you" };
export const ANY_CHARACTER: PickSpec = { type: "character", control: "any" };
export const YOUR_SHIP: PickSpec = { type: "character", control: "you", trait: "Ship" };
export const ANY_SHIP: PickSpec = { type: "character", control: "any", trait: "Ship" };
export const SHIP_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Ship", staging: true };
export const ANY_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true };
export const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
export const YOUR_CHARACTER: PickSpec = { type: "character", control: "you" };
export const ATTACKER_IS_SHIP: Condition = { kind: "matches", card: "attacker", pick: SHIP_ENEMY };
export const IN_STAGING = { kind: "sourceIn", zone: "staging" } as const;
export const DREADNAUGHT_PICK: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Dreadnaught"] };
export const SEVEN_ALLIES: Condition = { kind: "count", pick: { type: "ally", control: "you" }, min: 7 };
export const NON_UNIQUE_ENGAGED: PickSpec = { type: "enemy", control: "any", nonUnique: true };
export const ALL_PLAYERS: PickSpec = { type: "player", control: "any" };
export const EACH_PLAYER = (instructions: Instruction[]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions } as Instruction);

// "Each hero you control gets +N <stat>" (the six ships' constants).
export const heroStat = (code: string, line: string, n: number, stat: "willpower" | "hitPoints" | "defense", amount: number, more: Instruction[] = []): Effect => ({
  id: `${code}:constant:${n}`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  instructions: [{ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", holders: YOUR_HEROES }, ...more],
});
// "Response: After <ship> flips, ..." (side B of each ship).
export const flipResponse = (code: string, line: string, instructions: Instruction[], condition?: Condition): Effect => ({
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
export const noDreadnaught = (code: string, line: string, n = 1): Effect => ({
  id: `${code}:constant:${n}`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  condition: { kind: "sourceIn", zone: "engaged" },
  instructions: [{ verb: "ModifyStat", stat: "cannotAttackDreadnaught", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "you" } }],
});
// An enemy's Forced effect "After <enemy> attacks you" and the like.
export const afterAttacks = (code: string, line: string, n: number, instructions: Instruction[]): Effect => ({ id: `${code}:forced:${n}`, cardCode: code, lines: [line], timing: "forced", trigger: "attackResolved", subject: "self", instructions });
// "Forced: After an event card is discarded from your deck by <enemy>'s Pillage keyword, ..." (reading 21): one Forced effect for each event card Pillage discards.
export const pillaged = (code: string, line: string, instructions: Instruction[]): Effect => ({
  id: `${code}:forced:1`,
  cardCode: code,
  lines: [line],
  timing: "forced",
  trigger: "pillaged",
  subject: "self",
  condition: { kind: "matches", card: "other", pick: { type: "card", control: "any", cardType: "event", from: "discard" } },
  instructions,
});
// "Pillage X." keyword lines: the keyword is the card's printed field (overrides.cards), the attack's end runs it (families/sea/pillage.ts).
export const pillageKeyword = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [] });
// A mode card's Setup line a record of its own implements (the steps the data or the engine do carry no instruction).
export const setup = (code: string, n: number, lines: string[], instructions: Instruction[]): Effect => ({ id: `${code}:setup:${n}`, cardCode: code, lines, timing: "setup", instructions });
// "If a player controls no ship-objective, that player is eliminated from the game." (reading 14), the last line of each mode card's back.
export const noShipEliminated = (code: string, line: string): Effect => ({ id: `${code}:constant:3`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "EliminateWithoutShip" }] });
// The mode card's Quest Action (reading 15): 10 damage to a non-unique enemy engaged with a player; Standard Mode reveals the top card of the encounter deck as well.
export const questAction = (code: string, line: string, reveal: boolean): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [line],
  timing: "action",
  limit: "oncePerGameGroup",
  condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "canPick", pick: NON_UNIQUE_ENGAGED }] },
  instructions: [{ verb: "Pick", pick: NON_UNIQUE_ENGAGED }, { verb: "DamageCard", amount: 10, target: "picked" }, ...(reveal ? [{ verb: "RevealEncounter" } as Instruction] : [])],
});
// "Choose a hero you control" then "Until the end of the game, that hero gains ranged" (Golden Wing, A:3).
export const RANGED_HERO: Instruction[] = [{ verb: "Pick", pick: YOUR_HEROES }, { verb: "ModifyStat", stat: "ranged", amount: 1, until: "endOfGame", target: "picked" }];
// "Ready a character": any exhausted character (Swan Ship of Dol Amroth).
export const EXHAUSTED_CHARACTER: PickSpec = { type: "character", control: "any", state: "exhausted" };
// "Play an ally or attachment from your hand": the player takes one kind.
export const playAllyOrAttachment: Instruction = {
  verb: "Choose",
  who: "actor",
  options: [
    { id: "ally", requires: { kind: "canPick", pick: { type: "card", control: "you", cardType: "ally", from: "hand" } }, instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "ally" } }] },
    { id: "attachment", requires: { kind: "canPick", pick: { type: "card", control: "you", cardType: "attachment", from: "hand" } }, instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you", cardType: "attachment" } }] },
  ],
};
// "either raise your threat by N or it gains Boarding 1" (War Galley; Corsair Skiff is the copy of 12022): the engaged player chooses; the Boarding branch is offered while the Corsair deck holds a card (rr.effects).
export const threatOrBoarding = (code: string, line: string, threat: number): Effect => ({
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

// "N PerPlayer" on a global value (the stages, the Dreadnaught): N for each player who started the scenario, an eliminated one included (docs/scenarios/standalone-scenarios.md, The Hunt for the Dreadnaught, reading 16).
export const STARTED = { startedPlayers: true } as const;
export const PLAYERS = { players: true } as const;

