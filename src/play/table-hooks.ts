// The parts of the table's hook (use-table-choice.ts) that run on their own clock: the outcome banner and the round
// summary after it, the first-game guide's line, and the answers the table gives for the player from the player's own
// settings (stops.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { stageText } from "./objective.ts";
import { BEAT_MS, intentWords, momentOf, roundSummary, takenBack, type Moment } from "./outcome.ts";
import { guideLine } from "./reference.ts";
import type { Sheet, SheetNames } from "./sheet-types.ts";
import { alwaysUseIntent, passableWindow, stopDecision, usableIds } from "./stops.ts";
import type { LegalIntent, ReduceContext, ScenarioState, TableMoment, TableStore } from "./store.ts";
import { tableSettings, type TableSettings } from "./table-settings.ts";
import { useSpotlightHold } from "./use-spotlight.ts";

// How long the outcome banner stays up once every line is shown; the log keeps it. Each line before the last takes a beat
// (outcome.ts, BEAT_MS).
const MOMENT_MS = 4500;

/**
 * The banner over the table: the last moment worth showing (store.ts, `shown`), line by line, then the round's summary when
 * that moment ended a round. `beatKey` is the cards the banner's current line names, ringed on the table; MomentBanner calls
 * `onBeat` as it reaches each line. While the combat spotlight plays the moment's attacks the banner waits: its beats and its
 * hold start when the spotlight ends or is skipped, so they do not race it.
 */
export function useBanner(store: TableStore, ctx: ReduceContext, names: SheetNames): { banner: Moment | null; bannerKey: string; beatKey: string; onBeat: (cards: readonly string[]) => void } {
  const shown = useStore(store, (state) => state.shown);
  const spotlit = useSpotlightHold(store);
  const [closedMoment, setClosedMoment] = useState(0);
  const [closedSummary, setClosedSummary] = useState(0);
  const [beatKey, setBeatKey] = useState("");
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
  // How a quest stage is won or held, in its printed lines (objective.ts).
  const stage = useCallback(
    (cardId: string) => stageText(ctx, store.getState().game.cards[cardId]?.code ?? "", names.line),
    [store, ctx, names],
  );
  // After it, the state it made. Read once per moment.
  const said = useMemo((): Moment | null => {
    if (!shown) return null;
    // After an undo the game is the state before the intent taken back, and `left` the state it had made.
    if (shown.kind === "undone") return takenBack(intentWords(shown.intent, names.card), momentOf(shown.after, shown.left, shown.steps, { card: names.card, shadow, stage }));
    return momentOf(shown.before, shown.after, shown.steps, { card: names.card, shadow, stage });
  }, [shown, names, shadow, stage]);
  // The round summary, once the round's own moment has had its say (outcome.ts, roundSummary).
  const summary = useMemo((): Moment | null => {
    if (shown?.kind !== "sent" || !shown.ended) return null;
    const after = shown.after;
    return roundSummary(shown.ended.round, shown.ended.steps, after, (cardId) => ctx.cards.get(after.cards[cardId]?.code ?? "")?.backType === "player");
  }, [shown, ctx]);
  const momentOpen = shown != null && said != null && closedMoment !== shown.seq && !spotlit;
  const summaryOpen = shown != null && summary != null && !momentOpen && closedSummary !== shown.seq && !spotlit;
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
  return {
    banner: momentOpen ? said : summaryOpen ? summary : null,
    // The moment's number and whether the banner shows it or the round summary: a new one enters the banner afresh.
    bannerKey: `${shown?.seq ?? 0}:${momentOpen ? "moment" : "summary"}`,
    beatKey,
    onBeat,
  };
}

/**
 * The first-game guide's line for the moment (reference.ts, guideLine): the step's decision the first two times it comes up,
 * not in a sheet the player opened, and not when the note already says it. A showing is counted when its moment ends, so
 * the line stays up for the whole moment it explains.
 */
export function useGuide(settings: TableSettings, game: ScenarioState, sheet: Sheet, legal: readonly LegalIntent[], opened: boolean, note: string | null): string | null {
  const line = settings.guide && !opened ? guideLine(game, sheet.kind === "window" && passableWindow(game, sheet, legal)) : null;
  const guide = line && (settings.guideSeen[line.key] ?? 0) < 2 && !(note ?? "").includes(line.text) ? line : null;
  const guideKey = guide ? `${guide.key}:${sheet.key}` : "";
  const showing = useRef<string | null>(null);
  useEffect(() => {
    const ended = showing.current;
    showing.current = guide?.key ?? null;
    if (ended == null) return;
    const now = tableSettings.getState().settings;
    tableSettings.getState().update({ guideSeen: { ...now.guideSeen, [ended]: (now.guideSeen[ended] ?? 0) + 1 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- counted once per moment the line appears in.
  }, [guideKey]);
  return guide?.text ?? null;
}

/**
 * The answers the table gives for the player, once per moment, where the player's settings say so (stops.ts): a free
 * Response set to Always, and a step window that is not a stop. Anything else asks, and asking ends "Pass to next stop".
 * Returns what starts that run: the dock's Pass to stop.
 */
export function useAutoAnswer({
  store,
  ctx,
  game,
  sheet,
  legal,
  settings,
  moment,
  opened,
  hold = false,
}: {
  store: TableStore;
  ctx: ReduceContext;
  game: ScenarioState;
  sheet: Sheet;
  legal: readonly LegalIntent[];
  settings: TableSettings;
  moment: TableMoment | null;
  // A sheet the player opened from the table is up: the table answers nothing under it.
  opened: boolean;
  // A screen over the table holds the moment (the quest advance screen, use-quest-advance.ts): the table answers nothing until it
  // closes, and then answers the moment as it would have.
  hold?: boolean;
}): () => void {
  const running = useRef(false);
  // The cards usable where the player was last asked: a new one makes a window ask again.
  const seen = useRef<Set<string>>(new Set());
  const autoKey = `${sheet.key}:${moment?.seq ?? 0}:${game.window?.kind ?? ""}:${hold ? "held" : ""}`;
  useEffect(() => {
    if (opened || hold) return;
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
  return useCallback(() => {
    running.current = true;
  }, []);
}

// How long a new moment ignores a send: the second tap of a double tap meant for the moment before lands where its button was, and a
// moment with one answer would send on it. A gate, not a motion, so it is outside the scale. It starts when the moment appears, and
// again when a combat spotlight on it ends or is skipped (the tap that skipped it must not send).
const SETTLE_MS = 350;

/**
 * `settled()` is true once the moment on the dock (`momentKey`) has been there for SETTLE_MS, and the spotlight on it, if any, has ended
 * for as long. While a spotlight is held it is false, so a tap that reaches the dock before the scrim does sends nothing.
 */
export function useSettle(store: TableStore, momentKey: string): () => boolean {
  const spotlit = useSpotlightHold(store);
  const held = useRef(spotlit);
  const settledFrom = useRef(0);
  useEffect(() => {
    held.current = spotlit;
    settledFrom.current = Date.now() + SETTLE_MS;
  }, [momentKey, spotlit]);
  return useCallback(() => !held.current && Date.now() >= settledFrom.current, []);
}
