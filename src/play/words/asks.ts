// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The words of a choice written as data beside the record (docs/design-system-table.md, Choice tray): an asks file
// (src/play/words/asks/<scenario-id>.ts) holds, for each Pick and Choose of a scenario's records, the sentence the sheet opens with and the rows under it, so a scenario needs no words code. `askWords` and the Choose
// sheet read an entry first; with none, the chain of word families runs as it always did. An entry is keyed as the words allowlist is: `<record id> @<instruction path> <verb | option id>` (record-path.ts).
// The tail is the instruction's verb for the sentence over a Pick or a Choose, and an option id for one branch of a Choose. A game reads only its own scenario's file (`ASKS_BY_SCENARIO[game.scenarioId]`): a card
// several scenarios deal is worded by each scenario's file, never by another's. Every number comes from an `Amount` read with the engine's reader, every warning from a `Condition` read with the engine's, so a
// sentence says what the table holds and no code counts it. Pure.
import type { Amount, Condition, Instruction, PickSpec } from "../../catalog/boundary.ts";
import type { Cause } from "../../rules/core/cause.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { embassyPairNow } from "../readouts/black-gate.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { ringBearerId } from "../../rules/families/burden/deck.ts";
import { poisonOf } from "../../rules/families/poison/poison.ts";
import { frameScope, hostOf, resolveAmount } from "../../rules/interpret/amounts.ts";
import { holds } from "../../rules/interpret/conditions.ts";
import { pickCandidates } from "../../rules/interpret/pick.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { stagedInOrder } from "../../rules/families/haradrim/staged.ts";
import { effectById, effectsOf } from "../../rules/windows/listen.ts";

import { ASKS_BY_SCENARIO } from "./asks/index.ts";
import type { ChoiceNames, PickWords } from "./choice.ts";
import { matchOf, repeatTimesOf, walk, type PathMatch } from "./record-path.ts";
import { holdsProwl, prowlForced, prowlLeft } from "./group-steps.ts";
import { askedSeat, seatSays } from "./seat.ts";

/**
 * Words that change with the table: a template, or variants where the first whose `when` holds is said (one without `when` always holds, so it ends the list). A stage-two sentence says "in play" where stage one says
 * "in the staging area"; the condition is read with the reader the caution's is.
 */
export type Text = string | readonly { when?: Condition; text: string }[];

/**
 * One entry of an asks file. Templates hold `{card}` (the card the record is on), `{owner}` ("Player N", the seat asked), `{picked}` (the card an Each or an earlier Pick of the record chose, in a note too; in a caution, the card of the row it is about), `{host}` (the card the record's card lies on), `{subject}` (the card that triggered the record: the ally that entered play), `{pair}` (the Embassy's pair being decided: the player card with its owner and the encounter card it is paired with) and `{ringBearer}` (the hero with the Ring-bearer trait), `{hero}` (the hero in the staging area the Orc chosen now will guard), `{n}` (what the instruction after a Pick deals or places, read now: a Pick's entry only, a Choose
 * has none), `{left}` (the damage an AssignDamage still has to place, the time counters a RemoveTimeCounters with `distribute` still has to take off, the resources a Prowl still has to discard, or the characters a CapRefresh still keeps exhausted, counting the step asked: its note only), `{ready}` (a CapRefresh's characters that would still ready), `{forced}` (a Prowl's hero Pick: the words that say no Stop row was offered because later players cannot discard the rest, or nothing), `{countdown}` (an entry with `countdown`: "2 of 4"), `{pursuitLimit}` (the value at which the players lose, in a scenario with a pursuit tracker) and a `{name}` for each key of `bind`. Every `Text` below is a template or variants.
 * - `note`: the sentence over a Pick or a Choose (the entry keyed with the instruction's verb).
 * - `why`: the reason the window opened. It is said after the card's title and before the note, "Card: why note" ("Player 1, Card: why note" when owned and two-handed).
 * - `bare`: the sheet says the entry's sentence alone, with no printed line of the record after it (a keyword line that holds other keywords, "Surge. Prowl 1.", is no use there).
 * - `owned`: one player's own choice. Two-handed the sentence leads with the player and the sheet adds no "Player N chooses."; solo it has no lead, and a note with no `why` is capitalised.
 * - `verb`: the button's word over a Pick, one or two words ("Exhaust"); "Choose" when absent.
 * - `title`: the sheet's title over a Pick in place of the card's name, for a count that must stay in view ("{card}: assign {left}").
 * - `labels`: the rows of a Pick that are no card, by option id ("skip", "done"). A key that names a card is refused.
 * - `label`: the row of one branch of a Choose (the entry keyed with the option id).
 * - `bind`: a name for each number a template says, as the `Amount` the engine reads.
 * - `xRows`: the rows of a ChooseX (the entry keyed with the verb `ChooseX`), one for each number X the player may take: `label` says `{x}` and each `bind` name, and `less` names `{<name>}`, the amount `of` less X and at
 *   least `min`, with its `unit` ("4 cards"), so "Spend {x}: reveal {reveals}" says what each number buys.
 * - `named`: a name for each card a template says, as the `PickSpec` that finds it for the seat asked: the card's name when exactly one card matches, else the words `otherwise` ("your highest-cost ally"), so a row names the card it takes when there is no second step to choose; `{<name>Cost}` says that card's printed cost.
 * - `caution`: the two-tap warning, said as "Tap again: ..." when `when` holds. It belongs to a row: on a Pick `when` is read once for each row with `picked` set to that row's id, so the confirm arms only on the row that loses
 *   the game, and on a Choose it is read for the branch the entry is keyed with. A warning that holds whatever is picked is a `when` that does not read `picked`; there is no sheet-wide caution.
 */
