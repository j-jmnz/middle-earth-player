// Rules: mec108.time-x, mec108.side-quests-in-play, mec108.the-investigation, mec108.objective-allies, rr.explored, rr.attachment-cards (data/rules/entries.json); ledger lines 10094:B:1, 10094:B:2, 10094:B:3, 10095:B:1, 10101:A:1, 10101:A:2, 10110:A:1, 10110:A:2, 10112:A:1, 10114:A:1.
//
// The words The Treachery of Rhudaur's pieces say on the table: Secrets of Rhudaur's time counters and what the last does, the current-quest dial that says there is none, the Clue objectives and what each claimed one takes off stage 2B, Forbidden Descent's progress sponge, and the previews of the cards that hold them.
// Every number is read from the table by the readout (`readouts/rhudaur.ts`); nothing here counts. Pure.
import { plural } from "../../list.ts";

const sideQuests = (count: number): string => plural(count, "Treachery of Rhudaur side quest", "Treachery of Rhudaur side quests");

/** The note of Secrets of Rhudaur's time dial: one counter comes off at the end of each refresh phase, and the last removes the side quests still quest side up and advances the quest. `left` side quests are in play quest side up. */
export const secretsTimeWords = (counters: number, left: number): string =>
  `${plural(counters, "time counter", "time counters")} left. One comes off at the end of each refresh phase. With the last gone, ${left === 0 ? "no Treachery of Rhudaur side quest is left to remove and" : `${sideQuests(left)} still quest side up ${left === 1 ? "leaves" : "leave"} the game and`} the quest advances to stage 2.`;

/** The warning when the next refresh phase takes the last time counter: it is never a loss, so it only warns near. */
export const secretsTimeNearWords = (counters: number, left: number): string =>
  counters <= 1
    ? `The next refresh phase takes the last time counter: ${left === 0 ? "the quest advances to stage 2" : `${sideQuests(left)} ${left === 1 ? "leaves" : "leave"} the game and the quest advances to stage 2`}.`
    : `${counters} time counters are left.`;

/** The line under Secrets of Rhudaur in its preview. */
export const secretsPreviewWords = (counters: number, left: number): string =>
  `${plural(counters, "time counter", "time counters")} on it. It cannot be the current quest in the quest phase: the first player chooses a side quest in the staging area, or there is no current quest. The quest advances to stage 2 when the last counter goes, or at once when no Treachery of Rhudaur side quest is in play (${left} now).`;

/** The note of the current-quest dial, shown only while the main quest card cannot be the current quest (10094:B:3) and no side quest was chosen: the disc says "None". */
export const NO_CURRENT_WORD = "None";
export const NO_CURRENT_NAME = "Current quest this phase:";
export const noCurrentWords = (main: string): string => `${main} cannot be the current quest in the quest phase and no side quest was chosen, so there is no current quest. Progress beyond the active location's share is lost.`;

/** The note of the dial that counts the Clue objectives attached to characters: each takes 5 quest points off stage 2B (10095:B:1). */
export const CLUES_TOTAL = 3;
export const cluesLimitWords = `${CLUES_TOTAL} Clues in all`;
export const cluesWords = (claimed: number, points: number): string =>
  `${plural(claimed, "Clue objective", "Clue objectives")} attached to ${claimed === 1 ? "a character" : "characters"}. Stage 2B has 5 fewer quest points for each, ${points} now. A Clue in the staging area counts for nothing.`;

/** Forbidden Descent's sponge dial: the progress it took this round against the 2 it takes (10101:A:1). */
export const SPONGE_LIMIT = 2;
export const spongeLimitWords = `${SPONGE_LIMIT} each round`;
export const spongeWords = (taken: number, progress: number, points: number): string =>
  `${taken} of ${SPONGE_LIMIT} progress taken this round. It takes the first ${SPONGE_LIMIT} progress placed on a quest each round, ${SPONGE_LIMIT} for each copy in the staging area. It holds ${progress} of ${points} progress and is explored at ${points}.`;
export const spongeNearWords = (copies: number): string => `It has taken its ${SPONGE_LIMIT} progress this round. The next progress placed on a quest ${copies > 1 ? "goes to a copy that has room, else " : ""}goes on the quest.`;

/** The line under Forbidden Descent in its preview. */
export const descentPreviewWords = (taken: number, progress: number, points: number): string =>
  `${taken} of ${SPONGE_LIMIT} progress taken this round, ${progress} of ${points} held. In the staging area it takes the first ${SPONGE_LIMIT} progress placed on a quest each round. Explored, discarded or removed there, each player raises their threat by 2; travelling to it raises nothing.`;

/** The line under a Clue objective in its preview: where it lies, what claiming it takes and what it gives its host. `host` is the character it is attached to, `owner` the player who controls it (two-handed). */
export const clueStagingWords = (gives: string): string => `Unclaimed, in the staging area. Any player may exhaust a ready hero they control, or Amarthiúl, to claim it and attach it to that character. ${gives}`;
export const clueClaimedWords = (host: string, owner: string | null, gives: string): string => `On ${host}${owner ? `, controlled by ${owner}` : ""}. ${gives} It takes 5 quest points off stage 2B, and a Clue boon is offered for it if the players win.`;
/** What each Clue gives the character that carries it. */
export const CLUE_GIVES: Readonly<Record<string, string>> = {
  "10110": "Its host gets +1 Attack while attacking an Undead enemy.",
  "10112": "Its host gets +1 Willpower.",
  "10114": "Its host gets +1 Defense while defending against an Undead enemy.",
};

/** The line under a side quest that flips into a Clue when defeated. */
export const FLIPS_WORDS = "When this quest is defeated it flips over into its Clue objective, which stays in the staging area for a player to claim.";

/** The line under Thaurdir's Pursuit while it is the current stage: its quest points less 5 for each claimed Clue, and the damage on Thaurdir that wins it with them. */
export const pursuitWords = (points: number, printed: number, claimed: number): string => `${points} quest points: ${printed}, less 5 for each of the ${plural(claimed, "Clue objective", "Clue objectives")} attached to a character. It is defeated with them and with no hit points left on Thaurdir, and then the players win.`;
