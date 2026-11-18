// Rules: rr.keywords (data/rules/entries.json).
//
// Which printed words are keywords the engine reads. A line that is only keywords is owned by the keyword, not by an effect
// record: the coverage test (scripts/checks/effect-coverage.test.ts) and the app's "not applied" check (active-text.ts) use this one
// reading. Moved from scripts/data/normalize so the app can share it.
import type { PrintedKeywords } from "./boundary.ts";

export type KeywordResult = { keywords: PrintedKeywords; unknown: string[] };

export const FLAGS: Readonly<Record<string, keyof PrintedKeywords>> = {
  surge: "surge",
  ambush: "ambush",
  peril: "peril",
  indestructible: "indestructible",
  permanent: "permanent",
  sentinel: "sentinel",
  ranged: "ranged",
  restricted: "restricted",
  battle: "battle",
  siege: "siege",
  "immune to player card effects": "immune",
  sailing: "sailing",
  uncharted: "uncharted",
  phantom: "phantom",
  dire: "dire",
};

export const NUMBERED: Readonly<Record<string, keyof PrintedKeywords>> = {
  hide: "hide",
  doomed: "doomed",
  archery: "archery",
  toughness: "toughness",
  secrecy: "secrecy",
  boarding: "boarding",
  aflame: "aflame",
};

// Hall of Beorn lists one keyword per entry, with the trailing period: "Hide 2.", "Surge.".
export function parseKeywordTokens(tokens: readonly string[]): KeywordResult {
  const keywords: Record<string, boolean | number | string> = {};
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
    // "Grapple (highest printed Threat)" (dcce.grapple); Hall of Beorn spaces the parentheses.
    const grapple = /^grapple \(\s*(highest|lowest) printed (threat|quest points)\s*\)$/.exec(lower);
    if (grapple?.[1] && grapple[2]) {
      keywords.grapple = `${grapple[1]}${grapple[2] === "threat" ? "Threat" : "QuestPoints"}`;
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

function isKeywordSentence(sentence: string): boolean {
  const parsed = parseKeywordTokens([sentence]);
  return parsed.unknown.length === 0 && Object.keys(parsed.keywords).length > 0;
}

// Leading keyword sentences ("Hide 2. Cannot have ...") are not part of the ability.
export function stripKeywords(line: string): string {
  const sentences = line.split(/(?<=\.)\s+/);
  let at = 0;
  while (at < sentences.length && isKeywordSentence(sentences[at] ?? "")) at += 1;
  return sentences.slice(at).join(" ");
}

// A line that is only keywords the parser reads is not an ability: the keyword owns it.
export function isKeywordLine(line: string): boolean {
  return line.trim() !== "" && stripKeywords(line.trim()) === "";
}
