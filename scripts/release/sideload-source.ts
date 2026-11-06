import { readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";
import { parseTag } from "./version.ts";

// The SideStore and AltStore source (docs/releasing.md, Jobs): a JSON file, in AltStore's source format that SideStore reads
// too, attached to every release as `source.json`. A player adds its "latest" URL once, and the app offers each new release
// as an update. It lists only the release it is attached to; the tag's version is its version and app.config.js's build
// number its buildVersion, as in the IPA.
// Usage: pnpm release:source --tag v0.2.0 --ipa <file> --notes <notes.md> --out <source.json>

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const { versionCodeOf } = require("../../app.config.js") as { versionCodeOf: (version: string) => number };

export const SOURCE_NAME = "source.json";
export const BUNDLE_ID = "com.middleearth.lcg";
// React Native's iOS minimum (react-native/scripts/cocoapods/helpers.rb); the README's Install section says the same.
export const MIN_IOS = "15.1";
const DESCRIPTION = "An offline app for playing The Lord of the Rings: The Card Game solo or two-handed, with its campaigns. Fan-made, not affiliated with Fantasy Flight Games.";

export type SourceInput = { repository: string; tag: string; ipaName: string; ipaBytes: number; date: string; notes: string };

/** The URL a player adds in SideStore or AltStore: the newest release's source, which GitHub redirects to. */
export function sourceUrl(repository: string): string {
  return `https://github.com/${repository}/releases/latest/download/${SOURCE_NAME}`;
}

export function sourceOf(input: SourceInput): Record<string, unknown> {
  if (!parseTag(input.tag)) throw new Error(`"${input.tag}" is not a release tag`);
  const version = input.tag.slice(1);
  const site = `https://github.com/${input.repository}`;
  const iconURL = `https://raw.githubusercontent.com/${input.repository}/${input.tag}/assets/images/icon.png`;
  return {
    name: "Middle Earth LCG",
    identifier: `${BUNDLE_ID}.source`,
    subtitle: "Releases of the Middle Earth LCG app",
    website: site,
    iconURL,
    apps: [
      {
        name: "Middle Earth LCG",
        bundleIdentifier: BUNDLE_ID,
        developerName: "Middle Earth LCG contributors",
        subtitle: "The Lord of the Rings: The Card Game, offline",
        localizedDescription: DESCRIPTION,
        iconURL,
        tintColor: "#BED6BA",
        category: "games",
        versions: [
          {
            version,
            buildVersion: String(versionCodeOf(version)),
            date: input.date,
            localizedDescription: input.notes,
            downloadURL: `${site}/releases/download/${input.tag}/${input.ipaName}`,
            size: input.ipaBytes,
            minOSVersion: MIN_IOS,
          },
        ],
        appPermissions: { entitlements: [], privacy: {} },
      },
    ],
    news: [],
  };
}

function flag(args: string[], name: string): string {
  const at = args.indexOf(name);
  const value = at < 0 ? undefined : args[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

function repository(): string {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { repository?: { url?: string } };
  const match = /github\.com\/([^/]+\/[^/.]+)/.exec(pkg.repository?.url ?? "");
  if (!match) throw new Error("no GitHub repository in package.json or GITHUB_REPOSITORY");
  return match[1];
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  const ipa = flag(args, "--ipa");
  const source = sourceOf({
    repository: repository(),
    tag: flag(args, "--tag"),
    ipaName: path.basename(ipa),
    ipaBytes: statSync(ipa).size,
    date: new Date().toISOString(),
    notes: readFileSync(flag(args, "--notes"), "utf8"),
  });
  const out = flag(args, "--out");
  writeFileSync(out, `${JSON.stringify(source, null, 2)}\n`);
  log.debug(`wrote ${out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("release:source", main, { done: false });
