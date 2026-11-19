// The AppImage's update information (docs/releasing.md, Jobs): a type-2 AppImage's runtime is an ELF file with an empty `.upd_info` section, which AppImageUpdate
// and the AppImage managers read to find the next release's `.zsync` file. electron-builder leaves it empty, so `pnpm desktop stage` writes it into the release copy
// in place: only the section's bytes change, nothing is repacked. The ELF header and section table are read with positional reads, so a gigabyte AppImage is never
// loaded whole.
import { closeSync, openSync, readSync, writeSync } from "node:fs";

/** Where the AppImage's `.upd_info` section is and how many bytes it holds. */
export interface Section {
  readonly offset: number;
  readonly size: number;
}

function readAt(fd: number, offset: number, length: number): Buffer {
  const buffer = Buffer.alloc(length);
  const read = readSync(fd, buffer, 0, length, offset);
  if (read !== length) throw new Error(`short read at ${offset}: ${read} of ${length} bytes`);
  return buffer;
}

/** The named section of a little-endian ELF64 file, as its section header table gives it, or null when there is none. Throws on a file that is not one. */
export function findSection(fd: number, name: string): Section | null {
  const header = readAt(fd, 0, 64);
  if (header.readUInt32BE(0) !== 0x7f454c46) throw new Error("not an ELF file");
  if (header[4] !== 2 || header[5] !== 1) throw new Error("not a little-endian 64-bit ELF file");
  const tableOffset = Number(header.readBigUInt64LE(0x28));
  const entrySize = header.readUInt16LE(0x3a);
  const count = header.readUInt16LE(0x3c);
  const namesIndex = header.readUInt16LE(0x3e);
  const table = readAt(fd, tableOffset, entrySize * count);
  const entry = (index: number): { name: number; offset: number; size: number } => ({
    name: table.readUInt32LE(index * entrySize),
    offset: Number(table.readBigUInt64LE(index * entrySize + 0x18)),
    size: Number(table.readBigUInt64LE(index * entrySize + 0x20)),
  });
  const names = entry(namesIndex);
  const strings = readAt(fd, names.offset, names.size);
  for (let index = 0; index < count; index += 1) {
    const section = entry(index);
    const end = strings.indexOf(0, section.name);
    if (strings.toString("latin1", section.name, end < 0 ? undefined : end) === name) return { offset: section.offset, size: section.size };
  }
  return null;
}

/** The AppImage's magic: `AI` and type 2 at byte 8, which the runtime that has `.upd_info` carries. */
function isType2(fd: number): boolean {
  const magic = readAt(fd, 8, 3);
  return magic.toString("latin1", 0, 2) === "AI" && magic[2] === 2;
}

/** Writes `info` into the AppImage's `.upd_info` section, zero-padded. Throws when the file is not a type-2 AppImage, has no such section, or `info` does not fit. */
export function writeUpdateInfo(file: string, info: string): void {
  const fd = openSync(file, "r+");
  try {
    if (!isType2(fd)) throw new Error(`${file} is not a type-2 AppImage`);
    const section = findSection(fd, ".upd_info");
    if (!section) throw new Error(`${file} has no .upd_info section`);
    const bytes = Buffer.from(info, "utf8");
    if (bytes.length >= section.size) throw new Error(`the update information is ${bytes.length} bytes; .upd_info holds ${section.size - 1}`);
    const padded = Buffer.alloc(section.size);
    bytes.copy(padded);
    writeSync(fd, padded, 0, padded.length, section.offset);
  } finally {
    closeSync(fd);
  }
}

/** What `.upd_info` holds now, up to its first zero byte. */
export function readUpdateInfo(file: string): string {
  const fd = openSync(file, "r");
  try {
    const section = findSection(fd, ".upd_info");
    if (!section) throw new Error(`${file} has no .upd_info section`);
    const bytes = readAt(fd, section.offset, section.size);
    const end = bytes.indexOf(0);
    return bytes.toString("utf8", 0, end < 0 ? bytes.length : end);
  } finally {
    closeSync(fd);
  }
}
