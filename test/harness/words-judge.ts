// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The one judgement of a choice's words, shared by src/play/words/scenario-words.test.ts and src/play/words/asks.test.ts: a Pick is worded by
// `askWords`, the function the sheet calls (the record's asks entry first, then the families), and a branch of a Choose by the entry's label, else `branchWords`. A sentence fails when it is not a sentence, is a bare
// "Choose a player.", or is what the same function says for a verb or an option it does not know (the fallback). Each verdict carries the line the dump prints.
import type { Effect, Instruction } from "../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../src/rules/core/state.ts";
import type { ReduceContext } from "../../src/rules/interpret/interpret.ts";
import { askWords } from "../../src/play/words/ask.ts";
import { askKey, askValues, asksChoose, asksOption, asksPick, fill, templatesOf, textsOf, unknownPlaceholders, type Ask, type AsksTable } from "../../src/play/words/asks.ts";
import { dealtNow } from "../../src/play/words/scenarios/aflame.ts";
import { branchWords, pickWords, type ChoiceNames } from "../../src/play/words/choice.ts";
import { askedSeat } from "../../src/play/words/seat.ts";

import { asksPlayer, sendsWithoutAsking, walk } from "./record-walk.ts";

export type WordsTable = { game: ScenarioState; ctx: ReduceContext; names: ChoiceNames };
export type Verdict = { key: string; line: string; problem: string | null };

export const BARE = /^Choose an? [\w-]+\.$/;

/** The verdict on the words of an instruction that asks a player something, or null when it asks nobody. */
export function judgePick(t: WordsTable, effect: Effect, instruction: Instruction, next: Instruction | undefined, after: readonly Instruction[], path: string): Verdict | null {
  if (!asksPlayer(instruction) || sendsWithoutAsking(instruction)) return null;
  // An asks entry's {n} is what the instruction after the pick deals, read as the sheet reads it; the chain's words are judged as they always were, without it.
  const now = dealtNow(t.game, t.ctx, next, askedSeat(t.game), effect.cardCode);
  const facts = { ...t, instruction, source: effect.cardCode, effectId: effect.id, ...(now !== undefined ? { amountNow: now } : {}) };
  const written = asksPick({ ...facts, options: [] }) !== undefined;
  const words = askWords({ ...t, instruction, queue: next ? [next, ...after] : [], options: [], source: effect.cardCode, picked: null, effectId: effect.id, ...(written && now !== undefined ? { amountNow: now } : {}) });
  // What the same function says for a Pick with no instruction after it, or for a verb it has no words for.
  const fallback = pickWords(instruction.verb === "Pick" ? instruction : ({ verb: "NoSuchVerb" } as unknown as Instruction), undefined, t.names, null);
  const key = `${effect.id} @${path} ${instruction.verb}`;
  const problem = !/^[A-Z].*[.?]$/.test(words.prompt) ? `not a sentence: ${words.prompt}` : BARE.test(words.prompt) ? `a bare "${words.prompt}"` : words.prompt === fallback.prompt ? `the fallback sentence "${words.prompt}"` : null;
  return { key, line: `${key}: ${words.verb} / ${words.prompt}`, problem };
}

/** The verdict on the row of one branch of a Choose: the record's label, else `branchWords`, which answers an option it has no words for with the option's id capitalised. */
export function judgeBranch(t: WordsTable, effect: Effect, choose: Extract<Instruction, { verb: "Choose" }>, optionId: string, path: string): Verdict {
  const written = asksOption({ ...t, instruction: choose, source: effect.cardCode, effectId: effect.id }, optionId)?.label;
  const words = written ?? branchWords(choose, optionId, t.game, t.names, effect.cardCode);
  const key = `${effect.id} @${path} ${optionId}`;
  const problem = words === optionId.charAt(0).toUpperCase() + optionId.slice(1) ? `the fallback sentence "${words}"` : !/^[A-Z0-9]/.test(words) ? `not a sentence: ${words}` : null;
  return { key, line: `${key}: ${words}`, problem };
}

// The static checks of one asks entry (docs/design-system-table.md, Choice tray), shared by src/play/words/asks.test.ts and `pnpm scenario words`.
const wordsIn = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
// A card id the game makes (i12) or a card code: a row of a Pick that names a card is that card's, and a label may not rename it.
const CARD_LIKE = /^(i\d+|\d{5,6})$/;
/** The longest sentence an entry may say, in words (src/play/words/sentence-length.test.ts). */
export const SENTENCE_LIMIT = 25;

