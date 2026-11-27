// The parts of the table's hook (use-table-choice.ts) that run on their own clock: the last move's line and what a reader hears of it, the first-game guide's line, and the answers the table gives for the player from the player's own
// settings (stops.ts).
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { setBeat, type BeatStore } from "../store/beat-store.ts";
import { stageText } from "../readouts/objective.ts";
import { intentWords, takenBack } from "../store/intent-words.ts";
import { heldLine, lookHoldMs, type HeldLine } from "../readouts/last-move-time.ts";
import { lookIdsOf } from "../words/look-strip.ts";
import { momentOf, momentsOf, roundSummary, type Moment } from "../store/outcome.ts";
import { actingSeat } from "../store/selectors.ts";
import { guideLine } from "../phases/reference.ts";
import { questStatNow, type QuestStat } from "../phases/quest-stat.ts";
import type { Sheet, SheetNames } from "./sheet-types.ts";
import { followAnswers, passableWindow, tableAnswer, usableIds, type StopSettings } from "../phases/stops.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import { playIntoRule } from "../../rules/families/attachments/play.ts";
import { stageName } from "../../rules/families/wilderland/gundabad.ts";
import { fateNames } from "../words/scenarios/fate-beats.ts";
import { flipsAtStaging, mustBypassLead } from "../words/scenarios/gundabad-beats.ts";
import { forestAdvanceWords } from "../readouts/standalone-scenarios/old-forest-words.ts";
import type { LegalIntent, ReduceContext, ScenarioState, TableMoment, TableStore } from "../store/store.ts";
import { tableSettings, type TableSettings } from "../../ui/table-settings.ts";
import { bannerLabel, bannerSpeech } from "../readouts/banner-speech.ts";
import { announce } from "../../ui/announce.ts";
import { useReaderMode } from "../../ui/screen-reader.ts";
import { useSpotlightDrawn, useSpotlightHold } from "../spotlight/use-spotlight.ts";
import { reportsResult } from "../chrome/moment-sounds.ts";
import { playSound } from "../../ui/sound/sound.ts";

/**
 * The last move, told two ways (docs/design-system-table.md, Last move). `move` is the lean telling the command column's head shows: only what the
 * table does not show once the intent is resolved (store/outcome.ts, momentsOf), or null. It stays until the player's next send (`close`), an
 * Undo, or the next moment that has a line; a moment the table answers that has none leaves it up, and nothing times it. The full telling, and the round's summary after it, are announced for a screen reader, which never sees
 * the table. The cards the lean lines name are ringed on the table while the line is up (`beats`, beat-store.ts: only the canvas reads it). While the
 * combat spotlight plays the moment's attacks, the line, the rings and the speech wait for it.
 */
