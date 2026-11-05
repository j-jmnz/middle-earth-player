// The table's gesture-to-intent state (docs/architecture.md, Modules: src/play owns it): the open sheet (the window's own, or
// one the player opened from the table: a payment, a host, an Action), what is picked for it, whether it is answered on the
// table or on a paper panel, the dock's buttons, the engine's numbers beside them, and the outcome banner of the last
// intent. Taps, drops and tiles pick; only a dock button sends an intent, through the store (table-choice.ts).
import { useCallback, useMemo, useState } from "react";
import { useStore } from "zustand";

import { actionsSheet, commitSheet, playSheet, windowSheet } from "./bar-sheets.ts";
import type { BeatStore } from "../store/beat-store.ts";
import { tickRefused, tickSent } from "../../ui/haptics.ts";
import { pointTitle } from "../phases/rail.ts";
import { isFreeResponse, nextStopTitle, passableWindow } from "../phases/stops.ts";
import { useAutoAnswer, useBanner, useGuide, useSettle } from "./table-hooks.ts";
import { tableSettings, toggleAlways } from "../../ui/table-settings.ts";
import type { Moment } from "../store/outcome.ts";
import { readoutFor, type Readout } from "../readouts/readout.ts";
import { useReaderMode, useScreenReader } from "../../ui/screen-reader.ts";
import { hidesFace, actingSeat, isLooked, onTableFor } from "../store/selectors.ts";
import { dropOutcome, targetFromKey } from "../store/selection.ts";
import { cannotPay } from "./why.ts";
import type { Sheet, SheetNames, Unavailable } from "./sheet-types.ts";
import { dockExtras } from "./dock/extras.ts";
import { usePeeking } from "../store/use-peek.ts";
import { useStable } from "../../ui/use-stable.ts";
import { boardUnlit, fightOf, highlightKeys, highlightOf, playedCard } from "../canvas/highlight-of.ts";
import { listsResponses, tapAction, tapRoute, trayOpen } from "./tray-logic.ts";
import { sheetFor } from "./sheets.ts";
import { effectById } from "../../rules/windows/listen.ts";
import type { LegalIntent, PlayerIntent, ReduceContext, ScenarioState, TableStore } from "../store/store.ts";
import type { LayoutOptions } from "../layout/layout.ts";
import type { ReaderSeed, TableHighlight } from "../canvas/table-canvas-types.ts";
import type { DockExtra } from "./dock/buttons.tsx";
import { choiceFor, dockFor, fightPreview, headerOf, onTheTable, onlyAnswer, pickedWords, primaryReady, tap, tappable, type Choice, type Dock, type DockButton, type TapContext } from "./table-choice.ts";

// A sheet the player opened from the table, for the game it was opened in. `panel` keeps it on paper even when its choices
// are cards on the table (the Actions list reads the printed lines).
type Overlay = { sheet: Sheet; game: ScenarioState; panel: boolean };

export type TableChoice = {
  sheet: Sheet;
  choice: Choice;
  dock: Dock;
  header: { step: string; lead: string; title: string; note: string | null };
  picked: string | null;
  unavailable: readonly Unavailable[];
  readout: Readout | null;
  highlight: TableHighlight;
  // What the reader table needs besides the highlight; null with no phone screen reader on, so the canvas gets nothing new.
  readerSeed: ReaderSeed | null;
  raised: string | null;
  fight: LayoutOptions["preview"];
  // The choice is on a paper panel, and the panel is open (not folded).
  panelOpen: boolean;
  overlayOpen: boolean;
  extras: readonly DockExtra[];
  // Changes with the moment and the pick, so an armed button goes back to unarmed.
  resetKey: string;
  banner: Moment | null;
  // The moment's number and whether the banner shows it or the round summary: a new one enters the banner afresh.
  bannerKey: string;
  // The banner reached a line: the cards it names are ringed on the table.
  onBeat: (cards: readonly string[]) => void;
  // The player swiped the banner away.
  dismissBanner: () => void;
  // The first-game guide's line for this moment, and turning the guide off.
  guide: string | null;
  // The Undo button: puts back the pick being made, or goes back one intent (store.ts, undo-history.ts); null when there is
  // neither. It is also the first of `extras`.
  undo: DockExtra | null;
  onTap: (cardId: string) => void;
  onTile: (id: string) => void;
  onDrop: (cardId: string, key: string) => void;
  onButton: (button: DockButton) => void;
  fold: () => void;
  // A tap outside the open tray (the canvas, the top bar, the empty part of the command column): folds it and reports true, so
  // the caller swallows the tap. With a screen reader on it does nothing and reports false.
  foldOutside: () => boolean;
  closeOverlay: () => void;
};

