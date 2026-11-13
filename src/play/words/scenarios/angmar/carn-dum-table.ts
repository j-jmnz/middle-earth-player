// Rules: mec108.thaurdir, mec108.indestructible, mec108.side-quests-in-play, rr.active-location, rr.attachment-cards (data/rules/entries.json); ledger lines 10125:B:1, 10125:B:3, 10126:B:1, 10126:B:2, 10126:B:3, 10127:A:4, 10128:A:4, 10129:A:1, 10139:A:2, 10139:A:3, 10191:A:2.
//
// The words The Battle of Carn Dûm's pieces say on the table: Thaurdir's side and the shadow cards dealt to him against the 3 that flip him on stage 1B (a count, since a flip has effects of its own: the note says them), stage 2B's progress against the 15 that take his Indestructible away
// (the players' way out), the Carn Dûm Garrison's Threat that grows with its shadow cards, Furious Charge's 10 progress for the main quest, and Thaurdir's preview with the burden he carries across his flips. Every number is read from the table by the readout (`readouts/carn-dum.ts`); nothing here counts. Pure.
import { plural } from "../../list.ts";

export type ThaurdirSide = "Captain" | "Champion";
const otherSide = (side: ThaurdirSide): ThaurdirSide => (side === "Captain" ? "Champion" : "Captain");
const shadowCardsWords = (count: number): string => plural(count, "shadow card", "shadow cards");

/** The dial's name: what its number counts and the side he shows. */
export const thaurdirDialName = (side: ThaurdirSide): string => `Shadow cards dealt to Thaurdir, ${side} side faceup:`;
export const thaurdirLimitWords = (flipsAt: number): string => `${flipsAt} flip him`;

/** What a flip to `to` does, the Forced effect of the side he flips to: the Champion heals and attacks the first player at once, the Captain deals each enemy in play a shadow card (it stays dealt on stage 1B and raises the Garrison's Threat). */
const flipDoes = (to: ThaurdirSide, heals: number): string =>
  to === "Champion" ? `he heals ${heals} damage and attacks the first player at once` : "each enemy in play is dealt a shadow card, which stays on it and raises the Garrison's Threat";

/** The warning of a Captain one shadow card short of flipping on stage 1B: the flip to Champion is an attack, so the dial says so while it can still be stopped. */
export const thaurdirNearWords = (heals: number): string => `One more shadow card flips him to Champion: he heals ${heals} damage and attacks the first player at once.`;

const ENGAGED_WITH_EACH = "Engaged with each player: he attacks each player in turn in the combat phase, and any player's characters can attack him.";

/** The flip the shadow cards cause on stage 1B, as a clause: at `flipsAt` he flips (exactly that many, never a fourth); holding that many or more, more cards do not flip him until these are discarded. */
const shadowFlipWords = (side: ThaurdirSide, shadows: number, flipsAt: number, heals: number): string =>
  shadows >= flipsAt
    ? `Holding ${shadows}, more shadow cards do not flip him until these are discarded.`
    : `At ${flipsAt} he flips to his ${otherSide(side)} side: ${flipDoes(otherSide(side), heals)}.`;

/**
 * The note of Thaurdir's dial. Stage 1B (`flipsAt` is the count): at exactly that many shadow cards he flips to his other side (a fourth card flips nobody), and at the end of the round a Champion flips to Captain. Stage 2B (`flipsAt` is null): shadow cards no longer flip him; a Captain
 * flips to Champion at the end of the round and he attacks each player. A flip is not a free turn of the card: the side he flips to hears it (the Captain deals each enemy a shadow card, the Champion heals `heals` and attacks the first player at once), and the note says which.
 */
export function thaurdirDialWords(side: ThaurdirSide, shadows: number, flipsAt: number | null, heals: number): string {
  const lead = `${side} side faceup, ${shadowCardsWords(shadows)} dealt to him.`;
  if (flipsAt != null) {
    const roundEnd = side === "Champion" ? ` At the end of the round he flips to Captain: ${flipDoes("Captain", heals)}.` : "";
    return `${lead} ${shadowFlipWords(side, shadows, flipsAt, heals)}${roundEnd}`;
  }
  const next = side === "Captain" ? `At the end of the round he flips to his Champion side: ${flipDoes("Champion", heals)}.` : `He stays Champion side faceup until an effect flips him to Captain: ${flipDoes("Captain", heals)}.`;
  return `${lead} ${next} ${ENGAGED_WITH_EACH} Each attack he makes is dealt a shadow card of its own.`;
}