export type Ask = {
  /** A stub `pnpm scenario words <id> --write` wrote for a Pick or Choose with no words: the scenario's words tests fail while it is set, so the author writes the entry from the printed line and deletes it. */
  todo?: string;
  note?: Text;
  why?: string;
  owned?: true;
  bare?: true;
  verb?: string;
  title?: Text;
  label?: Text;
  labels?: Readonly<Record<string, Text>>;
  bind?: Readonly<Record<string, Amount>>;
  /** Marks a Pick the record's Repeat runs (Forest Stream's four discards): `{countdown}` says "n of m", m the Repeat's count read from the record, or fewer when the thing counted `against` (the poison under the characters offered) runs out. */
  countdown?: { against: "poison" };
  xRows?: { label: Text; less?: { name: string; of: Amount; min: number; unit: string } };
  named?: Readonly<Record<string, { pick: PickSpec; otherwise: string }>>;
  caution?: { when: Condition; text: Text };
};

export type AsksTable = Readonly<Record<string, Ask>>;

/** What a Pick's entry says: the words the chain returns, with the rows that are no card and the warning of each row an entry can add. */
export type AskedWords = PickWords & { labels?: Readonly<Record<string, string>>; cautions?: Readonly<Record<string, string>>; bare?: true };

/** Where the instruction stands: the record (its id), the path in it, and the table of the scenario that worded it. Worked out once for a sheet (askAt) and handed to every row's lookup. */
export type AskAt = { id: string; path: string; table: AsksTable };

/** The table the open window is at: the instruction asked, the record it came from (the frame's effect id, or the cause of the queued instruction) and the card the record is on. `options` are the window's, `at` the answer of askAt. */
export type AskFacts = {
  game: ScenarioState;
  ctx: ReduceContext;
  names: ChoiceNames;
  instruction: Instruction;
  effectId?: string;
  cause?: Cause;
  source: string | null;
  amountNow?: number;
  // How many times the same Pick is queued again after the one asked (a Repeat expanded in the queue), read only for an entry with `countdown`.
  again?: () => number;
  options?: readonly string[];
  at?: AskAt | null;
};

/** The key of an entry. */
export const askKey = (effectId: string, path: string, tail: string): string => `${effectId} @${path} ${tail}`;

const PLACEHOLDER = /\{(\w+)\}/g;

/** The names a template says between braces. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((found) => found[1] ?? "");
}

/** The templates of a `Text`: itself, or the text of each variant. */
export const textsOf = (text: Text | undefined): string[] => (text === undefined ? [] : typeof text === "string" ? [text] : text.map((variant) => variant.text));

/** Every template of an entry, variants included. */
export function templatesOf(entry: Ask): string[] {
  return [...textsOf(entry.note), ...(entry.why == null ? [] : [entry.why]), ...textsOf(entry.title), ...textsOf(entry.label), ...Object.values(entry.labels ?? {}).flatMap(textsOf), ...textsOf(entry.caution?.text)];
}

