// Rules: mec108.day-and-night, mec108.side-quests-in-play, mec108.campaign-log, rr.doomed-x (data/rules/entries.json); ledger lines 10011:A:1, 10012:A:1, 10011:A:3, 10015:B:1, 10015:B:2, 10015:B:3, 10023:A:1, 100158:A:2, 10172:A:1, 10173:A:1, 10173:A:2.
// What the table says of The Wastes of Eriador's pieces (src/play/readouts/wastes.ts, src/play/cards/wastes-preview.ts): Day and Night, the progress on stage 3B against the 5 that let Pack Leader take damage, the damage on Arnor Ravaged, a character that
// is determined or carries Determination, and the starting threat Fend Off Despair lowers. The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

/** The disc of the Day and Night dial and the name a screen reader hears for it. */
export const timeWord = (day: boolean): string => (day ? "Day" : "Night");
export const TIME_NAME = "Time of day:";

/** What the Time objective does while its side is up, and when it flips (10011:A:1, 10011:A:3, 10012:A:1; 10015:A:1 and 10026:A:1 flip it to Night as well). */
export const timeWords = (day: boolean): string =>
  day
    ? "It is Day. Enemies make no engagement checks. It becomes Night at the end of the round."
    : "It is Night. No progress can be placed on quest cards, and encounter card effects cannot be canceled. It becomes Day at the end of the round.";

/** The line under Daybreak and Nightfall in their previews. */
export const timePreviewWords = (day: boolean): string => timeWords(day);

/** What Pack Leader's gate dial says: the progress on stage 3B against the 5 that let him take damage (10015:B:1, 10015:B:2, 10015:B:3). */
export const gateLimitWords = (limit: number): string => `${limit} progress let Pack Leader take damage`;
export const gateWords = (progress: number, limit: number): string =>
  progress >= limit
    ? `${progress} progress on the stage: Pack Leader can take damage now. Destroy him to win the game. All progress is discarded when it becomes Day.`
    : `${progress} progress on the stage. Pack Leader takes no damage until the stage holds ${limit}. All progress is discarded when it becomes Day.`;

/** Arnor Ravaged's dial and preview (100158:A:2): the damage still on it, which moves to a character one at a time. */
export const ravagedWords = (damage: number): string =>
  damage <= 0 ? "No damage left on it: it does nothing." : `${damage} damage on it. After an attack damages a character but does not destroy it, 1 damage moves from it to that character.`;

/** What a character wears while it carries a Determination or the Campaign Log marks it determined (10172:A:1). */
export const DETERMINED_WORD = "Determined";
export const CARRIES_WORD = "Determination";
export const determinedWords = (marked: boolean, carries: boolean): string => {
  const log = "The Campaign Log marks this character determined, so Determination readies it.";
  const carried = "It carries Determination: it is marked determined in the Campaign Log if you win this scenario.";
  return marked && carries ? `${log} ${carried}` : marked ? log : carried;
};

/** The mark of a seat when Fend Off Despair has been defeated this game: the starting threat it lowers if the scenario is won (10173:A:2). */
export const startMarkLabel = (seat: number | null, amount: number): string => `${seat == null ? "" : `P${seat + 1} · `}Start −${amount}`;
export const startMarkWords = (amount: number): string => `Fend Off Despair is defeated. If you win, this player's starting threat is ${amount} lower in the next scenarios, noted in the Campaign Log.`;

/** The line under Fend Off Despair in its preview (10173:A:1, 10173:A:2). */
export const despairPreviewWords = "Each event card gains Doomed 1. When it is defeated and the scenario is won, each player's starting threat is 2 lower in the Campaign Log.";
