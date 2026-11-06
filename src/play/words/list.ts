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
const FROM_WORDS = { staging: null, engaged: "Engaged", active: "Active location" } as const;

/** The staging threat list's line: the type, where the card stands when not in staging, then the Threat it adds, "Enemy · 3 Threat". */
export function threatSourceWords(kind: string | null, threat: number, from: keyof typeof FROM_WORDS): string {
  return [kind, FROM_WORDS[from], `${threat} Threat`].filter(Boolean).join(" · ");
}

/** What a screen reader hears of that line: "Enemy, engaged, 3 threat". */
export function threatSourceSaid(kind: string | null, threat: number, from: keyof typeof FROM_WORDS): string {
  return [kind, FROM_WORDS[from]?.toLowerCase(), `${threat} threat`].filter(Boolean).join(", ");
}