/** The placeholders of an entry that no value answers: none of `card`, `owner`, `picked`, `host`, `subject`, `ringBearer`, `n` (only where `withN`: a Pick has what its next instruction deals, a Choose has nothing), `pursuitLimit` and its `bind` and `named` names. */
export function unknownPlaceholders(entry: Ask, withN = true): string[] {
  const known = new Set(["card", "owner", "x", "picked", "host", "subject", "ringBearer", "hero", "pair", "left", "ready", "forced", "dealt", "pursuitLimit", ...(entry.countdown != null ? ["countdown"] : []), ...(withN ? ["n"] : []), ...Object.keys(entry.bind ?? {}), ...(entry.xRows?.less ? [entry.xRows.less.name] : []), ...Object.keys(entry.named ?? {}), ...Object.keys(entry.named ?? {}).map((name) => `${name}Cost`)]);
  return [...new Set(templatesOf(entry).flatMap(placeholdersOf))].filter((name) => !known.has(name));
}

/** The template with each placeholder replaced, or null when one has no value (a template is never shown half filled). */
export function fill(template: string, values: Readonly<Record<string, string | number | undefined>>): string | null {
  let missing = false;
  const text = template.replace(PLACEHOLDER, (_all, name: string) => {
    const value = values[name];
    if (value === undefined) missing = true;
    return String(value);
  });
  return missing ? null : text;
}

type Values = Record<string, string | number | undefined>;
type Hit = { entry: Ask; values: Values; scope: ReturnType<typeof frameScope> };

const candidatesOf = (a: AskFacts, id: string | undefined, code: string | undefined) => [id ? effectById(a.ctx, id) : undefined, ...(code ? effectsOf(a.ctx, code) : [])];

/** The table of the game's own scenario (its asks file), or undefined when it has none. `by` is the barrel's `ASKS_BY_SCENARIO`. */
export const asksOfScenario = (game: ScenarioState, by: Readonly<Record<string, AsksTable>> = ASKS_BY_SCENARIO): AsksTable | undefined => by[game.scenarioId];

const tableOf = (a: AskFacts, table?: AsksTable): AsksTable | undefined => table ?? asksOfScenario(a.game);

/**
 * Which record holds the instruction, and the path in it, for the table of the game's scenario: null at once for a scenario with no asks file, else the best fit among the records that have an entry (the queued
 * instruction's cause first, then the frame's effect, then the records of the card). A record that holds the very instruction, or an equal copy, beats one that fits only as a copy the engine filled in.
 */
export function askAt(a: AskFacts, table?: AsksTable): AskAt | null {
  return askAtBy(a, table, (instructions) => matchOf(instructions, a.instruction));
}

// askAt with the way the record's instruction is found: askAt looks for the instruction asked, the ChooseX words for the record's one ChooseX (the Choose it opens is the engine's, no record holds it).
function askAtBy(a: AskFacts, table: AsksTable | undefined, find: (instructions: readonly Instruction[]) => PathMatch | null): AskAt | null {
  const entries = tableOf(a, table);
  if (!entries) return null;
  const ids = new Set(Object.keys(entries).map((key) => key.slice(0, key.indexOf(" "))));
  if (ids.size === 0) return null;
  const id = a.cause && "effect" in a.cause ? a.cause.effect : a.effectId;
  const code = a.source ? (a.game.cards[a.source]?.code ?? a.source) : undefined;
  let best: { id: string; path: string; rank: number } | null = null;
  for (const record of candidatesOf(a, id, code)) {
    if (!record || !ids.has(record.id)) continue;
    const match = find(record.instructions);
    if (match && (best === null || match.rank < best.rank)) best = { id: record.id, path: match.path, rank: match.rank };
  }
  return best ? { id: best.id, path: best.path, table: entries } : null;
}