/** The goal dial of stage 2B: the progress on Midwinter's Crux against the amount that takes Thaurdir's Indestructible away. */
export const cruxName = (stage: string): string => `Progress on ${stage}:`;
export const cruxLimitWords = (limit: number): string => `${limit} takes away his Indestructible`;
// `hurt`: Thaurdir's damage and hit points as the engine reads them, null while he is not in play. At the limit that is the players' next goal: damage on him against his hit points.
export const cruxWords = (progress: number, limit: number, stage: string, hurt: { damage: number; hitPoints: number } | null): string =>
  progress >= limit
    ? `${progress} progress on ${stage}: Thaurdir has lost Indestructible. Damage that destroys him wins the game${hurt ? `: he has ${hurt.damage} of ${hurt.hitPoints} hit points of damage` : ""}. The stage cannot be defeated while he is in play.`
    : `${progress} of ${limit} progress on ${stage}. At ${limit} Thaurdir loses Indestructible, so damage can destroy him and win the game. The stage cannot be defeated while he is in play.`;

/** The line under a Carn Dûm Garrison in its preview: its Threat as the engine reads it now, with the printed Threat and the shadow cards dealt to it. `staging`: it lies in the staging area, where its Threat counts against the quest. */
export const garrisonPreviewWords = (threat: number, printed: number, shadows: number, staging: boolean): string =>
  `Threat ${threat} now: ${printed} printed and 1 more for each shadow card dealt to it, ${shadowCardsWords(shadows)} now.${staging ? " Its Threat counts in the staging area." : ""}`;

/** The line under Furious Charge: its quest points as the engine reads them, the Defense each character loses when progress is placed on it, and the progress its defeat adds to the main quest card. */
export const furiousPreviewWords = (progress: number, points: number, add: number, defense: number, main: string): string =>
  `${progress} of ${points} progress. When progress is placed on it each character gets -${defense} Defense until the end of the round, and Thaurdir flips if he is Captain side faceup. Defeated, it adds ${add} progress to the main quest, ${main}: the active location takes its share first, unless another side quest is the current quest.`;

/** How Thaurdir takes damage now: none on stage 1B, Indestructible on stage 2B below `limit` progress, any once it lapses. */
export type ThaurdirGuard = { kind: "noDamage" } | { kind: "indestructible"; limit: number } | { kind: "vulnerable" };
const guardWords = (guard: ThaurdirGuard): string =>
  guard.kind === "noDamage" ? " He cannot take damage on this stage." : guard.kind === "indestructible" ? ` He is Indestructible until Midwinter's Crux holds ${guard.limit} progress.` : " He has lost Indestructible: damage can destroy him.";

/** Thaurdir's preview: his side, the shadow cards dealt to him, his damage against his hit points, whether damage touches him, and the burden he carries (it stays on him across a flip). `flipsAt` is the count that flips him on stage 1B, null on stage 2B (where he attacks each player). */
export function thaurdirPreviewWords(side: ThaurdirSide, shadows: number, flipsAt: number | null, damage: number, hitPoints: number, burden: string | null, guard: ThaurdirGuard): string {
  const flips = flipsAt == null ? ` ${ENGAGED_WITH_EACH}` : shadows >= flipsAt ? ` Holding ${shadows}, more shadow cards do not flip him until these are discarded.` : ` At ${flipsAt} he flips to his ${otherSide(side)} side.`;
  const carried = burden ? ` Carrying ${burden}, which stays on him when he flips.` : "";
  return `${side} side faceup: ${shadowCardsWords(shadows)} dealt to him, ${damage} of ${hitPoints} hit points of damage.${guardWords(guard)}${flips}${carried}`;
}