/** What an entry breaks without a table to render it on: a left-over `todo` stub, a verb of other than one or two words, a label that renames a card, a caution that does not start "Tap again:". */
export function entryProblems(key: string, entry: Ask): string[] {
  const problems: string[] = [];
  if (entry.todo !== undefined) problems.push(`${key}: a stub, write the words from the printed line and delete its todo (${entry.todo})`);
  if (entry.verb !== undefined && (wordsIn(entry.verb) < 1 || wordsIn(entry.verb) > 2)) problems.push(`${key}: the verb "${entry.verb}" is not one or two words`);
  for (const label of Object.keys(entry.labels ?? {})) if (CARD_LIKE.test(label)) problems.push(`${key}: labels["${label}"] names a card, and a card's row keeps its own name`);
  for (const text of textsOf(entry.caution?.text)) if (!text.startsWith("Tap again:")) problems.push(`${key}: the caution "${text}" does not start "Tap again:"`);
  return problems;
}

/** The tails an instruction's entries are keyed with: its verb, and for a Choose each option id too. */
export const tailsOf = (instruction: Instruction): string[] => [instruction.verb, ...(instruction.verb === "Choose" ? instruction.options.map((option) => option.id) : [])];

/** What the entry keyed `<effect> @<at> <tail>` breaks when rendered as the sheet renders it on `t`'s table, and the text it says; null when `asks` has no such entry. */
export function renderedEntry(t: WordsTable, effect: Effect, instruction: Instruction, next: Instruction | undefined, at: string, tail: string, asks: AsksTable): { key: string; problems: string[]; line: string } | null {
  const key = askKey(effect.id, at, tail);
  const entry = asks[key];
  if (!entry) return null;
  const problems: string[] = [];
  // A Pick's {n} is what the instruction after it deals, read now; a Choose and its branches have none.
  const asksCard = instruction.verb !== "Choose";
  const now = asksCard ? dealtNow(t.game, t.ctx, next, askedSeat(t.game), effect.cardCode) : undefined;
  const asked = { ...t, instruction, source: effect.cardCode, effectId: effect.id, options: [], ...(now !== undefined ? { amountNow: now } : {}), ...(asksCard ? { again: () => 0 } : {}) };
  const unknown = unknownPlaceholders(entry, asksCard);
  if (unknown.length > 0) problems.push(`${key}: no value for ${unknown.map((name) => `{${name}}`).join(", ")}`);
  // Every template, each variant and each caution, whether its condition holds on this table or not.
  const { values } = askValues(asked, entry);
  const texts: string[] = [];
  for (const template of templatesOf(entry)) {
    const text = fill(template, values);
    if (text === null) problems.push(`${key}: "${template}" does not render (a placeholder has no value here)`);
    else texts.push(text);
  }
  // The sentence the sheet opens with, led as the sheet leads it.
  const said = tail === "Choose" ? asksChoose(asked, asks)?.note : tail === instruction.verb ? asksPick(asked, asks)?.prompt : undefined;
  if (typeof entry.note === "string" && said === undefined && tail === instruction.verb) problems.push(`${key}: the note does not render`);
  // The sheet says the entry's own sentence: a record that holds the same object at two paths would match the first and say the other's.
  const own = typeof entry.note === "string" ? fill(entry.note, values) : null;
  if (own !== null && said !== undefined && !said.toLowerCase().includes(own.toLowerCase())) problems.push(`${key}: the sheet says "${said}", not the entry's "${own}" (another instruction of the record was matched)`);
  if (said !== undefined) texts.push(said);
  for (const text of texts) {
    if (/\{\w+\}/.test(text)) problems.push(`${key}: "${text}" has a placeholder left`);
    // The sentence-length rule of src/play/words/sentence-length.test.ts: split after . ! ? and count words.
    for (const part of text.split(/(?<=[.!?])\s+/)) if (wordsIn(part) > SENTENCE_LIMIT) problems.push(`${key}: (${wordsIn(part)} words) ${part}`);
  }
  return { key, problems, line: `${key}: ${[...new Set(texts)].join(" / ")}` };
}

/** One thing a scenario's records ask that the words must say: a Pick (its verb), a Choose's sentence (`Choose`, optional) or one branch of a Choose (its option id, a row label). */
export type AskRow = { key: string; effect: Effect; path: string; kind: "pick" | "choose" | "branch"; tail: string; verdict: Verdict | null };

/** Every Pick and Choose of `records`, in record order, with the verdict the words test gives it (a Choose's sentence is not judged: the branches are). */
export function askRows(t: WordsTable, records: readonly Effect[]): AskRow[] {
  const rows: AskRow[] = [];
  for (const effect of records) {
    walk(effect.instructions, (instruction, next, after, path) => {
      const pick = judgePick(t, effect, instruction, next, after, path);
      if (pick) rows.push({ key: pick.key, effect, path, kind: "pick", tail: instruction.verb, verdict: pick });
      if (instruction.verb !== "Choose") return;
      rows.push({ key: askKey(effect.id, path, "Choose"), effect, path, kind: "choose", tail: "Choose", verdict: null });
      for (const option of instruction.options) rows.push({ key: askKey(effect.id, path, option.id), effect, path, kind: "branch", tail: option.id, verdict: judgeBranch(t, effect, instruction, option.id, path) });
    });
  }
  return rows;
}
