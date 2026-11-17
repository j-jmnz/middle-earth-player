import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ASSET_LIMIT, DESKTOP_OS, installerNames, missingInstallers, packedApp, stagedName } from "./release-files.ts";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function outDir(files: readonly string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), "desktop-out-"));
  folders.push(dir);
  for (const file of files) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), "");
  }
  return dir;
}

describe("installerNames (desktop/electron-builder.yml, artifactName)", () => {
  it("is each OS's installers, named middle-earth-player-v<version>-<os>-<arch>.<ext>", () => {
    expect(installerNames("win", "1.2.3")).toEqual(["middle-earth-player-v1.2.3-win-x64.exe", "middle-earth-player-v1.2.3-win-x64.zip"]);
    expect(installerNames("mac", "1.2.3")).toEqual(["middle-earth-player-v1.2.3-mac-universal.dmg"]);
    expect(installerNames("linux", "1.2.3")).toEqual(["middle-earth-player-v1.2.3-linux-x64.AppImage", "middle-earth-player-v1.2.3-linux-x64.deb"]);
  });

  it("maps Node's platforms to the three OSes and keeps the 2 GiB limit", () => {
    expect(DESKTOP_OS).toEqual({ win32: "win", darwin: "mac", linux: "linux" });
    expect(ASSET_LIMIT).toBe(2147483648);
  });

  it("lists what a build is missing", () => {
    expect(missingInstallers("linux", "1.2.3", ["middle-earth-player-v1.2.3-linux-x64.deb"])).toEqual(["middle-earth-player-v1.2.3-linux-x64.AppImage"]);
    expect(missingInstallers("mac", "1.2.3", installerNames("mac", "1.2.3"))).toEqual([]);
  });
});

describe("stagedName", () => {
  it("marks a dry run after the version, as the APK and the IPA are, and leaves a release's name alone", () => {
    expect(stagedName("middle-earth-player-v1.2.3-win-x64.exe", "1.2.3", "-dry-run")).toBe("middle-earth-player-v1.2.3-dry-run-win-x64.exe");
    expect(stagedName("middle-earth-player-v1.2.3-win-x64.exe", "1.2.3", "")).toBe("middle-earth-player-v1.2.3-win-x64.exe");
  });
});

describe("packedApp", () => {
  it("is the AppImage on Linux, the unpacked exe on Windows and the executable inside the .app on macOS", () => {
    expect(packedApp("linux", "1.2.3", "/o")).toBe(path.join("/o", "middle-earth-player-v1.2.3-linux-x64.AppImage"));
    expect(packedApp("win", "1.2.3", "/o")).toBe(path.join("/o", "win-unpacked", "Middle-Earth Player.exe"));
    const dir = outDir(["mac-universal/Middle-Earth Player.app/Contents/MacOS/Middle-Earth Player", "middle-earth-player-v1.2.3-mac-universal.dmg"]);
    expect(packedApp("mac", "1.2.3", dir)).toBe(path.join(dir, "mac-universal", "Middle-Earth Player.app", "Contents", "MacOS", "Middle-Earth Player"));
  });

  it("says so when macOS left no .app", () => {
    expect(() => packedApp("mac", "1.2.3", outDir(["a.dmg"]))).toThrow("no Middle-Earth Player.app");
  });
});
