// A minimal reader for the one file the launch check needs from an app.asar: its package.json. An asar is a Pickle header (four UInt32s, the last is the JSON's length), the
// JSON tree of files with each one's size and offset, and the file bodies after it. Reading it here saves a dependency and works on a file electron-builder just made.
import { existsSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";

type Entry = { files?: Record<string, Entry>; size?: number; offset?: string };

/** The bytes of `name` (a top-level file) inside an asar, or null when it is not there. */
export function readAsarFile(asar: string, name: string): Buffer | null {
  const fd = openSync(asar, "r");
  try {
    const prefix = Buffer.alloc(16);
    readSync(fd, prefix, 0, 16, 0);
    const headerSize = prefix.readUInt32LE(4);
    const jsonLength = prefix.readUInt32LE(12);
    const json = Buffer.alloc(jsonLength);
    readSync(fd, json, 0, jsonLength, 16);
    const entry = (JSON.parse(json.toString("utf8")) as Entry).files?.[name];
    if (entry?.size === undefined || entry.offset === undefined) return null;
    const body = Buffer.alloc(entry.size);
    readSync(fd, body, 0, entry.size, 8 + headerSize + Number(entry.offset));
    return body;
  } finally {
    closeSync(fd);
  }
}

/** Where the app.asar of a packed app's executable is: `resources/` beside a Windows or Linux unpacked app, `../Resources/` for a macOS bundle's binary. */
export function asarOf(executable: string): string | null {
  const dir = path.dirname(executable);
  return [path.join(dir, "resources", "app.asar"), path.join(dir, "..", "Resources", "app.asar")].find((candidate) => existsSync(candidate)) ?? null;
}

/** The version a packed app's package.json carries (electron-builder stamps the tag's), or null for an app whose asar is not beside it (an AppImage). */
export function packedVersion(executable: string): string | null {
  const asar = asarOf(executable);
  const body = asar ? readAsarFile(asar, "package.json") : null;
  return body ? (JSON.parse(body.toString("utf8")) as { version?: string }).version ?? null : null;
}
