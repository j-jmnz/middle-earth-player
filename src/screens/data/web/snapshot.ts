// The file the web app keeps user.db in (memory-databases.ts): the database as SQLite serializes it, behind a header that says which copy is newer and whether it is
// whole. Two files take turns (SLOTS), so a write cut short by a closed page damages only the file being written and the other still opens. Pure, so a test runs it.

/** The folder in the origin's private file storage (OPFS), beside expo-sqlite's and the booklets'. */
export const SNAPSHOT_DIRECTORY = "middle-earth-player";
export const SLOTS = ["user-a.snap", "user-b.snap"] as const;
export type Slot = (typeof SLOTS)[number];

// "MEPSNAP1", then the generation (float64), the data's length (uint32), its SHA-256, and the data.
const MAGIC = [0x4d, 0x45, 0x50, 0x53, 0x4e, 0x41, 0x50, 0x31];
const GENERATION_AT = 8;
const LENGTH_AT = 16;
const HASH_AT = 20;
export const HEADER_BYTES = 52;

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data.slice().buffer));
}

/** The file for `data` as generation `generation` (a whole number that grows by one with each file written). */
export async function encodeSnapshot(data: Uint8Array, generation: number): Promise<Uint8Array> {
  const file = new Uint8Array(HEADER_BYTES + data.length);
  const view = new DataView(file.buffer);
  file.set(MAGIC, 0);
  view.setFloat64(GENERATION_AT, generation);
  view.setUint32(LENGTH_AT, data.length);
  file.set(await sha256(data), HASH_AT);
  file.set(data, HEADER_BYTES);
  return file;
}

export type Snapshot = { generation: number; data: Uint8Array };

/** What a file holds, or null when it is not a whole snapshot: another file, a write cut short, or bytes that changed. */
export async function decodeSnapshot(file: Uint8Array): Promise<Snapshot | null> {
  if (file.length < HEADER_BYTES || MAGIC.some((byte, index) => file[index] !== byte)) return null;
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const generation = view.getFloat64(GENERATION_AT);
  const length = view.getUint32(LENGTH_AT);
  if (!Number.isSafeInteger(generation) || generation < 1 || file.length !== HEADER_BYTES + length) return null;
  const data = file.slice(HEADER_BYTES);
  const hash = await sha256(data);
  if (hash.some((byte, index) => file[HASH_AT + index] !== byte)) return null;
  return { generation, data };
}

export type Stored = Snapshot & { slot: Slot };

/** The newer of the two files' snapshots, or null when neither is whole. */
export function newestOf(stored: readonly (Stored | null)[]): Stored | null {
  let best: Stored | null = null;
  for (const each of stored) if (each && (!best || each.generation > best.generation)) best = each;
  return best;
}

/** The file the next snapshot goes to: never the one that holds the newest whole copy. */
export function nextSlot(last: Slot | null): Slot {
  return last === SLOTS[0] ? SLOTS[1] : SLOTS[0];
}
