// `pnpm desktop pack`: electron-builder for the OS it runs on (desktop/electron-builder.yml names the targets), into desktop/out. It builds first unless `--skip-build`
// (the release workflow downloads the web export instead), and passes the version (APP_VERSION) and the installed Electron's version on the command line. Extra
// arguments go to electron-builder (`--dir` makes the unpacked app only).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, verbose, type Log } from "../log.ts";
import { APP_DIR, bundleShell, desktopVersion, exportDesktopWeb, OUT_DIR, packAssets, pnpmCommand, ROOT, WEB_DIR } from "./shell.ts";

const PLATFORM_FLAGS: Readonly<Record<string, string>> = { linux: "--linux", win32: "--win", darwin: "--mac" };

/**
 * The electron-builder arguments for a version on a platform; `extra` is passed on after them. `cache` (the `electron_config_cache` the release job sets, which
 * Electron's own install reads too) is where electron-builder keeps the Electron zips it unpacks; without it they go to the OS's cache folder, which CI does not keep.
 */
export function builderArgs(version: string, electronVersion: string, platform: string, extra: readonly string[], cache?: string): string[] {
  const flag = PLATFORM_FLAGS[platform];
  if (!flag) throw new Error(`No desktop target for ${platform}`);
  const cached = cache ? [`-c.electronDownload.cache=${cache}`] : [];
  return ["exec", "electron-builder", "--config", "desktop/electron-builder.yml", flag, `-c.extraMetadata.version=${version}`, `-c.electronVersion=${electronVersion}`, ...cached, "--publish", "never", ...extra];
}

async function main(log: Log): Promise<void> {
  const own = new Set(["--skip-build", "--skip-assets", "--optional", "--verbose", "--quiet"]);
  const extra = process.argv.slice(2).filter((arg) => !own.has(arg));
  const version = desktopVersion(process.env["APP_VERSION"]);
  if (process.argv.includes("--skip-build")) await bundleShell(log, version);
  else {
    if (!process.argv.includes("--skip-assets")) packAssets(log, [], process.argv.includes("--optional") ? ["--optional"] : []);
    exportDesktopWeb(log, { out: WEB_DIR });
    await bundleShell(log, version);
  }
  const electronVersion = (createRequire(import.meta.url)("electron/package.json") as { version: string }).version;
  const args = builderArgs(version, electronVersion, process.platform, extra, process.env["electron_config_cache"]);
  log.info(`pnpm ${args.join(" ")} (app ${path.relative(ROOT, APP_DIR)}, output ${path.relative(ROOT, OUT_DIR)})`);
  // electron-builder's progress shows under --verbose; a failure prints all of it.
  const pnpm = pnpmCommand(args);
  const child = spawnSync(pnpm.command, pnpm.args, { cwd: ROOT, shell: pnpm.shell, stdio: verbose() ? "inherit" : ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (child.status !== 0) {
    if (!verbose()) process.stderr.write(`${child.stdout ?? ""}${child.stderr ?? ""}`);
    throw new Error(`electron-builder failed (${child.status ?? child.signal})`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runScript("desktop:pack", main);
