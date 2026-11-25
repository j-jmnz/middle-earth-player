// The browser's half of the web app's saves (memory-databases.ts): reading the two snapshot files (snapshot.ts) from the origin's private file storage, and writing one
// from a worker of its own. Safari's engine writes such a file only through a sync access handle, which only a worker has; and that worker must not be expo-sqlite's,
// because the page waits on that one for every database call, and on Safari a worker growing a file waits on the page.
import { decodeSnapshot, HEADER_BYTES, newestOf, SLOTS, SNAPSHOT_DIRECTORY, snapshotHeader, type Slot, type Stored } from "./snapshot";

// A file or a lock that is busy is asked again this many times, this far apart: a page that reloads opens while the page before it may still hold the file.
const READ_TRIES = 6;
const READ_WAIT_MS = 250;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The slot's snapshot; null when the file is not there yet or is not a whole snapshot. A file the browser will not hand over (another handle holds it) is asked
 * again, and when it stays held the open fails: reading it as no file would open an empty database and write that over the games.
 */
async function readSlot(directory: FileSystemDirectoryHandle, slot: Slot): Promise<Stored | null> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const file = await (await directory.getFileHandle(slot)).getFile();
      const snapshot = await decodeSnapshot(new Uint8Array(await file.arrayBuffer()));
      return snapshot ? { ...snapshot, slot } : null;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "NotFoundError") return null;
      if (attempt >= READ_TRIES) throw new Error(`The saved games could not be read from storage (${slot}: ${error instanceof Error ? error.message : "unknown error"})`);
      await wait(READ_WAIT_MS);
    }
  }
}

/** The newest whole snapshot in storage, or null on a first launch. */
export async function readNewest(): Promise<Stored | null> {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle(SNAPSHOT_DIRECTORY, { create: true });
  return newestOf(await Promise.all(SLOTS.map((slot) => readSlot(directory, slot))));
}

// The worker's whole program. Each call is awaited, since an older Safari returns a promise from a sync access handle's methods.
const WORKER_SOURCE = `
self.onmessage = async (event) => {
  const { id, directory, name, header, data, at } = event.data;
  try {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle(directory, { create: true });
    const file = await folder.getFileHandle(name, { create: true });
    const handle = await file.createSyncAccessHandle();
    try {
      await handle.write(new Uint8Array(header), { at: 0 });
      await handle.write(new Uint8Array(data), { at });
      await handle.truncate(at + data.byteLength);
      await handle.flush();
    } finally {
      await handle.close();
    }
    self.postMessage({ id });
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message ? error.message : error) });
  }
};
`;

export type SnapshotWriter = (data: Uint8Array, generation: number, slot: Slot) => Promise<void>;

/** Starts the worker and returns the call that writes one snapshot file through it. */
export function snapshotWriter(): SnapshotWriter {
  const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
  const worker = new Worker(url);
  let nextId = 0;
  const waiting = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();
  worker.addEventListener("message", (event: MessageEvent<{ id: number; error?: string }>) => {
    const call = waiting.get(event.data.id);
    if (!call) return;
    waiting.delete(event.data.id);
    if (event.data.error) call.reject(new Error(event.data.error));
    else call.resolve();
  });
  return async (data, generation, slot) => {
    const header = await snapshotHeader(data, generation);
    const id = nextId;
    nextId += 1;
    await new Promise<void>((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      // The data's own buffer goes to the worker (it is this copy's alone: the database worker handed it over for it), so nothing is copied here.
      worker.postMessage({ id, directory: SNAPSHOT_DIRECTORY, name: slot, header: header.buffer, data: data.buffer, at: HEADER_BYTES }, [header.buffer, data.buffer as ArrayBuffer]);
    });
  };
}

const LOCK = "middle-earth-player.user-db";

// One try for the lock: true when this page now holds it.
function tryLock(): Promise<boolean> {
  return new Promise((resolve) => {
    void navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      // Never settles: the lock is held until the page goes.
      return lock ? new Promise<void>(() => undefined) : undefined;
    });
  });
}

/**
 * Whether this page is the only one of the origin with the saves open, and from now on it is: it holds a lock until it closes. Two pages would each keep their own
 * copy in memory and write over the other's file. The lock is asked for a few times, since a page that reloads opens while the page before it still lets go of
 * its own. A browser with no Web Locks is let through.
 */
export async function holdOnlyPage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.locks) return true;
  for (let attempt = 1; attempt <= READ_TRIES; attempt += 1) {
    if (await tryLock()) return true;
    if (attempt < READ_TRIES) await wait(READ_WAIT_MS);
  }
  return false;
}
