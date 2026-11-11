// Rules: mec112.mire, mec112.gollum-smeagol (data/rules/entries.json); ledger lines 144019:A:1, 144020:A:2, 144021:A:1, 144022:A:1, 144023:A:1, 144064:B:1, 144075:A:1, 144075:A:3, 144076:A:1. The words of The Passage of the Marshes' table dials and held marks (src/play/readouts/marshes.ts).

/** One location with Mire as the table holds it: its name, the mire tokens on it and its Mire X. */
export type MireRow = { name: string; tokens: number; limit: number };

const tokensWord = (count: number): string => (count === 1 ? "1 mire token" : `${count} mire tokens`);

/** The locations nearest to being discarded: the fewest mire tokens left, every one of them on a tie. */
export function nearestRows(rows: readonly MireRow[]): readonly MireRow[] {
  const fewest = Math.min(...rows.map((row) => row.limit - row.tokens));
  return rows.filter((row) => row.limit - row.tokens === fewest);
}

/** "A", "A and B", "A, B and C". */
export function listNames(rows: readonly MireRow[]): string {
  const names = rows.map((row) => row.name);
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The Mire dial's own warning (mec112.mire): at 1 mire token left a location is one token from being discarded; with more left the ring's proportion speaks alone. */
export function mireWarn(left: number, closest: readonly MireRow[]): { level: "critical"; words: string } | undefined {
  return left === 1 ? { level: "critical", words: `1 mire token more and ${listNames(closest)} ${closest.length > 1 ? "are" : "is"} discarded` } : undefined;
}

/** What the Mire dial reads (mec112.mire): the locations closest to being discarded give the dial's number, and each location's tokens against its limit are said here, with what the limit does. */
export function mireWords(rows: readonly MireRow[], closest: readonly MireRow[]): string {
  const each = rows.map((row) => `${row.name} ${row.tokens} of ${row.limit}`).join(", ");
  const first = closest[0];
  const left = first ? Math.max(0, first.limit - first.tokens) : 0;
  return `${each}; ${first ? `${tokensWord(left)} more and ${listNames(closest)} ${closest.length > 1 ? "are" : "is"} discarded by Mire` : "none left"}`;
}

/** What Gollum's hit points are (144064:B:1, 144075:A:3): defeating him flips him to Sméagol, and the first player must control Sméagol for the players to advance. */
export const GOLLUM_WORDS = "defeat him and he flips to Sméagol, whom the first player controls; the players cannot advance without Sméagol";

/** What a seat's dial says of the card Gollum / Sméagol, by the side it shows: Gollum is engaged with a player, Sméagol is controlled by the first player (and exhausted when the flip left him so). */
export function gollumHeldWords(side: "gollum" | "smeagol", who: string, exhausted: boolean): string {
  return side === "gollum" ? `Gollum is engaged with ${who}` : `${who === "you" ? "You control" : `${who} controls`} Sméagol${exhausted ? ", exhausted" : ""}`;
}
