import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requiredFlag as flag } from "../args.ts";
import { runScript, type Log } from "../log.ts";

// The README's installs badge (docs/releasing.md, Installs count): the download count of every installer on every release, written as a
// shields.io endpoint file that .github/scripts/publish-installs.sh puts on the `stats` branch. Only the files a player
// installs count: the APK, the IPA and the desktop installers and zip. The `.sha256` files, `source.json` (SideStore and
// AltStore fetch it on every update check) and the certificate fingerprint do not.
// Usage: gh api --paginate --slurp repos/<owner>/<repo>/releases > releases.json
//        pnpm release installs --releases releases.json --out installs.json

export const INSTALLS_NAME = "installs.json";
const INSTALL_FILE = /\.(apk|ipa|exe|zip|dmg|AppImage|deb)$/;

export type ReleaseAssets = { assets?: { name: string; download_count: number }[] };

/** The downloads of every installer on these releases (a `--slurp` of pages, or one page). */
export function installsOf(releases: readonly (ReleaseAssets | readonly ReleaseAssets[])[]): number {
  return releases
    .flat()
    .flatMap((release) => release.assets ?? [])
    .filter((asset) => INSTALL_FILE.test(asset.name))
    .reduce((sum, asset) => sum + asset.download_count, 0);
}

/** A count as a badge shows it: 999, 1.2k, 12k, 1.5M. */
export function shortCount(count: number): string {
  const unit = (size: number, suffix: string): string => {
    const value = count / size;
    const text = value < 10 ? (Math.floor(value * 10) / 10).toFixed(1).replace(/\.0$/, "") : String(Math.floor(value));
    return `${text}${suffix}`;
  };
  if (count >= 1_000_000) return unit(1_000_000, "M");
  if (count >= 1_000) return unit(1_000, "k");
  return String(count);
}

/** The shields.io endpoint file (https://shields.io/badges/endpoint-badge). */
export function badgeOf(count: number): Record<string, unknown> {
  return { schemaVersion: 1, label: "installs", message: shortCount(count), color: "3E5A48" };
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  const releases = JSON.parse(readFileSync(flag(args, "--releases"), "utf8")) as (ReleaseAssets | ReleaseAssets[])[];
  const count = installsOf(releases);
  const out = flag(args, "--out");
  writeFileSync(out, `${JSON.stringify(badgeOf(count))}\n`);
  log.info(`${count} installs, written to ${out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("release:installs", main, { done: false });
