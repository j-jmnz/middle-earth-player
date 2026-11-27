// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json).
// The check a surge chain shares with the families that hold one (pelargir/surge-chain.ts, ring-maker/surge-chain.ts). A game can drain its encounter deck into the staging area, the engaged rows and the hidden cards until a surging card is the only card it has left. The core's reset would
// shuffle that card back and reveal it inside its own surge for ever. The core cuts a repeating chain in every game (repeatsChain: a reset that finds the table an earlier reset of the chain found); a family adds its own hold for the chains it names (inSurgeChain with a filter on the cards).
import type { CardInstance, ScenarioState } from "../core/state.ts";

/** The deck is empty and every card of the discard pile is a card whose reveal is past its staging and still open (a surge chain, rr.surge) and that `counts` accepts: the surge finds no card and the chain ends; the reset that follows the last reveal (faq.last-encounter-card) runs as usual. */
export function inSurgeChain(state: ScenarioState, counts: (code: string) => boolean = () => true): boolean {
  if (state.encounterDeck.length > 0 || state.encounterDiscard.length === 0) return false;
  const open = new Set(state.stack.filter((frame) => frame.frame === "reveal" && frame.step >= 6).map((frame) => frame.cardId));
  return state.encounterDiscard.every((id) => open.has(id) && counts(state.cards[id]?.code ?? ""));
}

/**
 * The table as facts: the state without what only counts passes or records history, and without the scenario's constant data. Two states that return the same facts hold the same game. It leaves out: the stack and the window (the running frames and the open question), the seed (it never changes) and its cursor, the id counters (`nextId`, `frameSeq`), the clock, the undo log (every accepted intent changes it), `setup`, `stages`, `widgets` and `resolution` (the scenario's constant data), and the order in which cards entered play (`enteredPlay`, a count). It keeps `revealCursor` (the seats still to reveal: a game fact) and every modifier, in the state's order; a caller that compares orders sorts them. Used by the surge chain's mark (below) and by the words that compare the orders of a Forced window (play/words/table-changes.ts).
 */
export function tableFacts(state: ScenarioState): Omit<ScenarioState, "cards" | "stack" | "window" | "seed" | "seedCursor" | "nextId" | "frameSeq" | "clock" | "undo" | "setup" | "stages" | "widgets" | "resolution"> & { readonly cards: readonly Omit<CardInstance, "enteredPlay">[] } {
  const { stack: _stack, window: _window, seed: _seed, seedCursor: _cursor, nextId: _next, frameSeq: _seq, clock: _clock, undo: _undo, setup: _setup, stages: _stages, widgets: _widgets, resolution: _resolution, cards, ...table } = state;
  return { ...table, cards: Object.values(cards).map(({ enteredPlay: _entered, ...card }) => card) };
}

// The mark of a table is the length of its facts' text and a 32-bit FNV-1a hash of it, kept on the reveal frame. Two resets of one chain that find the same table are one lap of a loop that changes nothing.
function tableMark(state: ScenarioState): string {
  const text = JSON.stringify(tableFacts(state));
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${text.length}:${hash.toString(16)}`;
}

/** The general end of a surge chain that changes nothing (rr.surge, rr.running-out-of-cards): the reset is about to shuffle the discard pile back inside a chain (every card of it a reveal still open), and the table is the one an earlier reset of the chain found. A chain whose passes change the game (threat, damage, a token, a time counter) finds a new table each pass and goes on. Returns the state to continue with, and whether the reset is held. */
export function repeatsChain(state: ScenarioState): { state: ScenarioState; held: boolean } {
  if (!inSurgeChain(state)) return { state, held: false };
  const mark = tableMark(state);
  const reveals = state.stack.filter((frame) => frame.frame === "reveal");
  if (reveals.some((frame) => frame.data.kind === "reveal" && frame.data.chainMark === mark)) return { state, held: true };
  const top = state.stack[state.stack.length - 1];
  if (!top || top.frame !== "reveal" || top.data.kind !== "reveal") return { state, held: false };
  const stack = [...state.stack.slice(0, -1), { ...top, data: { ...top.data, chainMark: mark } }];
  return { state: { ...state, stack }, held: false };
}
