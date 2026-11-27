// The table's screen state. Zustand holds the latest reducer result so each subscriber selects the slice it draws; the
// reducer is the only writer of the game (docs/architecture.md, State). A dispatch that the reducer refuses leaves the game
// as it was and keeps the reason, so a drop moves nothing until it is accepted. legalIntents runs once per accepted intent
// (every accepted intent is a new window), and drop targets are computed for the selected card only. Undo goes back to the
// state before an accepted intent while that intent showed no hidden card (undo-history.ts).
import { createStore, type StoreApi } from "zustand/vanilla";

import { legalIntents, reduce, type EngineStep, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";

import { deckTopFaceUp } from "../../rules/player/deck-play.ts";
import { clashesOf } from "./clash.ts";
import { stampVillagers } from "./villager-steps.ts";
import { stampControl } from "../readouts/against-the-shadow/osgiliath-steps.ts";
import { stampVale } from "../readouts/against-the-shadow/vale-steps.ts";
import { carryHidden, stampHidden, typeIn } from "../readouts/against-the-shadow/blood-steps.ts";
import { stampCounted } from "./counted.ts";
import { finishedRoundSteps } from "./outcome.ts";
import { peekSeat } from "./peek.ts";
import { draggableIds, dropTargets, type DropTarget } from "./selection.ts";
import { endGate, leaveGate, nextGate, NO_SPOTLIGHT, type SpotlightGate } from "../spotlight/gate.ts";
import { nextUndoable, type Undoable } from "./undo-history.ts";

// The engine types the screens hold. src/screens reaches the reducer only through src/play and src/campaign.
export type { EngineStep, LegalIntent, PlayerIntent, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
// An effect record by its id (src/screens may not import src/rules).
export { effectById } from "../../rules/windows/listen.ts";

// The cards a row folded into its stack (row-fold.ts), as the canvas laid the table out: the table's pick reads them (a folded card is not on the table), and the row list shows them.
export type RowFolds = { staging: readonly string[]; engaged: readonly string[] };
export const NO_ROW_FOLDS: RowFolds = { staging: [], engaged: [] };

export type TableState = {
  game: ScenarioState;
  legal: readonly LegalIntent[];
  draggable: readonly string[];
  // The seats that play with the top card of their deck faceup (Gandalf, 142002:A:1): the table shows that card on the deck, playable now or not.
  faceUpDecks: readonly number[];
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
  // The heroes a destroy step named over the whole game, kept with each accepted intent and dropped with an Undo: the outcome tells them from the heroes that left play with an eliminated player (campaign/report.ts).
  destroyedHeroes: ReadonlySet<string>;
  // The combat spotlight of the moment in `shown`: the attacks it resolved, and whether the canvas is still playing them
  // (spotlight/gate.ts). The banner, the settle after a new moment and the card motions wait for it; it holds no rule.
  spotlight: SpotlightGate;
  // The seat the player is peeking at in two-handed play (peek.ts), or null: UI-only, never the engine's and never in the save. It is
  // null when the table opens and returns to null with every new state (a new moment, so also a new sheet key or acting seat).
  viewedSeat: number | null;
  // The cards the staging row and the engagement row folded away, written by the canvas when it lays the table out (UI-only, never in the save).
  rowFolds: RowFolds;
  // Whether the table opened on a save that had intents already (a resumed game, not a new deal): the quest screen the table opens on
  // then says Continue, not Begin (quest-advance.ts, advanceButton). Set once when the store is built.
  resumed: boolean;
};

export type TableActions = {
  // The canvas says which cards its rows folded; the same lists leave the state as it was.
  setRowFolds: (folds: RowFolds) => void;
  // `accepted` is called the moment the reducer accepts the intent, before the table's next state is built and the save is written, so a
  // haptic tick for an accepted intent does not wait for them. It is not called for a refused one.
  dispatch: (intent: PlayerIntent, accepted?: () => void) => boolean;
  // Goes back to the state before the last intent that can be taken back. False when there is none.
  undo: () => boolean;
  select: (cardId: string | null) => void;
  // Peek at a seat's whole area, or null to go back to the acting seat. A seat that is not a peek (the acting seat, one outside the
  // game, any seat in a solo game) is null. The acting seat does not change.
  peek: (seat: number | null) => void;
  clearRefusal: () => void;
  // The table refused a play before it reached the reducer (why.ts, cannotPay): the reason shows as a refusal does.
  refuse: (reason: string) => void;
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

/** What the table keeps of the intents sent so far: the round's log, the states Undo can go back to and the heroes destroyed (`destroyedHeroes`, none when a caller gives none). */
export type Kept = { roundSteps: readonly EngineStep[]; history: readonly Undoable[]; destroyedHeroes?: ReadonlySet<string> };

function withDestroyed(held: ReadonlySet<string> | undefined, more: readonly string[]): ReadonlySet<string> {
  return more.length === 0 && held ? held : new Set([...(held ?? []), ...more]);
}

/** The heroes in play before an intent that its steps destroy. */
export function heroesDestroyed(before: ScenarioState, steps: readonly EngineStep[]): string[] {
  return steps.flatMap((step) => (step.kind === "destroy" && before.cards[step.targetId]?.zone === "heroes" ? [step.targetId] : []));
}

/**
 * One more accepted intent folded into what the table keeps. The store calls it for each intent sent, and reopening a save
 * calls it for each intent replayed, so both keep the same log and the same Undo list.
 */
export function keepIntent(kept: Kept, before: ScenarioState, after: ScenarioState, given: readonly EngineStep[], intent: PlayerIntent, ctx?: ReduceContext): Kept {
  const steps = carryHidden(given, before, after);
  return {
    roundSteps: nextRoundSteps(kept.roundSteps, before, after, steps, ctx),
    history: nextUndoable(kept.history, after, { before, roundSteps: kept.roundSteps, intent, steps: stampVale(steps, before) }),
    destroyedHeroes: withDestroyed(kept.destroyedHeroes, heroesDestroyed(before, steps)),
  };
}

/**
 * The steps of the round the table is in. A reduce that crosses into a new round starts the list again from the steps it
 * produced, so the list never mixes two earlier rounds. With `ctx` each quest step also keeps the stat the quest counted (counted.ts).
 */
export function nextRoundSteps(previous: readonly EngineStep[], before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[], ctx?: ReduceContext): readonly EngineStep[] {
  if (steps.length === 0) return previous;
  const kept = stampVale(stampHidden(stampControl(stampVillagers(stampCounted(steps, before, ctx), before, after), before, after), before, after, ctx ? typeIn(after, ctx.cards) : undefined), before);
  return after.round !== before.round ? [...kept] : [...previous, ...kept];
}

export type TableInput = {
  ctx: ReduceContext;
  game: ScenarioState;
  roundSteps?: readonly EngineStep[];
  history?: readonly Undoable[];
  destroyedHeroes?: ReadonlySet<string>;
  // Called after the reducer accepts an intent, with the state it returned. The screen writes the intent to the save here.
  onCommit?: (intent: PlayerIntent, game: ScenarioState) => void;
  // Called after an undo with the state it went back to and the state it left: the screen drops the last intent from the save and takes back what the left state wrote.
  onUndo?: (game: ScenarioState, left: ScenarioState) => void;
};

function windowState(game: ScenarioState, ctx: ReduceContext): Pick<TableState, "legal" | "draggable" | "faceUpDecks"> {
  const legal = legalIntents(game, ctx);
  const faceUpDecks = game.seats.slice(0, game.seatCount).flatMap((_, seat) => (deckTopFaceUp(game, seat, ctx) ? [seat] : []));
  return { legal, draggable: draggableIds(game, ctx, legal), faceUpDecks };
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
    destroyedHeroes: input.destroyedHeroes ?? new Set(),
    spotlight: NO_SPOTLIGHT,
    viewedSeat: null,
    rowFolds: NO_ROW_FOLDS,
    resumed: (input.roundSteps?.length ?? 0) > 0 || (input.history?.length ?? 0) > 0,
    setRowFolds: (folds) => {
      const now = get().rowFolds;
      const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, at) => id === b[at]);
      if (same(now.staging, folds.staging) && same(now.engaged, folds.engaged)) return;
      set({ rowFolds: folds });
    },
    dispatch: (intent, accepted) => {
      const before = get().game;
      const result = reduce(before, intent, ctx);
      if (!result.ok) {
        set({ refusal: result.reason });
        return false;
      }
      accepted?.();
      // A choice of The Blood of Gondor that moved a hidden card and returned no step still shows (blood-steps.ts).
      const steps = carryHidden(result.steps, before, result.state);
      // The banner words the steps as the log does: The Morgul Vale's notes on them (vale-steps.ts) are applied first, and any other game's steps stay as they are.
      const told = stampVale(steps, before);
      // A round ends with its refresh: setup (round 0) ends with no summary.
      const crossed = result.state.round !== before.round && before.round > 0;
      const ended = crossed ? { ended: { round: before.round, steps: finishedRoundSteps([...get().roundSteps, ...told]) } } : {};
      const moment: TableMoment = { seq: (get().moment?.seq ?? 0) + 1, kind: "sent", before, after: result.state, steps: told, ...ended };
      const shows = steps.length > 0 || crossed;
      set({
        ...showing(result.state),
        ...keepIntent(get(), before, result.state, steps, intent, ctx),
        moment,
        shown: shows ? moment : get().shown,
        // The attacks this moment resolved play on the canvas before its banner; a pass that shows nothing, or a moment with no attacks
        // while the last one's still wait to play, leaves the last gate be (gate.ts, nextGate).
        spotlight: shows ? nextGate(get().spotlight, moment.seq, clashesOf(before, result.state, steps, ctx.cards), before, result.state) : get().spotlight,
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
        destroyedHeroes: new Set([...get().destroyedHeroes].filter((id) => !heroesDestroyed(last.before, last.steps).includes(id))),
        moment: undone,
        shown: undone,
        // Undo takes the attack back: nothing is replayed, and one still playing ends.
        spotlight: endGate(get().spotlight, "skipped"),
      });
      input.onUndo?.(last.before, game);
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
    refuse: (reason) => set({ refusal: reason }),
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
