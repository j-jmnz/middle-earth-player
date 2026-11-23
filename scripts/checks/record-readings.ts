import type { Effect } from "../../src/catalog/boundary.ts";

// The readings a review keeps catching in a record, turned into checks on the record and its printed line (docs/agents/effect-authoring.md, Readings the review
// catches). Each check reads the printed text of the lines a record implements, from the ledger and the pool lines the build uses, and the record's JSON. They are
// heuristics that find candidates: a finding is a line to read, not a verdict (scripts/checks/record-readings.test.ts lists today's findings with their reasons).

export type Finding = { check: "enemyZone" | "thenShort" | "limitTest"; recordId: string; line: string; text: string };

/** The printed text of a line id (`<code>:<side>:<n>`), or an empty string. */
export type TextOf = (lineId: string) => string;

// A Pick, a count or a holder filter of enemies that says where they are in one of these fields reads that zone and no other.
const ZONE_FIELDS = ["staging", "stagingOnly", "engaged", "engagedWith", "inStormcallerArea", "from", "attackableByPicked", "attacking", "defending", "atStage", "atOtherStage", "hasShadow", "attackingEnemy", "engagedThisRound", "facedownShadow"] as const;
// The words a printed line uses to say that its enemies are the engaged ones, or the one attacking: the filter then needs no staging area.
const ENGAGED_WORDS = /engaged with|attacking/i;

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
 * (a) A record with an enemy filter (a pick, a count, a holder, a `names` filter: each is an object of `type: enemy`) that has no `staging`, no `stagingOnly`, no `engaged` and no other field that fixes the zone,
 * whose printed line does not say "engaged with" or "attacking". The staging area is in play (rr.in-play-and-out-of-play): such a filter reads only the engaged enemies. The check reads the record, not the
 * word "enemy" in the line: a line that names an enemy card ("Watcher in the Water cannot take damage") is read as well.
 */
export function enemyZoneFindings(effects: readonly Effect[], textOf: TextOf): Finding[] {
  const found: Finding[] = [];
  for (const effect of effects) {
    const text = textOfLines(effect, textOf);
    if (ENGAGED_WORDS.test(text)) continue;
    const loose = enemyFilters([effect.instructions, (effect as { condition?: unknown }).condition ?? null]).filter((filter) => ZONE_FIELDS.every((field) => filter[field] == null));
    if (loose.length > 0) found.push({ check: "enemyZone", recordId: effect.id, line: effect.lines.join(" "), text });
  }
  return found;
}

// The instructions that can find fewer cards or tokens than the line asks for, or have nothing to change: a draw, a discard from the deck or the hand, a discard or a removal of tokens, a spend, a
// ready or an exhaust of a card that is not exhausted or ready, a heal of a card with no damage.
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
  "Ready",
  "Exhaust",
  "Heal",
]);

// Every instruction list of a record: the record's own, a Repeat's, an Each's, a ForEachPlayer's, a Delay's, an AfterAttack's and a Choose option's, at any depth. A Choose option with `requires` is offered only
// when it can be taken ("you may spend 1 resource to ..."), so it is not read.
function instructionLists(value: unknown, out: Json[][] = []): Json[][] {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => item != null && typeof item === "object" && typeof (item as Json).verb === "string")) out.push(value as Json[]);
    for (const item of value) instructionLists(item, out);
    return out;
  }
  if (value == null || typeof value !== "object") return out;
  const object = value as Json;
  if (object.requires != null && Array.isArray(object.instructions)) return out;
  for (const item of Object.values(object)) instructionLists(item, out);
  return out;
}

// An instruction that can come up short, itself or in a list it holds (a Repeat of discards, a Choose option that draws).
// An Exhaust that the printed line words as a cost ("Exhaust a hero to claim this objective") is paid or the action is not offered, so it is not read.
const shortVerb = (step: Json, text: string): boolean => typeof step.verb === "string" && CAN_COME_UP_SHORT.has(step.verb) && !(step.verb === "Exhaust" && /\bexhaust\b[^.]*\bto\b/i.test(text));
// A list a step holds that is part of the step itself: a Repeat's, an Each's, a ForEachPlayer's. A Choose option is its own part (offered only when it can be taken) and is read as a list of its own.
const bodyOf = (step: Json): Json[] => (step.verb === "Repeat" || step.verb === "Each" || step.verb === "ForEachPlayer") && Array.isArray(step.instructions) ? (step.instructions as Json[]) : [];
const canComeUpShort = (step: Json, text: string): boolean => shortVerb(step, text) || bodyOf(step).some((inner) => canComeUpShort(inner, text));

