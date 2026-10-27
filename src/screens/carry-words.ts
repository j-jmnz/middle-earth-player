// How a finished playthrough's carry-over reads in the start panel (docs/design-system.md, Campaign list). Pure, so a test reads it.
import type { PoolCard } from "../campaign/log";

/** The cards as one phrase, duplicates collapsed: "Mendor, Mendor's Support (each player)". Two entries of one code read "Name ×2". */
export function carryWords(cards: readonly PoolCard[], nameOf: (code: string) => string): string {
  const rows = new Map<string, { code: string; count: number; perPlayer: boolean }>();
  for (const card of cards) {
    const key = `${card.code}\u0000${card.perPlayer === true}`;
    const row = rows.get(key);
    if (row) row.count += 1;
    else rows.set(key, { code: card.code, count: 1, perPlayer: card.perPlayer === true });
  }
  return [...rows.values()].map((row) => `${nameOf(row.code)}${row.perPlayer ? " (each player)" : row.count > 1 ? ` ×${row.count}` : ""}`).join(", ");
}

/** "Two-handed · finished 24 Oct · score 41": what tells two finished playthroughs of one campaign apart. */
export function carrySource(seats: string, finishedAt: number | null, score: number): string {
  const date = finishedAt == null ? null : new Date(finishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return [seats, date ? `finished ${date}` : null, `score ${score}`].filter((part) => part != null).join(" · ");
}
