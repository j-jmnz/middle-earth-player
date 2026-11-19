import type { Effect } from "../../catalog/boundary.ts";

import type { ReduceContext } from "../interpret/interpret.ts";
import type { ScenarioState } from "./state.ts";

// Card codes whose records mention a piece of vocabulary, per effect list.
const READERS = new WeakMap<readonly Effect[], Map<string, ReadonlySet<string>>>();

// A record's JSON text, and its instructions', per record. A record is never changed, and every list a test builds (the shared list
// less one line's records) holds the same record objects, so a needle read on a new list stringifies nothing again.
const RECORD_TEXT = new WeakMap<Effect, string>();
const INSTRUCTIONS_TEXT = new WeakMap<Effect, string>();

function textOf(memo: WeakMap<Effect, string>, effect: Effect, write: (effect: Effect) => unknown): string {
  let text = memo.get(effect);
  if (text === undefined) {
    text = JSON.stringify(write(effect));
    memo.set(effect, text);
  }
  return text;
}

// Whether a record reads a needle, per needle and record: the needles are the engine's own literals, so a new list asks each record
// once per needle, not once per list.
const MENTIONS = new Map<string, WeakMap<Effect, boolean>>();

function mentions(effect: Effect, key: string, test: (effect: Effect) => boolean): boolean {
  let byEffect = MENTIONS.get(key);
  if (!byEffect) {
    byEffect = new WeakMap();
    MENTIONS.set(key, byEffect);
  }
  let found = byEffect.get(effect);
  if (found === undefined) {
    found = test(effect);
    byEffect.set(effect, found);
  }
  return found;
}

// The codes of the cards in a game, per cards record. A record is never changed once the reducer returns it (docs/architecture.md,
// State), and many states share one (a mode or a window change keeps it), so the set is built once for all of them.
const PRESENT = new WeakMap<ScenarioState["cards"], ReadonlySet<string>>();

function presentCodes(state: ScenarioState): ReadonlySet<string> {
  let codes = PRESENT.get(state.cards);
  if (!codes) {
    codes = new Set(Object.values(state.cards).map((card) => card.code));
    PRESENT.set(state.cards, codes);
  }
  return codes;
}

// Whether a card of one of these codes is in the game, walking the smaller of the two sets.
function anyPresent(state: ScenarioState, found: ReadonlySet<string>): boolean {
  if (found.size === 0) return false;
  const present = presentCodes(state);
  const [few, many] = found.size <= present.size ? [found, present] : [present, found];
  for (const code of few) if (many.has(code)) return true;
  return false;
}

// Whether a card in the game has a record that reads this piece of vocabulary. What the engine remembers only for such a card
// (resources spent this round, who paid for a card, a successful quest) is kept only in a game that has one, so every other
// game's state stays as it was.
export function gameReads(state: ScenarioState, ctx: ReduceContext, needle: string): boolean {
  let byNeedle = READERS.get(ctx.effects);
  if (!byNeedle) {
    byNeedle = new Map();
    READERS.set(ctx.effects, byNeedle);
  }
  let codes = byNeedle.get(needle);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => mentions(effect, needle, (record) => textOf(RECORD_TEXT, record, (it) => it).includes(needle))).map((effect) => effect.cardCode));
    byNeedle.set(needle, codes);
  }
  return anyPresent(state, codes);
}

/**
 * Whether a card in the game has a record that answers this trigger and reads this piece of vocabulary in its instructions
 * (a failed quest answered with an X amount, "place X progress here"): what the engine stamps on that event only for such a card.
 */
export function gameReadsOnTrigger(state: ScenarioState, ctx: ReduceContext, trigger: string, needle: string): boolean {
  const key = `${trigger}\u0000${needle}`;
  let byNeedle = READERS.get(ctx.effects);
  if (!byNeedle) {
    byNeedle = new Map();
    READERS.set(ctx.effects, byNeedle);
  }
  let codes = byNeedle.get(key);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => "trigger" in effect && effect.trigger === trigger && mentions(effect, key, (record) => textOf(INSTRUCTIONS_TEXT, record, (it) => it.instructions).includes(needle))).map((effect) => effect.cardCode));
    byNeedle.set(key, codes);
  }
  return anyPresent(state, codes);
}
