import type { PrintedKeywords } from "../../../src/catalog/boundary.ts";

export type KeywordResult = { keywords: PrintedKeywords; unknown: string[] };

const FLAGS: Readonly<Record<string, keyof PrintedKeywords>> = {
  surge: "surge",
  peril: "peril",
  indestructible: "indestructible",
  permanent: "permanent",
  sentinel: "sentinel",
  ranged: "ranged",
  "immune to player card effects": "immune",
};

const NUMBERED: Readonly<Record<string, keyof PrintedKeywords>> = {
  hide: "hide",
  doomed: "doomed",
  archery: "archery",
  toughness: "toughness",
};

// Hall of Beorn lists one keyword per entry, with the trailing period: "Hide 2.", "Surge.".
export function parseKeywordTokens(tokens: readonly string[]): KeywordResult {
  const keywords: Record<string, boolean | number> = {};
  const unknown: string[] = [];
  // Hall of Beorn sometimes joins two on one entry: "Peril. Toughness 1".
  for (const raw of tokens.flatMap((entry) => entry.split(/\.\s+/))) {
    const token = raw.trim().replace(/\.$/, "");
    const lower = token.toLowerCase();
    const flag = FLAGS[lower];
    if (flag) {
      keywords[flag] = true;
      continue;
    }
    const numbered = /^([a-z]+) (\d+)$/.exec(lower);
    const key = numbered?.[1] ? NUMBERED[numbered[1]] : undefined;
    if (key && numbered?.[2]) {
      keywords[key] = Number(numbered[2]);
      continue;
    }
    if (token !== "") unknown.push(token);
  }
  return { keywords: keywords as PrintedKeywords, unknown };
}
