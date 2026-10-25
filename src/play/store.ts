// The table's screen state. Zustand holds the latest reducer result so each subscriber selects the slice it draws; the
// reducer is the only writer of the game (docs/architecture.md, State). A dispatch that the reducer refuses leaves the game
// as it was and keeps the reason, so a drop moves nothing until it is accepted. legalIntents runs once per accepted intent
// (every accepted intent is a new window), and drop targets are computed for the selected card only. Undo goes back to the
// state before an accepted intent while that intent showed no hidden card (undo-history.ts).
import { createStore, type StoreApi } from "zustand/vanilla";

import { legalIntents, reduce, type EngineStep, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";

import { draggableIds, dropTargets, type DropTarget } from "./selection.ts";
import { nextUndoable, type Undoable } from "./undo-history.ts";

// The engine types the screens hold. src/screens reaches the reducer only through src/play and src/campaign.
export type { EngineStep, LegalIntent, PlayerIntent, ReduceContext, ScenarioState } from "../rules/reduce.ts";

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
  // What the last accepted intent did: the state before it and the engine steps it ran, for the outcome banner. `seq` moves
  // with each accepted intent and each undo. After an undo (`undone`), `before` is the state taken back and `steps` what its
  // intent ran.
  moment: { seq: number; before: ScenarioState; steps: readonly EngineStep[]; undone?: boolean } | null;
  // The states Undo can go back to, oldest first.
  history: readonly Undoable[];
};

export type TableActions = {
  dispatch: (intent: PlayerIntent) => boolean;
  // Goes back to the state before the last intent that can be taken back. False when there is none.
  undo: () => boolean;
  select: (cardId: string | null) => void;
  clearRefusal: () => void;
};

export type TableStore = StoreApi<TableState & TableActions>;

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
  return createStore<TableState & TableActions>()((set, get) => ({
    game: input.game,
    ...windowState(input.game, ctx),
    roundSteps: input.roundSteps ?? [],
    selected: null,
    targets: [],
    refusal: null,
    moment: null,
    history: input.history ?? [],
    dispatch: (intent) => {
      const before = get().game;
      const result = reduce(before, intent, ctx);
      if (!result.ok) {
        set({ refusal: result.reason });
        return false;
      }
      set({
        game: result.state,
        ...windowState(result.state, ctx),
        roundSteps: nextRoundSteps(get().roundSteps, before, result.state, result.steps),
        selected: null,
        targets: [],
        refusal: null,
        moment: { seq: (get().moment?.seq ?? 0) + 1, before, steps: result.steps },
        history: nextUndoable(get().history, before, result.state, get().roundSteps, result.steps),
      });
      input.onCommit?.(intent, result.state);
      return true;
    },
    undo: () => {
      const { history, game, moment } = get();
      const last = history[history.length - 1];
      if (!last) return false;
      set({
        game: last.before,
        ...windowState(last.before, ctx),
        roundSteps: last.roundSteps,
        selected: null,
        targets: [],
        refusal: null,
        moment: { seq: (moment?.seq ?? 0) + 1, before: game, steps: last.steps, undone: true },
        history: history.slice(0, -1),
      });
      input.onUndo?.(last.before);
      return true;
    },
    select: (cardId) => {
      const { game, legal, selected } = get();
      if (cardId === selected) return;
      set({ selected: cardId, targets: cardId ? dropTargets(game, ctx, legal, cardId) : [] });
    },
    clearRefusal: () => set({ refusal: null }),
  }));
}
