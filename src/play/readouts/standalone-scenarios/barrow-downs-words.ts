// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.quest-advancement (data/rules/entries.json); ledger lines 148003:B:1, 148003:B:3, 148004:B:2, 148007:A:2 (docs/scenarios/standalone-scenarios.md, Fog on the Barrow-downs, The table).
// What the table says of Fog on the Barrow-downs' separate staging areas: the parked stage 3B (no player is at it), a player who is apart at his own stage 4A, and the progress and the win stage 3B withholds. The numbers and the cards are the engine's; the words only read them. Pure.

/** The label of the parked stage's dial and what a screen reader calls it: the count is the cards of that staging area. */
export const PARKED_LABEL = "Parked 3B";
export const PARKED_NAME = "Cards in the staging area of stage 3B, which no player is at";

// "Great Barrow ×2, Standing Stones": the names of the cards, a name that repeats said once with its count.
export function cardList(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(", ");
}

const SOLO = "You";

/** The note of the parked stage's dial and the line of its preview: the stage stays in play with its staging area, and nothing resolves there. `solo`: one player, who comes back himself. */
export function parkedWords(stage: string, names: readonly string[], noProgress: boolean, solo: boolean): string {
  const area = names.length === 0 ? "Its staging area is empty." : `Its staging area holds ${cardList(names)}.`;
  const hold = noProgress ? " No progress can be placed on it while a Great Barrow is in play." : "";
  return `Stage 3B, ${stage}, stays in play with no player at it. ${area} Nothing resolves there until ${solo ? "you come" : "a player comes"} back from stage 4B.${hold}`;
}

/** The line a card of the parked staging area says in its preview. */
export const parkedCardWords = (solo: boolean): string => `It is in the staging area of stage 3B, which no player is at. It is in no player's area until ${solo ? "you come" : "one comes"} back from stage 4B.`;

/** The line stage 3B says in its preview while a Great Barrow is in play and a player is at it. */
export const NO_PROGRESS_LINE = "No progress can be placed on it while a Great Barrow is in play.";

/** The mark a player trapped at stage 4B wears on his threat dial: "Trapped", "P2 · Trapped" two-handed. */
export const apartLabel = (seat: number | null): string => `${seat == null ? "" : `P${seat + 1} · `}Trapped`;

/** The note spoken after the dial of a player trapped. `who` is "Player 2" or "You". */
export const apartWords = (who: string, stage: string): string => `${who} ${who === SOLO ? "are" : "is"} trapped at stage 4B, ${stage}, with a staging area of ${who === SOLO ? "your" : "their"} own, until it is defeated.`;

/** The line of a stage 4A in its preview. */
export const apartStageWords = (who: string): string => `${who} ${who === SOLO ? "are" : "is"} trapped at this stage, in a staging area of ${who === SOLO ? "your" : "their"} own, until it is defeated.`;

/** The overline of the advance screen over the stage that traps a player: "Trapped", "Player 2 · Trapped" two-handed. */
export const trapEyebrow = (seat: number | null): string => `${seat == null ? "" : `Player ${seat + 1} · `}Trapped`;

/**
 * What the advance screen says when a Great Barrow traps a player: who is trapped, where the others stay, and when he comes back. `stays` is the player still at stage 3B ("Player 1"), or null when none is (the parked stage); `stage` is stage 3B's name.
 */
export function trapWords(who: string, stays: string | null, stage: string): string {
  const solo = who === SOLO;
  const left = stays ? `${stays} stays at stage 3B, ${stage}.` : `Stage 3B, ${stage}, stays in play with no player at it.`;
  return `A Great Barrow trapped ${solo ? "you" : who}. ${left} ${who} ${solo ? "come" : "comes"} back at the beginning of the travel phase after stage 4B is defeated.`;
}

/** The beat and the note of the return: the player is back at stage 3B and his enemies and locations join its staging area. */
export const backWords = (who: string, stage: string): string => `${who} ${who === SOLO ? "are" : "is"} back at stage 3B, ${stage}. ${who === SOLO ? "Your" : "Their"} enemies and locations join its staging area.`;

/** The note that leads the pick of the Great Barrow at stage 3B: the player is back there already. */
export const BACK_LEAD = "You are back at stage 3B.";

/** The title of the banner beat that tells a Great Barrow's trap and the return. */
export const TRAPPED_TITLE = "Trapped in a barrow";
export const BACK_TITLE = "Back at stage 3B";

/** The line of the banner when the trap begins: who is at stage 4B, whose name it is. */
export const trappedLine = (who: string, stage: string): string => `${who} ${who === SOLO ? "are" : "is"} trapped at stage 4B, ${stage}`;

/** The foresight when a quest that fails eliminates a player while stage 3B hears it: who is raised by 10, to what, and what that does. */
export const raiseWords = (who: string, stage: string, to: number): string => `${who} +10 (${stage}, stage 3B), to ${to}`;

/** What the quest readout says of `progress` while a Great Barrow keeps it off stage 3B: the active location takes what it can. */
export const noStageProgressWords = (onLocation: number): string =>
  onLocation > 0 ? `${onLocation} progress on the active location; none on the stage while a Great Barrow is in play` : "No progress on the stage while a Great Barrow is in play";

/** What the quest readout adds when the progress would fill stage 3B but the stage cannot be defeated: who is not at it, and Standing Stones. */
export function holdWords(apart: boolean, stones: boolean): string {
  const reasons = [apart ? "every player is at it" : null, stones ? "Standing Stones is in the victory display" : null].filter((reason) => reason != null);
  return `the stage is held until ${reasons.join(" and ")}`;
}
