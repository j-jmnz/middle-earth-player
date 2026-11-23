import type { Effect } from "../../src/catalog/boundary.ts";

// The readings a review keeps catching in a record, turned into checks on the record and its printed line (docs/agents/effect-authoring.md, Readings the review
// catches). Each check reads the printed text of the lines a record implements, from the ledger and the pool lines the build uses, and the record's JSON. They are
// heuristics that find candidates: a finding is a line to read, not a verdict (scripts/checks/record-readings.test.ts lists today's findings with their reasons).

export type Finding = { check: "enemyZone" | "thenShort" | "limitTest"; recordId: string; line: string; text: string };

/** The printed text of a line id (`<code>:<side>:<n>`), or an empty string. */
export type TextOf = (lineId: string) => string;

// A Pick or a count of enemies that says where they are in one of these fields reads that zone and no other.
const ZONE_FIELDS = ["staging", "stagingOnly", "engaged", "engagedWith", "inStormcallerArea", "from", "attackableByPicked", "attacking", "defending", "atStage", "atOtherStage", "hasShadow"] as const;
// The words a line uses to say where its enemies are: any of them and the line says it.
const ZONE_WORDS = /engage|staging|attack|defen|victory|discard pile|hand\b|deck|encounter|shadow|\byou\b|\byour\b/i;

type Json = Record<string, unknown>;

// The enemy filters of a record: every object with `type: enemy` and a `control`, wherever it stands (a Pick, an Each, a count, a canPick). A `matches` condition reads a card the
// effect already holds, whatever its zone, so what stands under one is not a search of the table.
function enemyFilters(value: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(value)) {
    for (const item of value) enemyFilters(item, out);
    return out;
  }
  if (value == null || typeof value !== "object") return out;
  const object = value as Json;
  if (object.kind === "matches") return out;
  if (object.type === "enemy" && typeof object.control === "string") out.push(object);
  for (const item of Object.values(object)) enemyFilters(item, out);
  return out;
}

const textOfLines = (effect: Effect, textOf: TextOf): string => effect.lines.map(textOf).join(" | ");

/**
 * (a) A line about enemies "in play", or one that names an enemy and no zone, whose record has an enemy filter with no `staging` and no field that fixes the zone. The staging area is in play
 * (rr.in-play-and-out-of-play): such a filter reads only the engaged enemies.
 */
export function enemyZoneFindings(effects: readonly Effect[], textOf: TextOf): Finding[] {
  const found: Finding[] = [];
  for (const effect of effects) {
    const text = textOfLines(effect, textOf);
    if (!/\benem(?:y|ies)\b/i.test(text)) continue;
    const inPlay = /\bin play\b/i.test(text);
    if (!inPlay && ZONE_WORDS.test(text)) continue;
    const loose = enemyFilters([effect.instructions, (effect as { condition?: unknown }).condition ?? null]).filter((filter) => ZONE_FIELDS.every((field) => filter[field] == null));
    if (loose.length > 0) found.push({ check: "enemyZone", recordId: effect.id, line: effect.lines.join(" "), text });
  }
  return found;
}

// The instructions that can find fewer cards or tokens than the line asks for: a draw, a discard from the deck or the hand, a discard or a removal of tokens, a spend.
const CAN_COME_UP_SHORT: ReadonlySet<string> = new Set([
  "Draw",
  "DiscardTopOfDeck",
  "DiscardFromDeck",
  "DiscardFromHand",
  "DiscardRandomFromHand",
  "DiscardResources",
  "DiscardUntil",
  "RemoveResourceTokens",
  "RemoveQuestProgress",
  "SpendResources",
  "MoveResources",
]);

/**
 * (b) A line with "then" whose record has an instruction that can come up short followed by a last instruction with no condition: the part after "then" resolves only if the part before it did
 * (rr.then), so it carries `thenResolves`, the same condition or sits on a `then` branch. A last instruction with any `when` is read as holding one. The record's own `condition` is not read:
 * it may guard another part.
 */
export function thenFindings(effects: readonly Effect[], textOf: TextOf): Finding[] {
  const found: Finding[] = [];
  for (const effect of effects) {
    const text = textOfLines(effect, textOf);
    if (!/\bthen\b/i.test(text)) continue;
    const steps = effect.instructions as readonly Json[];
    const first = steps.findIndex((step) => typeof step.verb === "string" && CAN_COME_UP_SHORT.has(step.verb));
    if (first < 0) continue;
    // The part after "then" is the last instruction: it holds a condition on the part before it, or it is not read.
    const last = steps.length - 1;
    if (last > first && steps[last]?.when == null) found.push({ check: "thenShort", recordId: effect.id, line: effect.lines.join(" "), text });
  }
  return found;
}

// A title that tests a second use or the end of a duration says so in one of these words.
const SECOND_OR_END = /second|twice|again|third|next (?:phase|round|turn)|new (?:phase|round)|end of the (?:phase|round|turn|attack)|expire|ends?\b|lasts?\b|no longer|only once/i;
// The words of a line that set a limit or a duration.
const LIMIT_OR_DURATION = /\blimit\b(?! \d+ per deck)|until the end of/i;

/** The titles of the tests in a source file: the strings that open `it`, `test` and `describe` (and `it.fails`, `it.each(...)`), as the coverage check reads them. */
export function testTitles(source: string): string[] {
  return [...source.matchAll(/(?:\b(?:it|test|describe)(?:\.[a-zA-Z]+)*|\))\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((match) => match[2] ?? "");
}

/**
 * (c) A line with "Limit" or "until the end of" whose line id no test title names with a word for the second use or the end of the duration
 * (docs/agents/effect-authoring.md, Readings the review catches). `titles` are every test title of the repository. The check cannot tell that a title tests the right thing, only that it says it tests a second use or an end.
 */
export function limitFindings(effects: readonly Effect[], textOf: TextOf, titles: readonly string[]): Finding[] {
  const found: Finding[] = [];
  for (const effect of effects) {
    const lines = effect.lines.filter((line) => LIMIT_OR_DURATION.test(textOf(line)));
    const limited = effect.limit != null || (effect.instructions as readonly Json[]).some((step) => step.until != null);
    for (const line of lines) {
      // A record with neither a limit nor a duration of its own (a line that only mentions another card's) is not read.
      if (!limited && !/\blimit\b/i.test(textOf(line))) continue;
      const named = titles.some((title) => (title.includes(line) || title.includes(effect.id)) && SECOND_OR_END.test(title));
      if (!named) found.push({ check: "limitTest", recordId: effect.id, line, text: textOf(line) });
    }
  }
  return found;
}
