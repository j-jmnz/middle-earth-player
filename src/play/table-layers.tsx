// The layers over the table that read or answer (phase 21): the one reading panel (a discard pile, the log, the threat panel, the
// table settings; reading-panels.tsx) and the phase carousel, with the hit layers that close them on a tap outside, and the hit
// layers that fold the choice's rows (choice-tray.tsx), which stand in the dock. The table view hands them the numbers; they send no intent. One reading layer at a time (reading.ts):
// a new one replaces the last.
//   - The choice folds on a tap on the canvas (use-table-choice.ts, onTap), on the top bar except its menu button and its dials, or on the empty
//     part of the command column above the dock. That tap is swallowed.
//   - A reading panel and the carousel have a scrim from the top bar's foot down: a tap anywhere else closes it and does nothing
//     more. The top bar stays live, so a dial or the rail replaces the layer.
//   - The carousel hangs over the canvas only, and the choice stays in the command column; neither covers the dock's armed line or buttons.
//   - While the combat spotlight plays, its scrim (spotlight-scrim.tsx) is over the top bar and the dock, above all of these.
//   - The peek banner (peek-banner.tsx) is the lowest of them, over the canvas only: the scrims and panels sit above it, and the spotlight's
//     scrim (the bar and the dock column) never covers it.
import { useEffect, useEffectEvent, useMemo } from "react";
import { Pressable } from "react-native";
import { useStore } from "zustand";

import type { Carousel } from "./carousel.ts";
import { threatRows, threatVerdict } from "./foresight.ts";
import { logLines, type LogNames } from "./log.ts";
import { useDialsEdge } from "./bar-edge.ts";
import { PEEK_TOP, PeekBanner } from "./peek-banner.tsx";
import { carouselHeight } from "./carousel-size.ts";
import { PhaseCarousel } from "./phase-carousel.tsx";
import { PhaseSweep } from "./phase-sweep.tsx";
import type { Reading } from "./reading.ts";
import { LogPanel, PileList, RowList, SettingsPanel, ThreatPanel } from "./reading-panels.tsx";
import { foldTitle } from "./row-fold.ts";
import { alwaysRows } from "./settings-words.ts";
import { useScreenReader } from "./screen-reader.ts";
import { hidesFace, PILE_WORDS, pileIds, type PileId } from "./selectors.ts";
import type { Sheet, SheetNames } from "./sheet-types.ts";
import { SpotlightScrim } from "./spotlight-scrim.tsx";
import type { ReduceContext, TableStore } from "./store.ts";
import { settingsPanelWidth } from "./settings-panel-width.ts";
import { tableSettings } from "./table-settings.ts";
import { TrayFrame, useHeld } from "./tray-frame.tsx";
import { usePeek } from "./use-peek.ts";
import { useSpotlightHold } from "./use-spotlight.ts";
import { BAR_PAD, MENU_BUTTON } from "./top-bar-layout.ts";
import { outsideLayers, trayBox } from "./tray-logic.ts";
import { discardPlays } from "./table-choice.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import type { TableChoice } from "./use-table-choice.ts";
import { Text } from "./text.tsx";

// The menu button's zone at the top bar's right (at the UI scale, `menuZone`). A tap there is the menu's, never the tray's.
const READING_MIN = 300;
const EDGE = 8;

// The discard pile list, the log and the threat panel read the game themselves, so the layers above them do not render on every state.
function PileReading({ store, pile, seat, names, sheet, peeking, onRead, onPlay, onClose }: { store: TableStore; pile: PileId; seat: number; names: SheetNames; sheet: Sheet; peeking: boolean; onRead: (cardId: string) => void; onPlay: (cardId: string) => void; onClose: () => void }) {
  const game = useStore(store, (state) => state.game);
  return (
    <PileList
      title={PILE_WORDS[pile]}
      cards={[...pileIds(game, pile, seat)].reverse().map((id) => ({ id, label: names.card(id) }))}
      playable={pile === "discard" && !peeking ? discardPlays(game, seat, sheet) : []}
      onRead={onRead}
      onPlay={onPlay}
      onClose={onClose}
    />
  );
}

const NO_IDS: readonly string[] = [];

