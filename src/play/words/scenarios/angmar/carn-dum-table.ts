// Rules: mec108.thaurdir, mec108.indestructible, mec108.side-quests-in-play, rr.active-location, rr.attachment-cards (data/rules/entries.json); ledger lines 10125:B:1, 10125:B:3, 10126:B:1, 10126:B:2, 10126:B:3, 10127:A:4, 10128:A:4, 10129:A:1, 10139:A:2, 10139:A:3, 10191:A:2.
//
// The words The Battle of Carn Dûm's pieces say on the table: Thaurdir's side and the shadow cards dealt to him against the 3 that flip him on stage 1B (a plain count, since a flip is neither good nor bad), stage 2B's progress against the 15 that take his Indestructible away
// (the players' way out), the Carn Dûm Garrison's Threat that grows with its shadow cards, Furious Charge's 10 progress for the main quest, and Thaurdir's preview with the burden he carries across his flips. Every number is read from the table by the readout (`readouts/carn-dum.ts`); nothing here counts. Pure.
import { plural } from "../../list.ts";

export type ThaurdirSide = "Captain" | "Champion";
const otherSide = (side: ThaurdirSide): ThaurdirSide => (side === "Captain" ? "Champion" : "Captain");
const shadowCardsWords = (count: number): string => plural(count, "shadow card", "shadow cards");

/** The dial's name: what its number counts and the side he shows. */
export const thaurdirDialName = (side: ThaurdirSide): string => `Shadow cards dealt to Thaurdir, ${side} side faceup:`;
export const thaurdirLimitWords = (flipsAt: number): string => `${flipsAt} flip him`;

/**
 * The note of Thaurdir's dial. Stage 1B (`flipsAt` is the count): at that many shadow cards he flips to his other side, and at the end of the round a Champion flips to Captain. Stage 2B (`flipsAt` is null): shadow cards no longer flip him; a Captain flips to Champion at the end of the round.
 * A flip only turns the card over, so it says nothing is lost or gained; the side he flips to then hears it (the Captain deals each enemy a shadow card, the Champion heals 3 and attacks).
 */
export function thaurdirDialWords(side: ThaurdirSide, shadows: number, flipsAt: number | null): string {
  const lead = `${side} side faceup, ${shadowCardsWords(shadows)} dealt to him.`;
  if (flipsAt != null) return `${lead} At ${flipsAt} he flips to his ${otherSide(side)} side${side === "Champion" ? ", and at the end of the round he flips to Captain" : ""}.`;
  return `${lead} ${side === "Captain" ? "At the end of the round he flips to his Champion side." : "He stays Champion side faceup until an effect flips him."} Each attack he makes is dealt a shadow card of its own.`;
}

/** The goal dial of stage 2B: the progress on Midwinter's Crux against the amount that takes Thaurdir's Indestructible away. */
export const cruxName = (stage: string): string => `Progress on ${stage}:`;
export const cruxLimitWords = (limit: number): string => `${limit} takes away his Indestructible`;
export const cruxWords = (progress: number, limit: number, stage: string): string =>
  progress >= limit
    ? `${progress} progress on ${stage}: Thaurdir has lost Indestructible. Damage that destroys him wins the game, and the stage cannot be defeated while he is in play.`
    : `${progress} of ${limit} progress on ${stage}. At ${limit} Thaurdir loses Indestructible, so damage can destroy him and win the game. The stage cannot be defeated while he is in play.`;

/** The line under a Carn Dûm Garrison in its preview: its Threat as the table reads it, from the printed Threat and the shadow cards dealt to it. */
export const garrisonPreviewWords = (threat: number, printed: number, shadows: number): string =>
  `Threat ${threat}: ${printed} printed and 1 more for each shadow card dealt to it, ${shadowCardsWords(shadows)} now. Its Threat counts in the staging area.`;

/** The line under Furious Charge: its quest points as the engine reads them, and the 10 progress its defeat adds to the main quest card. */
export const furiousPreviewWords = (progress: number, points: number, add: number, main: string): string =>
  `${progress} of ${points} progress. When progress is placed on it each character gets -2 Defense until the end of the round, and a Captain Thaurdir flips. Defeated, it adds ${add} progress to the main quest, ${main}: the active location takes none of it while another side quest is the current quest.`;

/** Thaurdir's preview: his side, the shadow cards dealt to him, his damage against his hit points and the burden he carries (it stays on him across a flip). `flipsAt` is the count that flips him on stage 1B, null on stage 2B. */
export function thaurdirPreviewWords(side: ThaurdirSide, shadows: number, flipsAt: number | null, damage: number, hitPoints: number, burden: string | null): string {
  const flips = flipsAt != null ? ` At ${flipsAt} he flips to his ${otherSide(side)} side.` : "";
  const carried = burden ? ` Carrying ${burden}, which stays on him when he flips.` : "";
  return `${side} side faceup: ${shadowCardsWords(shadows)} dealt to him, ${damage} of ${hitPoints} hit points of damage.${flips}${carried}`;
}
