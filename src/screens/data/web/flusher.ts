// When the web app's user.db in memory is copied to storage (memory-databases.ts). A write asks for a copy (`note`), and the copies run one at a time: each reads how many
// changes the connection has made, and when that moved since the last copy it serializes the database and hands the bytes on. Writes made while a copy runs are in the next
// one, so a burst of moves costs a few copies, not one each. No browser here, so a test runs it.
import { nextSlot, type Slot } from "./snapshot";

export type FlusherParts = {
  /** SQLite's `total_changes()` of the connection. */
  changes(): Promise<number>;
  serialize(): Promise<Uint8Array>;
  /** Writes one snapshot file; rejects when it was not written. */
  persist(data: Uint8Array, generation: number, slot: Slot): Promise<void>;
  /** The snapshot the database was opened from: its generation and file, and the connection's changes then (0 for a fresh connection). */
  start: { generation: number; slot: Slot | null; changes: number };
  /** Runs `task` soon, off the tap that asked (a zero timeout in the page). */
  soon(task: () => void): void;
  onError(error: unknown): void;
};

export type Flusher = {
  /** A write happened, or may have: copy soon. Cheap, and many calls before the copy runs make one copy. */
  note(): void;
  /** Resolves once a copy that started after this call has finished (a restore reloads the page after it). */
  flush(): Promise<void>;
};

export function createFlusher(parts: FlusherParts): Flusher {
  let generation = parts.start.generation;
  let slot = parts.start.slot;
  let copied = parts.start.changes;
  let queued = false;
  let chain: Promise<void> = Promise.resolve();

  const copy = async (): Promise<void> => {
    try {
      const now = await parts.changes();
      if (now === copied) return;
      const data = await parts.serialize();
      const to = nextSlot(slot);
      await parts.persist(data, generation + 1, to);
      generation += 1;
      slot = to;
      // `now` was read before the bytes were taken: a write between the two is in this file and is copied once more, which costs a file and loses nothing.
      copied = now;
    } catch (error: unknown) {
      parts.onError(error);
    }
  };
  const run = (): Promise<void> => {
    chain = chain.then(copy);
    return chain;
  };

  return {
    note() {
      if (queued) return;
      queued = true;
      parts.soon(() => {
        queued = false;
        void run();
      });
    },
    flush: run,
  };
}
