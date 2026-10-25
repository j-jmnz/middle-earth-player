import { execFileSync } from "node:child_process";

import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import { bytes, createLog, type Log } from "../../log.ts";
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
  let out: string;
  try {
    out = execFileSync("git", ["ls-remote", REPO, "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`git ls-remote ${REPO} failed${stderr ? `: ${stderr}` : ""}`, { cause: error });
  }
  const sha = out.split(/\s/)[0];
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Could not read the HEAD of ${REPO}`);
  return sha;
}

export async function syncDragnCards(log: Log = createLog("dragncards")): Promise<SourceRecord> {
  const sha = headSha();
  log.info(`plugin HEAD ${sha.slice(0, 12)}`);
  const files: SourceFile[] = [];
  const tick = log.progress(FILES.length, "file");
  for (const file of FILES) {
    const url = `${RAW}/${sha}/${file.from}`;
    const body = await fetchText(url, undefined, log);
    if (file.jsonc) {
      const errors: ParseError[] = [];
      parseJsonc(body, errors);
      if (errors.length > 0) throw new Error(`${file.from} is not valid JSON with comments (${errors.length} error${errors.length === 1 ? "" : "s"}, first at offset ${errors[0]?.offset})`);
    } else if (file.to.endsWith(".json")) {
      try {
        JSON.parse(body);
      } catch (error) {
        throw new Error(`${file.from} is not valid JSON`, { cause: error });
      }
    }
    files.push(writeRaw(`dragncards/${file.to}`, url, body));
    tick(`${file.from}, ${bytes(body.length)}`);
  }
  return { id: "dragncards", site: REPO, pin: { kind: "git", value: sha }, fetchedAt: new Date().toISOString(), files };
}
