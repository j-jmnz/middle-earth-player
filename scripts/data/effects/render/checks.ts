// The checks `pnpm effects render --checks` prints under each printed line (docs/agents/effect-authoring.md, Readings the review catches): each is a short tag and the question the reading judge
// answers for that line (`.claude/agents/reading-judge.md`). A tag applies by a mechanical test on the printed words, or on the record (the fault kinds of scripts/checks/record-readings.ts
// and the first step of an Action or a Response), so a fault kind the judge skipped is a tag left unanswered, and a line with no tag shows none.
import type { Effect } from "../../../../src/catalog/boundary.ts";
import { enemyZoneFindings, LIMIT_OR_DURATION, thenFindings } from "../../../checks/record-readings.ts";

export type LineCheck = { tag: string; ask: string; entry: string };

type Rule = LineCheck & { words: RegExp };

// The words of a printed line that call for a check. The order is the order the tags print. `entry` is the bold name of the entry of docs/agents/effect-authoring.md (Readings the review
// catches) that the question stands for; a reading added there gets its tag here (a rule below for words, or a test of the record in lineChecks). Each question is short: the doc has the reasoning.
const BAR = /cannot be cancell?ed/i;
const SPHERE = "Leadership|Tactics|Spirit|Lore|Baggins|Fellowship";
const RULES: readonly Rule[] = [
  { tag: "then", entry: "Then", words: /\bthen\b/i, ask: "does everything after \"then\" wait for the part before it, and do nothing when that found nothing?" },
  { tag: "in-play", entry: "In play", words: /\bin play\b/i, ask: "does \"in play\" reach the staging area as well as the engaged cards?" },
  { tag: "limit", entry: "A limit on the card", words: LIMIT_OR_DURATION, ask: "does the limit or duration keep the printed scope (card, hero, phase, round) and end when the line does?" },
  { tag: "you-control", entry: "Whose card", words: /\byou control\b|\bplayer attachment\b/i, ask: "does it leave out cards another player or the encounter deck controls?" },
  { tag: "another", entry: "Whose card", words: /\banother\b/i, ask: "does it leave out the card itself?" },
  { tag: "printed", entry: "A sphere", words: /\bprinted\b/i, ask: "does it read the printed value only (icon, trait, cost), not one a card gained?" },
  { tag: "uncancelable", entry: "What cannot be canceled", words: BAR, ask: "is the bar the printed one (When Revealed effects only, or every encounter card effect), no wider, no narrower?" },
  { tag: "any-player", entry: "\"One player\" or \"any player\"", words: /\b(?:one|any) player\b/i, ask: "can any player act, choose or be counted, not only the first player?" },
  { tag: "side-quest", entry: "\"Side quest\"", words: /\bside quests?\b/i, ask: "does it mean a player side quest or an encounter side quest, as the line does?" },
  { tag: "attached", entry: "\"Attached character\", \"attached hero\"", words: /\battached (?:character|hero|ally|enemy|location)\b/i, ask: "does it hold only while the host is that card type?" },
  { tag: "canceled", entry: "\"After a 'When Revealed' effect is canceled\"", words: /\bcancell?ed\b/i, ask: "does it hear the cancel the line names and no other?" },
  { tag: "any-reason", entry: "\"For any reason\" and \"cannot enter …\"", words: /for any reason|\bcannot enter\b/i, ask: "does it cover every way the card can arrive or leave?" },
  { tag: "trigger-scope", entry: "The trigger's scope", words: /\bafter\b[^.:]*\b(?:explored|travel|engages?|defeated|destroyed|discarded)\b/i, ask: "does the trigger hear every zone the event happens in, and no more?" },
  { tag: "exhausts-to", entry: "\"After X exhausts to …\"", words: /\bexhaust(?:s|ed)? to (?:defend|attack|commit|quest)\b/i, ask: "does the event it answers exhaust the card (a card already exhausted, made to defend or quest by an effect, does not answer)?" },
  { tag: "own-name", entry: "The card's own name in a filter", words: /\bcop(?:y|ies)\b/i, ask: "does the count match cards with that printed title, not every chosen card?" },
  // A sphere word (a sphere is printed as its name), or "resource icon" or "sphere": not every "non-" ("a non-unique enemy", "non-Ship").
  { tag: "sphere", entry: "A sphere", words: new RegExp(`\\b(?:${SPHERE})\\b|\\bresource icons?\\b|\\bspheres?\\b`, "i"), ask: "does it hold the sphere as printed (a gained icon counts, a payment allowance does not, non-X excludes one sphere)?" },
];

/** The checks that apply to a printed line, from its words and from the records that name it. `owners` are the card's records that name the line. */
export function lineChecks(text: string, owners: readonly Effect[]): LineCheck[] {
  // "cannot be canceled" is the bar's own check, not a line about a cancel.
  const barred = BAR.test(text);
  const found: LineCheck[] = RULES.filter((rule) => rule.words.test(text) && !(barred && rule.tag === "canceled")).map(({ tag, ask, entry }) => ({ tag, ask, entry }));
  const textOf = () => text;
  const has = (tag: string) => found.some((check) => check.tag === tag);
  const add = (check: LineCheck) => {
    if (!has(check.tag)) found.push(check);
  };
  // The enemy-zone tag follows the record, as scripts/checks/record-readings.ts reads it, not the word "enemy" (a Pillage reminder and "all 7 unique enemies" name enemies and pick none).
  if (enemyZoneFindings(owners, textOf).length > 0) add({ tag: "enemy-zone", entry: "In play", ask: "an enemy filter has no zone: does the English say where the enemies are, as the line does?" });
  if (thenFindings(owners, textOf).length > 0) add({ tag: "then", entry: "Then", ask: "a step that can come up short comes before \"then\" with no thenResolves: does the later part wait?" });
  // An Action or a Response that opens with a Pick, or any optional ability: not offered when its Pick has no candidate or its whole effect cannot happen.
  const optional = owners.some((effect) => (effect.timing === "action" || effect.timing === "response") && (effect.instructions as readonly { verb?: string }[])[0]?.verb === "Pick");
  if (optional) add({ tag: "pick-first", entry: "An optional ability that can change nothing", ask: "the ability opens with a Pick: is it not offered, and its cost not paid, when the Pick has no candidate?" });
  if (owners.some((effect) => effect.timing === "shadow" && (effect as { condition?: unknown }).condition != null)) add({ tag: "shadow-condition", entry: "A Shadow's condition", ask: "the record holds a record-level condition, which is never read: is each condition on the instruction that needs it?" });
  // A step that reads the picked card after a step that remembers a card and can find none (`remember`): a stale pick from an earlier seat or step.
  if (owners.some((effect) => JSON.stringify(effect.instructions).includes('"remember":true') && /"(?:of|card)":"picked"/.test(JSON.stringify(effect.instructions)))) add({ tag: "stale-pick", entry: "A stale picked card", ask: "a step reads the picked card after a step that can find none: does it read no card (not an earlier seat's or step's) when the hand, deck or pool is empty?" });
  if (/^\s*travel\b/i.test(text)) add({ tag: "travel-cost", entry: "A Travel cost gated by `when`", ask: "does each instruction of the cost carry its condition, so the location can be traveled to when it fails?" });
  return found;
}

/** The lines printed under a printed line: one `CHECK <tag>: <question>` for each check, indented as the records are. */
export function checkLines(text: string, owners: readonly Effect[]): string[] {
  return lineChecks(text, owners).map((check) => `  CHECK ${check.tag}: ${check.ask} [entry: ${check.entry}]`);
}
