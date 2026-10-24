// The table's screen state. Zustand holds the latest reducer result so each subscriber selects the slice it draws; the
// reducer is the only writer of the game (docs/architecture.md, State). A dispatch that the reducer refuses leaves the game
// as it was and keeps the reason, so a drop moves nothing until it is accepted. legalIntents runs once per accepted intent
// (every accepted intent is a new window), and drop targets are computed for the selected card only.
import { createStore, type StoreApi } from "zustand/vanilla";

import { legalIntents, reduce, type EngineStep, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";

import { draggableIds, dropTargets, toggleCommit, type DropTarget } from "./selection.ts";

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
  // Characters the player has put toward a quest commit; nothing is sent until the commit is confirmed.
  pendingCommit: readonly string[];
  // Why the reducer refused the last intent. Cleared by the next accepted one.
  refusal: string | null;
};

export type TableActions = {
  dispatch: (intent: PlayerIntent) => boolean;
  select: (cardId: string | null) => void;
  toggleCommit: (cardId: string) => void;
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
  // Called after the reducer accepts an intent, with the state it returned. The screen writes the intent to the save here.
  onCommit?: (intent: PlayerIntent, game: ScenarioState) => void;
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
    pendingCommit: [],
    refusal: null,
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
        pendingCommit: [],
        refusal: null,
      });
      input.onCommit?.(intent, result.state);
      return true;
    },
    select: (cardId) => {
      const { game, legal, selected } = get();
      if (cardId === selected) return;
      set({ selected: cardId, targets: cardId ? dropTargets(game, ctx, legal, cardId) : [] });
    },
    toggleCommit: (cardId) => {
      const { game, pendingCommit } = get();
      set({ pendingCommit: toggleCommit(game, ctx, pendingCommit, cardId) });
    },
    clearRefusal: () => set({ refusal: null }),
  }));
}
