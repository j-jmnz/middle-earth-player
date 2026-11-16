// What the Saves group's buttons do, as plain async functions (a component body holds no try/catch). Each returns the sentence to show.
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";

import { backupFileName, hasSqliteHeader, REFUSALS } from "./backup-file";
import { exportBackup, restoreBackup } from "./backup-db";
import { downloadBytes, pickBackupFile } from "./backup-io";

export type Say = { text: string; failed: boolean };

/** Serialize user.db and hand it to the browser as a download. Nothing is sent anywhere. */
export async function backUp(user: ExpoSQLiteDatabase, now: Date): Promise<Say> {
  try {
    const name = backupFileName(now);
    downloadBytes(await exportBackup(user), name);
    return { text: `Saved ${name}. It holds every campaign, game, deck and run on this computer.`, failed: false };
  } catch (error: unknown) {
    console.warn(`The backup was not made: ${error instanceof Error ? error.message : "unknown error"}`);
    return { text: "The backup could not be made.", failed: true };
  }
}

/** The picked file's bytes, null when the picker was closed, or the sentence when it is plainly not a backup. */
export async function pickBackup(): Promise<Uint8Array | Say | null> {
  const file = await pickBackupFile();
  if (!file) return null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return hasSqliteHeader(bytes) ? bytes : { text: REFUSALS.notDatabase, failed: true };
  } catch {
    return { text: REFUSALS.damaged, failed: true };
  }
}

/** Restore the picked bytes. `reload` runs after an accepted restore so every screen reads the restored games. */
export async function restore(user: ExpoSQLiteDatabase, bytes: Uint8Array, reload: () => void): Promise<Say> {
  const result = await restoreBackup(user, bytes);
  if (!result.ok) return { text: REFUSALS[result.reason], failed: true };
  reload();
  return { text: "Restored. The app is reloading.", failed: false };
}
