// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The words of a choice written as data beside the record (docs/design-system-table.md, Choice tray): an asks file
// (src/play/words/asks/<scenario-id>.ts) holds, for each Pick and Choose of a scenario's records, the sentence the sheet opens with and the rows under it, so a scenario needs no words code. `askWords` and the Choose
// sheet read an entry first; with none, the chain of word families runs as it always did. An entry is keyed as the words allowlist is: `<record id> @<instruction path> <verb | option id>` (record-path.ts).
// The tail is the instruction's verb for the sentence over a Pick or a Choose, and an option id for one branch of a Choose. Every number comes from an `Amount` read with the engine's reader, every warning from a
// `Condition` read with the engine's, so a sentence says what the table holds and no code counts it. Pure.
import type { Amount, Condition, Instruction } from "../../catalog/boundary.ts";
import type { Cause } from "../../rules/core/cause.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import { holds } from "../../rules/interpret/conditions.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectById, effectsOf } from "../../rules/windows/listen.ts";

import { ASKS } from "./asks/index.ts";
import type { ChoiceNames, PickWords } from "./choice.ts";
import { pathOf } from "./record-path.ts";
import { askedSeat } from "./seat.ts";

/**
 * One entry of an asks file. Templates hold `{card}` (the card the record is on), `{owner}` ("Player N", the seat asked), `{n}` (what the instruction after a pick deals or places, read now) and a `{name}` for each key of `bind`.
 * - `note`: the sentence over a Pick or a Choose (the entry keyed with the instruction's verb).
 * - `why`: the reason the window opened, said after the card's title: "Card: why note".
 * - `owned`: one player's own choice, so two-handed the sentence leads with "Player N, " and the sheet adds no "Player N chooses."; solo it has no lead.
 * - `verb`: the button's word over a Pick ("Exhaust"); "Choose" when absent.
 * - `labels`: the rows of a Pick that are no card, by option id.
 * - `label`: the row of one branch of a Choose (the entry keyed with the option id).
 * - `bind`: a name for each number a template says, as the `Amount` the engine reads.
 * - `caution`: the two-tap warning, said when `when` holds (on a Pick it arms the confirm whatever is picked, on a branch only that row).
 */
export type Ask = {
  note?: string;
  why?: string;
  owned?: true;
  verb?: string;
  label?: string;
  labels?: Readonly<Record<string, string>>;
  bind?: Readonly<Record<string, Amount>>;
  caution?: { when: Condition; text: string };
};

export type AsksTable = Readonly<Record<string, Ask>>;

/** What a Pick's entry says: the words the chain returns, with the rows and the warning an entry can add. */
export type AskedWords = PickWords & { labels?: Readonly<Record<string, string>>; caution?: string };

/** The table the open window is at: the instruction asked, the record it came from (the frame's effect id, or the cause of the queued instruction) and the card the record is on. */
export type AskFacts = { game: ScenarioState; ctx: ReduceContext; names: ChoiceNames; instruction: Instruction; effectId?: string; cause?: Cause; source: string | null; amountNow?: number };

/** The key of an entry. */
export const askKey = (effectId: string, path: string, tail: string): string => `${effectId} @${path} ${tail}`;

const PLACEHOLDER = /\{(\w+)\}/g;

/** The names a template says between braces. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((found) => found[1] ?? "");
}

/** Every template of an entry. */
export function templatesOf(entry: Ask): string[] {
  return [entry.note, entry.why, entry.label, ...Object.values(entry.labels ?? {}), entry.caution?.text].filter((template) => template != null);
}

