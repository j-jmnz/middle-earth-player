// Rules: mec113.saga-staging-rules, mec113.army-of-the-dead, mec113.multiplayer-aragorn, rr.quest-advancement, rr.damage, rr.travel (data/rules/entries.json); ledger lines 145030:A:1, 145030:A:2, 145033:A:1, 145034:A:1, 145068:A:1, 145069:B:2, 145071:A:1.
// The words of The Siege of Gondor's table pieces: The Corsair Fleet's resources, the Ship locations toward Great Corsair Ship's travel, Pelargir Quays' damage tokens, the Port's heal cap, the progress Great Corsair Ship holds on stage 1B and the
// seat that controls the Army of the Dead. Pure.

/** What the Fleet's dial says: its resources are X, and the Fleet gains one at the beginning of each staging step (145071:A:1). */
export const fleetWords = (resources: number): string => `X is ${resources}: the resources on The Corsair Fleet. It gains 1 at the beginning of each staging step. Great Corsair Ship's Threat, the Fleet's damage and Driven to the Brink's damage are X. If you win, this number is written in the campaign log.`;

/** What the Ships dial counts toward: the Ship locations in the victory display that let the players travel to Great Corsair Ship (145030:A:2). */
export const shipsWords = (needed: number, count: number): string => (count >= needed ? `${count} Ship locations are in the victory display: the players can travel to Great Corsair Ship.` : `${needed} Ship locations in the victory display let the players travel to Great Corsair Ship. ${count} so far.`);

/** What a Pelargir Quays dial says: its damage tokens against the 4 at which it is discarded and deals them (145034:A:1). */
export const quaysWords = (limit: number): string => `At the end of the round Pelargir Quays gets 1 damage token. At ${limit} it is discarded and the first player assigns ${limit} damage among the characters in play, any player's`;

/** The warning at one token short of the limit. */
export const quaysNearWords = (damage: number, limit: number): string => `Pelargir Quays holds ${damage} of ${limit} damage tokens: at the end of the round it deals ${limit} damage among the characters in play`;

/** What the Port's dial says: the most damage one character has had healed this round against the 1 the Port allows (145033:A:1). */
export const portWords = (cap: number): string => `While Port of Pelargir is in the staging area, no more than ${cap} damage can be healed from each character each round, by all healing together`;

/** The warning once a character has used its allowance: the characters at the cap, named. */
export const portReachedWords = (cap: number, names: readonly string[]): string => {
  const who = names.length <= 1 ? (names[0] ?? "A character") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return names.length > 1
    ? `${who} have each had ${cap} damage healed this round: no more can be healed from them until the round ends`
    : `${who} has had ${cap} damage healed this round: no more can be healed from it until the round ends`;
};

/** What the quest meter says of the progress the quest places while Great Corsair Ship holds the stage. */
export const heldProgressWords = (progress: number): string => `${progress} progress if nothing changes: held while Great Corsair Ship is in play`;

/** The mark a seat's dial wears for the Army of the Dead it controls: its seat (two-handed), then "Army". */
export const armyLabel = (seat: number | null): string => (seat == null ? "Army" : `P${seat + 1} · Army`);

/** Heard with the Army's mark (145068:A:1): who controls it and how it passes. */
export const ARMY_WORDS = "You control the Army of the Dead. It is immune to player card effects, and it passes with the first player token.";
