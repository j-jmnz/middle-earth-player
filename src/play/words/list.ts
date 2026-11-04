// The line under a card's name in a card list (docs/design-system-table.md, Reading panels): its type and its sphere, "Event · Tactics", from its
// printing. A side quest reads "Side quest"; an encounter card has no sphere ("Enemy"). Pure.
import type { PrintedCard } from "../../rules/core/printed.ts";

const capital = (word: string) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;

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
