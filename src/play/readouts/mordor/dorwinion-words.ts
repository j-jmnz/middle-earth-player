// Rules: docs/scenarios/vengeance-of-mordor/danger-in-dorwinion.md (Table); ledger lines 21077:B:2, 21078:B:2, 21033:A:1, 21035:A:2, 21037:A:1. The words of Danger in Dorwinion's top-bar dials and seat marks (dorwinion.ts beside them). Pure.
const resourcesOf = (n: number): string => `${n} ${n === 1 ? "resource" : "resources"}`;

/** What a tap on the stage gate says: the resources on the stage against the number that let it be defeated. */
export const gateWords = (stage: string, held: number, needed: number): string =>
  `${stage} holds ${resourcesOf(held)}. It cannot be defeated with fewer than ${needed}. A resource is placed on it each time the active location is explored`;

export const gateLimitWords = (needed: number): string => `${resourcesOf(needed)} let this stage be defeated`;

/** The warning while the stage holds fewer resources than it needs and its progress would defeat it (it fills the quest points, or any progress on a stage with none). */
export const gateNearWords = (stage: string, more: number, full: boolean): string => `${stage} ${full ? "has all its progress" : "holds progress"} but needs ${more} more ${more === 1 ? "resource" : "resources"} before it can be defeated.`;

/** What a tap on the Bribes dial says: each resource adds 1 Threat to the staging area. */
export const bribesWords = (held: number): string => `${resourcesOf(held)} on Bribes. Each adds 1 Threat to the staging area. When the active location is explored, each player discards cards from the top of their deck equal to its Threat, and 1 resource is placed here for each event discarded.`;

/** What a tap on the Sauron Worship dial says: each damage token lowers every player's elimination level by 1. */
export const worshipWords = (damage: number): string =>
  `${damage} damage ${damage === 1 ? "token" : "tokens"} on Sauron Worship. Each lowers every player's elimination threat level by 1, and 1 more is placed at the end of each round.`;

/** The seat mark of Hillside Manor's cap (short enough for a two-handed bar's caption, which keeps the count): the threat the player's card effects took off this round against the 1 allowed. */
export const capMarkLabel = (seat: number | null, lowered: number): string => `${seat == null ? "Cap" : `P${seat + 1}`} ${Math.min(lowered, 1)}/1`;

/** What a tap on the cap mark says; `card` is the card that holds the cap (Hillside Manor, Covered in Darkness). */
export const capMarkWords = (lowered: number, card: string): string =>
  lowered >= 1 ? `${card}: player card effects have already lowered this threat by 1 this round. No more can be lowered by them this round.` : `${card}: player card effects can lower this threat by no more than 1 in all each round.`;
