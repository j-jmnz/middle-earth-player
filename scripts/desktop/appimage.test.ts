import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readUpdateInfo, writeUpdateInfo } from "./appimage.ts";
import { updateInfo, ZSYNC_GLOB } from "./release-files.ts";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A minimal little-endian ELF64 file laid out as a type-2 AppImage runtime is: the AppImage magic at byte 8, then a null section, `.upd_info` and the section names. */
function runtime(options: { magic?: string; updInfoSize?: number; sectionName?: string } = {}): string {
  const names = Buffer.from(`\0${options.sectionName ?? ".upd_info"}\0.shstrtab\0`, "latin1");
  const updSize = options.updInfoSize ?? 32;
  const updOffset = 64;
  const namesOffset = updOffset + updSize;
  const tableOffset = namesOffset + names.length;
  const file = Buffer.alloc(tableOffset + 3 * 64);
  file.writeUInt32BE(0x7f454c46, 0);
  file[4] = 2;
  file[5] = 1;
  file.write(options.magic ?? "AI\u0002", 8, "latin1");
  file.writeBigUInt64LE(BigInt(tableOffset), 0x28);
  file.writeUInt16LE(64, 0x3a);
  file.writeUInt16LE(3, 0x3c);
  file.writeUInt16LE(2, 0x3e);
  const section = (index: number, name: number, offset: number, size: number): void => {
    const at = tableOffset + index * 64;
    file.writeUInt32LE(name, at);
    file.writeBigUInt64LE(BigInt(offset), at + 0x18);
    file.writeBigUInt64LE(BigInt(size), at + 0x20);
  };
  section(1, 1, updOffset, updSize);
  section(2, names.indexOf(".shstrtab"), namesOffset, names.length);
  names.copy(file, namesOffset);
  file.fill(0xaa, updOffset, updOffset + updSize);
  const dir = mkdtempSync(path.join(tmpdir(), "appimage-"));
  folders.push(dir);
  const out = path.join(dir, "app.AppImage");
  writeFileSync(out, file);
  return out;
}

describe("writeUpdateInfo (the AppImage specification, update information)", () => {
  it("writes the update information into .upd_info, zero-padded, and changes no other byte", () => {
    const file = runtime();
    const before = readFileSync(file);
    writeUpdateInfo(file, "gh-releases-zsync|a|b");
    const after = readFileSync(file);
    expect(readUpdateInfo(file)).toBe("gh-releases-zsync|a|b");
    expect(after.subarray(64 + 21, 64 + 32).every((byte) => byte === 0)).toBe(true);
    expect(after.subarray(0, 64)).toEqual(before.subarray(0, 64));
    expect(after.subarray(96)).toEqual(before.subarray(96));
  });

  it("refuses a file that is not a type-2 AppImage, has no .upd_info or is too small for the text", () => {
    expect(() => writeUpdateInfo(runtime({ magic: "AI\u0001" }), "x")).toThrow(/not a type-2 AppImage/);
    expect(() => writeUpdateInfo(runtime({ sectionName: ".other" }), "x")).toThrow(/no \.upd_info section/);
    expect(() => writeUpdateInfo(runtime({ updInfoSize: 8 }), "gh-releases-zsync")).toThrow(/holds 7/);
  });
});

describe("updateInfo", () => {
  it("points at the newest GitHub release's .zsync file for the AppImage", () => {
    expect(updateInfo("j-jmnz/middle-earth-player")).toBe(`gh-releases-zsync|j-jmnz|middle-earth-player|latest|${ZSYNC_GLOB}`);
    expect(ZSYNC_GLOB).toBe("middle-earth-player-*-x86_64.AppImage.zsync");
    expect(() => updateInfo("middle-earth-player")).toThrow(/owner\/name/);
  });

  // The runtime electron-builder ships has a 1024-byte .upd_info section (read from the v0.8.0 AppImage), so the text must stay well under it.
  it("fits the runtime's 1024-byte section", () => {
    expect(Buffer.byteLength(updateInfo("j-jmnz/middle-earth-player"))).toBeLessThan(1024);
  });
});
