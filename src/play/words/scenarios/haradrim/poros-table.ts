// Rules: hrd.multiple-encounter-sets, hrd.removed-from-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 17145:A:4, 17150:A:2, 17151:A:1, 17157:A:1, 17158:A:1, 17159:A:1, 17160:A:1 to 17162:A:1 (docs/scenarios/haradrim/the-crossings-of-poros.md, Table).
// What the table says of The Crossings of Poros' pieces (src/play/readouts/haradrim/poros.ts): the encounter sets set aside with the cards each still holds, the stages played and removed, and Poros Garrison with its loss line. The engine decided every number; these only say it.

/** The labels of the three dials. */
export const ASIDE_LABEL = "Aside";
export const ASIDE_NAME = "Set aside encounter sets";
export const PATH_LABEL = "Path";
export const PATH_NAME = "Quest path";
export const GARRISON_LABEL = "Garrison";
export const GARRISON_NAME = "Poros Garrison damage";

/** One set's line in the panel: its cards left, and whether it is the set with the most (the one the random draws of Mountains of Shadow and stage 4's search read). */
export const asideLine = (set: string, left: number, most: boolean): string => `${set}: ${left === 1 ? "1 card" : `${left} cards`} left${most && left > 0 ? " (most)" : ""}`;

/** The note spoken after the dial's number: the most cards left, and what that decides. */
export const asideNote = (most: number, sets: readonly string[]): string =>
  most === 0
    ? "No set aside encounter set has a card left."
    : `The set with the most cards left is ${sets.join(" or ")}, ${most} ${most === 1 ? "card" : "cards"}. ${sets.length > 1 ? "On a tie the first player chooses. " : ""}A set removed from the game has no card left.`;

/** The line at the foot of the panel. */
export const ASIDE_FOOT = "Cards of a set aside set join the encounter deck once they are revealed or placed in its discard pile.";

/** How a stage stands in the path panel. */
export const stageLine = (name: string, status: "current" | "played" | "removed" | "ahead"): string =>
  status === "current" ? `${name}: in play` : status === "played" ? `${name}: played` : status === "removed" ? `${name}: removed` : `${name}: not chosen yet`;

/** The path dial's note: the stage in play out of four. */
export const pathNote = (number: number, name: string): string => `Stage ${number} of 4: ${name}. Stages 2 and 3 are chosen at random; the other stages of their number are out of the game.`;

/** The Garrison dial: the damage against its hit points, and the loss. */
export const garrisonLimitWords = (hitPoints: number): string => `the players lose when Poros Garrison leaves play, at ${hitPoints} damage`;
export const garrisonNote = (owner: number | null, damage: number, hitPoints: number): string =>
  `${owner == null ? "The first player controls" : `Player ${owner + 1} controls`} Poros Garrison: ${damage} of ${hitPoints} damage. If it leaves play the players lose the game.`;
export const garrisonNearWords = (left: number): string => (left === 1 ? "1 more damage and the players lose." : `${left} more damage and the players lose.`);

/** The mark on the seat that controls it. */
export const garrisonMark = (seat: number, seats: number): string => (seats > 1 ? `P${seat + 1} · Garrison` : "Garrison");
export const GARRISON_MARK_NOTE = "Poros Garrison: if it leaves play the players lose the game.";
