// Rules: docs/scenarios/standalone-scenarios/the-stone-of-erech.md (The Stone of Erech), rr.forced (data/rules/entries.json); ledger lines 50301:A:1, 50303:B:2, 50304:A:1, 50304:A:4, 50308:A:1, 50308:A:2, 50309:A:1, 50309:A:2, 50310:A:1. The words of the pieces The Stone of Erech's cards hold on the table
// (erech.ts beside it): the progress on the Night objective in play against the 4 that brings the next Night in, and who controls Derufin. Pure.

/** The Night objective's progress, the way the dial's note says it (Eventide and Dusk: `next` is the Night that comes in at the limit). */
export const nightWords = (name: string, progress: number, limit: number, next: string): string => `${name} holds ${progress} of ${limit} progress. At ${limit} it goes to the victory display and ${next} comes into play.`;

/** Midnight has no limit: each round it gets 1 progress and each player raises their threat by what it holds. */
export const midnightWords = (name: string, progress: number): string => `${name} holds ${progress} progress and has no limit. At the end of the round it gets 1 more, and each player raises their threat by ${progress + 1}.`;

/** The warning of the dial when the Night is near its limit. */
export const nightNearWords = (left: number, next: string): string => (left === 1 ? `1 more progress and ${next} comes into play.` : `${left} more progress and ${next} comes into play.`);

/** What a dial's ring is counting toward. */
export const nightLimitWords = (limit: number, next: string): string => `${limit} progress brings ${next} into play`;

/** Derufin before and after a player takes him: attached to the Stone, or in a player's area. */
export const derufinFreeWords = (): string => "No player controls Derufin: he is attached to The Stone of Erech. After the players travel to it the first player gains control of him. If he leaves play the players lose the game.";
export const derufinHeldWords = (owner: number | null): string => `${owner == null ? "You control" : `Player ${owner + 1} controls`} Derufin. If he leaves play the players lose the game.`;

/** The warning on the last stage while no player controls him. */
export const derufinStageWords = (): string => "No progress can be placed on this stage while no player controls Derufin.";

/** The quest readout on stage 3B while no player controls Derufin: what the active location takes, and that the stage takes none. */
export const erechProgressWords = (onLocation: number): string => (onLocation > 0 ? `${onLocation} progress on the active location; none on the stage while no player controls Derufin` : "No progress on the stage while no player controls Derufin");
