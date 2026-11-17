// The booklets a player adds live in the browser's origin private file system (OPFS), in a `booklets/` directory of their own beside the one
// expo-sqlite's worker keeps its databases in (`expo-sqlite`), so the two never meet. A stored book is addressed as `opfs:booklets/<id>.pdf`:
// the reader reads the file's bytes itself, so no object URL is ever made and none can leak.
export const OPFS_SCHEME = "opfs:";

export function opfsUri(path: string): string {
  return `${OPFS_SCHEME}${path}`;
}

export function isOpfsUri(uri: string): boolean {
  return uri.startsWith(OPFS_SCHEME);
}

export function opfsPathOf(uri: string): string {
  return uri.slice(OPFS_SCHEME.length);
}

type Place = { directories: readonly string[]; name: string };

function placeOf(path: string): Place {
  const parts = path.split("/").filter((part) => part !== "");
  const name = parts.pop();
  if (!name || parts.some((part) => part === "..")) throw new Error(`Not a stored path: ${path}`);
  return { directories: parts, name };
}

async function directoryOf(place: Place, create: boolean): Promise<FileSystemDirectoryHandle> {
  let directory = await navigator.storage.getDirectory();
  for (const part of place.directories) directory = await directory.getDirectoryHandle(part, { create });
  return directory;
}

export function opfsAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function";
}

export async function readOpfsFile(path: string): Promise<File> {
  const place = placeOf(path);
  const directory = await directoryOf(place, false);
  const handle = await directory.getFileHandle(place.name);
  return handle.getFile();
}

/** Replaces the file in one commit: a failed write leaves the book that was there (createWritable swaps its temporary file in on close). */
export async function writeOpfsFile(path: string, content: Blob): Promise<void> {
  const place = placeOf(path);
  const directory = await directoryOf(place, true);
  const handle = await directory.getFileHandle(place.name, { create: true });
  if (typeof handle.createWritable !== "function") throw new Error("This browser cannot store files.");
  const writable = await handle.createWritable();
  try {
    await writable.write(content);
    await writable.close();
  } catch (error: unknown) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}
