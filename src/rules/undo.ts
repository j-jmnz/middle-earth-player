import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import type { CardInstance, ScenarioState, UndoLog } from "./state.ts";

export type ReduceFn = (
  state: ScenarioState,
  intent: PlayerIntent,
  ctx: ReduceContext,
) => { ok: true; state: ScenarioState; steps: readonly EngineStep[] } | { ok: false; reason: string; state: ScenarioState };

let reduceFn: ReduceFn | null = null;

export function bindReduce(reduce: ReduceFn): void {
  reduceFn = reduce;
}

// The state at a phase boundary, kept by reference: a state is never changed once the reducer returns it, so there is nothing
// to copy. The card map is held apart (`undo.cards`) and the snapshot carries none, and its own `undo` is empty, so the
// snapshots do not chain.
export function snapshotOf(state: ScenarioState): UndoLog {
  return {
    phase: state.phase,
    snapshot: { ...state, cards: {}, undo: { phase: state.phase, snapshot: null, cards: null, intents: [], steps: [] } },
    cards: state.cards,
    intents: [],
    steps: [],
  };
}

export function noteHistory(
  before: ScenarioState,
  after: ScenarioState,
  intent: PlayerIntent,
  steps: readonly EngineStep[],
): ScenarioState {
  if (after.phase !== before.phase) {
    return { ...after, undo: snapshotOf(after) };
  }
  return {
    ...after,
    undo: {
      phase: after.phase,
      snapshot: before.undo.snapshot,
      cards: before.undo.cards,
      intents: [...before.undo.intents, intent],
      steps: [...before.undo.steps, steps],
    },
  };
}

export function replay(
  snapshot: ScenarioState,
  intents: readonly PlayerIntent[],
  ctx: ReduceContext,
  cards: ScenarioState["cards"],
): ScenarioState {
  if (!reduceFn) throw new Error("Replay is available after the reducer loads");
  let state: ScenarioState = { ...snapshot, cards: structuredClone(cards) };
  for (const intent of intents) {
    const result = reduceFn(state, intent, ctx);
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
  }
  return state;
}

// Zones whose cards the player has not seen.
const UNSEEN: ReadonlySet<CardInstance["zone"]> = new Set(["deck", "encounterDeck", "questDeck", "burdenDeck"]);

function unseen(card: CardInstance): boolean {
  return UNSEEN.has(card.zone) || card.face === "down";
}

// The cards the open window names, for a player to read: a Look's cards, a Choose's options (a Pick among the top of a deck,
// a search). Option ids that are not cards are skipped.
function windowCards(state: ScenarioState): readonly string[] {
  const window = state.window;
  if (window?.kind === "look") return window.cardIds;
  if (window?.kind === "choose" || window?.kind === "chooseEnemy") return window.options;
  return [];
}

/**
 * True when the intent from `before` to `after` showed the player something they had not seen, so the table's Undo cannot
 * take it back (docs/brief.md, The engine plays the game): a card that left a deck or turned face up (a draw, a reveal, a shadow card
 * turned), a card in a deck or face down that the open window names (a Look, a Pick among the top cards, a search), a new
 * card on top of a player's deck, a card that did not exist before, or a random result (the seed cursor moved: a shuffle, a
 * random discard).
 */
export function showedHidden(before: ScenarioState, after: ScenarioState): boolean {
  if (after.seedCursor !== before.seedCursor) return true;
  for (const [id, card] of Object.entries(after.cards)) {
    const was = before.cards[id];
    if (!was || (unseen(was) && !unseen(card))) return true;
  }
  if (after.window !== before.window && windowCards(after).some((id) => after.cards[id] && unseen(after.cards[id]))) return true;
  return after.seats.some((seat, index) => seat.deck[0] !== before.seats[index]?.deck[0]);
}

/** True when the scenario is won or lost: its result is not taken back. */
export function isOver(state: ScenarioState): boolean {
  return state.lost || state.stageCleared;
}
