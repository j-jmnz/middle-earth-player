// Rules: docs/scenarios/standalone-scenarios.md (The Ruins of Belegost, The table), rr.forced (data/rules/entries.json); ledger lines 50603:B:1, 50603:B:2, 50608:A:1, 50615:A:2. The words of the pieces The Ruins of Belegost's cards hold on the table (belegost.ts beside it): the
// resources on Stalking the Ruins against the number that brings Naurlhûg, and the resources on stage 2D against the number its stage asks for. Pure.

/** The resources on Stalking the Ruins, the way the dial's note says it: Naurlhûg is set aside, in the staging area or engaged. `x` is Naurlhûg's X. */
export const stalkingWords = (resources: number, limit: number, arrived: boolean): string =>
  arrived
    ? `Stalking the Ruins holds ${resources} resources, and Naurlhûg is in play: X is ${resources}, and each attack of Naurlhûg assigns ${resources} damage. One more resource is placed at the beginning of each quest phase.`
    : `Stalking the Ruins holds ${resources} of ${limit} resources. One more is placed at the beginning of each quest phase. At ${limit} Naurlhûg is added to the staging area, and when the players advance the resources are discarded.`;

/** The warning of the dial when the next quest phase brings Naurlhûg. */
export const stalkingNearWords = (): string => "The next quest phase places 1 more resource, and Naurlhûg is added to the staging area.";

/** What a dial's ring is counting toward. */
export const stalkingLimitWords = (limit: number): string => `${limit} resources bring Naurlhûg into play`;

/** The resources on stage 2D, the way the dial's note says it: the stage needs `limit` of them, 2 Loot objectives and no other test. */
export const stageResourcesWords = (resources: number, limit: number): string => `This stage holds ${resources} of ${limit} resources. After the active location is explored 1 more is placed. The players cannot advance with fewer than ${limit}, or without 2 Loot objectives.`;

export const stageResourcesLimitWords = (limit: number): string => `${limit} resources, with 2 Loot objectives, let the players advance`;