// The conditions of a record, the `all` members apart.
const membersOf = (condition: unknown): Json[] => {
  const found = condition as Json | undefined;
  if (found == null) return [];
  return found.kind === "all" && Array.isArray(found.conditions) ? (found.conditions as unknown[]).flatMap(membersOf) : [found];
};
const ofSelf = (step: Json): boolean => step.target == null || step.target === "self";
const atLeastOneResource = (member: Json): boolean => {
  const one = JSON.stringify(member);
  return one === JSON.stringify({ kind: "not", condition: { kind: "less", left: { stat: "resources", of: "self" }, right: 1 } }) || one === JSON.stringify({ kind: "less", left: 0, right: { stat: "resources", of: "self" } });
};

// Whether a condition of the record itself holds that the step does what it says, so the step cannot come up short: a Ready of the card that is exhausted, an Exhaust of the card that is ready, a removal or
// a discard of resources from the card that holds one. Any other condition may guard another part and is not read.
const conditionHolds = (effect: Effect, step: Json): boolean =>
  membersOf((effect as { condition?: unknown }).condition).some((member) => {
    const state = ((member.pick as Json | undefined)?.state as string | undefined) ?? "";
    const self = member.kind === "matches" && member.card === "self";
    if (step.verb === "Ready") return ofSelf(step) && self && state === "exhausted";
    if (step.verb === "Exhaust") return ofSelf(step) && self && state === "ready";
    if (step.verb === "RemoveResourceTokens" || step.verb === "DiscardResources") return ofSelf(step) && atLeastOneResource(member);
    return false;
  });

// Whether a condition is `thenResolves` or an `all` that holds it.
const waitsForThen = (condition: unknown): boolean => {
  const found = condition as Json | undefined;
  return found?.kind === "thenResolves" || (found?.kind === "all" && Array.isArray(found.conditions) && (found.conditions as unknown[]).some(waitsForThen));
};

// Whether a step waits for the part before "then": its `when` holds `thenResolves`, a Choose option requires it ("you may flip it", offered only when the part before "then" resolved), or a step of the
// list it is made of (a Repeat's, an Each's, a ForEachPlayer's) does.
const holdsThen = (step: Json | undefined): boolean =>
  step != null &&
  (waitsForThen(step.when) || (Array.isArray(step.options) && (step.options as Json[]).some((option) => waitsForThen(option.requires))) || bodyOf(step).some((inner) => holdsThen(inner)));

/**
 * (b) A line with "then" whose record has, in one instruction list (the record's, or one inside a Repeat, an Each, a Choose option or another list), an instruction that can come up short followed by a last
 * instruction that does not hold `thenResolves`: the part after "then" resolves only if the part before it did (rr.then), so its `when` holds `thenResolves` (alone or among the conditions of an `all`), a Choose
 * option requires it, or a Repeat, Each or ForEachPlayer it is made of holds it in a step. A `when` that reads something else is not enough. The record's own `condition` is not read: it may guard another part
 * (a record whose condition does hold the part before "then" is listed in THEN_SHORT with its reason).
 */
export function thenFindings(effects: readonly Effect[], textOf: TextOf): Finding[] {
  const found: Finding[] = [];
  for (const effect of effects) {
    const text = textOfLines(effect, textOf);
    if (!/\bthen\b/i.test(text)) continue;
    const short = instructionLists(effect.instructions).some((steps) => {
      // A step the record's own `condition` holds the part of (the card is exhausted before a Ready of it) cannot come up short in the record's own list.
      const first = steps.findIndex((step) => canComeUpShort(step, text) && !(steps === effect.instructions && conditionHolds(effect, step)));
      // The part after "then" is the last instruction of the list: it holds a condition on the part before it, or it is not read.
      const last = steps[steps.length - 1];
      return first >= 0 && steps.length - 1 > first && !holdsThen(last);
    });
    if (short) found.push({ check: "thenShort", recordId: effect.id, line: effect.lines.join(" "), text });
  }
  return found;
}

// A title that tests a second use or the end of a duration says so in one of these words.
const SECOND_OR_END = /second|twice|again|third|next (?:phase|round|turn)|new (?:phase|round)|end of the (?:phase|round|turn|attack)|expire|ends?\b|lasts?\b|no longer|only once/i;
// The words of a line that set a limit or a duration.
export const LIMIT_OR_DURATION = /\blimit\b(?! \d+ per deck)|until the end of/i;

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