/** The placeholders of an entry that no value answers: none of `card`, `owner`, `n` and its `bind` names. */
export function unknownPlaceholders(entry: Ask): string[] {
  const known = new Set(["card", "owner", "n", ...Object.keys(entry.bind ?? {})]);
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

// The records that may hold the instruction, the frame's own first: a frame that runs several records of one timing names the first, the queued instruction's cause names the one it came from.
function recordsOf(a: AskFacts): { id: string; path: string } | null {
  const id = a.cause && "effect" in a.cause ? a.cause.effect : a.effectId;
  const code = a.source ? (a.game.cards[a.source]?.code ?? a.source) : undefined;
  const records = [id ? effectById(a.ctx, id) : undefined, ...(code ? effectsOf(a.ctx, code) : [])];
  for (const record of records) {
    const path = record ? pathOf(record.instructions, a.instruction) : null;
    if (record && path !== null) return { id: record.id, path };
  }
  return null;
}

// The entry for the instruction's verb or for one of its options, with the values its templates read.
function found(a: AskFacts, tail: string | undefined, table: AsksTable): { entry: Ask; values: Record<string, string | number | undefined>; scope: ReturnType<typeof frameScope> } | null {
  if (Object.keys(table).length === 0) return null;
  const at = recordsOf(a);
  const entry = at ? table[askKey(at.id, at.path, tail ?? a.instruction.verb)] : undefined;
  if (!entry) return null;
  const seat = askedSeat(a.game);
  const scope = frameScope(a.game, seat, a.source);
  const values: Record<string, string | number | undefined> = { card: a.source ? a.names.card(a.source) : "This card", owner: `Player ${seat + 1}`, n: a.amountNow };
  for (const [name, amount] of Object.entries(entry.bind ?? {})) values[name] = resolveAmount(a.game, amount, scope, a.ctx);
  return { entry, values, scope };
}

function cautionOf(a: AskFacts, hit: NonNullable<ReturnType<typeof found>>): string | undefined {
  const caution = hit.entry.caution;
  if (!caution || !holds(a.game, caution.when, { actor: hit.scope.actor, sourceId: a.source, returned: 0, ...(hit.scope.picked ? { picked: hit.scope.picked } : {}) }, a.ctx)) return undefined;
  return fill(caution.text, hit.values) ?? undefined;
}

// "Card: why note", led by the player when the choice is the player's own and the table has two.
function sentence(entry: Ask, values: Readonly<Record<string, string | number | undefined>>, game: ScenarioState): string | null {
  const note = entry.note == null ? null : fill(entry.note, values);
  const why = entry.why == null ? "" : fill(entry.why, values);
  if (note === null || why === null) return null;
  const said = why === "" ? note : `${String(values.card)}: ${why} ${note}`;
  return entry.owned && game.seatCount > 1 ? `${String(values.owner)}, ${said}` : said;
}

/** The words of a Pick (or any asking instruction) from its entry, or undefined when it has none and the chain of word families runs. */
export function asksPick(a: AskFacts, table: AsksTable = ASKS): AskedWords | undefined {
  const hit = a.instruction.verb === "Choose" ? null : found(a, undefined, table);
  const prompt = hit ? sentence(hit.entry, hit.values, a.game) : null;
  if (!hit || prompt === null) return undefined;
  const labels: Record<string, string> = {};
  for (const [id, template] of Object.entries(hit.entry.labels ?? {})) {
    const label = fill(template, hit.values);
    if (label !== null) labels[id] = label;
  }
  const caution = cautionOf(a, hit);
  return { verb: hit.entry.verb ?? "Choose", prompt, ...(hit.entry.owned && a.game.seatCount > 1 ? { owned: true as const } : {}), ...(Object.keys(labels).length > 0 ? { labels } : {}), ...(caution ? { caution } : {}) };
}

/** The sentence over a Choose from its entry (the one keyed "Choose"), or undefined. `owned` says it leads with the player. */
export function asksChoose(a: AskFacts, table: AsksTable = ASKS): { note: string; owned: boolean } | undefined {
  const hit = found(a, "Choose", table);
  const note = hit ? sentence(hit.entry, hit.values, a.game) : null;
  return hit && note !== null ? { note, owned: hit.entry.owned === true && a.game.seatCount > 1 } : undefined;
}

/** The row of one branch of a Choose, and the warning before it sends, from the entry keyed with the option id, or undefined. */
export function asksOption(a: AskFacts, optionId: string, table: AsksTable = ASKS): { label?: string; caution?: string } | undefined {
  const hit = found(a, optionId, table);
  if (!hit) return undefined;
  const label = hit.entry.label == null ? undefined : (fill(hit.entry.label, hit.values) ?? undefined);
  const caution = cautionOf(a, hit);
  return label === undefined && caution === undefined ? undefined : { ...(label !== undefined ? { label } : {}), ...(caution !== undefined ? { caution } : {}) };
}
