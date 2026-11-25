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

/** A count as the badge shows it: every digit, grouped by thousands (999, 1,043, 12,345, 1,500,000). */
export function fullCount(count: number): string {
  return String(count).replace(/\B(?=(\d{3})+$)/g, ",");
}

/** The shields.io endpoint file (https://shields.io/badges/endpoint-badge). */
export function badgeOf(count: number): Record<string, unknown> {
  return { schemaVersion: 1, label: "installs", message: fullCount(count), color: "8957E5" };
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
