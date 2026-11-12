// Rules: mec113.setup-the-tower-of-cirith-ungol, mec113.the-one-ring, mec113.multiplayer-the-one-ring, rr.guarded, rr.travel, rr.quest-advancement (data/rules/entries.json); ledger lines 146014:A:1, 146015:A:2, 146066:A:1, 146067:B:2, 146068:B:1, 146069:B:1, 146069:B:2, 146070:A:2.
// The words of The Tower of Cirith Ungol's table pieces: the progress that lets the players travel to Topmost Chamber (18 on stage 2B) and to The Two Watchers (12 on stage 3B), the Watchers' X, the hero that carries Last of the Company, the Ring-bearer under
// Topmost Chamber and the boons guarded on Shagrat with their owners. Pure.

const capital = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/** The one sentence of what happens to the Ring-bearer when Topmost Chamber leaves play (146067:B:2): `held` is its name, or "it". */
export const releaseWords = (chamber: string, held: string): string => `When ${chamber} leaves play, the first player gains control of ${held} with its attachments`;

/** What the chamber dial counts toward: the progress on stage 2B against the 18 that lets the players travel to Topmost Chamber (146015:A:2). */
export const chamberWords = (progress: number, needed: number, stage: string): string =>
  `${progress} of ${needed} progress on ${stage}. The players cannot travel to Topmost Chamber until the stage holds ${needed}; its Travel cost adds Shagrat to the staging area`;

/** A boon Shagrat guards: its name and its owner's words in a list ("yours", "Player 2's"), null when it has none. */
export type GuardedBoon = { name: string; owner: string | null };

const boonList = (boons: readonly GuardedBoon[]): string => boons.map((boon) => (boon.owner == null ? boon.name : `${boon.name} (${boon.owner})`)).join(", ");

/** What the Watchers' travel dial counts toward: the progress on stage 3B against the 12 that lets the players travel to The Two Watchers (146068:B:1), and the boons Shagrat guards, lost from the pool if the players win while he is in play (146069:B:1). */
export const watchersTravelWords = (progress: number, needed: number, stage: string, boons: readonly GuardedBoon[]): string =>
  `${progress} of ${needed} progress on ${stage}. The players cannot travel to The Two Watchers until the stage holds ${needed}, and the stage cannot be defeated while The Two Watchers is in play${boons.length > 0 ? `. Shagrat guards ${boonList(boons)}: they are lost from the campaign pool if the players win while he is in play` : ""}`;

/** What the dial of The Two Watchers' enemy side says while it is in play: defeating it frees the stage, and on stage 3B wins the game (146066:B:3, 146068:B:3). */
export const watchersEnemyWords = (stage: string, wins: boolean): string =>
  `Defeat The Two Watchers to ${wins ? "win" : `defeat ${stage}`}. It is engaged with each player and its hit points left are shown`;

/** What X says on The Two Watchers' location: twice the stage number of the main quest (146070:A:2). */
export const watchersXWords = (x: number, stage: number): string => `X is ${x}: twice the stage number, ${stage}. The Two Watchers adds it to the staging area's Threat, and flips to its enemy side when the players travel there`;

/** The seat mark of the player whose hero carries Last of the Company ("Company", "P2 · Company" two-handed). */
export const companyLabel = (seat: number | null): string => (seat == null ? "Company" : `P${seat + 1} · Company`);

/** Heard with the mark: the hero is a Ring-bearer with The One Ring and A Heavy Burden while it carries Last of the Company, and the first player token stays with the first player (146014:A:1). */
export const companyWords = (hero: string): string => `${hero} carries Last of the Company, The One Ring and A Heavy Burden. The first player token never passes`;

/** What the first player's dial says while the Ring-bearer lies under Topmost Chamber (146066:A:1, 146067:B:2). */
export const captiveDialWords = (hero: string, under: string): string => `${hero}, the Ring-bearer, lies faceup under ${under}. ${releaseWords(under, "it")}`;

/** The line under Topmost Chamber's name while it holds the Ring-bearer (146066:A:1, 146067:B:2); `owner` is whose Ring-bearer it is, or null. */
export const chamberHoldsWords = (hero: string, owner: string | null, chamber: string): string => `Guards ${hero}, ${owner == null ? "the" : owner} Ring-bearer, faceup. No one controls ${hero} and it takes no damage. ${releaseWords(chamber, hero)}`;

/** The line under the Ring-bearer's name while it lies under Topmost Chamber. */
export const captiveWords = (under: string): string => `The Ring-bearer, a guarded objective under ${under}. No one controls it and it takes no damage. ${releaseWords(under, "it")}`;

/** The line under Shagrat's name while he guards boons, each with its owner (146069:B:1, 146069:B:2). */
export const guardsWords = (boons: readonly GuardedBoon[]): string => `Guards ${boonList(boons)}. A boon goes back to its owner's hand when Shagrat is defeated, and is lost from the campaign pool if he is in play when the scenario is won`;

/** The line under a boon's name while Shagrat guards it. */
export const guardedBoonWords = (owner: string | null, host: string): string => `${owner == null ? "Boon" : `${capital(owner)} boon`}, guarded by ${host}. Defeat ${host} to return it to hand; it is lost if ${host} is in play when the scenario is won`;

/** The line under Last of the Company's name on its hero. */
export const lastOfTheCompanyWords = (hero: string): string => `Carried by ${hero}, a Ring-bearer in the Fellowship sphere. It goes to the victory display at stage 3`;
