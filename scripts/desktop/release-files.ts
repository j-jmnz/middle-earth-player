// What a release's desktop job takes from desktop/out: the installers each OS builds (desktop/electron-builder.yml names them
// `middle-earth-player-v<version>-<os>-<arch>.<ext>`, and the AppImage `middle-earth-player-v<version>-x86_64.AppImage`, as the AppImage catalog asks: no OS
// in its name) and the unpacked app the launch check opens. Pure over a folder listing, so a test can feed it one.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { APP_NAME } from "../../desktop/identity.ts";

export type DesktopOs = "win" | "mac" | "linux";

/** The OS a Node platform builds for. */
export const DESKTOP_OS: Readonly<Record<string, DesktopOs>> = { win32: "win", darwin: "mac", linux: "linux" };

/** A GitHub release asset is at most 2 GiB. */
export const ASSET_LIMIT = 2 * 1024 ** 3;

// What follows the version in each installer's name (docs/releasing.md, Jobs).
const INSTALLERS: Readonly<Record<DesktopOs, readonly string[]>> = {
  win: ["win-x64.exe", "win-x64.zip"],
  mac: ["mac-universal.dmg"],
  linux: ["x86_64.AppImage", "linux-x64.deb"],
};

/** The installers one OS's build must have made. */
export function installerNames(os: DesktopOs, version: string): string[] {
  return INSTALLERS[os].map((ending) => `middle-earth-player-v${version}-${ending}`);
}

/** The `.zsync` files every release's AppImage points to: a dry run's carry `-dry-run` after the version and still match. */
export const ZSYNC_GLOB = "middle-earth-player-*-x86_64.AppImage.zsync";

/**
 * The AppImage's update information for a repository (`owner/name`): AppImageUpdate and the AppImage managers look for the newest GitHub release's `.zsync`
 * file that matches ZSYNC_GLOB (the AppImage specification, update information, gh-releases-zsync).
 */
export function updateInfo(repository: string): string {
  const [owner, name, ...rest] = repository.split("/");
  if (!owner || !name || rest.length > 0) throw new Error(`a repository is owner/name, not ${repository}`);
  return `gh-releases-zsync|${owner}|${name}|latest|${ZSYNC_GLOB}`;
}

/** The name a release carries for a built installer: a dry run's artifacts say so, as the APK's and the IPA's do (`-dry-run` after the version). */
export function stagedName(name: string, version: string, suffix: string): string {
  return suffix === "" ? name : name.replace(`-v${version}-`, `-v${version}${suffix}-`);
}

/** The installers this OS makes that `files` lacks. */
export function missingInstallers(os: DesktopOs, version: string, files: readonly string[]): string[] {
  return installerNames(os, version).filter((name) => !files.includes(name));
}

/** The executable the launch check opens: the AppImage on Linux, the unpacked app next to the installers on Windows and macOS. */
export function packedApp(os: DesktopOs, version: string, outDir: string): string {
  if (os === "linux") return path.join(outDir, installerNames(os, version).find((name) => name.endsWith(".AppImage")) ?? "");
  if (os === "win") return path.join(outDir, "win-unpacked", `${APP_NAME}.exe`);
  const folder = readdirSync(outDir).find((name) => /^mac/.test(name) && existsSync(path.join(outDir, name, `${APP_NAME}.app`)));
  if (!folder) throw new Error(`no ${APP_NAME}.app in a mac* folder of ${outDir}`);
  return path.join(outDir, folder, `${APP_NAME}.app`, "Contents", "MacOS", APP_NAME);
}
