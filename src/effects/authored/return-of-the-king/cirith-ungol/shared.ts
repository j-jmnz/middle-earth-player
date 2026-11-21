import type { Effect, Instruction, PickSpec } from "../../../../catalog/boundary.ts";
import { consideredEngaged } from "../../considered-engaged.ts";

// What the records of The Tower of Cirith Ungol share: the cards they name, and the two pieces of text that two cards print.
export const LAST_OF_THE_COMPANY = "146014";
export const TOPMOST_CHAMBER = "146015";
export const SHAGRAT = "146020";
export const ONE_RING = "146065";
export const STAGE_2 = "146067";
export const STAGE_3 = "146068";
export const WATCHERS_LOCATION = "146070";
export const WATCHERS_ENEMY = "146071";

export type Cond = NonNullable<Effect["condition"]>;

export const STAGED_ENEMIES: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
export const QUEST_PHASE = { kind: "phase", is: "Quest" } satisfies Cond;
// The enemy side of The Two Watchers, in the staging area (the location side is another card).
export const WATCHERS_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, names: ["The Two Watchers"] };
// "The Two Watchers is in play", on either side.
export const WATCHERS_IN_PLAY = { kind: "any", conditions: [{ kind: "inPlay", code: WATCHERS_LOCATION, is: true }, { kind: "inPlay", code: WATCHERS_ENEMY, is: true }] } satisfies Cond;

// The enemy side of The Two Watchers, considered engaged with each player while it is in the staging area (146066:B:2, 146068:B:2): the Watcher in the Water's four flags (142024:A:2).
export const CONSIDERED_ENGAGED: Instruction[] = consideredEngaged(WATCHERS_IN_STAGING);

// "Discard cards from the top of the encounter deck until an enemy is discarded. If there is a copy of that enemy in the staging area, discard that copy as well. If there is not, add the discarded enemy to the staging area." (146019:A:1, 146067:B:1.)
// The enemy discarded is the card picked. With a copy in the staging area, it is picked and discarded too, and the enemy discarded stays in the discard pile; with none the enemy is added. A deck with no enemy left is emptied and nothing is added (the card picked before it is not moved).
const COPY_OF_PICKED: PickSpec = { type: "enemy", control: "any", stagingOnly: true, sameTitleAs: "picked" };
const A_COPY: Cond = { kind: "canPick", pick: COPY_OF_PICKED };
const NO_COPY: Cond = { kind: "count", pick: COPY_OF_PICKED, max: 0 };
const DISCARDED_ENEMY: Cond = { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false };
export const DISCARD_UNTIL_ENEMY_OR_COPY: Instruction[] = [
  { verb: "DiscardUntil", type: "enemy" },
  { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "all", conditions: [DISCARDED_ENEMY, NO_COPY] } },
  { verb: "Pick", pick: COPY_OF_PICKED, when: A_COPY },
  { verb: "Discard", target: { kind: "picked" }, when: { kind: "all", conditions: [{ kind: "matches", card: "picked", pick: { type: "enemy", control: "any", stagingOnly: true } }, { kind: "matches", card: "previous", pick: { type: "enemy", control: "any" }, inPlay: false }] } },
];
