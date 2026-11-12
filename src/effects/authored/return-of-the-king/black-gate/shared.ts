import type { Effect, Instruction, PickSpec } from "../../../../catalog/boundary.ts";

// What the records of The Black Gate Opens share: the cards they name and the picks and amounts several of them print.
export const BLACK_GATE = "146024";
export const MOUTH_OF_SAURON = "146031";
export const GWAIHIR = "146041";
export const STAGE_1 = "146072";
export const STAGE_2 = "146073";

export type Cond = NonNullable<Effect["condition"]>;

export const QUEST_PHASE = { kind: "phase", is: "Quest" } satisfies Cond;
// "While X is the active location".
export const ACTIVE = { kind: "sourceIn", zone: "activeLocation" } satisfies Cond;

// The resource tokens on The Black Gate, read live (0 when it is not in play): Jaws of Steel's X, the reveals of stage 2B.
export const BLACK_GATE_TOKENS = { stat: "resources", ofNamed: "The Black Gate" } as const;

export const NON_UNIQUE_STAGED_ENEMY: PickSpec = { type: "enemy", control: "any", stagingOnly: true, nonUnique: true };
export const ENGAGEABLE_NON_UNIQUE: PickSpec = { type: "enemy", control: "any", stagingOnly: true, nonUnique: true, engageable: true };
export const QUESTING_CHARACTER: PickSpec = { type: "character", control: "you", committed: true };
export const MOUTH_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, names: ["The Mouth of Sauron"] };
export const MOUTH_ATTACKING = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", names: ["The Mouth of Sauron"] } } satisfies Cond;

// "Pick the card, then act on it, while there is one": a choice that names no card is skipped.
export const WHEN_CAN_PICK = (pick: PickSpec) => ({ when: { kind: "canPick", pick } }) as const;

// The card picked is an encounter card not in play yet (an enemy just discarded from the deck).
export const PICKED_ENEMY_OUT_OF_PLAY = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false } satisfies Cond;

export const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
