// Rules: rr.engaged, rr.guarded, rr.objective-cards, hrd.stage-number (data/rules/entries.json); ledger lines 17094:A:1, 17094:A:2, 17107:B:2, 17091:A:1 (docs/scenarios/haradrim/the-black-serpent.md, Table).
// What the table says of The Black Serpent's pieces: the enemy considered engaged, the objective a card guards, and what a card carries. The engine decided each fact; these only say it.

/** The word of the empty engagement area when a staging enemy is considered engaged with the player: "The Black Serpent is engaged with you". */
export const consideredEmptyWord = (names: readonly string[], who: string): string => `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} engaged with ${who}`;

/** The chip on a staging enemy considered engaged: "Engaged" solo, "Engaged P1" for the players it is engaged with. */
export const consideredChipText = (seats: readonly number[], seatCount: number): string => (seatCount > 1 ? `Engaged ${seats.map((seat) => `P${seat + 1}`).join(" ")}` : "Engaged");

/** The reader's words for the chip: "Considered engaged with Player 1 and Player 2" (it stays in the staging area). */
export const consideredSpeech = (seats: readonly number[], seatCount: number): string => (seatCount > 1 ? `Considered engaged with ${seats.map((seat) => `Player ${seat + 1}`).join(" and ")}` : "Considered engaged with you");

/** The quest readout's note for an enemy that is considered engaged and adds no Threat: "The Black Serpent adds no threat: it is engaged with you". */
export const addsNoThreatNote = (name: string, who: string): string => `${name} adds no threat: it is engaged with ${who}`;

/** The preview line of an enemy considered engaged: who, and that it stays in the staging area. `adds` says whether it still adds its Threat to the staging area. */
export const consideredPreview = (who: string, adds: boolean): string => `Considered engaged with ${who}, so it stays in the staging area and never engages anyone.${adds ? "" : " It adds no Threat while a player controls a Harad objective."}`;

/** The chip on an objective an encounter card guards. */
export const GUARDED_CHIP = "Guarded";

/** The words for an objective's guard: "Guarded by Harad Soldier", wherever the guard stands. */
export const guardedSpeech = (guards: readonly string[]): string => `Guarded by ${guards.join(", ")}`;

/** The preview line of a card that carries objectives: a hero holds them, an enemy or a location has them hanging on it. */
export const carriesWords = (held: readonly string[], hung: readonly string[]): string =>
  [held.length > 0 ? `Holds ${held.join(", ")}` : "", hung.length > 0 ? `${hung.join(" and ")} ${hung.length === 1 ? "hangs" : "hang"} on it` : ""].filter((part) => part !== "").join(". ");

/** The preview line of a stage-number enemy's totals: "X is the stage number of the main quest: Threat 2, Attack 4, Defense 3 now." */
export const totalsWords = (stats: readonly { name: string; value: number }[], staged: boolean): string => `X is the stage number of the main quest${staged ? "" : " (no stage in play)"}: ${stats.map((one) => `${one.name} ${one.value}`).join(", ")} now.`;
