// Rules: docs/scenarios/vengeance-of-mordor/the-river-running.md (Table); ledger lines 21012:A:1, 21076:B:2. The words of The River Running's two top-bar dials (river.ts beside them). Pure.

/** What a tap on the Pursuit dial says: the resources on Easterling Pursuit and what the end of the round does with them. */
export const pursuitWords = (resources: number): string =>
  `${resources} ${resources === 1 ? "resource" : "resources"} on Easterling Pursuit. At the end of the round it gains 1 resource. If it then holds 3 or more, 3 come off. The encounter discard pile is shuffled into the encounter deck. Cards are discarded from the top until 1 enemy for each player is discarded. Each of those enemies is added to the staging area. While stage 1B is the quest, each resource on it adds 1 Threat to the staging area.`;

export const pursuitLimitWords = (): string => "3 resources add 1 enemy for each player at the end of the round";

/** The warning at 2 resources (the end of the round brings it to 3) and at 3 or more (the end of the round takes 3 off). */
export const pursuitNearWords = (resources: number): string =>
  resources >= 3 ? "At the end of this round 3 come off and 1 enemy for each player is added to the staging area." : "At the end of this round it reaches 3: 1 enemy for each player is added to the staging area.";

/** What a tap on the progress cap dial says. */
export const capWords = (placed: number, cap: number, stage: string): string =>
  `${placed} of the ${cap} progress that can be placed on ${stage} this round, while a player is engaged with an enemy.`;
