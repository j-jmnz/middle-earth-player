// `pnpm desktop pack`: electron-builder for the OS it runs on (desktop/electron-builder.yml names the targets), into desktop/out. It builds first unless `--skip-build`
// (the release workflow downloads the web export instead), and passes the version (APP_VERSION) and the installed Electron's version on the command line. Extra
// arguments go to electron-builder (`--dir` makes the unpacked app only).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { runScript, type Log } from "../log.ts";
import { APP_DIR, bundleShell, desktopVersion, exportDesktopWeb, OUT_DIR, packAssets, ROOT, WEB_DIR } from "./shell.ts";

const PLATFORM_FLAGS: Readonly<Record<string, string>> = { linux: "--linux", win32: "--win", darwin: "--mac" };

/** The electron-builder arguments for a version on a platform; `extra` is passed on after them. */
export function builderArgs(version: string, electronVersion: string, platform: string, extra: readonly string[]): string[] {
  const flag = PLATFORM_FLAGS[platform];
  if (!flag) throw new Error(`No desktop target for ${platform}`);
  return ["exec", "electron-builder", "--config", "desktop/electron-builder.yml", flag, `-c.extraMetadata.version=${version}`, `-c.electronVersion=${electronVersion}`, "--publish", "never", ...extra];
}

async function main(log: Log): Promise<void> {
  const own = new Set(["--skip-build", "--skip-assets", "--optional"]);
  const extra = process.argv.slice(2).filter((arg) => !own.has(arg));
  const version = desktopVersion(process.env["APP_VERSION"]);
  if (process.argv.includes("--skip-build")) await bundleShell(log, version);
  else {
    if (!process.argv.includes("--skip-assets")) packAssets(log, [], process.argv.includes("--optional") ? ["--optional"] : []);
    exportDesktopWeb(log, { out: WEB_DIR });
    await bundleShell(log, version);
  }
  const electronVersion = (createRequire(import.meta.url)("electron/package.json") as { version: string }).version;
  const args = builderArgs(version, electronVersion, process.platform, extra);
  log.info(`pnpm ${args.join(" ")} (app ${path.relative(ROOT, APP_DIR)}, output ${path.relative(ROOT, OUT_DIR)})`);
  const child = spawnSync("pnpm", args, { cwd: ROOT, stdio: "inherit" });
  if (child.status !== 0) throw new Error(`electron-builder failed (${child.status ?? child.signal})`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) await runScript("desktop:pack", main);