/** The values the templates of an entry read now. */
export function askValues(a: AskFacts, entry: Ask): { values: Values; scope: ReturnType<typeof frameScope> } {
  const seat = askedSeat(a.game);
  const scope = frameScope(a.game, seat, a.source);
  const values: Values = { card: a.source ? a.names.card(a.source) : "This card", owner: `Player ${seat + 1}`, picked: "The picked card", n: a.amountNow, pursuitLimit: a.game.widgets.pursuitTracker };
  // The card the record's card lies on ("Exhaust Frodo Baggins, who carries A Heavy Burden") and the Ring-bearer, named only where an entry says them.
  const hostId = hostOf(a.game, a.source);
  // An AssignDamage not yet split into steps holds all of its amount.
  if (a.instruction.verb === "AssignDamage") values.left = a.instruction.left ?? resolveAmount(a.game, a.instruction.amount, scope, a.ctx);
  // A RemoveTimeCounters that divides its total (08153:A:1): the counters still to take off, counting the one asked (the engine sets `left` on the pick it asks).
  else if (a.instruction.verb === "RemoveTimeCounters" && a.instruction.distribute != null) values.left = a.instruction.left ?? 1;
  // A Prowl's discard: the resources the players still have to discard, counting the step asked (group-steps.ts).
  // Heart of Fangorn's cap: the characters that would still ready, and how many of them must stay exhausted, counting the one asked.
  else if (a.instruction.verb === "CapRefresh") {
    const ready = a.options?.length ?? 0;
    values.ready = ready;
    values.left = Math.max(1, ready - a.instruction.amount);
  } else {
    // Only a record that holds a GroupDiscardResources has Prowl steps: another record's Pick of the same heroes has no count (group-steps.ts).
    const id = a.cause && "effect" in a.cause ? a.cause.effect : a.effectId;
    const code = a.source ? (a.game.cards[a.source]?.code ?? a.source) : undefined;
    const prowl = candidatesOf(a, id, code).some((record) => record != null && holdsProwl(record.instructions));
    if (prowl) values.left = prowlLeft(a.game, a.instruction);
    values.forced = prowl && prowlForced(a.game, a.instruction) ? " Later players cannot discard the rest." : "";
  }
  // The encounter cards a locate test has discarded so far, each with whether it prints PASS (dwd.locate-test), named only where an entry says them.
  if (a.instruction.verb === "LocateTest" && templatesOf(entry).some((template) => placeholdersOf(template).includes("dealt"))) {
    const dealt = (a.instruction.dealtIds ?? []).map((id) => `${a.names.card(id)}${printedOf(a.ctx.cards, a.game.cards[id]?.code ?? "").keywords.pass === true ? " (PASS)" : " (no PASS)"}`);
    values.dealt = dealt.length > 0 ? dealt.join(", ") : "none yet";
  }
  // "2 of 4": the discards done so far, this one, and the most the poison still on the characters offered lets the repeats reach.
  if (entry.countdown != null && a.again) {
    const code = a.source ? (a.game.cards[a.source]?.code ?? a.source) : undefined;
    const id = a.cause && "effect" in a.cause ? a.cause.effect : a.effectId;
    const times = candidatesOf(a, id, code).reduce<number | null>((found, record) => found ?? (record ? repeatTimesOf(record.instructions, a.instruction) : null), null);
    const left = a.again() + 1;
    const done = (times ?? left) - left;
    const poison = (a.options ?? []).reduce((sum, option) => sum + poisonOf(a.game, option), 0);
    values.countdown = `${done + 1} of ${done + Math.max(1, Math.min(left, poison))}`;
  }
  values.host = hostId ? a.names.card(hostId) : "Its host";
  // The card an Each or an earlier Pick of the record chose, for the question it opens ("Fanuidhol: spend 1 resource from {picked}'s pool", 04016:A:1).
  const chosen = scope.picked?.findLast((id) => a.game.cards[id] != null);
  if (chosen) values.picked = a.names.card(chosen);
  // The card that triggered the record (Barren Moorland's ally), named only where an entry says it.
  if (templatesOf(entry).some((template) => placeholdersOf(template).includes("subject"))) values.subject = scope.subject ? a.names.card(scope.subject) : "that card";
  if (templatesOf(entry).some((template) => placeholdersOf(template).includes("ringBearer"))) {
    const bearer = ringBearerId(a.game, a.ctx);
    values.ringBearer = bearer ? a.names.card(bearer) : "The Ring-bearer";
  }
  // The hero in the staging area the Orc chosen now will guard, named only where an entry says it (16073:A:1): the first player's heroes go first.
  if (templatesOf(entry).some((template) => placeholdersOf(template).includes("hero"))) {
    const next = stagedInOrder(a.game)[0];
    values.hero = next ? (a.game.seatCount > 1 && next.owner != null ? `${a.names.card(next.id)} (Player ${next.owner + 1}'s hero)` : a.names.card(next.id)) : "the next hero";
  }
  // The Embassy's pair being decided ("Player 1's Gandalf with Hill-troll"), named only where an entry says it (146072:B:1).
  if (templatesOf(entry).some((template) => placeholdersOf(template).includes("pair"))) values.pair = embassyPairNow(a.game, (id) => a.names.card(id)) ?? "this pair";
  for (const [name, amount] of Object.entries(entry.bind ?? {})) values[name] = resolveAmount(a.game, amount, scope, a.ctx);
  for (const [name, named] of Object.entries(entry.named ?? {})) {
    const only = pickCandidates(a.game, named.pick, scope.actor, [], scope.sourceId, a.ctx, undefined, undefined, true);
    values[name] = only.length === 1 && only[0] !== undefined ? a.names.card(only[0]) : named.otherwise;
    // `{<name>Cost}`: the printed cost of the card the pick finds (cards tied for the highest cost share one; 0 with no card), where a line turns on it.
    const cost = only[0] === undefined ? undefined : a.ctx.cards.get(a.game.cards[only[0]]?.code ?? "")?.cost;
    values[`${name}Cost`] = cost ?? 0;
  }
  return { values, scope };
}

