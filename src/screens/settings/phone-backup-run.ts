// What the phone's Saves page does (docs/brief.md, Persistence and shipping), as plain async functions over the phone's file calls (`PhoneIo`, phone-backup-io.native.ts), so
// a test runs them with no phone. The file is the web's and the desktop's (web/backup-db.ts), so a backup made on one client restores on any other. Each returns the sentence to show.
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";

import { flushRuns } from "../data/pending-runs";
import { exportBackup, restoreBackup } from "./web/backup-db";
import { backupFileName, hasSqliteHeader, REFUSALS } from "./web/backup-file";

export type Say = { text: string; failed: boolean };
export type Picked = { bytes: Uint8Array; name: string };

export type PhoneIo = {
  /** Hands the file to the player: `saved` into a folder they chose, `shared` through the share sheet, or `cancelled` when they closed either. */
  hand(bytes: Uint8Array, name: string): Promise<"saved" | "shared" | "cancelled">;
  /** The file the player picked, or null when they closed the picker. */
  pick(): Promise<Picked | null>;
  /** Starts the app again, so every screen reads the restored games. */
  reload(): void;
};

/**
 * Serialize user.db and hand it to the player. The app sends it nowhere: the player chooses where it goes. The runs still queued are written first, so the file
 * holds them (.claude/rules/code-standards.md, Saving). Null when the player closed the sheet or the folder picker: nothing happened, so nothing is said.
 */
export async function backUp(user: ExpoSQLiteDatabase, now: Date, io: PhoneIo): Promise<Say | null> {
  try {
    flushRuns();
    const name = backupFileName(now);
    const handed = await io.hand(await exportBackup(user), name);
    if (handed === "cancelled") return null;
    const what = "It holds every campaign, game, deck and run on this device.";
    return { text: handed === "saved" ? `${name} is saved. ${what}` : `${name} is ready. ${what}`, failed: false };
  } catch (error: unknown) {
    console.warn(`The backup was not made: ${error instanceof Error ? error.message : "unknown error"}`);
    return { text: "The backup could not be made.", failed: true };
  }
}

/** The picked file, null when the picker was closed, or the sentence when it is plainly not a backup or cannot be read. */
export async function pickBackup(io: PhoneIo): Promise<Picked | Say | null> {
  try {
    const picked = await io.pick();
    if (!picked) return null;
    return hasSqliteHeader(picked.bytes) ? picked : { text: REFUSALS.notDatabase, failed: true };
  } catch {
    return { text: REFUSALS.damaged, failed: true };
  }
}

/**
 * Restore the picked file, then start the app again. The runs still queued are written first, into the database the restore replaces, so none of them lands in
 * the restored one afterwards.
 */
export async function restore(user: ExpoSQLiteDatabase, { bytes }: Picked, io: PhoneIo): Promise<Say> {
  flushRuns();
  const result = await restoreBackup(user, bytes);
  if (!result.ok) return { text: REFUSALS[result.reason], failed: true };
  io.reload();
  return { text: "Restored. The app is starting again.", failed: false };
}
