// Rules: docs/brief.md (The Woodland Realm, The table); ledger lines 51103:B:2, 51104:B:3, 51105:B:2, 51108:B:3. The words of the two top-bar dials of The Woodland Realm (woodland.ts beside them). Pure.

/** What a tap on the progress cap dial says: what this round has placed, the cap and why it is that number. */
export const capWords = (placed: number, cap: number, stage: string): string =>
  `${placed} of the ${cap} progress that can be placed on ${stage} this round. The cap is 5, or 10 when Mendor was committed to the quest.`;

export const capLimitWords = (): string => "progress that can be placed this round";

/** The warning near the cap and at it. */
export const capNearWords = (left: number, stage: string): string => `${left} more progress can be placed on ${stage} this round.`;

export const capFullWords = (stage: string): string => `No more progress can be placed on ${stage} this round.`;

/** What a tap on the phase tally dial says. */
export const phaseWords = (placed: number, stage: string): string =>
  `${placed} progress placed on ${stage} this phase. After a successful quest with 10 or more, the top card of the encounter deck is revealed.`;

export const phaseLimitWords = (): string => "progress placed this phase";
