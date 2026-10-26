// The table's gesture-to-intent state (docs/architecture.md, Modules: src/play owns it): the open sheet (the window's own, or
// one the player opened from the table: a payment, a host, an Action), what is picked for it, whether it is answered on the
// table or on a paper panel, the dock's buttons, the engine's numbers beside them, and the outcome banner of the last
// intent. Taps, drops and tiles pick; only a dock button sends an intent, through the store (table-choice.ts).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { actionsSheet, commitSheet, playSheet, windowSheet } from "./bar-sheets.ts";
import { tickRefused, tickSent } from "./haptics.ts";
import { intentWords, momentOf, takenBack, type Moment } from "./outcome.ts";
import { readoutFor, type Readout } from "./readout.ts";
import { useScreenReader } from "./screen-reader.ts";
import { onTableFor, shownSeat } from "./selectors.ts";
import { dropOutcome, targetFromKey } from "./selection.ts";
import type { OptionMark, Sheet, SheetNames, Unavailable } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";
import type { PlayerIntent, ReduceContext, ScenarioState, TableStore } from "./store.ts";
import type { LayoutOptions } from "./layout.ts";
import type { TableHighlight } from "./table-canvas-types.ts";
import type { DockExtra } from "./dock-buttons.tsx";
import { choiceFor, dockFor, fightPreview, headerOf, marked, onTheTable, onlyAnswer, pickedWords, primaryReady, tap, tappable, type Choice, type Dock, type DockButton, type TapContext } from "./table-choice.ts";

// How long the outcome banner stays up; the log keeps it.
const MOMENT_MS = 4500;
// How long a new moment ignores a send: the second tap of a double tap meant for the moment before lands where its button
// was, and a moment with one answer would send on it.
const SETTLE_MS = 350;

// A sheet the player opened from the table, for the game it was opened in. `panel` keeps it on paper even when its choices
// are cards on the table (the Actions list reads the printed lines).
type Overlay = { sheet: Sheet; game: ScenarioState; panel: boolean };

export type TableChoice = {
  sheet: Sheet;
  choice: Choice;
  dock: Dock;
  header: { step: string; title: string; note: string | null };
  picked: string | null;
  unavailable: readonly Unavailable[];
  readout: Readout | null;
  highlight: TableHighlight;
  raised: string | null;
  fight: LayoutOptions["preview"];
  // The choice is on a paper panel, and the panel is open (not folded).
  panelOpen: boolean;
  overlayOpen: boolean;
  extras: readonly DockExtra[];
  // Changes with the moment and the pick, so an armed button goes back to unarmed.
  resetKey: string;
  banner: Moment | null;
  // The moment's number: a new one enters the banner afresh, even while the last is still up.
  bannerKey: number;
  // The Undo button: puts back the pick being made, or goes back one intent (store.ts, undo-history.ts); null when there is
  // neither. It is also the first of `extras`.
  undo: DockExtra | null;
  onTap: (cardId: string) => void;
  onTile: (id: string) => void;
  onDrop: (cardId: string, key: string) => void;
  onButton: (button: DockButton) => void;
  fold: () => void;
  closeOverlay: () => void;
};