// The entry for the instruction's verb or for one of its options, with the values its templates read.
function found(a: AskFacts, tail: string | undefined, table?: AsksTable): Hit | null {
  const at = a.at === undefined ? askAt(a, table) : a.at;
  const entry = at?.table[askKey(at.id, at.path, tail ?? a.instruction.verb)];
  return at && entry ? { entry, ...askValues(a, entry) } : null;
}

// What a condition of the entry reads: the seat asked, the card the record is on, and the row a caution is about.
const scopeOf = (a: AskFacts, hit: Hit, picked?: string) => ({ actor: hit.scope.actor, sourceId: a.source, returned: 0, ...(hit.scope.subject ? { subject: hit.scope.subject } : {}), ...(picked ? { picked: [picked] } : hit.scope.picked ? { picked: hit.scope.picked } : {}) });

// A `Text` as it reads now: the first variant whose condition holds, filled. `picked` is the row a caution is about. Null when no variant holds or a placeholder has no value.
function said(a: AskFacts, hit: Hit, text: Text, picked?: string, more?: Values): string | null {
  const scope = scopeOf(a, hit, picked);
  const chosen = typeof text === "string" ? text : text.find((variant) => variant.when === undefined || holds(a.game, variant.when, scope, a.ctx))?.text;
  return chosen === undefined ? null : fill(chosen, { ...hit.values, ...(picked ? { picked: a.names.card(picked) } : {}), ...more });
}

// The warning of one row: its text when the entry's condition holds with that row picked.
function cautionOf(a: AskFacts, hit: Hit, picked?: string): string | undefined {
  const caution = hit.entry.caution;
  if (!caution) return undefined;
  return holds(a.game, caution.when, scopeOf(a, hit, picked), a.ctx) ? (said(a, hit, caution.text, picked) ?? undefined) : undefined;
}

// The first word of a note after "Player 1: " starts lower case when it is an imperative ("Choose 1 of your heroes"); a card's name or an acronym keeps its capital.
const IMPERATIVES = /^(Add|Assign|Attach|Choose|Declare|Discard|Draw|Exhaust|Heal|Look|Move|Name|Pay|Pick|Place|Put|Ready|Remove|Return|Reveal|Search|Select|Shuffle|Take)\b/;
const lowerFirst = (note: string): string => (IMPERATIVES.test(note) ? `${note.charAt(0).toLowerCase()}${note.slice(1)}` : note);

// "Card: why note", led as every family leads (seatSays): "Player 1, Card: why note" two-handed, "Player 1: note" for an owned note with no why, capitalised solo.
function sentence(a: AskFacts, hit: Hit): string | null {
  const { entry, values } = hit;
  const note = entry.note == null ? null : said(a, hit, entry.note);
  const why = entry.why == null ? "" : fill(entry.why, values);
  if (note === null || why === null) return null;
  const owned = entry.owned === true;
  const lead = seatSays(a.game);
  // An owned note leads with the player two-handed ("Player 1: choose ...", as every family writes it) and is capitalised only solo, whichever way the entry wrote its first word.
  if (why === "") return owned ? lead.say(a.game.seatCount > 1 ? lowerFirst(note) : note) : note;
  return owned ? lead.titled(String(values.card), `${why} ${note}`) : `${String(values.card)}: ${why} ${note}`;
}

