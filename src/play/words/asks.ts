// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The words of a choice written as data beside the record (docs/design-system-table.md, Choice tray): an asks file
// (src/play/words/asks/<scenario-id>.ts) holds, for each Pick and Choose of a scenario's records, the sentence the sheet opens with and the rows under it, so a scenario needs no words code. `askWords` and the Choose
// sheet read an entry first; with none, the chain of word families runs as it always did. An entry is keyed as the words allowlist is: `<record id> @<instruction path> <verb | option id>` (record-path.ts).
// The tail is the instruction's verb for the sentence over a Pick or a Choose, and an option id for one branch of a Choose. A game reads only its own scenario's file (`ASKS_BY_SCENARIO[game.scenarioId]`): a card
// several scenarios deal is worded by each scenario's file, never by another's. Every number comes from an `Amount` read with the engine's reader, every warning from a `Condition` read with the engine's, so a
// sentence says what the table holds and no code counts it. Pure.
import type { Amount, Condition, Instruction } from "../../catalog/boundary.ts";
import type { Cause } from "../../rules/core/cause.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { embassyPairNow } from "../readouts/black-gate.ts";
import { ringBearerId } from "../../rules/families/burden/deck.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import { holds } from "../../rules/interpret/conditions.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectById, effectsOf } from "../../rules/windows/listen.ts";

import { ASKS_BY_SCENARIO } from "./asks/index.ts";
import type { ChoiceNames, PickWords } from "./choice.ts";
import { matchOf } from "./record-path.ts";
import { askedSeat, seatSays } from "./seat.ts";

/**
 * Words that change with the table: a template, or variants where the first whose `when` holds is said (one without `when` always holds, so it ends the list). A stage-two sentence says "in play" where stage one says
 * "in the staging area"; the condition is read with the reader the caution's is.
 */
export type Text = string | readonly { when?: Condition; text: string }[];

/**
 * One entry of an asks file. Templates hold `{card}` (the card the record is on), `{owner}` ("Player N", the seat asked), `{picked}` (the card of the row a caution is about: a caution's text only), `{host}` (the card the record's card lies on), `{pair}` (the Embassy's pair being decided: the player card with its owner and the encounter card it is paired with) and `{ringBearer}` (the hero with the Ring-bearer trait), `{n}` (what the instruction after a Pick deals or places, read now: a Pick's entry only, a Choose
 * has none), `{left}` (the damage an AssignDamage still has to place, counting the step asked: its note only), `{pursuitLimit}` (the value at which the players lose, in a scenario with a pursuit tracker) and a `{name}` for each key of `bind`. Every `Text` below is a template or variants.
 * - `note`: the sentence over a Pick or a Choose (the entry keyed with the instruction's verb).
 * - `why`: the reason the window opened. It is said after the card's title and before the note, "Card: why note" ("Player 1, Card: why note" when owned and two-handed).
 * - `owned`: one player's own choice. Two-handed the sentence leads with the player and the sheet adds no "Player N chooses."; solo it has no lead, and a note with no `why` is capitalised.
 * - `verb`: the button's word over a Pick, one or two words ("Exhaust"); "Choose" when absent.
 * - `labels`: the rows of a Pick that are no card, by option id ("skip", "done"). A key that names a card is refused.
 * - `label`: the row of one branch of a Choose (the entry keyed with the option id).
 * - `bind`: a name for each number a template says, as the `Amount` the engine reads.
 * - `caution`: the two-tap warning, said as "Tap again: ..." when `when` holds. It belongs to a row: on a Pick `when` is read once for each row with `picked` set to that row's id, so the confirm arms only on the row that loses
 *   the game, and on a Choose it is read for the branch the entry is keyed with. A warning that holds whatever is picked is a `when` that does not read `picked`; there is no sheet-wide caution.
 */
export type Ask = {
  note?: Text;
  why?: string;
  owned?: true;
  verb?: string;
  label?: Text;
  labels?: Readonly<Record<string, Text>>;
  bind?: Readonly<Record<string, Amount>>;
  caution?: { when: Condition; text: Text };
};

export type AsksTable = Readonly<Record<string, Ask>>;

/** What a Pick's entry says: the words the chain returns, with the rows that are no card and the warning of each row an entry can add. */
export type AskedWords = PickWords & { labels?: Readonly<Record<string, string>>; cautions?: Readonly<Record<string, string>> };

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
  return [...textsOf(entry.note), ...(entry.why == null ? [] : [entry.why]), ...textsOf(entry.label), ...Object.values(entry.labels ?? {}).flatMap(textsOf), ...textsOf(entry.caution?.text)];
}

