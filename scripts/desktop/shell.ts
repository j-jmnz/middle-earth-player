// What the desktop commands share: the version a build carries, the shell's bundle (desktop/main.ts and preload.ts, bundled by esbuild into desktop/build/app with
// the package.json electron-builder reads) and the web export a desktop build serves. Folders: desktop/build/app (the shell), desktop/build/web (the export a
// package carries), desktop/build/web-e2e (the seeded export the smoke test serves), desktop/out (installers); all gitignored.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { build } from "esbuild";

import { APP_NAME } from "../../desktop/identity.ts";
import type { Log } from "../log.ts";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const BUILD = path.join(ROOT, "desktop", "build");
export const APP_DIR = path.join(BUILD, "app");
export const WEB_DIR = path.join(BUILD, "web");
export const WEB_E2E_DIR = path.join(BUILD, "web-e2e");
export const OUT_DIR = path.join(ROOT, "desktop", "out");

// app.config.js stamps the phone's version from APP_VERSION and rejects anything but <major>.<minor>.<patch>; the desktop build takes the same variable and the same check.
const { versionCodeOf } = createRequire(import.meta.url)("../../app.config.js") as { versionCodeOf: (version: string) => number };

/** The version a desktop build carries: APP_VERSION when set (the release workflow sets it from the tag), otherwise package.json's 0.0.0. */
export function desktopVersion(appVersion: string | undefined): string {
  if (!appVersion) return "0.0.0";
  versionCodeOf(appVersion);
  return appVersion;
}

/** The package.json electron-builder reads from desktop/build/app: the shell's entry and its name, with no dependency (the bundle holds everything but Electron). */
export function appPackage(version: string): Record<string, unknown> {
  return {
    name: "middle-earth-player",
    productName: APP_NAME,
    version,
    description: "An offline app for playing The Lord of the Rings: The Card Game solo. Fan-made, not affiliated with Fantasy Flight Games.",
    license: "MIT",
    homepage: "https://github.com/j-jmnz/middle-earth-player#readme",
    author: { name: "Middle-Earth Player contributors", email: "noreply@users.noreply.github.com" },
    main: "main.js",
  };
}

/** Bundles the main process and the preload into desktop/build/app. */
export async function bundleShell(log: Log, version: string): Promise<void> {
  rmSync(APP_DIR, { recursive: true, force: true });
  mkdirSync(APP_DIR, { recursive: true });
  await log.stepAsync("esbuild desktop/main.ts and preload.ts", async () => {
    await build({
      entryPoints: { main: path.join(ROOT, "desktop", "main.ts"), preload: path.join(ROOT, "desktop", "preload.ts") },
      outdir: APP_DIR,
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node22",
      external: ["electron"],
      minify: false,
      sourcemap: false,
      logLevel: "warning",
    });
  });
  writeFileSync(path.join(APP_DIR, "package.json"), `${JSON.stringify(appPackage(version), null, 2)}\n`);
}

export type ExportOptions = { out: string; env?: Record<string, string> };

/** Exports the web build for the desktop (`expo export -p web` with EXPO_PUBLIC_DESKTOP=1) into `out`. The packs it serves (pnpm assets) are made before. */
export function exportDesktopWeb(log: Log, { out, env }: ExportOptions): void {
  log.step(`expo export -p web (desktop) to ${path.relative(ROOT, out)}`, () => {
    execFileSync("pnpm", ["exec", "expo", "export", "-p", "web", "--output-dir", out], {
      cwd: ROOT,
      shell: process.platform === "win32",
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, EXPO_PUBLIC_DESKTOP: "1", EXPO_NO_TELEMETRY: "1", EXPO_OFFLINE: "1", CI: "1", ...env },
    });
  });
}

/** Runs `pnpm assets <packs>` (every pack when none is named). */
export function packAssets(log: Log, packs: readonly string[], extra: readonly string[] = []): void {
  log.step(`pnpm assets ${packs.join(" ")}`.trim(), () => {
    execFileSync("pnpm", ["assets", ...packs, ...extra], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32" });
  });
}
