// Rules: mec112.mire, mec112.gollum-smeagol (data/rules/entries.json); ledger lines 144019:A:1, 144020:A:2, 144021:A:1, 144022:A:1, 144023:A:1, 144064:B:1, 144075:A:1, 144075:A:3, 144076:A:1. The words of The Passage of the Marshes' table dials and held marks (src/play/readouts/marshes.ts).

/** One location with Mire as the table holds it: its name, the mire tokens on it and its Mire X. */
export type MireRow = { name: string; tokens: number; limit: number };

const tokensWord = (count: number): string => (count === 1 ? "1 mire token" : `${count} mire tokens`);

/** What the Mire dial reads (mec112.mire): the location closest to being discarded is the dial's number, and each location's tokens against its limit are said here, with what the limit does. */
export function mireWords(rows: readonly MireRow[]): string {
  const each = rows.map((row) => `${row.name} ${row.tokens} of ${row.limit}`).join(", ");
  const nearest = rows.reduce<MireRow | null>((best, row) => (best == null || row.limit - row.tokens < best.limit - best.tokens ? row : best), null);
  const left = nearest ? Math.max(0, nearest.limit - nearest.tokens) : 0;
  return `${each}; ${nearest ? `${tokensWord(left)} more and ${nearest.name} is discarded by Mire` : "none left"}`;
}

/** What Gollum's hit points are (144064:B:1, 144075:A:3): defeating him flips him to Sméagol, and the first player must control Sméagol for the players to advance. */
export const GOLLUM_WORDS = "defeat him and he flips to Sméagol, whom the first player controls; the players cannot advance without Sméagol";

/** What a seat's dial says of the card Gollum / Sméagol, by the side it shows: Gollum is engaged with a player, Sméagol is controlled by the first player (and exhausted when the flip left him so). */
export function gollumHeldWords(side: "gollum" | "smeagol", who: string, exhausted: boolean): string {
  return side === "gollum" ? `Gollum is engaged with ${who}` : `${who === "you" ? "You control" : `${who} controls`} Sméagol${exhausted ? ", exhausted" : ""}`;
}