/** The words of a Pick (or any asking instruction) from its entry, or undefined when it has none and the chain of word families runs. */
export function asksPick(a: AskFacts, table?: AsksTable): AskedWords | undefined {
  const hit = a.instruction.verb === "Choose" ? null : found(a, undefined, table);
  const prompt = hit ? sentence(a, hit) : null;
  if (!hit || prompt === null) return undefined;
  const labels: Record<string, string> = {};
  for (const [id, text] of Object.entries(hit.entry.labels ?? {})) {
    const label = said(a, hit, text);
    if (label !== null) labels[id] = label;
  }
  const cautions: Record<string, string> = {};
  for (const id of a.options ?? []) {
    const caution = cautionOf(a, hit, id);
    if (caution !== undefined) cautions[id] = caution;
  }
  const owned = hit.entry.owned === true && a.game.seatCount > 1;
  const title = hit.entry.title == null ? null : said(a, hit, hit.entry.title);
  return { verb: hit.entry.verb ?? "Choose", prompt, ...(title != null ? { title } : {}), ...(owned ? { owned: true as const } : {}), ...(hit.entry.bare === true ? { bare: true as const } : {}), ...(Object.keys(labels).length > 0 ? { labels } : {}), ...(Object.keys(cautions).length > 0 ? { cautions } : {}) };
}

/** The sentence over a Choose from its entry (the one keyed "Choose"), or undefined. `owned` says it leads with the player. */
export function asksChoose(a: AskFacts, table?: AsksTable): { note: string; owned: boolean; bare?: true } | undefined {
  const hit = found(a, "Choose", table);
  const note = hit ? sentence(a, hit) : null;
  return hit && note !== null ? { note, owned: hit.entry.owned === true && a.game.seatCount > 1, ...(hit.entry.bare === true ? { bare: true as const } : {}) } : undefined;
}

/** The row of one branch of a Choose, and the warning before it sends, from the entry keyed with the option id, or undefined. */
export function asksOption(a: AskFacts, optionId: string, table?: AsksTable): { label?: string; caution?: string } | undefined {
  const hit = found(a, optionId, table);
  if (!hit) return undefined;
  const label = hit.entry.label == null ? undefined : (said(a, hit, hit.entry.label) ?? undefined);
  const caution = cautionOf(a, hit);
  return label === undefined && caution === undefined ? undefined : { ...(label !== undefined ? { label } : {}), ...(caution !== undefined ? { caution } : {}) };
}

/** The Choose a ChooseX opens: one branch for each number, `x<n>`, each setting X. */
export const isXChoice = (choose: Extract<Instruction, { verb: "Choose" }>): boolean =>
  choose.options.length > 0 && choose.options.every((option) => /^x\d+$/.test(option.id) && option.instructions.length === 1 && option.instructions[0]?.verb === "SetX");

const onlyChooseX = (instructions: readonly Instruction[]): PathMatch | null => {
  const paths: string[] = [];
  walk(instructions, (instruction, _next, _after, path) => {
    if (instruction.verb === "ChooseX") paths.push(path);
  });
  return paths.length === 1 && paths[0] !== undefined ? { rank: 2, path: paths[0] } : null;
};

/**
 * The words over the Choose that a ChooseX opens, from the entry keyed with the record's `ChooseX`: its sentence, and the row of each number from `xRows`. The record's ChooseX is the only one in its record (a record with
 * two is not worded, the chain of word families runs), found by the record the queued instruction came from.
 */
export function asksChooseX(a: AskFacts, table?: AsksTable): { note: string; owned: boolean; effectId: string; row: (optionId: string) => string | undefined } | undefined {
  const at = askAtBy(a, table, onlyChooseX);
  const hit = found({ ...a, at }, "ChooseX", table);
  const note = hit ? sentence(a, hit) : null;
  if (!hit || !at || note === null) return undefined;
  const rows = hit.entry.xRows;
  const row = (optionId: string): string | undefined => {
    const x = /^x(\d+)$/.exec(optionId)?.[1];
    if (!rows || x === undefined) return undefined;
    const less = rows.less;
    const base = less ? resolveAmount(a.game, less.of, hit.scope, a.ctx) : 0;
    const left = less ? Math.max(less.min, base - Number(x)) : 0;
    const more: Values = { x: Number(x), ...(less ? { [less.name]: `${left} ${less.unit}${left === 1 ? "" : "s"}` } : {}) };
    return said(a, hit, rows.label, undefined, more) ?? undefined;
  };
  return { note, owned: hit.entry.owned === true && a.game.seatCount > 1, effectId: at.id, row };
}