// The cards a row folded away, as the canvas last laid the table out (store.ts, `folded`): a tile shows one large.
function RowReading({ store, row, names, onRead, onClose }: { store: TableStore; row: "staging" | "engaged"; names: SheetNames; onRead: (cardId: string) => void; onClose: () => void }) {
  const ids = useStore(store, (state) => state.rowFolds[row]);
  // A card the table hides the face of (facedown) is not named, as it is not on the canvas (selectors.ts, hidesFace).
  const hiddenKey = useStore(store, (state) => state.rowFolds[row].filter((id) => hidesFace(state.game.cards[id])).join(","));
  const hidden = hiddenKey === "" ? NO_IDS : hiddenKey.split(",");
  return <RowList title={foldTitle(row)} cards={ids.map((id) => ({ id, label: hidden.includes(id) ? "Facedown card" : names.card(id) }))} onRead={onRead} onClose={onClose} />;
}

function LogReading({ store, logNames, onClose }: { store: TableStore; logNames: LogNames; onClose: () => void }) {
  const round = useStore(store, (state) => state.game.round);
  const roundSteps = useStore(store, (state) => state.roundSteps);
  const lines = useMemo(() => logLines(roundSteps, logNames), [roundSteps, logNames]);
  return <LogPanel round={round} lines={lines} onClose={onClose} />;
}

function ThreatReading({ store, ctx, names, seat, onClose }: { store: TableStore; ctx: ReduceContext; names: SheetNames; seat: number; onClose: () => void }) {
  const game = useStore(store, (state) => state.game);
  return (
    <ThreatPanel
      seatLabel={game.seatCount > 1 ? `Player ${seat + 1}` : null}
      threat={game.seats[seat]?.threat ?? 0}
      rows={threatRows(game, ctx).map((row) => ({ id: row.id, name: names.card(row.id), cost: row.cost, verdict: threatVerdict(row, seat) }))}
      onClose={onClose}
    />
  );
}

