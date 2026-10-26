// The table's gesture-to-intent state (docs/architecture.md, Modules: src/play owns it): the open sheet (the window's own, or
// one the player opened from the table: a payment, a host, an Action), what is picked for it, whether it is answered on the
// table or on a paper panel, the dock's buttons, the engine's numbers beside them, and the outcome banner of the last
// intent. Taps, drops and tiles pick; only a dock button sends an intent, through the store (table-choice.ts).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { actionsSheet, commitSheet, playSheet, windowSheet } from "./bar-sheets.ts";
import { tickRefused, tickSent } from "./haptics.ts";
import { pointTitle } from "./rail.ts";
import { guideLine } from "./reference.ts";
import { alwaysUseIntent, isFreeResponse, nextStopTitle, passableWindow, stopDecision, usableIds } from "./stops.ts";
import { tableSettings, toggleAlways } from "./table-settings.ts";
import { BEAT_MS, intentWords, momentOf, roundSummary, takenBack, type Moment } from "./outcome.ts";
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

// How long the outcome banner stays up once every line is shown; the log keeps it. Each line before the last takes a beat
// (outcome.ts, BEAT_MS).
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
  // The moment's number and whether the banner shows it or the round summary: a new one enters the banner afresh.
  bannerKey: string;
  // The banner reached a line: the cards it names are ringed on the table.
  onBeat: (cards: readonly string[]) => void;
  // The first-game guide's line for this moment, and turning the guide off.
  guide: string | null;
  hideGuide: () => void;
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
  const shown = useStore(store, (state) => state.shown);
  const canUndo = useStore(store, (state) => state.history.length > 0);
  const reader = useScreenReader();
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [held, setHeld] = useState<Choice | null>(null);
  const [folded, setFolded] = useState<string | null>(null);
  // The sheet the player asked to see listed on paper.
  const [listed, setListed] = useState<string | null>(null);
  const [closedMoment, setClosedMoment] = useState(0);
  const [closedSummary, setClosedSummary] = useState(0);
  // The cards the banner's current beat names, ringed on the table (MomentBanner calls onBeat as it reaches each line).
  const [beatKey, setBeatKey] = useState("");
  const seat = shownSeat(game);
  const settings = useStore(tableSettings, (state) => state.settings);
  // "Pass to next stop" is running; the cards usable where the player was last asked (stops.ts).
  const running = useRef(false);
  const seen = useRef<Set<string>>(new Set());

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
  // "Pass to next stop" on a step window the table could pass, named by the stop it runs to (stops.ts).
  const stopPass = !live && !single && passableWindow(game, sheet, legal) ? `Tap again: pass to ${nextStopTitle(game, settings, pointTitle)}` : null;
  const free = useMemo(() => new Set(sheet.kind === "trigger" && game.window?.kind === "response" ? sheet.options.filter((item) => isFreeResponse(ctx.effects.find((effect) => effect.id === item.effectId))).map((item) => item.effectId) : []), [sheet, game, ctx]);
  const dock = useMemo(
    () => dockFor(sheet, choice, table, { overlay: live != null, passLegal, surface: panelOpen ? "panel" : "table", single, stopPass, free }),
    [sheet, choice, table, live, passLegal, panelOpen, single, stopPass, free],
  );
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
  // In planning, the hand cards that cannot be played now are dimmed, so the player sees which can (a tap says why not).
  const mutedKey = !panel && sheet.kind === "window" && game.mode === "planning" ? (game.seats[seat]?.hand ?? []).filter((id) => !sheet.plays.includes(id)).join(",") : "";
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
      muted: new Set(mutedKey === "" ? [] : mutedKey.split(",")),
      beat: new Set(beatKey === "" ? [] : beatKey.split(",")),
    }),
    [glowKey, pickedKey, share, dimOthers, markKey, mutedKey, beatKey],
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
  // The first-game guide: the moment's step explained the first two times it comes up (reference.ts, guideLine).
  const guideFor = settings.guide && !live ? guideLine(game, sheet.kind === "window" && passableWindow(game, sheet, legal)) : null;
  const guide = guideFor && (settings.guideSeen[guideFor.key] ?? 0) < 2 ? guideFor : null;
  const guideKey = guide ? `${guide.key}:${sheet.key}` : "";
  useEffect(() => {
    if (!guide) return;
    const now = tableSettings.getState().settings;
    tableSettings.getState().update({ guideSeen: { ...now.guideSeen, [guide.key]: (now.guideSeen[guide.key] ?? 0) + 1 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- counted once per moment the line appears in.
  }, [guideKey]);
  const base_header = headerOf(sheet, game);
  // While stops are on, the eyebrow says so: the table is passing some windows for the player.
  const header = settings.stopsOn ? { ...base_header, step: `${base_header.step} · Stops on` } : base_header;

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
  // The banner reads the last moment that had something to show: after it, the state it made. Read once per moment.
  const said = useMemo((): Moment | null => {
    if (!shown) return null;
    // After an undo the game is the state before the intent taken back, and `left` the state it had made.
    if (shown.kind === "undone") return takenBack(intentWords(shown.intent, names.card), momentOf(shown.after, shown.left, shown.steps, { card: names.card, shadow }));
    return momentOf(shown.before, shown.after, shown.steps, { card: names.card, shadow });
  }, [shown, names, shadow]);
  // The round summary, once the round's own moment has had its say (outcome.ts, roundSummary).
  const summary = useMemo((): Moment | null => {
    if (shown?.kind !== "sent" || !shown.ended) return null;
    const after = shown.after;
    return roundSummary(shown.ended.round, shown.ended.steps, after, (cardId) => ctx.cards.get(after.cards[cardId]?.code ?? "")?.backType === "player");
  }, [shown, ctx]);
  const momentOpen = shown != null && said != null && closedMoment !== shown.seq;
  const summaryOpen = shown != null && summary != null && !momentOpen && closedSummary !== shown.seq;
  const banner = momentOpen ? said : summaryOpen ? summary : null;
  // The banner stays up for its beats (one line at a time) and then a while to read; the summary follows it.
  useEffect(() => {
    if (!shown || !momentOpen || !said) return;
    const timer = setTimeout(() => setClosedMoment(shown.seq), MOMENT_MS + said.lines.length * BEAT_MS);
    return () => clearTimeout(timer);
  }, [shown, momentOpen, said]);
  useEffect(() => {
    if (!shown || !summaryOpen) return;
    const timer = setTimeout(() => setClosedSummary(shown.seq), MOMENT_MS);
    return () => clearTimeout(timer);
  }, [shown, summaryOpen]);
  const onBeat = useCallback((cards: readonly string[]) => setBeatKey(cards.join(",")), []);

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
  // The table answers for the player where the player's settings say so (stops.ts): a step window that is not a stop, and a
  // free Response set to Always. Anything else asks; asking ends "Pass to next stop".
  const autoKey = `${sheet.key}:${moment?.seq ?? 0}:${game.window?.kind ?? ""}`;
  useEffect(() => {
    if (live) return;
    // The moment Undo went back to asks, even where the table would answer it; the next choice the player sends lifts that.
    const held = moment?.kind === "undone";
    if (held) running.current = false;
    const always = alwaysUseIntent(game, sheet, ctx, settings, held);
    if (always) {
      store.getState().dispatch(always);
      return;
    }
    if (stopDecision({ game, sheet, legal, settings, running: running.current, held, seen: seen.current }) === "pass") {
      store.getState().dispatch({ type: "Pass" });
      return;
    }
    // The table asks here: the cards usable now are seen, and a run to the next stop ends.
    for (const id of usableIds(sheet)) seen.current.add(id);
    running.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per moment; the key holds what it reads.
  }, [autoKey]);

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
      if ((action.kind === "intent" || action.kind === "outcome" || action.kind === "passToStop" || action.kind === "alwaysUse") && !settled()) return;
      if (action.kind === "intent") dispatch(action.intent);
      else if (action.kind === "passToStop") {
        running.current = true;
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
    bannerKey: `${shown?.seq ?? 0}:${momentOpen ? "moment" : "summary"}`,
    onBeat,
    guide: guide?.text ?? null,
    hideGuide: () => tableSettings.getState().update({ guide: false }),
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