export function useTableChoice({
  store,
  ctx,
  names,
  onPreview,
  onPile,
  onOutcome,
}: {
  store: TableStore;
  ctx: ReduceContext;
  names: SheetNames;
  // A tap on a card the moment does not ask about shows it large; `extra` are cards to list with it (the Look window's).
  onPreview: (cardId: string, extra?: readonly string[]) => void;
  // A tap on a pile: the screen opens a discard pile's list.
  onPile: (pile: string) => void;
  // The scenario is over and the player goes to its resolution.
  onOutcome: () => void;
}): TableChoice {
  const game = useStore(store, (state) => state.game);
  const legal = useStore(store, (state) => state.legal);
  const moment = useStore(store, (state) => state.moment);
  const canUndo = useStore(store, (state) => state.history.length > 0);
  const reader = useScreenReader();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [held, setHeld] = useState<Choice | null>(null);
  const [folded, setFolded] = useState<string | null>(null);
  // The sheet the player asked to see listed on paper.
  const [listed, setListed] = useState<string | null>(null);
  const [closedMoment, setClosedMoment] = useState(0);
  const seat = shownSeat(game);

  const base = useMemo(() => sheetFor(game, ctx, legal, names) ?? windowSheet(game, ctx, legal, names), [game, ctx, legal, names]);
  const live = overlay && overlay.game === game ? overlay : null;
  const sheet = live?.sheet ?? base;
  const table: TapContext = useMemo(() => ({ game, ctx, legal, names }), [game, ctx, legal, names]);
  const onTable = useMemo(() => onTableFor(game, seat), [game, seat]);
  // On paper: when the player asked, when a screen reader is on (a card drawn only on the canvas is no control for it), or
  // when the choices are not cards drawn whole on the table. The action window itself stays on the table.
  const asked = (live?.panel ?? false) || listed === sheet.key || (reader && sheet.kind !== "window" && sheet.kind !== "outcome" && tappable(sheet).size > 0);
  const panel = asked || !onTheTable(sheet, onTable);
  const panelOpen = panel && folded !== sheet.key;
  const passLegal = legal.some((intent) => intent.type === "Pass");
  // A moment with one answer has it picked already, and one tap sends it (table-choice.ts, onlyAnswer).
  const only = useMemo(() => onlyAnswer(sheet, legal), [sheet, legal]);
  const single = only != null;
  const choice = useMemo(() => choiceFor(sheet, held, only), [sheet, held, only]);
  const dock = useMemo(() => dockFor(sheet, choice, table, { overlay: live != null, passLegal, surface: panelOpen ? "panel" : "table", single }), [sheet, choice, table, live, passLegal, panelOpen, single]);
  const readout = useMemo(() => readoutFor(game, ctx, sheet, choice, names.card), [game, ctx, sheet, choice, names]);
  // The canvas's props keep their identity while their contents are the same, so a change elsewhere in the game (a threat)
  // does not draw the table again (docs/architecture.md, State). Card ids carry no commas.
  const glowKey = panel ? "" : [...tappable(sheet)].join(",");
  const pickedKey = [...marked(sheet, choice)].map(([id, amount]) => `${id}=${amount}`).join(",");
  const share = sheet.kind === "distribute" ? (sheet.purpose.kind === "archery" ? "damage" : "pay") : null;
  // A pick (a defender, a location, a payment) dims what it does not ask about; the action window does not.
  const dimOthers = !panel && glowKey !== "" && sheet.kind !== "window";
  // The numbers the pick draws on its cards (the damage each defender would take), keyed so the canvas draws again only
  // when they change.
  const optionMarks = panel ? [] : optionMarksOf(sheet);
  const markKey = optionMarks.map(([id, mark]) => `${id}=${mark.icon}:${mark.value}:${mark.danger ? 1 : 0}`).join(",");
  const highlight = useMemo(
    (): TableHighlight => ({
      tappable: new Set(glowKey === "" ? [] : glowKey.split(",")),
      picked: new Map(pickedKey === "" ? [] : pickedKey.split(",").map((entry): [string, number] => [entry.split("=")[0] ?? "", Number(entry.split("=")[1])])),
      share,
      dimOthers,
      marks: new Map(
        markKey === ""
          ? []
          : markKey.split(",").map((entry): [string, OptionMark] => {
              const [id = "", rest = ""] = entry.split("=");
              const [icon = "damage", value = "0", danger = "0"] = rest.split(":");
              return [id, { icon: icon as OptionMark["icon"], value: Number(value), danger: danger === "1" }];
            }),
      ),
    }),
    [glowKey, pickedKey, share, dimOthers, markKey],
  );
  const fightNow = fightPreview(game, sheet, choice);
  const fightKey = fightNow ? `${fightNow.enemyId}:${fightNow.kind}:${fightNow.ids.join(",")}` : "";
  const fight = useMemo((): LayoutOptions["preview"] => {
    if (fightKey === "") return null;
    const [enemyId = "", kind = "defense", ids = ""] = fightKey.split(":");
    return { enemyId, kind: kind as NonNullable<LayoutOptions["preview"]>["kind"], ids: ids.split(",") };
  }, [fightKey]);
  // The hand card being played rises whole above the bottom edge.
  const raised = live ? playedCard(live.sheet) : null;
  const header = headerOf(sheet, game);

  // A shadow card's printed shadow line, for the banner.
  const shadow = useCallback(
    (cardId: string) => {
      const code = store.getState().game.cards[cardId]?.code;
      const effect = ctx.effects.find((candidate) => candidate.cardCode === code && candidate.timing === "shadow");
      const lineId = effect?.lines[0];
      return lineId ? names.line(lineId) : null;
    },
    [store, ctx, names],
  );
  const said = useMemo((): Moment | null => {
    if (!moment) return null;
    // After an undo the game is the state before the intent taken back, and `left` the state it had made.
    if (moment.kind === "undone") return takenBack(intentWords(moment.intent, names.card), momentOf(game, moment.left, moment.steps, { card: names.card, shadow }));
    return momentOf(moment.before, game, moment.steps, { card: names.card, shadow });
  }, [moment, game, names, shadow]);
  const banner = moment && said && closedMoment !== moment.seq ? said : null;
  useEffect(() => {
    if (!moment) return;
    const timer = setTimeout(() => setClosedMoment(moment.seq), MOMENT_MS);
    return () => clearTimeout(timer);
  }, [moment]);

  const reset = useCallback(() => {
    setOverlay(null);
    setHeld(null);
    setFolded(null);
    setListed(null);
  }, []);
  // When the moment on the dock last changed: a send just after it is the tail of a double tap (SETTLE_MS).
  const momentKey = `${sheet.key}:${moment?.seq ?? 0}`;
  const settledFrom = useRef(0);
  useEffect(() => {
    settledFrom.current = Date.now() + SETTLE_MS;
  }, [momentKey]);
  const settled = useCallback(() => Date.now() >= settledFrom.current, []);
  const dispatch = useCallback(
    (intent: PlayerIntent) => {
      if (store.getState().dispatch(intent)) {
        tickSent();
        reset();
      } else tickRefused();
    },
    [store, reset],
  );
  // A pick being made is put back first; otherwise the last intent is taken back.
  const picking = held != null && held.key === sheet.key && (held.ids.length > 0 || held.shares.length > 0);
  const undo = useCallback(() => {
    if (picking) {
      setHeld(null);
      return;
    }
    if (!store.getState().undo()) return;
    tickSent();
    reset();
  }, [picking, store, reset]);
  const open = useCallback(
    (next: Sheet, asPanel = false) => {
      setOverlay({ sheet: next, game: store.getState().game, panel: asPanel });
      setHeld(null);
    },
    [store],
  );
  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setHeld(null);
  }, []);
  const onButton = useCallback(
    (button: DockButton) => {
      const action = button.action;
      if ((action.kind === "intent" || action.kind === "outcome") && !settled()) return;
      if (action.kind === "intent") dispatch(action.intent);
      else if (action.kind === "open") open(action.sheet);
      else if (action.kind === "outcome") onOutcome();
      else if (action.kind === "clear") setHeld({ key: sheet.key, ids: [], shares: [] });
      else closeOverlay();
    },
    [settled, dispatch, open, onOutcome, sheet, closeOverlay],
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
  // A tap on the table: a pile, a pick for the open moment, or (on a card the moment does not ask about) the card large.
  const onTap = useCallback(
    (cardId: string) => {
      if (cardId.startsWith("pile:")) {
        onPile(cardId.slice(5));
        return;
      }
      if (!pick(cardId) && game.cards[cardId]?.face !== "down") onPreview(cardId);
    },
    [pick, onPile, onPreview, game],
  );
  const onTile = useCallback((id: string) => void pick(id), [pick]);
  const tapOnTable = useStable(onTap);
  const onDrop = useCallback(
    (cardId: string, key: string) => {
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
    [game, ctx, legal, names, store, open, base, live, held, table],
  );

  const dropOnTable = useStable(onDrop);

  // The dock's extra buttons: read the card the moment is about, list the choices on paper, list every Action, bring a
  // folded panel back.
  const extras: DockExtra[] = [];
  // Undo is in the dock, in reach of the thumb and at the foot of a panel; a sheet opened from the table has Cancel instead.
  const undoButton: DockExtra | null = !live && (canUndo || picking) ? { label: "Undo", testID: "table-undo", accessibilityLabel: picking ? "Put back this pick" : "Take back your last choice", onPress: undo } : null;
  if (undoButton) extras.push(undoButton);
  const about = sheet.kind === "pick" ? (sheet.about ?? []) : sheet.kind === "trigger" && sheet.sourceId ? [sheet.sourceId] : [];
  const first = about[0];
  if (first) extras.push({ label: "Read the card", testID: "sheet-inspect", onPress: () => onPreview(first, about) });
  if (!panel && sheet.kind !== "window" && tappable(sheet).size > 0) extras.push({ label: "List", testID: "sheet-list", onPress: () => setListed(sheet.key) });
  if (sheet.kind === "window" && sheet.commit) extras.push({ label: "List", testID: "sheet-list", onPress: () => open(commitSheet(game, ctx, names), true) });
  if (sheet.kind === "window" && sheet.triggers.length > 0) extras.push({ label: `Actions (${sheet.triggers.length})`, testID: "table-actions", onPress: () => open(actionsSheet(game, ctx, legal, names), true) });
  if (panel && !panelOpen) extras.push({ label: "Choose", testID: "sheet-expand", onPress: () => setFolded(null) });

  const resetKey = `${sheet.key}:${moment?.seq ?? 0}:${choice.ids.join(",")}:${choice.shares.map((share) => `${share.id}=${share.amount}`).join(",")}`;
  return {
    sheet,
    choice,
    dock,
    header,
    picked: panelOpen ? null : pickedWords(sheet, choice, names),
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
    bannerKey: moment?.seq ?? 0,
    undo: undoButton,
    onTap: tapOnTable,
    onTile,
    onDrop: dropOnTable,
    onButton,
    fold: () => setFolded(sheet.key),
    closeOverlay,
  };
}

// A handler that keeps its identity and always calls the latest one: the canvas's gesture is built once per set of
// callbacks, and the table should not draw again because a handler closed over a newer game.
function useStable<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}

// The marks a sheet's options carry, by card id.
function optionMarksOf(sheet: Sheet): [string, OptionMark][] {
  if (sheet.kind !== "pick" && sheet.kind !== "multi") return [];
  return sheet.options.flatMap((item): [string, OptionMark][] => (item.mark ? [[item.id, item.mark]] : []));
}

// The hand card a sheet the player opened is about: the card being played.
function playedCard(sheet: Sheet): string | null {
  if (sheet.kind === "pick") return sheet.about?.[0] ?? null;
  if (sheet.kind === "distribute" && sheet.purpose.kind === "play") return sheet.purpose.cardId;
  return null;
}
