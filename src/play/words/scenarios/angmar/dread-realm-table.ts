// Rules: mec108.reanimated-dead, mec108.indestructible, rr.attachment-cards, rr.removed-from-game, rr.winning-the-game (data/rules/entries.json); ledger lines 10152:B:3, 10153:A:2, 10153:A:3, 10154:A:1, 101157:A:1, 101160:A:1, 101161:A:1, 101162:A:2, 101163:A:1.
//
// The words The Dread Realm's pieces say on the table: a Reanimated Dead (a facedown card that acts as an Undead enemy: never its face, always what it is and whose card it is), the Wraith of Carn Dûm lying on a character, Possession on its Reanimated Dead, A Fell Dread on its hero, Daechanar's Sorcery
// cards, the Altar of Midwinter, and stage 3's count of locations in play against the 0 at which the players win. Every number is read from the table by the readout and the preview; nothing here counts. Pure.
import { plural } from "../../list.ts";

/** The name every Reanimated Dead shows: the card's own name is not read or shown while it lies facedown. */
export const REANIMATED_DEAD = "Reanimated Dead";

/** The mark on a seat's dial: the Reanimated Dead engaged with it. */
export const deadLabel = (seat: number | null): string => (seat == null ? "Dead" : `P${seat + 1} · Dead`);

export const deadSeatWords = (count: number, engaged: boolean, crypts: number): string =>
  `${plural(count, "Reanimated Dead", "Reanimated Dead")} ${engaged ? "engaged" : "in the staging area"}, each an Undead enemy with 2 Attack and 2 Defense.${crypts > 0 ? ` Each adds 1 Threat to every Unholy Crypt in the staging area.` : ""}`;

/** The stats a Reanimated Dead has now, as the engine reads them: 0 engagement cost, 2 Threat, 2 Attack, 2 Defense and 2 hit points before any modifier (a Dark Halls in the staging area adds 1 Attack and 1 Defense). */
export type DeadStats = { engagementCost: number; threat: number; attack: number; defense: number; hitPoints: number; damage: number };

const statsWords = (s: DeadStats): string => `engagement cost ${s.engagementCost}, Threat ${s.threat}, Attack ${s.attack}, Defense ${s.defense}, ${s.damage > 0 ? `${s.damage} damage of ${s.hitPoints} hit points` : `${s.hitPoints} hit points`}`;

/** What a Reanimated Dead says it is, after its name, for the screen reader and the web list: it never names the card behind it. `owner` is whose card it is ("your", "Player 2's"), `where` where it lies. */
export function reanimatedSpeech(stats: DeadStats, owner: string, where: { engagedWith: string | null }): string {
  const place = where.engagedWith != null ? `engaged with ${where.engagedWith}` : "in the staging area";
  return `a facedown Undead enemy ${place}: ${statsWords(stats)}. ${capital(owner)} card, it goes to ${owner} discard pile when it leaves play`;
}

const capital = (words: string): string => words.replace(/^./, (first) => first.toUpperCase());

/** The preview of a Reanimated Dead: what it is, whose card it is, and where that card goes when it leaves play. The face behind it is not shown or named. */
export function reanimatedPreviewWords(stats: DeadStats, owner: string, where: { engagedWith: string | null }, possession: string | null): string {
  const place = where.engagedWith != null ? `Engaged with ${where.engagedWith}.` : "In the staging area, adding its Threat there.";
  const held = possession != null ? ` ${possession} is attached to it: when ${possession} is discarded this card is discarded too.` : "";
  return `A facedown card acting as an Undead enemy: ${statsWords(stats)}. ${place} It is ${owner} card, and goes to ${owner} discard pile when it leaves play.${held}`;
}

/** The Wraith of Carn Dûm lying on a character: the attachment's text and what happens when the character leaves play. */
export const wraithAttachedWords = (host: string): string =>
  `Attached to ${host} as a Sorcery attachment: ${host} has -1 Willpower, -1 Attack and -1 Defense. When ${host} leaves play it returns to the staging area as an enemy.`;

/** Possession on its Reanimated Dead. */
export const possessionAttachedWords = (owner: string): string =>
  `Attached to a Reanimated Dead (${owner} card). Counts as a Sorcery Condition attachment. Discarding it discards the Reanimated Dead to its owner's discard pile; removing it from the game leaves the Reanimated Dead in the staging area.`;

/** A Fell Dread on its hero. */
export const fellDreadWords = (hero: string, owner: string | null): string =>
  `Attached to ${hero}${owner != null ? ` (${owner} hero)` : ""}: Willpower 0, and ${hero} must commit to the quest each round, if able. Counts as a Sorcery Condition attachment.`;

/** The Sorcery cards in play, against Daechanar: his Attack and what keeps him from harm. */
export function daechanarWords(sorcery: number, attack: number): string {
  if (sorcery === 0) return `No Sorcery card is in play: ${attack} Attack, and damage to him lands. Destroying him advances the quest.`;
  return `${plural(sorcery, "Sorcery card", "Sorcery cards")} in play: ${attack} Attack, Indestructible, and each time he is damaged all of it is canceled and the first player removes a Sorcery card from the game.`;
}

/** The dial of the Sorcery cards in play while Daechanar is. */
export const SORCERY_DIAL_NAME = "Sorcery cards in play:";
export const sorceryNote = (sorcery: number): string =>
  sorcery === 0
    ? "Daechanar takes damage now, and destroying him advances the quest."
    : `Daechanar cancels all damage while a Sorcery card is in play, removing one from the game each time. ${plural(sorcery, "Sorcery card", "Sorcery cards")} in play.`;

/** The Altar of Midwinter's preview line. */
export const altarWords = (daechanarInPlay: boolean): string => (daechanarInPlay ? "No progress can be placed here while Daechanar is in play." : "Progress can be placed here: Daechanar is not in play.");

/** Stage 3's dial: the locations in the staging area and the active location, against the 0 at which the players win at the end of the quest phase. */
export const ESCAPE_DIAL_NAME = "Locations in play:";
export const escapeNote = (locations: number): string =>
  locations === 0
    ? "No location is in play: the players escape Carn Dûm and win at the end of the quest phase."
    : `${plural(locations, "location", "locations")} in play, in the staging area or active. At the end of the quest phase every character takes 1 damage while any location is in play; the players win once none is.`;
/** The warning while a location is in play and the damage at the end of the quest phase would destroy a character: who it destroys. */
export const escapeNear = (names: readonly string[]): string => `At the end of the quest phase 1 damage destroys ${names.length <= 3 ? names.join(", ") : `${plural(names.length, "character", "characters")}`}.`;
