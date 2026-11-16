// How long a synchronous SQLite call on the web waits for its worker. expo-sqlite's own loop gives up after a count of spins (a million `Atomics.pause()` calls),
// which is tens to hundreds of milliseconds on a recent Chromium, so a slow OPFS flush made an accepted intent's synchronous save throw. The wait here is a wall-clock
// deadline instead (docs/architecture.md, Persistence). The save stays synchronous.

// The longest a save waits for the worker before it throws "Sync operation timeout".
export const SYNC_WAIT_LIMIT_MS = 15_000;
// The clock is read once every this many spins, so the loop is not slowed by reading it.
export const SYNC_CLOCK_EVERY = 1024;

// True once `now` is `limitMs` or more past `startedAt`.
export function syncWaitExpired(startedAt: number, now: number, limitMs: number = SYNC_WAIT_LIMIT_MS): boolean {
  return now - startedAt >= limitMs;
}
