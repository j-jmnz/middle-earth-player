// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The one judgement of a choice's words, shared by src/play/words/scenario-words.test.ts and src/play/words/asks.test.ts: a Pick is worded by
// `askWords`, the function the sheet calls (the record's asks entry first, then the families), and a branch of a Choose by the entry's label, else `branchWords`. A sentence fails when it is not a sentence, is a bare
// "Choose a player.", or is what the same function says for a verb or an option it does not know (the fallback). Each verdict carries the line the dump prints.
import type { Effect, Instruction } from "../../src/catalog/boundary.ts";
import type { ScenarioState } from "../../src/rules/core/state.ts";
import type { ReduceContext } from "../../src/rules/interpret/interpret.ts";
import { askWords } from "../../src/play/words/ask.ts";
import { asksOption, asksPick } from "../../src/play/words/asks.ts";
import { dealtNow } from "../../src/play/words/scenarios/aflame.ts";
import { branchWords, pickWords, type ChoiceNames } from "../../src/play/words/choice.ts";
import { askedSeat } from "../../src/play/words/seat.ts";

import { asksPlayer, sendsWithoutAsking } from "./record-walk.ts";

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
  const problem = !/^[A-Z].*\.$/.test(words.prompt) ? `not a sentence: ${words.prompt}` : BARE.test(words.prompt) ? `a bare "${words.prompt}"` : words.prompt === fallback.prompt ? `the fallback sentence "${words.prompt}"` : null;
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
