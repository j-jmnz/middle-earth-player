// How long a synchronous SQLite call on the web waits for its worker. expo-sqlite's own loop gives up after a count of spins (a million `Atomics.pause()` calls),
// which is tens to hundreds of milliseconds on a recent Chromium, so a slow OPFS flush made an accepted intent's synchronous save throw. The wait here is a wall-clock
// deadline instead (docs/architecture.md, Persistence). The save stays synchronous.

import { span } from "../../../ui/web/meter-span";

// The longest a save waits for the worker before it throws "Sync operation timeout".
export const SYNC_WAIT_LIMIT_MS = 15_000;
// The clock is read once every this many spins, so the loop is not slowed by reading it.
export const SYNC_CLOCK_EVERY = 1024;

/** Tells the web app's test meter how long the page waited for the worker (src/ui/web/meter-span.ts). */
export function noteSyncWait(startedAt: number, now: number): void {
  span("db", now - startedAt);
}

// True once `now` is `limitMs` or more past `startedAt`.
export function syncWaitExpired(startedAt: number, now: number, limitMs: number = SYNC_WAIT_LIMIT_MS): boolean {
  return now - startedAt >= limitMs;
}

// The size of the buffer a synchronous call's answer comes back in (expo-sqlite's own limit for one answer).
export const SYNC_RESULT_BYTES = 1024 * 1024;

export type SyncBuffers = { lockBuffer: SharedArrayBuffer; resultBuffer: SharedArrayBuffer };

let spare: SyncBuffers | null = null;

/**
 * The lock and the answer's buffer for one synchronous call. expo-sqlite makes both anew for every call, and an answer's buffer is a megabyte: the 280 reads
 * that open a campaign left 280 MB for the page's and the worker's garbage collectors, and Safari's engine drew the page slowly until both had run. The
 * page waits for each call's answer before it makes the next, so one pair serves them all. A call takes the pair and gives it back when its answer is read.
 * A call that timed out does not give it back: the worker may still write its late answer there, so the next call makes a new pair.
 */
export function takeSyncBuffers(): SyncBuffers {
  const buffers = spare ?? { lockBuffer: new SharedArrayBuffer(4), resultBuffer: new SharedArrayBuffer(SYNC_RESULT_BYTES) };
  spare = null;
  return buffers;
}

/** Gives the pair back once the call's answer is copied out of it. */
export function giveBackSyncBuffers(buffers: SyncBuffers): void {
  spare = buffers;
}
