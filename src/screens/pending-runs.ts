// Runs that are written after the tap that asked for them (table-session.ts, recordUnclosedRun). A job is queued once and runs
// once: when its turn comes after the next paint (the caller schedules `flushRuns`), or earlier when a reader of the run table
// flushes the queue first (run-store.ts listRuns), so History never lacks a run its player just closed. Pure.
const queue: (() => void)[] = [];

/** Runs every queued job now, in the order queued, each once. A job that throws does not stop the rest. */
export function flushRuns(): void {
  for (const job of queue.splice(0)) {
    try {
      job();
    } catch {
      // A run is a record: the job reports its own failures.
    }
  }
}

/** Queues `job` for the next flush. */
export function queueRun(job: () => void): void {
  queue.push(job);
}

export function pendingRuns(): number {
  return queue.length;
}