export function useTableChoice({
  store,
  ctx,
  names,
  beats,
  onPreview,
  onPile,
  onOutcome,
  hold = false,
}: {
  store: TableStore;
  ctx: ReduceContext;
  names: SheetNames;
  // Where the banner rings the cards its current line names (beat-store.ts); only the canvas reads them.
  beats: BeatStore;
  // A tap on a card the moment does not ask about shows it large; `extra` are cards to list with it (the Look window's).
  onPreview: (cardId: string, extra?: readonly string[]) => void;
  // A tap on a pile: the screen opens a discard pile's list; a tap on a fold stack names its row ("staging", "engaged") and opens the row's list.
  onPile: (pile: string) => void;
  // The scenario is over and the player goes to its resolution.
  onOutcome: () => void;
  // A screen over the table holds the moment (the quest advance screen): the table answers nothing for the player meanwhile.
  hold?: boolean;
}): TableChoice {
  const game = useStore(store, (state) => state.game);
  const legal = useStore(store, (state) => state.legal);
  const moment = useStore(store, (state) => state.moment);
  const canUndo = useStore(store, (state) => state.history.length > 0);
  const reader = useScreenReader();
  // The phone's screen reader (not the web list): it hears a sheet's readerNote and gets the words of each card (reader-table.tsx).
  const readerMode = useReaderMode();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [held, setHeld] = useState<Choice | null>(null);
  const [folded, setFolded] = useState<string | null>(null);
  // The sheet the player asked to see listed on paper.
  const [listed, setListed] = useState<string | null>(null);
  // Everything here picks, pays or answers for the acting seat; a peek at the other seat (peek.ts) changes only what is drawn.
  const acting = actingSeat(game);
  // The settings this hook reads, one by one: a change to another (the theme, the scale, a haptics switch) does not render the table.
  const stopsOn = useStore(tableSettings, (state) => state.settings.stopsOn);
  const stops = useStore(tableSettings, (state) => state.settings.stops);
  const alwaysUse = useStore(tableSettings, (state) => state.settings.alwaysUse);
  const guideOn = useStore(tableSettings, (state) => state.settings.guide);
  const guideSeen = useStore(tableSettings, (state) => state.settings.guideSeen);
  const settings = useMemo(() => ({ stopsOn, stops, alwaysUse, guide: guideOn, guideSeen }), [stopsOn, stops, alwaysUse, guideOn, guideSeen]);
  // The outcome banner of the last moment worth showing, and the round's summary after it (table-hooks.ts).
  const { banner, bannerKey, onBeat, dismiss: dismissBanner } = useBanner(store, ctx, names, beats);

  const base = useMemo(() => sheetFor(game, ctx, legal, names) ?? windowSheet(game, ctx, legal, names), [game, ctx, legal, names]);
  const live = overlay && overlay.game === game ? overlay : null;
  const sheet = live?.sheet ?? base;
  const table: TapContext = useMemo(() => ({ game, ctx, legal, names }), [game, ctx, legal, names]);
  // A card folded into a row's stack is not drawn whole: a pick that reaches one opens as the choice tray (row-fold.ts).
  const rowFolds = useStore(store, (state) => state.rowFolds);
  const rowFolded = useMemo(() => new Set([...rowFolds.staging, ...rowFolds.engaged]), [rowFolds]);
  const onTable = useMemo(() => onTableFor(game, acting, rowFolded), [game, acting, rowFolded]);
  // A moment that is not this one (a new sheet key) ends a peek; while it lasts a tap on a card only previews it.
  const peeking = usePeeking(store, sheet.key);
  // On paper: when the player asked, when a screen reader is on (a card drawn only on the canvas is no control for it), or
  // when the choices are not cards drawn whole on the table. The action window itself stays on the table.
  // A Response the player may use opens listed, beside the dock's Pass (user request, 2026-10-29).
  const responses = listsResponses(sheet, game.window?.kind);
  const asked = (live?.panel ?? false) || listed === sheet.key || responses || (reader && sheet.kind !== "window" && sheet.kind !== "outcome" && tappable(sheet).size > 0) || (reader && sheet.kind === "pick" && sheet.look != null);
  const panel = asked || !onTheTable(sheet, onTable);
  const panelOpen = trayOpen(panel, folded, sheet.key);
  const passLegal = legal.some((intent) => intent.type === "Pass");
  // A moment with one answer has it picked already, and one tap sends it (table-choice.ts, onlyAnswer).
  const only = useMemo(() => onlyAnswer(sheet, legal), [sheet, legal]);
  const single = only != null;
  const choice = useMemo(() => choiceFor(sheet, held, only), [sheet, held, only]);
  // "Pass to next stop" on a step window the table could pass, named by the stop it runs to (stops.ts).
  // Pass to stop is offered while stops are on, naming where the run ends at the latest (a choice on the way ends it sooner).
  const stopPass = settings.stopsOn && !live && !single && passableWindow(game, sheet, legal) ? `Tap again: pass until ${nextStopTitle(game, settings, pointTitle)}` : null;
  const free = useMemo(() => new Set(sheet.kind === "trigger" && game.window?.kind === "response" ? sheet.options.filter((item) => isFreeResponse(effectById(ctx, item.effectId))).map((item) => item.effectId) : []), [sheet, game, ctx]);
  const dock = dockFor(sheet, choice, table, { overlay: live != null, passLegal, surface: panelOpen ? "panel" : "table", single, stopPass, free });
  const readout = useMemo(() => readoutFor(game, ctx, sheet, choice, names.card), [game, ctx, sheet, choice, names]);
  // The canvas's props keep their identity while their contents are the same, so a change elsewhere in the game (a threat)
  // does not draw the table again (docs/architecture.md, State). Card ids carry no commas.
  // The board glows, dims and marks the sheet's own cards whenever any of them is drawn on the table, the tray open or not (boardUnlit).
  const { glow, picked: pickedKey, share, dim, marks: markKey, muted: mutedKey, keep: keepKey } = highlightKeys({ game, seat: acting, sheet, choice, panel: boardUnlit(panel, sheet, onTable) });
  const highlight = useMemo((): TableHighlight => highlightOf({ glow, picked: pickedKey, share, dim, marks: markKey, muted: mutedKey, keep: keepKey }), [glow, pickedKey, share, dim, markKey, mutedKey, keepKey]);
  const fightNow = fightPreview(game, sheet, choice);
  const fightKey = fightNow ? `${fightNow.enemyId}:${fightNow.kind}:${fightNow.ids.join(",")}` : "";
  const fight = useMemo(() => fightOf(fightKey), [fightKey]);
  // The hand card being played rises whole above the bottom edge.
  const raised = live ? playedCard(live.sheet) : null;
  // A reader hears the sheet's own sentence for it where the visible note names a glow or a drag (sheet-types.ts, readerNote).
  const headed = headerOf(sheet, game);
  const baseHeader = readerMode && sheet.kind !== "outcome" && sheet.readerNote ? { ...headed, note: sheet.readerNote } : headed;
  // While stops are on, the eyebrow says so first (a long eyebrow is cut at its end): the table passes some windows.
  const header = settings.stopsOn ? { ...baseHeader, step: `Stops on · ${baseHeader.step}` } : baseHeader;
  const guide = useGuide(settings, game, sheet, legal, live != null, header.note);
  const reset = useCallback(() => {
    setOverlay(null);
    setHeld(null);
    setFolded(null);
    setListed(null);
  }, []);
  // When the moment on the dock last changed, or its spotlight ended: a send just after it is the tail of a double tap (table-hooks.ts).
  const settled = useSettle(store, `${sheet.key}:${moment?.seq ?? 0}`);
  // The table answers for the player where the player's settings say so (stops.ts); Pass to stop starts a run.
  const sheetOf = useCallback((at: ScenarioState, offered: readonly LegalIntent[]) => sheetFor(at, ctx, offered, names) ?? windowSheet(at, ctx, offered, names), [ctx, names]);
  const { startRun, follow } = useAutoAnswer({ store, ctx, game, sheet, legal, settings, moment, opened: live != null, sheetOf, hold });
  const dispatch = useCallback(
    (intent: PlayerIntent) => {
      // The Sent tick plays the moment the reducer accepts the intent, before the next state is built and the save written; a refused intent
      // gets the Refused tick, never both. The moments the table answers after it are answered in the same tap (table-hooks.ts, follow).
      if (store.getState().dispatch(intent, tickSent)) {
        reset();
        follow();
      } else tickRefused();
    },
    [store, reset, follow],
  );

  // A pick being made is put back first; otherwise the last intent is taken back.
  const picking = held != null && held.key === sheet.key && (held.ids.length > 0 || held.shares.length > 0);
  const undo = useCallback(() => {
    if (picking) {
      setHeld(null);
      return;
    }
    // Undo goes back exactly when there is an intent to take back, so the tick can play before it does the work.
    if (store.getState().history.length === 0) return;
    tickSent();
    store.getState().undo();
    reset();
  }, [picking, store, reset]);
  // A payment the pools cannot make: the reject haptic, and the reason on the dock as a reducer refusal shows.
  const refuse = useCallback(
    (reason: string) => {
      tickRefused();
      store.getState().refuse(reason);
    },
    [store],
  );
  // Every sheet the player opens comes through here: a payment sheet (or an attachment's host pick) the pools cannot pay is refused
  // instead of opened (why.ts, cannotPay), whichever path asked for it.
  const open = useCallback(
    (next: Sheet, asPanel = false) => {
      const game = store.getState().game;
      const short = cannotPay(game, ctx, next);
      if (short) return refuse(short);
      setOverlay({ sheet: next, game, panel: asPanel });
      setHeld(null);
    },
    [store, ctx, refuse],
  );
  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setHeld(null);
  }, []);
  const onButton = useCallback(
    (button: DockButton) => {
      const action = button.action;
      if ((action.kind === "intent" || action.kind === "outcome" || action.kind === "passToStop" || action.kind === "alwaysUse") && !settled()) return;
      if (action.kind === "intent") dispatch(action.intent);
      else if (action.kind === "passToStop") {
        startRun();
        dispatch({ type: "Pass" });
      } else if (action.kind === "alwaysUse") {
        const current = tableSettings.getState().settings;
        tableSettings.getState().update({ alwaysUse: toggleAlways(current.alwaysUse.filter((id) => id !== action.effectId), action.effectId) });
        dispatch(action.intent);
      }
      else if (action.kind === "open") open(action.sheet);
      else if (action.kind === "outcome") onOutcome();
      else if (action.kind === "clear") setHeld({ key: sheet.key, ids: [], shares: [] });
      else closeOverlay();
    },
    [settled, dispatch, startRun, open, onOutcome, sheet, closeOverlay],
  );
  const pick = useCallback(
    (id: string): boolean => {
      // The only answer of the moment: the tap on its card sends it.
      if (dock.single && dock.primary && primaryReady(dock) && tappable(sheet).has(id)) {
        onButton(dock.primary);
        return true;
      }
      const result = tap(sheet, held, id, table);
      if (result.kind === "choice") setHeld(result.choice);
      else if (result.kind === "open") open(result.sheet);
      return result.kind !== "none";
    },
    [dock, onButton, sheet, held, table, open],
  );
  // A tap or a drop outside the open tray folds it and is swallowed (tapRoute).
  const foldOutside = useCallback((): boolean => {
    if (tapRoute({ panelOpen, reader, cardId: "" }) !== "fold") return false;
    setFolded(sheet.key);
    return true;
  }, [panelOpen, reader, sheet.key]);
  // A tap on the table: a pile, a pick for the open moment, or (on a card the moment does not ask about) the card large.
  const onTap = useCallback(
    (cardId: string) => {
      // A card of the open sheet glows on the table while the tray lists it (a Response listed beside Pass, or any choice in the open
      // tray), and a tap on it picks it through the same pick as its tray row, so the tray's selection and the board stay in step; a tap
      // on any other card folds the tray.
      const answers = (responses || panelOpen) && tappable(sheet).has(cardId);
      const action = tapAction({ panelOpen, reader, cardId, peeking, faceDown: hidesFace(game.cards[cardId]) && !isLooked(game, cardId), answers }, pick);
      if (action === "fold") setFolded(sheet.key);
      else if (action === "pile") onPile(cardId.slice(5));
      else if (action === "preview") onPreview(cardId);
    },
    [panelOpen, reader, peeking, sheet, responses, pick, onPile, onPreview, game],
  );
  const onTile = useCallback((id: string) => void pick(id), [pick]);
  const tapOnTable = useStable(onTap);
  const onDrop = useCallback(
    (cardId: string, key: string) => {
      if (foldOutside()) return;
      const outcome = dropOutcome(game, ctx, legal, cardId, targetFromKey(key));
      store.getState().select(null);
      if (outcome.kind === "play") {
        const opened = playSheet(game, ctx, legal, names, cardId, outcome.hostId);
        if (opened) open(opened);
      } else if (outcome.kind === "commit" || outcome.kind === "choose") {
        const result = tap(base, live ? null : held, cardId, table);
        if (result.kind === "choice") {
          setOverlay(null);
          setHeld(result.choice);
        }
      }
    },
    [foldOutside, game, ctx, legal, names, store, open, base, live, held, table],
  );

  const dropOnTable = useStable(onDrop);

  // The dock's extra buttons (dock/extras.ts).
  const undoButton: DockExtra | null = !live && (canUndo || picking) ? { label: "Undo", testID: "table-undo", accessibilityLabel: picking ? "Put back this pick" : "Take back your last choice", onPress: undo } : null;
  const extras = dockExtras({
    sheet,
    undoButton,
    panel,
    panelOpen,
    onRead: onPreview,
    onList: () => setListed(sheet.key),
    onCommit: () => open(commitSheet(game, ctx, names), true),
    onActions: () => open(actionsSheet(game, ctx, legal, names), true),
    onChoose: () => setFolded(null),
  });

  const resetKey = `${sheet.key}:${moment?.seq ?? 0}:${choice.ids.join(",")}:${choice.shares.map((share) => `${share.id}=${share.amount}`).join(",")}`;
  return {
    sheet,
    choice,
    dock,
    header,
    readerSeed: readerMode ? { sheet, cards: ctx.cards } : null,
    // No line shows it (the cards' marks and the primary's verb say it); the primary's hint speaks it.
    picked: pickedWords(sheet, choice, names),
    unavailable: sheet.kind === "pick" ? (sheet.unavailable ?? []) : [],
    readout,
    highlight,
    raised,
    fight,
    panelOpen,
    overlayOpen: live != null,
    extras,
    resetKey,
    banner,
    bannerKey,
    onBeat,
    dismissBanner,
    guide,
    undo: undoButton,
    onTap: tapOnTable,
    onTile,
    onDrop: dropOnTable,
    onButton,
    fold: () => setFolded(sheet.key),
    foldOutside,
    closeOverlay,
  };
}
