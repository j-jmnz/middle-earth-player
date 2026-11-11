import type { Effect, Instruction, PickSpec } from "../../../../catalog/boundary.ts";

// The codes, picks, conditions and instruction runs the records of The Battle of the Pelennor Fields share (the cards in ../the-battle-of-the-pelennor-fields.ts, the quest stages and the Witch-king's two sides in ./stages.ts).
export const MINAS_TIRITH = "145043";
export const GROND = "145044";
export const WRAITH = "145062";
export const WITCH_KING_CAPTAIN = "145079";
export const WITCH_KING_SORCERER = "145080";
export const ARAGORN = "145001";
export const FLEET = "145072";
export const ANDURIL = "142014";
export const BANNER = "145013";
export const ESQUIRE_OF_ROHAN = "145014";
export const ESQUIRE_OF_GONDOR = "145015";
export const FELL_BEAST = "145057";
export const BLACK_DART = "145058";
export const STAGE_4 = "145076";
export const STAGE_5 = "145077";

export type Cond = NonNullable<Effect["condition"]>;
export type Option = Extract<Instruction, { verb: "Choose" }>["options"][number];

export const CITY_IN_PLAY = { kind: "inPlay", code: MINAS_TIRITH, is: true } satisfies Cond;
export const CITY: PickSpec = { type: "objective", control: "any", names: ["Minas Tirith"] };
export const WITCH_KING: PickSpec = { type: "enemy", control: "any", staging: true, names: ["The Witch-king"] };
export const STAGED_ENEMIES: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
export const STAGED_ALLIES: PickSpec = { type: "ally", control: "any", stagingOnly: true };
export const STAGING_LOCATIONS: PickSpec = { type: "location", control: "any", stagingOnly: true };
export const MY_HERO: PickSpec = { type: "hero", control: "you" };
export const HARAD_ATTACKER = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", staging: true, trait: "Harad" } } satisfies Cond;
export const MORDOR_ATTACKER = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", staging: true, trait: "Mordor" } } satisfies Cond;
export const QUEST_PHASE = { kind: "phase", is: "Quest" } satisfies Cond;
export const NOT_FIRST_PLAYER = { kind: "not", condition: { kind: "firstPlayer" } } satisfies Cond;
export const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
export const FIVE_BURDEN_SETS = ["A Shadow of the Past", "Flight to the Ford", "The Ring Goes South", "The Passage of the Marshes", "Shelob's Lair"];

// "Either deal 3 damage to Minas Tirith or [the enemy] makes an additional attack after this one": the defending player chooses; with Minas Tirith out of play only the attack is offered (mec113.minas-tirith).
export const CITY_OR: (damage: number, other: Option) => Instruction = (damage, other) => ({
  verb: "Choose",
  who: "actor",
  options: [{ id: "city", requires: CITY_IN_PLAY, instructions: [{ verb: "DamageMinasTirith", amount: damage }] }, other],
});
export const ADDITIONAL_ATTACK: Option = { id: "attack", instructions: [{ verb: "ImmediateAttack", afterThis: true }] };

// "Discard cards from the encounter deck until an enemy is discarded. Add the discarded enemy to the staging area." With no enemy left the deck is emptied and nothing is added (the card picked before it is not moved).
export const DISCARD_UNTIL_ENEMY: Instruction[] = [
  { verb: "DiscardUntil", type: "enemy" },
  { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } },
];

