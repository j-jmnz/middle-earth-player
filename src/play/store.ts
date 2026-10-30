// The table's screen state. Zustand holds the latest reducer result so each subscriber selects the slice it draws; the
// reducer is the only writer of the game (docs/architecture.md, State). A dispatch that the reducer refuses leaves the game
// as it was and keeps the reason, so a drop moves nothing until it is accepted. legalIntents runs once per accepted intent
// (every accepted intent is a new window), and drop targets are computed for the selected card only. Undo goes back to the
// state before an accepted intent while that intent showed no hidden card (undo-history.ts).
import { createStore, type StoreApi } from "zustand/vanilla";

import { legalIntents, reduce, type EngineStep, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";

import { clashesOf } from "./clash.ts";
import { finishedRoundSteps } from "./outcome.ts";
import { peekSeat } from "./peek.ts";
import { draggableIds, dropTargets, type DropTarget } from "./selection.ts";
import { endGate, leaveGate, NO_SPOTLIGHT, openGate, type SpotlightGate } from "./spotlight-gate.ts";
import { nextUndoable, type Undoable } from "./undo-history.ts";

// The engine types the screens hold. src/screens reaches the reducer only through src/play and src/campaign.
export type { EngineStep, LegalIntent, PlayerIntent, ReduceContext, ScenarioState } from "../rules/reduce.ts";
// An effect record by its id (src/screens may not import src/rules).
export { effectById } from "../rules/listen.ts";

export type TableState = {
  game: ScenarioState;
  legal: readonly LegalIntent[];
  draggable: readonly string[];
  // The engine steps of the round on the table, oldest first, for the log sheet.
  roundSteps: readonly EngineStep[];
  selected: string | null;
  targets: readonly DropTarget[];
  // Why the reducer refused the last intent. Cleared by the next accepted one.
  refusal: string | null;
  // What the last change of the table was, for the outcome banner; `seq` moves with each. "sent": an accepted intent, the
  // state before it and the engine steps it ran. "undone": the intent Undo took back, the state it had made and its steps.
  moment: TableMoment | null;
  // The last moment that had something to show (an engine step, or an undo), for the banner: a pass that only closes a
  // window (one the table passed for the player) leaves the banner of the moment before it up.
  shown: TableMoment | null;
  // The states Undo can go back to, oldest first.
  history: readonly Undoable[];
  // The combat spotlight of the moment in `shown`: the attacks it resolved, and whether the canvas is still playing them
  // (spotlight-gate.ts). The banner, the settle after a new moment and the card motions wait for it; it holds no rule.
  spotlight: SpotlightGate;
  // The seat the player is peeking at in two-handed play (peek.ts), or null: UI-only, never the engine's and never in the save. It is
  // null when the table opens and returns to null with every new state (a new moment, so also a new sheet key or acting seat).
  viewedSeat: number | null;
};

export type TableActions = {
  dispatch: (intent: PlayerIntent) => boolean;
  // Goes back to the state before the last intent that can be taken back. False when there is none.
  undo: () => boolean;
  select: (cardId: string | null) => void;
  // Peek at a seat's whole area, or null to go back to the acting seat. A seat that is not a peek (the acting seat, one outside the
  // game, any seat in a solo game) is null. The acting seat does not change.
  peek: (seat: number | null) => void;
  clearRefusal: () => void;
  // The spotlight finished ("done") or was skipped by a tap (the default); for the moment `seq`, else the current one. A gate that
  // already ended stays as it was.
  endSpotlight: (how?: "done" | "skipped", seq?: number) => void;
  // The last attack of the spotlight has begun to go back.
  leaveSpotlight: (seq?: number) => void;
};

export type TableStore = StoreApi<TableState & TableActions>;

// `after`: the state the moment made (the game right after the intent, or right after the undo), so the banner reads it even
// once later passes have moved the game on.
// `ended`: the round this intent finished, with its steps up to the refresh's threat, for the round summary.
export type TableMoment =
  | { seq: number; kind: "sent"; before: ScenarioState; after: ScenarioState; steps: readonly EngineStep[]; ended?: { round: number; steps: readonly EngineStep[] } }
  | { seq: number; kind: "undone"; intent: PlayerIntent; left: ScenarioState; after: ScenarioState; steps: readonly EngineStep[] };

/** What the table keeps of the intents sent so far: the round's log and the states Undo can go back to. */
export type Kept = { roundSteps: readonly EngineStep[]; history: readonly Undoable[] };

/**
 * One more accepted intent folded into what the table keeps. The store calls it for each intent sent, and reopening a save
 * calls it for each intent replayed, so both keep the same log and the same Undo list.
 */
export function keepIntent(kept: Kept, before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[], intent: PlayerIntent): Kept {
  return {
    roundSteps: nextRoundSteps(kept.roundSteps, before, after, steps),
    history: nextUndoable(kept.history, after, { before, roundSteps: kept.roundSteps, intent, steps }),
  };
}

/**
 * The steps of the round the table is in. A reduce that crosses into a new round starts the list again from the steps it
 * produced, so the list never mixes two earlier rounds.
 */
export function nextRoundSteps(previous: readonly EngineStep[], before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[]): readonly EngineStep[] {
  if (steps.length === 0) return previous;
  return after.round !== before.round ? [...steps] : [...previous, ...steps];
}

export type TableInput = {
  ctx: ReduceContext;
  game: ScenarioState;
  roundSteps?: readonly EngineStep[];
  history?: readonly Undoable[];
  // Called after the reducer accepts an intent, with the state it returned. The screen writes the intent to the save here.
  onCommit?: (intent: PlayerIntent, game: ScenarioState) => void;
  // Called after an undo: the screen drops the last intent from the save.
  onUndo?: (game: ScenarioState) => void;
};

function windowState(game: ScenarioState, ctx: ReduceContext): Pick<TableState, "legal" | "draggable"> {
  const legal = legalIntents(game, ctx);
  return { legal, draggable: draggableIds(game, ctx, legal) };
}

export function createTableStore(input: TableInput): TableStore {
  const { ctx } = input;
  // The table on a new game: its window, nothing picked or dragged, no refusal, no peek.
  const showing = (game: ScenarioState) => ({ game, ...windowState(game, ctx), selected: null, targets: [], refusal: null, viewedSeat: null });
  return createStore<TableState & TableActions>()((set, get) => ({
    game: input.game,
    ...windowState(input.game, ctx),
    roundSteps: input.roundSteps ?? [],
    selected: null,
    targets: [],
    refusal: null,
    moment: null,
    shown: null,
    history: input.history ?? [],
    spotlight: NO_SPOTLIGHT,
    viewedSeat: null,
    dispatch: (intent) => {
      const before = get().game;
      const result = reduce(before, intent, ctx);
      if (!result.ok) {
        set({ refusal: result.reason });
        return false;
      }
      // A round ends with its refresh: setup (round 0) ends with no summary.
      const crossed = result.state.round !== before.round && before.round > 0;
      const ended = crossed ? { ended: { round: before.round, steps: finishedRoundSteps([...get().roundSteps, ...result.steps]) } } : {};
      const moment: TableMoment = { seq: (get().moment?.seq ?? 0) + 1, kind: "sent", before, after: result.state, steps: result.steps, ...ended };
      const shows = result.steps.length > 0 || crossed;
      set({
        ...showing(result.state),
        ...keepIntent(get(), before, result.state, result.steps, intent),
        moment,
        shown: shows ? moment : get().shown,
        // The attacks this moment resolved play on the canvas before its banner; a pass that shows nothing leaves the last gate be.
        spotlight: shows ? openGate(moment.seq, clashesOf(before, result.state, result.steps)) : get().spotlight,
      });
      input.onCommit?.(intent, result.state);
      return true;
    },
    undo: () => {
      const { history, game, moment } = get();
      const last = history[history.length - 1];
      if (!last) return false;
      const undone: TableMoment = { seq: (moment?.seq ?? 0) + 1, kind: "undone", intent: last.intent, left: game, after: last.before, steps: last.steps };
      set({
        ...showing(last.before),
        roundSteps: last.roundSteps,
        history: history.slice(0, -1),
        moment: undone,
        shown: undone,
        // Undo takes the attack back: nothing is replayed, and one still playing ends.
        spotlight: endGate(get().spotlight, "skipped"),
      });
      input.onUndo?.(last.before);
      return true;
    },
    select: (cardId) => {
      const { game, legal, selected } = get();
      if (cardId === selected) return;
      set({ selected: cardId, targets: cardId ? dropTargets(game, ctx, legal, cardId) : [] });
    },
    peek: (seat) => {
      const viewedSeat = peekSeat(get().game, seat);
      if (viewedSeat !== get().viewedSeat) set({ viewedSeat });
    },
    clearRefusal: () => set({ refusal: null }),
    endSpotlight: (how = "skipped", seq) => {
      const gate = endGate(get().spotlight, how, seq);
      if (gate !== get().spotlight) set({ spotlight: gate });
    },
    leaveSpotlight: (seq) => {
      const gate = leaveGate(get().spotlight, seq);
      if (gate !== get().spotlight) set({ spotlight: gate });
    },
  }));
}
