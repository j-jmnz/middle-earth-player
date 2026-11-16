// What a release's desktop job takes from desktop/out: the installers each OS builds (desktop/electron-builder.yml names them
// `middle-earth-player-v<version>-<os>-<arch>.<ext>`) and the unpacked app the launch check opens. Pure over a folder listing, so a test can feed it one.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { APP_NAME } from "../../desktop/identity.ts";

export type DesktopOs = "win" | "mac" | "linux";

/** The OS a Node platform builds for. */
export const DESKTOP_OS: Readonly<Record<string, DesktopOs>> = { win32: "win", darwin: "mac", linux: "linux" };

/** A GitHub release asset is at most 2 GiB. */
export const ASSET_LIMIT = 2 * 1024 ** 3;

// The `<os>-<arch>` part of each name and the extensions its installers have (docs/releasing.md, Jobs).
const INSTALLERS: Readonly<Record<DesktopOs, { target: string; extensions: readonly string[] }>> = {
  win: { target: "win-x64", extensions: ["exe", "zip"] },
  mac: { target: "mac-universal", extensions: ["dmg"] },
  linux: { target: "linux-x64", extensions: ["AppImage", "deb"] },
};

/** The installers one OS's build must have made. */
export function installerNames(os: DesktopOs, version: string): string[] {
  const { target, extensions } = INSTALLERS[os];
  return extensions.map((extension) => `middle-earth-player-v${version}-${target}.${extension}`);
}

/** The name a release carries for a built installer: a dry run's artifacts say so, as the APK's and the IPA's do (`-dry-run` after the version). */
export function stagedName(name: string, version: string, suffix: string): string {
  return suffix === "" ? name : name.replace(`-v${version}-`, `-v${version}${suffix}-`);
}

/** The installers in `files` that are missing, and an error-ready list of what is there instead. */
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
