// The line under a card's name in a card list (docs/design-system-table.md, Reading panels): its type and its sphere, "Event · Tactics", from its
// printing. A side quest reads "Side quest"; an encounter card has no sphere ("Enemy"). Pure.
import type { PrintedCard } from "../../rules/core/printed.ts";

/** The text with its first letter capitalized. */
export const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** "1 stage", "3 stages"; `many` when the plural is not the word with an s ("1 ally", "2 allies"). */
export const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;

/** "Event · Tactics", or null when the printing is not known. */
export function kindWords(printed: Pick<PrintedCard, "type" | "sphere"> | undefined): string | null {
  if (!printed) return null;
  const type = printed.type === "player-side-quest" ? "Side quest" : capital(printed.type);
  return printed.sphere ? `${type} · ${capital(printed.sphere)}` : type;
}

/** The victory list's line: the type, then the Victory points the card scores, "Enemy · 4 VP". */
export function victoryWords(kind: string | null, points: number): string {
  return kind ? `${kind} · ${points} VP` : `${points} VP`;
}

/** What a screen reader hears of that line: "Enemy, 4 victory points" (it would spell "VP" out). */
export function victorySaid(kind: string | null, points: number): string {
  const said = `${points} victory ${points === 1 ? "point" : "points"}`;
  return kind ? `${kind}, ${said}` : said;
}

// Where a card that adds to the staging threat stands, when that is not the staging area itself.
const FROM_WORDS = { staging: null, engaged: "Engaged", active: "Active location", elsewhere: "In another area" } as const;

// Where the card stands: a card in another player's staging area names the player ("In Player 2's staging area"), else it is "In another area".
function whereWords(from: keyof typeof FROM_WORDS, area?: number): string | null {
  return from === "elsewhere" && area != null ? `In Player ${area + 1}'s staging area` : FROM_WORDS[from];
}

/** The staging threat list's line: the type, where the card stands when not in staging, then the Threat it adds, "Enemy · 3 Threat". `area` is the seat whose staging area holds a card that stands in another. */
export function threatSourceWords(kind: string | null, threat: number, from: keyof typeof FROM_WORDS, area?: number): string {
  return [kind, whereWords(from, area), `${threat} Threat`].filter(Boolean).join(" · ");
}

/** What a screen reader hears of that line: "Enemy, engaged, 3 threat". */
export function threatSourceSaid(kind: string | null, threat: number, from: keyof typeof FROM_WORDS, area?: number): string {
  return [kind, whereWords(from, area)?.toLowerCase(), `${threat} threat`].filter(Boolean).join(", ");
}

/** The Set aside list (docs/design-system-table.md, Reading panels): its title, the menu row's words, and the lines that are not a card. */
export const SET_ASIDE_TITLE = "Set aside";

/** The menu row: "Set aside (5)". */
export function setAsideLabel(count: number): string {
  return `${SET_ASIDE_TITLE} (${count})`;
}

/** What a screen reader hears of the menu row: "Set aside cards, 5". */
export function setAsideSaid(count: number): string {
  return `Set aside cards, ${count}`;
}

/** The cards the scenario hides: "1 card is facedown", "2 cards are facedown". Shown and heard the same; it names nothing. */
export function facedownWords(count: number): string {
  return count === 1 ? "1 card is facedown" : `${count} cards are facedown`;
}

/** The list's foot (rr.in-play-and-out-of-play: cards set aside are out of play). */
export const SET_ASIDE_FOOT = "These cards are out of play.";

/** A set-aside card's line: its type, then what the table knows of it ("Enemy · Set aside with 3 damage, which it keeps when it returns."). */
export function setAsideWords(kind: string | null, kept: string | null): string | null {
  return [kind, kept].filter(Boolean).join(" · ") || null;
}