/** The placeholders of an entry that no value answers: none of `card`, `owner`, `picked`, `host`, `ringBearer`, `n` (only where `withN`: a Pick has what its next instruction deals, a Choose has nothing), `pursuitLimit` and its `bind` names. */
export function unknownPlaceholders(entry: Ask, withN = true): string[] {
  const known = new Set(["card", "owner", "picked", "host", "ringBearer", "pair", "left", "pursuitLimit", ...(withN ? ["n"] : []), ...Object.keys(entry.bind ?? {})]);
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

/** The table of the game's own scenario (its asks file), or undefined when it has none. `by` is the barrel's `ASKS_BY_SCENARIO`. */
export const asksOfScenario = (game: ScenarioState, by: Readonly<Record<string, AsksTable>> = ASKS_BY_SCENARIO): AsksTable | undefined => by[game.scenarioId];

const tableOf = (a: AskFacts, table?: AsksTable): AsksTable | undefined => table ?? asksOfScenario(a.game);

/**
 * Which record holds the instruction, and the path in it, for the table of the game's scenario: null at once for a scenario with no asks file, else the best fit among the records that have an entry (the queued
 * instruction's cause first, then the frame's effect, then the records of the card). A record that holds the very instruction, or an equal copy, beats one that fits only as a copy the engine filled in.
 */
export function askAt(a: AskFacts, table?: AsksTable): AskAt | null {
  const entries = tableOf(a, table);
  if (!entries) return null;
  const ids = new Set(Object.keys(entries).map((key) => key.slice(0, key.indexOf(" "))));
  if (ids.size === 0) return null;
  const id = a.cause && "effect" in a.cause ? a.cause.effect : a.effectId;
  const code = a.source ? (a.game.cards[a.source]?.code ?? a.source) : undefined;
  let best: { id: string; path: string; rank: number } | null = null;
  for (const record of [id ? effectById(a.ctx, id) : undefined, ...(code ? effectsOf(a.ctx, code) : [])]) {
    if (!record || !ids.has(record.id)) continue;
    const match = matchOf(record.instructions, a.instruction);
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
  const hostId = a.source ? a.game.cards[a.source]?.host : undefined;
  // An AssignDamage not yet split into steps holds all of its amount.
  if (a.instruction.verb === "AssignDamage") values.left = a.instruction.left ?? resolveAmount(a.game, a.instruction.amount, scope, a.ctx);
  values.host = hostId ? a.names.card(hostId) : "Its host";
  if (templatesOf(entry).some((template) => placeholdersOf(template).includes("ringBearer"))) {
    const bearer = ringBearerId(a.game, a.ctx);
    values.ringBearer = bearer ? a.names.card(bearer) : "The Ring-bearer";
  }
  // The Embassy's pair being decided ("Player 1's Gandalf with Hill-troll"), named only where an entry says it (146072:B:1).
  if (templatesOf(entry).some((template) => placeholdersOf(template).includes("pair"))) values.pair = embassyPairNow(a.game, (id) => a.names.card(id)) ?? "this pair";
  for (const [name, amount] of Object.entries(entry.bind ?? {})) values[name] = resolveAmount(a.game, amount, scope, a.ctx);
  return { values, scope };
}

// The entry for the instruction's verb or for one of its options, with the values its templates read.
function found(a: AskFacts, tail: string | undefined, table?: AsksTable): Hit | null {
  const at = a.at === undefined ? askAt(a, table) : a.at;
  const entry = at?.table[askKey(at.id, at.path, tail ?? a.instruction.verb)];
  return at && entry ? { entry, ...askValues(a, entry) } : null;
}

// What a condition of the entry reads: the seat asked, the card the record is on, and the row a caution is about.
const scopeOf = (a: AskFacts, hit: Hit, picked?: string) => ({ actor: hit.scope.actor, sourceId: a.source, returned: 0, ...(picked ? { picked: [picked] } : hit.scope.picked ? { picked: hit.scope.picked } : {}) });

// A `Text` as it reads now: the first variant whose condition holds, filled. `picked` is the row a caution is about. Null when no variant holds or a placeholder has no value.
function said(a: AskFacts, hit: Hit, text: Text, picked?: string): string | null {
  const scope = scopeOf(a, hit, picked);
  const chosen = typeof text === "string" ? text : text.find((variant) => variant.when === undefined || holds(a.game, variant.when, scope, a.ctx))?.text;
  return chosen === undefined ? null : fill(chosen, picked ? { ...hit.values, picked: a.names.card(picked) } : hit.values);
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
  return { verb: hit.entry.verb ?? "Choose", prompt, ...(owned ? { owned: true as const } : {}), ...(Object.keys(labels).length > 0 ? { labels } : {}), ...(Object.keys(cautions).length > 0 ? { cautions } : {}) };
}

/** The sentence over a Choose from its entry (the one keyed "Choose"), or undefined. `owned` says it leads with the player. */
export function asksChoose(a: AskFacts, table?: AsksTable): { note: string; owned: boolean } | undefined {
  const hit = found(a, "Choose", table);
  const note = hit ? sentence(a, hit) : null;
  return hit && note !== null ? { note, owned: hit.entry.owned === true && a.game.seatCount > 1 } : undefined;
}

/** The row of one branch of a Choose, and the warning before it sends, from the entry keyed with the option id, or undefined. */
export function asksOption(a: AskFacts, optionId: string, table?: AsksTable): { label?: string; caution?: string } | undefined {
  const hit = found(a, optionId, table);
  if (!hit) return undefined;
  const label = hit.entry.label == null ? undefined : (said(a, hit, hit.entry.label) ?? undefined);
  const caution = cautionOf(a, hit);
  return label === undefined && caution === undefined ? undefined : { ...(label !== undefined ? { label } : {}), ...(caution !== undefined ? { caution } : {}) };
}
