// Rules: docs/brief.md (The Battle of Lake-town), rr.victory, ltp.scoring (data/rules/entries.json); ledger lines 50201:B:1, 50202:B:1, 50203:B:3, 50207:A:1. The words of the pieces Lake-town's cards hold on the table (readouts/standalone-scenarios/lake-town.ts): the damage on Lake-town against the 50 that loses
// the game, the Victory points in the display against that damage on stage 3, and the damage on Smaug against the cap the stage gives him. Pure.

/** Lake-town's damage, the way the dial's note says it. */
export const townWords = (damage: number, limit: number): string => `Lake-town holds ${damage} of ${limit} damage. At ${limit} the players lose the game.`;

/** The warning of the dial when Lake-town is near its limit. */
export const townNearWords = (left: number): string => `${left} more damage and the players lose the game.`;

/** What a dial's ring is counting toward. */
export const townLimitWords = (limit: number): string => `${limit} damage loses the game`;

/** The Victory points in the display against Lake-town's damage on stage 3: more points than damage wins, a tie loses. */
export const scoreWords = (points: number, damage: number): string => `${points} Victory points in the display against ${damage} damage on Lake-town. The players win when Smaug is defeated with more points than damage; a tie loses.`;

export const scoreLimitWords = (damage: number): string => `more than ${damage} wins`;

/** Smaug's damage against the cap of the stage (stages 1 and 2) or his hit points (stage 3, where he can be defeated). */
export const smaugWords = (damage: number, limit: number, capped: boolean): string =>
  capped ? `Smaug holds ${damage} of the ${limit} damage this stage lets him take. More is not placed on him, and he cannot be defeated.` : `Smaug has ${damage} damage of his ${limit} hit points. Defeating him ends the game.`;

export const smaugLimitWords = (limit: number, capped: boolean): string => (capped ? `${limit} damage is the most he can hold` : `${limit} damage defeats him`);
