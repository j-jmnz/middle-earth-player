// The one line a successful restore leaves for the page that reloads after it (backup-group.tsx): the page is gone with the reload, so the note goes through sessionStorage and is
// shown once (read when the group mounts, spent in an effect). Each access is wrapped, since storage can be blocked or throw in a private window; without it the restore simply says nothing after the reload.
const KEY = "middle-earth-player.restored";

/** What the Saves group says after a restore has reloaded the page: the backup's file name. */
export function restoredLine(name: string): string {
  return `Restored ${name}. Every campaign, game, deck, run and setting on this computer is now the backup's.`;
}

/** Leave the restored file's name for the page that opens after the reload. */
export function rememberRestored(name: string): void {
  try {
    sessionStorage.setItem(KEY, name);
  } catch {
    // Storage is blocked: the restore went through and the page says nothing about it.
  }
}

/** The name a restore left, or null. Reading it changes nothing, so a render may read it (StrictMode runs an initializer twice); `clearRestored` spends it. */
export function peekRestored(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Spends the note, so the next visit to Settings (and the next reload) says nothing. */
export function clearRestored(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage is blocked: there is no note to spend.
  }
}
