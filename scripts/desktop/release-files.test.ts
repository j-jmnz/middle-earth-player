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
  it("is each OS's installers, named middle-earth-player-<os>-<arch>.<ext> with no version", () => {
    expect(installerNames("win")).toEqual(["middle-earth-player-win-x64.exe", "middle-earth-player-win-x64.zip"]);
    expect(installerNames("mac")).toEqual(["middle-earth-player-mac-universal.dmg"]);
    expect(installerNames("linux")).toEqual(["middle-earth-player-linux-x64.AppImage", "middle-earth-player-linux-x64.deb"]);
  });

  it("maps Node's platforms to the three OSes and keeps the 2 GiB limit", () => {
    expect(DESKTOP_OS).toEqual({ win32: "win", darwin: "mac", linux: "linux" });
    expect(ASSET_LIMIT).toBe(2147483648);
  });

  it("lists what a build is missing", () => {
    expect(missingInstallers("linux", ["middle-earth-player-linux-x64.deb"])).toEqual(["middle-earth-player-linux-x64.AppImage"]);
    expect(missingInstallers("mac", installerNames("mac"))).toEqual([]);
  });
});

describe("stagedName", () => {
  it("marks a dry run after the app's name, as the APK and the IPA are, and leaves a release's name alone", () => {
    expect(stagedName("middle-earth-player-win-x64.exe", "-dry-run")).toBe("middle-earth-player-dry-run-win-x64.exe");
    expect(stagedName("middle-earth-player-win-x64.exe", "")).toBe("middle-earth-player-win-x64.exe");
  });
});

describe("packedApp", () => {
  it("is the AppImage on Linux, the unpacked exe on Windows and the executable inside the .app on macOS", () => {
    expect(packedApp("linux", "/o")).toBe(path.join("/o", "middle-earth-player-linux-x64.AppImage"));
    expect(packedApp("win", "/o")).toBe(path.join("/o", "win-unpacked", "Middle-Earth Player.exe"));
    const dir = outDir(["mac-universal/Middle-Earth Player.app/Contents/MacOS/Middle-Earth Player", "middle-earth-player-mac-universal.dmg"]);
    expect(packedApp("mac", dir)).toBe(path.join(dir, "mac-universal", "Middle-Earth Player.app", "Contents", "MacOS", "Middle-Earth Player"));
  });

  it("says so when macOS left no .app", () => {
    expect(() => packedApp("mac", outDir(["a.dmg"]))).toThrow("no Middle-Earth Player.app");
  });
});
