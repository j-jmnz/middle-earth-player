import { execFileSync } from "node:child_process";

import { parse as parseJsonc } from "jsonc-parser";

import { fetchText, writeRaw, type SourceFile, type SourceRecord } from "./fetch.ts";

const REPO = "https://github.com/seastan/dragncards-lotrlcg-plugin";
const RAW = "https://raw.githubusercontent.com/seastan/dragncards-lotrlcg-plugin";

// path in the plugin repo -> name under data/raw/dragncards. Two of the JSON files carry // comments.
const FILES: readonly { from: string; to: string; jsonc?: boolean }[] = [
  { from: "tsvs/cardDb.tsv", to: "cardDb.tsv" },
  { from: "jsons/preBuiltDecks.json", to: "preBuiltDecks.json", jsonc: true },
  { from: "jsons/steps.json", to: "steps.json" },
  { from: "jsons/phases.json", to: "phases.json" },
  { from: "jsons/imageUrlPrefix.json", to: "imageUrlPrefix.json" },
  { from: "jsons/playerCards.json", to: "playerCards.json", jsonc: true },
  { from: "jsons/encounterCards.json", to: "encounterCards.json", jsonc: true },
];

function headSha(): string {
  const out = execFileSync("git", ["ls-remote", REPO, "HEAD"], { encoding: "utf8" });
  const sha = out.split(/\s/)[0];
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Could not read the HEAD of ${REPO}`);
  return sha;
}

export async function syncDragnCards(): Promise<SourceRecord> {
  const sha = headSha();
  const files: SourceFile[] = [];
  for (const file of FILES) {
    const url = `${RAW}/${sha}/${file.from}`;
    const body = await fetchText(url);
    if (file.jsonc) {
      const errors: unknown[] = [];
      parseJsonc(body, errors as never[]);
      if (errors.length > 0) throw new Error(`${file.from} is not valid JSON with comments`);
    } else if (file.to.endsWith(".json")) {
      JSON.parse(body);
    }
    files.push(writeRaw(`dragncards/${file.to}`, url, body));
  }
  return { id: "dragncards", site: REPO, pin: { kind: "git", value: sha }, fetchedAt: new Date().toISOString(), files };
}
