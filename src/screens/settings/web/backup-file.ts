// The backup file's pure parts (docs/brief.md, Persistence and shipping): its name, what makes a file a SQLite database, how its migration
// history compares with this build's, and the sentences a refused file is told. No database and no browser here, so tests can reach it.

const MAGIC = "SQLite format 3\u0000";

/** The Settings button's own words: one sentence per reason a restore is refused. */
export const REFUSALS = {
  notDatabase: "That file is not a Middle-earth Player backup.",
  noSaves: "That file has no saves in it, so it is not a Middle-earth Player backup.",
  newer: "That backup was made by a newer version of the app. Update the app, then restore it.",
  damaged: "That backup is damaged and cannot be read.",
  unreadable: "A campaign in that backup does not read, so nothing was changed.",
  failed: "The restore did not finish, so nothing was changed.",
} as const;

export type Refusal = keyof typeof REFUSALS;

/** `middle-earth-player-2026-11-16.backup`, in the computer's own date. */
export function backupFileName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `middle-earth-player-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.backup`;
}

/** Whether the bytes start as a SQLite database does. */
export function hasSqliteHeader(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Where a file's applied migrations (their `created_at`, the journal's `when`) stand against this build's, compared as sets: `newer` when it holds one this
 * build does not know (a later one, or an earlier one from a line this build never had: either way it is not this build's to migrate), `current` when it holds
 * them all, `older` when it lacks some (they are run on the copy before anything is replaced).
 */
export function schemaVerdict(applied: readonly number[], known: readonly number[]): "newer" | "current" | "older" {
  const knownSet = new Set(known);
  if (applied.some((when) => !knownSet.has(when))) return "newer";
  const appliedSet = new Set(applied);
  return known.every((when) => appliedSet.has(when)) ? "current" : "older";
}

/** The tables a restore leaves as they are on this computer: they describe files and the catalog stored here, not the player's games. */
export const KEPT_TABLES: readonly string[] = ["meta", "booklets", "image_files"];

/** The tables a restore replaces, from the ones the live database has. */
export function restoredTables(live: readonly string[]): string[] {
  return live.filter((name) => !KEPT_TABLES.includes(name) && !name.startsWith("sqlite_") && !name.startsWith("__drizzle"));
}
