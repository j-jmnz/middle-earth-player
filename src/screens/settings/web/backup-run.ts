// What the Saves group's buttons do, as plain async functions (a component body holds no try/catch). Each returns the sentence to show.
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";

import { backupFileName, hasSqliteHeader, REFUSALS } from "./backup-file";
import { exportBackup, restoreBackup } from "./backup-db";
import { rememberRestored } from "./backup-note";
import { downloadBytes } from "./backup-io";
import { pickFile } from "../../../ui/web/pick-file";
import { flushRuns } from "../../data/pending-runs";

export type Say = { text: string; failed: boolean };

/**
 * Serialize user.db and hand it to the browser as a download. Nothing is sent anywhere. The runs still queued are written first, so the file holds them
 * (.claude/rules/code-standards.md, Saving). The sentence says the file is ready, not saved: the browser, or the desktop's save dialog, decides whether it lands, and says so itself.
 */
export async function backUp(user: ExpoSQLiteDatabase, now: Date): Promise<Say> {
  try {
    flushRuns();
    const name = backupFileName(now);
    downloadBytes(await exportBackup(user), name);
    return { text: `${name} is ready to save. It holds every campaign, game, deck and run on this computer.`, failed: false };
  } catch (error: unknown) {
    console.warn(`The backup was not made: ${error instanceof Error ? error.message : "unknown error"}`);
    return { text: "The backup could not be made.", failed: true };
  }
}

export type Picked = { bytes: Uint8Array; name: string };

/** The picked file (its bytes and its name), null when the picker was closed, or the sentence when it is plainly not a backup. */
export async function pickBackup(): Promise<Picked | Say | null> {
  const file = await pickFile();
  if (!file) return null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return hasSqliteHeader(bytes) ? { bytes, name: file.name } : { text: REFUSALS.notDatabase, failed: true };
  } catch {
    return { text: REFUSALS.damaged, failed: true };
  }
}

/**
 * Restore the picked file. `reload` runs after an accepted restore so every screen reads the restored games; the file's name is left for the page that opens after it.
 * The runs still queued are written first, into the database the restore replaces, so none of them lands in the restored one afterwards.
 */
export async function restore(user: ExpoSQLiteDatabase, { bytes, name }: Picked, reload: () => void): Promise<Say> {
  flushRuns();
  const result = await restoreBackup(user, bytes);
  if (!result.ok) return { text: REFUSALS[result.reason], failed: true };
  rememberRestored(name);
  reload();
  return { text: "Restored. The app is reloading.", failed: false };
}
