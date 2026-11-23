// The checks `pnpm effects render --checks` prints under each printed line (docs/agents/effect-authoring.md, Readings the review catches): each is a short tag and the question the reading judge
// answers for that line (`.claude/agents/reading-judge.md`). A tag applies by a mechanical test on the printed words, or on the record (the fault kinds of scripts/checks/record-readings.ts
// and the first step of an Action or a Response), so a fault kind the judge skipped is a tag left unanswered, and a line with no tag shows none.
import type { Effect } from "../../../../src/catalog/boundary.ts";
import { enemyZoneFindings, LIMIT_OR_DURATION, thenFindings } from "../../../checks/record-readings.ts";

export type LineCheck = { tag: string; ask: string };

type Rule = { tag: string; ask: string; words: RegExp };

// The words of a printed line that call for a check. The order is the order the tags print.
const BAR = /cannot be cancell?ed/i;
const RULES: readonly Rule[] = [
  { tag: "then", words: /\bthen\b/i, ask: "does the English make everything after \"then\" wait for the part before it, and say nothing is done if that part found nothing (rr.then)?" },
  { tag: "in-play", words: /\bin play\b/i, ask: "does \"in play\" reach the staging area as well as the engaged cards (rr.in-play-and-out-of-play), as the English says?" },
  { tag: "limit", words: LIMIT_OR_DURATION, ask: "does the English hold the limit or the duration with the printed scope (per card, per hero, per phase, per round) and end it when the line does?" },
  { tag: "you-control", words: /\byou control\b|\bplayer attachment\b/i, ask: "does the English leave out cards another player or the encounter deck controls, as \"you control\" does?" },
  { tag: "another", words: /\banother\b/i, ask: "does the English leave out the card itself?" },
  { tag: "printed", words: /\bprinted\b/i, ask: "does the English read the printed value only (icon, trait, cost), not one a card gained?" },
  { tag: "uncancelable", words: BAR, ask: "is the bar the one the line prints (When Revealed effects only, or every encounter card effect), no wider and no narrower?" },
  { tag: "any-player", words: /\b(?:one|any) player\b/i, ask: "does the English treat \"one\" or \"any player\" as the line does (any player acts, chooses or is counted, not only the first player)?" },
  { tag: "side-quest", words: /\bside quests?\b/i, ask: "does the English mean a player side quest or an encounter side quest, as the line does (mec108.side-quests)?" },
  { tag: "attached", words: /\battached (?:character|hero|ally|enemy|location)\b/i, ask: "does the English hold only while the host is that card type?" },
  { tag: "canceled", words: /\bcancell?ed\b/i, ask: "does the English hear the cancel the line names and no other?" },
  { tag: "any-reason", words: /for any reason|\bcannot enter\b/i, ask: "does the English cover every way the card can arrive or leave?" },
  { tag: "trigger-scope", words: /\bafter\b[^.:]*\b(?:explored|travel|engages?|defeated|destroyed|discarded)\b/i, ask: "does the trigger in the English hear every zone the line's event happens in, and no more?" },
  { tag: "own-name", words: /\bcop(?:y|ies)\b/i, ask: "does the count in the English match the cards with that printed title, not every chosen card?" },
  { tag: "sphere", words: /\bnon-|\b(?:Leadership|Tactics|Spirit|Lore|Baggins|Fellowship)\b/i, ask: "does the English hold the sphere as printed (an icon gained counts, a payment allowance does not, non-X excludes one sphere)?" },
];

const ENGAGED_OR_ZONED = /engaged with|attacking|staging area|in the staging|in play|engaged/i;
const ENEMY = /\benem(?:y|ies)\b/i;

/** The checks that apply to a printed line, from its words and from the records that name it. `owners` are the card's records that name the line. */
export function lineChecks(text: string, owners: readonly Effect[]): LineCheck[] {
  // "cannot be canceled" is the bar's own check, not a line about a cancel.
  const barred = BAR.test(text);
  const found: LineCheck[] = RULES.filter((rule) => rule.words.test(text) && !(barred && rule.tag === "canceled")).map(({ tag, ask }) => ({ tag, ask }));
  const textOf = () => text;
  const has = (tag: string) => found.some((check) => check.tag === tag);
  const add = (check: LineCheck) => {
    if (!has(check.tag)) found.push(check);
  };
  // An enemy named with no zone: the pick or count may read only the engaged enemies.
  if (ENEMY.test(text) && !ENGAGED_OR_ZONED.test(text)) add({ tag: "enemy-zone", ask: "the line names enemies with no zone: does the English reach the staging area too, or say why it does not?" });
  if (enemyZoneFindings(owners, textOf).length > 0) add({ tag: "enemy-zone", ask: "record-readings finds an enemy filter with no zone (staging, engaged, ...): does the English say where the enemies are, as the line does?" });
  if (thenFindings(owners, textOf).length > 0) add({ tag: "then", ask: "record-readings finds a step that can come up short before \"then\" with no thenResolves after it: does the English make the later part wait?" });
  // An Action or a Response that opens with a Pick, or any optional ability: not offered when its Pick has no candidate or its whole effect cannot happen.
  const optional = owners.some((effect) => (effect.timing === "action" || effect.timing === "response") && (effect.instructions as readonly { verb?: string }[])[0]?.verb === "Pick");
  if (optional) add({ tag: "pick-first", ask: "the ability opens with a Pick: is it not offered, and its cost not paid, when the Pick has no candidate (a canPick or equal condition in the English)?" });
  if (owners.some((effect) => effect.timing === "shadow" && (effect as { condition?: unknown }).condition != null)) add({ tag: "shadow-condition", ask: "a Shadow record holds a record-level condition, which is never read: is each condition on the instruction that needs it?" });
  if (/^\s*travel\b/i.test(text)) add({ tag: "travel-cost", ask: "a Travel cost gated by a condition: does each instruction carry it, so the location can still be traveled to when it fails?" });
  return found;
}

/** The lines printed under a printed line: one `CHECK <tag>: <question>` for each check, indented as the records are. */
export function checkLines(text: string, owners: readonly Effect[]): string[] {
  return lineChecks(text, owners).map((check) => `  CHECK ${check.tag}: ${check.ask}`);
}
