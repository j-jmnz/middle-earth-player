// Rules: docs/scenarios/vengeance-of-mordor/the-river-running.md (Table); ledger lines 21012:A:1, 21076:B:2. The words of The River Running's two top-bar dials (river.ts beside them). Pure.

/** What a tap on the Pursuit dial says: the resources on Easterling Pursuit against the 3 that make the end of the round search for enemies. */
export const pursuitWords = (resources: number): string =>
  `${resources} of the 3 resources on Easterling Pursuit. At the end of the round it gains 1; with 3 or more, 3 come off, the encounter discard pile is shuffled into the encounter deck and 1 enemy for each player is discarded from the top and added to the staging area. Each resource on it also adds 1 Threat to the staging area while stage 1B is the quest.`;

export const pursuitLimitWords = (): string => "resources on Easterling Pursuit";

/** The warning one resource short of the 3. */
export const pursuitNearWords = (): string => "One more resource and enemies are added to the staging area.";

/** What a tap on the progress cap dial says. */
export const capWords = (placed: number, cap: number, stage: string): string =>
  `${placed} of the ${cap} progress that can be placed on ${stage} this round, while a player is engaged with an enemy.`;

export const capLimitWords = (): string => "progress that can be placed this round";

export const capFullWords = (stage: string): string => `No more progress can be placed on ${stage} this round.`;