export function TableLayers({
  store,
  ctx,
  names,
  nameOf,
  choice,
  reading,
  onReading,
  carousel,
  logNames,
  screen,
  insets,
  barBottom,
  commandWidth,
  anchorTop,
  onPreview,
  onAllSettings,
}: {
  store: TableStore;
  ctx: ReduceContext;
  names: SheetNames;
  nameOf: (code: string) => string;
  choice: TableChoice;
  reading: Reading | null;
  onReading: (next: Reading | null) => void;
  // The strip's data, built by the screen only while the carousel is open (carousel.ts); null otherwise. It is held here while the strip leaves.
  carousel: Carousel | null;
  logNames: LogNames;
  screen: { width: number; height: number };
  insets: { left: number; right: number; bottom: number };
  // The screen y under the top bar.
  barBottom: number;
  commandWidth: number;
  // The screen y of the top of the dock's content (its words, the choice's rows and its buttons), or null until it is measured.
  anchorTop: number | null;
  onPreview: (cardId: string) => void;
  // The settings panel's All settings: leave the table for the Settings tab (the game is saved), as the menu's Rules does.
  onAllSettings: () => void;
}) {
  // The UI scale (ui-scale.ts): the layers' sizes below are Medium's times it.
  const s = useUiScale();
  const menuZone = touch(s, MENU_BUTTON) + BAR_PAD * s;
  // The settings panel and the strip's Stops switches read the settings themselves; no state of the game renders this view (the panels that
  // read the game below subscribe to it on their own, and only while they are open).
  const settings = useStore(tableSettings, (state) => state.settings);
  const reader = useScreenReader();
  // The discard pile list is the shown seat's; the banner over the canvas says when that is not the acting seat's (peek.ts).
  const peek = usePeek(store);
  const dialsEdge = useDialsEdge();
  const seat = peek.shown;
  const close = () => onReading(null);
  // A spotlight plays over the table, so a reading layer (the carousel, a panel) closes as one begins instead of hiding it.
  const spotlit = useSpotlightHold(store);
  const closeReading = useEffectEvent(() => onReading(null));
  useEffect(() => {
    if (spotlit) closeReading();
  }, [spotlit]);
  const anchor = anchorTop ?? Math.round(screen.height * 0.55);
  const canvas = screen.width - insets.left - insets.right - commandWidth;
  const box = trayBox({ commandWidth, insetRight: insets.right, screenHeight: screen.height, barBottom, anchorTop: anchor }, s);
  const trayShown = choice.panelOpen;
  // The panel layer (everything but the carousel).
  const panel = reading && reading.kind !== "carousel" ? reading : null;
  const held = useHeld(panel);
  const settingsOpen = held?.kind === "settings";
  // The settings panel is wider than the other panels, so its three-word switches fit (settings-panel-width.ts).
  const width = settingsOpen ? settingsPanelWidth(canvas, s, screen.width - insets.left - insets.right - 2 * EDGE * s) : Math.max(READING_MIN * s, box.width);
  const foot = Math.max(insets.bottom, EDGE * s);
  const open = reading?.kind === "carousel";
  const strip = useHeld(carousel);
  return (
    <>
      {peek.words ? <PeekBanner words={peek.words} top={barBottom + PEEK_TOP * s} left={insets.left} width={canvas} onBack={peek.back} /> : null}
      {/* The phase title crosses the canvas center; taps pass through it. */}
      <PhaseSweep store={store} area={{ left: insets.left, top: barBottom, width: canvas, height: screen.height - barBottom }} />
      {/* A tap outside the open tray, away from the canvas (which folds it itself): the top bar but its menu button and its dials (a dial
          cannot pick: the table view folds the tray on its tap and then peeks), and the empty part of the command column above the dock. A screen reader leaves the tray open. */}
      {outsideLayers({ trayShown, reading: reading != null, reader }) ? (
        <>
          <Pressable testID="tray-outside-bar" accessible={false} importantForAccessibility="no" onPress={choice.foldOutside} style={{ position: "absolute", top: 0, left: insets.left + dialsEdge, right: insets.right + menuZone, height: barBottom }} />
          <Pressable testID="tray-outside-column" accessible={false} importantForAccessibility="no" onPress={choice.foldOutside} style={{ position: "absolute", top: barBottom, right: insets.right, width: commandWidth, height: Math.max(0, anchor - barBottom) }} />
        </>
      ) : null}
      {panel ? <Pressable testID="reading-scrim" accessibilityRole="button" accessibilityLabel="Close the panel" onPress={close} style={{ position: "absolute", top: barBottom, left: 0, right: 0, bottom: 0 }} /> : null}
      <TrayFrame open={panel != null} surface={settingsOpen ? "night" : "paper"} testID="reading" place={{ right: insets.right, width, bottom: foot, maxHeight: screen.height - barBottom - foot - EDGE * s }}>
        {held?.kind === "pile" ? (
          <PileReading
            store={store}
            pile={held.pile}
            seat={seat}
            names={names}
            sheet={choice.sheet}
            peeking={peek.words != null}
            onRead={onPreview}
            onPlay={(cardId) => {
              close();
              choice.onTile(cardId);
            }}
            onClose={close}
          />
        ) : null}
        {held?.kind === "row" ? <RowReading store={store} row={held.row} names={names} onRead={onPreview} onClose={close} /> : null}
        {held?.kind === "log" ? <LogReading store={store} logNames={logNames} onClose={close} /> : null}
        {held?.kind === "threat" ? <ThreatReading store={store} ctx={ctx} names={names} seat={held.seat} onClose={close} /> : null}
        {held?.kind === "settings" ? (
          <SettingsPanel
            settings={settings}
            always={alwaysRows(settings.alwaysUse, ctx.effects, nameOf)}
            onChange={(change) => tableSettings.getState().update(change)}
            onAllSettings={onAllSettings}
            onClose={close}
          />
        ) : null}
        {/* A choice is still open under the panel: say so, and the dock's armed button is untouched by closing it. */}
        {trayShown && panel ? (
          <Text testID="choice-waiting" className={`pt-1 text-center text-label ${settingsOpen ? "text-muted" : "text-inkMuted"}`}>
            Choice waiting
          </Text>
        ) : null}
      </TrayFrame>
      {/* The strip hangs over the canvas only; the tray stays in the command column. */}
      <PhaseCarousel
        open={open}
        carousel={strip}
        settings={settings}
        top={barBottom}
        left={insets.left}
        width={canvas}
        height={carouselHeight({ screenHeight: screen.height, barBottom, insetBottom: insets.bottom }, s)}
        onChange={(change) => tableSettings.getState().update(change)}
        onClose={close}
      />
      {/* The combat spotlight dims the bar and the dock while it plays; a tap on it skips and reaches nothing under it. */}
      <SpotlightScrim store={store} insets={insets} barBottom={barBottom} commandWidth={commandWidth} />
    </>
  );
}