export function useLastMove(store: TableStore, ctx: ReduceContext, names: SheetNames, beats: BeatStore): { move: Moment | null; moveKey: string; close: () => void } {
  const shown = useStore(store, (state) => state.shown);
  const playing = useSpotlightHold(store);
  // Whether a spotlight is drawn at all (not under reduced motion, with the setting off, or for a reader): the lean telling leaves the attacks one
  // played to its end to it. A phone reader's table plays none.
  const reader = useReaderMode();
  const spotlights = useSpotlightDrawn();
  const speed = useStore(tableSettings, (state) => state.settings.animationSpeed);
  // The line that is up (last-move-time.ts, heldLine): it outlives the moments after it that have none.
  const [held, setHeld] = useState<HeldLine | null>(null);
  // A shadow card's printed shadow line, for the telling.
  const shadow = useCallback(
    (cardId: string) => {
      const code = store.getState().game.cards[cardId]?.code;
      const effect = code == null ? undefined : effectsOf(ctx, code).find((candidate) => candidate.timing === "shadow");
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
  // The printed When Revealed lines of a stage, for the beat of the Stormcaller's advance (words/scenarios/stormcaller.ts).
  const revealed = useCallback(
    (cardId: string) => {
      const code = store.getState().game.cards[cardId]?.code ?? "";
      const text = [...new Set(effectsOf(ctx, code).filter((effect) => effect.timing === "whenRevealed").flatMap((effect) => effect.lines))].sort().flatMap((id) => names.line(id) ?? []);
      return text.length > 0 ? text.join(" ") : null;
    },
    [store, ctx, names],
  );
  // A stage of Mount Gundabad's quest deck by its reading (the stages print one title), and the lead of a bypass the stage forces (words/scenarios/gundabad-beats.ts).
  const stageNamed = useCallback((cardId: string) => stageName(store.getState().game, ctx, cardId, names.card(cardId)), [store, ctx, names]);
  const mustBypass = useCallback((cardId: string) => mustBypassLead(ctx, store.getState().game.cards[cardId]?.code ?? ""), [store, ctx]);
  // The lines of The Fate of Wilderland's telling: where the objective stands, the card an attack discards, the enemy that took no damage, the treachery that raises the staging area's Threat (words/scenarios/fate-beats.ts).
  const fate = useMemo(() => fateNames(ctx, names.card), [ctx, names]);
  // Which side of The Old Forest's stage 2 test the advance fell on (words/scenarios/old-forest.ts).
  const forestAdvance = useCallback((before: ScenarioState, after: ScenarioState, stageId: string) => forestAdvanceWords(ctx, before, after, stageId), [ctx]);
  // Where a card with a PlayInto record goes, for what a reader hears after Undo (host-words.ts).
  const playInto = useCallback((cardId: string) => playIntoRule(ctx, store.getState().game.cards[cardId]?.code ?? "")?.into, [store, ctx]);
  // One moment told both ways, and the round's summary when it ended one (outcome.ts). Called as each moment is told, never in a render.
  const tell = useCallback(
    (moment: TableMoment): { full: Moment | null; lean: Moment | null; summary: Moment | null } => {
      // A card's code is read from the moment's state, not the store: a card keeps its instance for the whole game.
      const codeOf = (cardId: string) => moment.after.cards[cardId]?.code ?? "";
      // Whether a card prints PASS, for the locate test's lines (dwd.locate-test); whether a stage flips at the staging step (Flight from Moria) or at the beginning of the quest phase (Mount Gundabad).
      const passes = (cardId: string) => printedOf(ctx.cards, codeOf(cardId)).keywords.pass === true;
      const atStaging = (cardId: string) => flipsAtStaging(ctx, codeOf(cardId));
      // The attacks the spotlight played to its end for this moment; one skipped (a tap, a new picture size) showed no numbers (spotlight/gate.ts).
      const gate = store.getState().spotlight;
      const played = spotlights && !reader && gate.seq === moment.seq && gate.ended === "done" ? gate.clashes : [];
      const spotlit = (targetId: string) => played.some((clash) => clash.target === targetId);
      // The seat the table draws when no peek is up: a fact about the other seat's area is not on screen.
      const seat = actingSeat(store.getState().game);
      const set = { card: names.card, typeOf: (cardId: string) => printedOf(ctx.cards, codeOf(cardId)).type, questStat: (state: ScenarioState) => questStatNow(state, ctx), passes, shadow, stage, revealed, stageName: stageNamed, mustBypass, atStaging, fate, forestAdvance, spotlit, seat };
      // After an undo the game is the state before the intent taken back, and `left` the state it had made: the table shows all of it, so only a reader is told.
      if (moment.kind === "undone") return { full: takenBack(intentWords(moment.intent, names.card, moment.after, playInto), momentOf(moment.after, moment.left, moment.steps, set)), lean: null, summary: null };
      const after = moment.after;
      const summary = moment.ended ? roundSummary(moment.ended.round, moment.ended.steps, after, (cardId) => ctx.cards.get(after.cards[cardId]?.code ?? "")?.backType === "player") : null;
      return { ...momentsOf(moment.before, after, moment.steps, set), summary };
    },
    [store, ctx, names, shadow, stage, revealed, stageNamed, mustBypass, fate, forestAdvance, playInto, spotlights, reader],
  );
  // Every moment worth telling since the last one told, oldest first: the table answers the windows after a send in the same tap (stops.ts,
  // followAnswers), so more than one can arrive before the next render, and each has its say.
  const waiting = useRef<TableMoment[]>([]);
  useEffect(
    () =>
      store.subscribe((state, before) => {
        if (state.shown && state.shown !== before.shown) waiting.current.push(state.shown);
      }),
    [store],
  );
  const told = shown != null && !playing;
  const seq = shown?.seq ?? 0;
  // As the moments are told: the line (last-move-time.ts, heldLine), the notice sound of a result (the quest, a test, an elimination), once, and the
  // announcements. Each moment is taken off the list, so an effect Activity runs again tells nothing twice.
  const notice = useEffectEvent(() => {
    const moments = waiting.current;
    if (moments.length === 0) return;
    waiting.current = [];
    let line = held;
    let result = false;
    for (const moment of moments) {
      const said = tell(moment);
      line = heldLine(line, { seq: moment.seq, undone: moment.kind === "undone", lean: said.lean });
      result = result || (moment.kind === "sent" && said.full != null && reportsResult(moment.steps));
      // The phone's reader never sees the spotlight, so it hears the title and then each line as its own announcement, in order, through the
      // queue (banner-speech.ts); every other listener hears each telling as one sentence.
      for (const part of [said.full, said.summary]) {
        if (!part) continue;
        if (reader) for (const words of bannerSpeech(part)) announce(words);
        else announce(bannerLabel(part));
      }
    }
    if (line !== held) setHeld(line);
    if (result) playSound("ui.notice");
  });
  useEffect(() => {
    if (told) notice();
  }, [told, seq]);
  const move = held?.move ?? null;
  // The cards the line names wear their ring while it is up. A look strip lies over the play area, so the rings and the strip go after a
  // hold of their own (last-move-time.ts, lookHoldMs) and the cards under it can be tapped; the line stays.
  const ringed = move ? move.lines.flatMap((line) => line.cards ?? []).join(",") : "";
  useEffect(() => {
    const ids = ringed === "" ? [] : ringed.split(",");
    setBeat(beats, ids);
    if (lookIdsOf(new Set(ids)).length === 0) return;
    const timer = setTimeout(() => setBeat(beats, []), lookHoldMs(speed));
    return () => clearTimeout(timer);
  }, [beats, ringed, speed]);
  useEffect(() => () => setBeat(beats, []), [beats]);
  // The player's own send takes the line down; the moment that send makes brings its own, if it has one.
  const close = useCallback(() => setHeld(null), []);
  return { move, moveKey: String(held?.seq ?? 0), close };
}

/**
 * The first-game guide's line for the moment (reference.ts, guideLine): the step's decision the first two times it comes up,
 * not in a sheet the player opened, and not when the note already says it. A showing is counted when its moment ends, so
 * the line stays up for the whole moment it explains.
 */
export function useGuide(settings: Pick<TableSettings, "guide" | "guideSeen">, game: ScenarioState, sheet: Sheet, legal: readonly LegalIntent[], opened: boolean, note: string | null, stat?: QuestStat): string | null {
  const line = settings.guide && !opened ? guideLine(game, sheet.kind === "window" && passableWindow(game, sheet, legal), stat) : null;
  const guide = line && (settings.guideSeen[line.key] ?? 0) < 2 && !(note ?? "").includes(line.text) ? line : null;
  const guideKey = guide ? `${guide.key}:${sheet.key}` : "";
  const showing = useRef<string | null>(null);
  // The line showing now, read when the key changes: the effect runs once per moment the line appears in.
  const showingNow = useEffectEvent(() => guide?.key ?? null);
  useEffect(() => {
    const ended = showing.current;
    showing.current = showingNow();
    if (ended == null) return;
    const now = tableSettings.getState().settings;
    tableSettings.getState().update({ guideSeen: { ...now.guideSeen, [ended]: (now.guideSeen[ended] ?? 0) + 1 } });
  }, [guideKey]);
  return guide?.text ?? null;
}

export type AutoAnswer = {
  // The dock's Pass to stop: starts a run to the next stop.
  startRun: () => void;
  // Called right after the player's send is accepted: the moments the table answers are answered in the same tap, so one it passes
  // (the other seat's window in two-handed play) is never drawn, and the table does not flash to that seat and back.
  follow: () => void;
};

/**
 * The answers the table gives for the player, once per moment, where the player's settings say so (stops.ts): a free
 * Response set to Always, and a step window that is not a stop. Anything else asks, and asking ends "Pass to next stop".
 * `follow` answers the moments after a send at once; the effect answers a moment reached any other way (a relaunch, Undo's held moment
 * asks), and is the one that records what the player was asked at.
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
  sheetOf,
  hold = false,
}: {
  store: TableStore;
  ctx: ReduceContext;
  game: ScenarioState;
  sheet: Sheet;
  legal: readonly LegalIntent[];
  settings: StopSettings;
  moment: TableMoment | null;
  // A sheet the player opened from the table is up: the table answers nothing under it.
  opened: boolean;
  // The moment's sheet for a state, as the table builds it (use-table-choice.ts), for the moments `follow` answers before they are drawn.
  sheetOf: (game: ScenarioState, legal: readonly LegalIntent[]) => Sheet;
  // A screen over the table holds the moment (the quest advance screen, use-quest-advance.ts): the table answers nothing until it
  // closes, and then answers the moment as it would have.
  hold?: boolean;
}): AutoAnswer {
  const running = useRef(false);
  // The cards usable where the player was last asked: a new one makes a window ask again.
  const seen = useRef<Set<string>>(new Set());
  const autoKey = `${sheet.key}:${moment?.seq ?? 0}:${game.window?.kind ?? ""}:${hold ? "held" : ""}`;
  const follow = useCallback(() => {
    if (!hold) followAnswers(store, ctx, sheetOf, settings, running.current, seen.current);
  }, [store, ctx, settings, sheetOf, hold]);
  // What the table answers with, read when the key changes: it runs once per moment; the key holds what decides that.
  const answer = useEffectEvent(() => {
    if (opened || hold) return;
    // The moment Undo went back to asks, even where the table would answer it; the next choice the player sends lifts that.
    const held = moment?.kind === "undone";
    if (held) running.current = false;
    const intent = tableAnswer(game, sheet, legal, ctx, settings, running.current, held, seen.current);
    if (intent) {
      if (store.getState().dispatch(intent)) follow();
      return;
    }
    // The table asks here: the cards usable now are seen, and a run to the next stop ends.
    for (const id of usableIds(sheet)) seen.current.add(id);
    running.current = false;
  });
  useEffect(() => {
    answer();
  }, [autoKey]);
  const startRun = useCallback(() => {
    running.current = true;
  }, []);
  return { startRun, follow };
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
