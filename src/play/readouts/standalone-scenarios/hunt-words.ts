// Rules: docs/scenarios/standalone-scenarios.md (The Hunt for the Dreadnaught, The table), rr.damage (data/rules/entries.json); ledger lines 40013:A:1, 40013:A:2, 40013:A:3, 40013:B:2, 40004:B:2, 40005:B:1, 40001:B:2, 40002:B:1. The words of the pieces The Hunt for the Dreadnaught's cards hold on the table (hunt.ts beside it): the
// Dreadnaught's hit points and its damage cap for the round, the progress cap of stages 1B and 2B, and the mode card's Quest Action. Pure.

/** The Dreadnaught's damage against its hit points, the way the dial's note says it. `players` started the scenario: 15 hit points for each. */
export const dreadnaughtWords = (damage: number, hitPoints: number, players: number, damaged: boolean): string =>
  damaged
    ? `The Dreadnaught holds ${damage} damage of ${hitPoints} hit points (15 for each of ${players} players who started). It is on its Damaged side: when it is destroyed the players win.`
    : `The Dreadnaught holds ${damage} damage of ${hitPoints} hit points (15 for each of ${players} players who started). At the end of a round with less than half of them left it flips to its Damaged side, and each player puts a unique Corsair into play engaged with them.`;

/** What the dial's ring is counting toward. */
export const dreadnaughtLimitWords = (hitPoints: number): string => `${hitPoints} hit points: destroy the Dreadnaught to win`;

/** The warning when the next end of the round flips the Dreadnaught. */
export const dreadnaughtFlipWords = (): string => "Less than half its hit points are left: at the end of the round the Dreadnaught flips and each player puts a unique Corsair into play engaged with them.";

/** The damage the Dreadnaught took this round against its cap. */
export const roundDamageWords = (taken: number, cap: number): string => `The Dreadnaught took ${taken} of ${cap} damage this round (5 for each player who started). It takes no more until the round ends.`;

export const roundDamageLimitWords = (cap: number): string => `No more than ${cap} damage each round`;

export const roundDamageReachedWords = (): string => "The Dreadnaught takes no more damage this round.";

/** The progress placed on the quest stage this round against the stage's cap (5 for each player who started). */
export const stageCapWords = (placed: number, cap: number): string => `${placed} of ${cap} progress placed on this stage this round (5 for each player who started). Progress beyond the cap is not placed.`;

export const stageCapLimitWords = (cap: number): string => `No more than ${cap} progress each round`;

export const stageCapReachedWords = (): string => "No more progress is placed on this stage this round.";

/** The mode card's Quest Action, used once in the game by the whole table. */
export const questActionWords = (used: boolean, reveals: boolean): string =>
  used
    ? "The Quest Action has been used: it is used once in the game by all the groups together."
    : `Quest Action, once in the game for all the groups together: 10 damage to a non-unique enemy engaged with a player${reveals ? ", then the top card of the encounter deck is revealed" : ""}.`;
