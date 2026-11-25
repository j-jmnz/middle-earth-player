// Rules: rr.surge, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json).
// The check the families that stop a surge chain share (pelargir/surge-chain.ts, ring-maker/surge-chain.ts). A game can drain its encounter deck into the staging area, the engaged rows and the hidden cards until a surging card is the only card it has left. The core's reset would
// shuffle that card back and reveal it inside its own surge for ever. Each family decides in which game and for which cards the chain is cut, then asks this check whether the state is such a chain.
import type { ScenarioState } from "../core/state.ts";

/** The deck is empty and every card of the discard pile is a card whose reveal is past its staging and still open (a surge chain, rr.surge) and that `counts` accepts: the surge finds no card and the chain ends; the reset that follows the last reveal (faq.last-encounter-card) runs as usual. */
export function inSurgeChain(state: ScenarioState, counts: (code: string) => boolean = () => true): boolean {
  if (state.encounterDeck.length > 0 || state.encounterDiscard.length === 0) return false;
  const open = new Set(state.stack.filter((frame) => frame.frame === "reveal" && frame.step >= 6).map((frame) => frame.cardId));
  return state.encounterDiscard.every((id) => open.has(id) && counts(state.cards[id]?.code ?? ""));
}

// The table without what only counts passes: the stack, the seed and its cursor, the id counters, the clock and the order in which cards entered play. Two resets of one chain that find the same table are one lap of a loop that changes nothing.
function tableMark(state: ScenarioState): string {
  const { stack: _stack, seed: _seed, seedCursor: _cursor, nextId: _next, frameSeq: _seq, clock: _clock, cards, ...table } = state;
  return JSON.stringify({ ...table, cards: Object.values(cards).map(({ enteredPlay: _entered, ...card }) => card) });
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
