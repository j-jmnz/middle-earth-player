// The layers over the table that read or answer (phase 21): the choice tray (choice-tray.tsx), the one reading panel (a discard
// pile, the log, the threat panel, the table settings; reading-panels.tsx) and the phase carousel, with the hit layers that close
// them on a tap outside. The table view hands them the numbers; they send no intent. One reading layer at a time (reading.ts):
// a new one replaces the last.
//   - The tray folds on a tap on the canvas (use-table-choice.ts, onTap), on the top bar except its menu button, or on the empty
//     part of the command column above the dock. That tap is swallowed.
//   - A reading panel and the carousel have a scrim from the top bar's foot down: a tap anywhere else closes it and does nothing
//     more. The top bar stays live, so a dial or the rail replaces the layer.
//   - The carousel hangs over the canvas only, and the tray stays in the command column; neither covers the dock's armed line or buttons.
import { useMemo } from "react";
import { Pressable, Text } from "react-native";
import { useStore } from "zustand";

import { ChoiceTray } from "./choice-tray.tsx";
import type { Carousel } from "./carousel.ts";
import { threatRows, threatVerdict } from "./foresight.ts";
import { logLines, type LogNames } from "./log.ts";
import { PhaseCarousel } from "./phase-carousel.tsx";
import type { Reading } from "./reading.ts";
import { LogPanel, PileList, SettingsPanel, ThreatPanel } from "./reading-panels.tsx";
import { useScreenReader } from "./screen-reader.ts";
import { PILE_WORDS, shownSeat } from "./selectors.ts";
import type { SheetNames } from "./sheet-types.ts";
import type { ReduceContext, TableStore } from "./store.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { tableSettings, type TableSettings } from "./table-settings.ts";
import { TrayFrame, useHeld } from "./tray-frame.tsx";
import { BAR_PAD, MENU_BUTTON } from "./top-bar-layout.ts";
import { DENSE_BELOW } from "./dock-budget.ts";
import { outsideLayers, trayBox } from "./tray-logic.ts";
import type { TableChoice } from "./use-table-choice.ts";

// The menu button's zone at the top bar's right. A tap there is the menu's, never the tray's.
const MENU_ZONE = MENU_BUTTON + BAR_PAD;
const READING_MIN = 300;
const EDGE = 8;

export function TableLayers({
  store,
  ctx,
  names,
  nameOf,
  picture,
  choice,
  reading,
  onReading,
  settings,
  carousel,
  logNames,
  screen,
  insets,
  barBottom,
  commandWidth,
  anchorTop,
  onPreview,
}: {
  store: TableStore;
  ctx: ReduceContext;
  names: SheetNames;
  nameOf: (code: string) => string;
  picture: (code: string) => PictureSource | null;
  choice: TableChoice;
  reading: Reading | null;
  onReading: (next: Reading | null) => void;
  settings: TableSettings;
  carousel: Carousel;
  logNames: LogNames;
  screen: { width: number; height: number };
  insets: { left: number; right: number; bottom: number };
  // The screen y under the top bar.
  barBottom: number;
  commandWidth: number;
  // The screen y of the top of the dock's block of readout, armed line and buttons, or null until it is measured.
  anchorTop: number | null;
  onPreview: (cardId: string) => void;
}) {
  const game = useStore(store, (state) => state.game);
  const roundSteps = useStore(store, (state) => state.roundSteps);
  const reader = useScreenReader();
  const seat = shownSeat(game);
  const close = () => onReading(null);
  const anchor = anchorTop ?? Math.round(screen.height * 0.55);
  const canvas = screen.width - insets.left - insets.right - commandWidth;
  const box = trayBox({ commandWidth, insetRight: insets.right, screenHeight: screen.height, barBottom, anchorTop: anchor });
  const trayShown = choice.panelOpen;
  // The panel layer (everything but the carousel).
  const panel = reading && reading.kind !== "carousel" ? reading : null;
  const held = useHeld(panel);
  const width = Math.max(READING_MIN, box.width);
  const foot = Math.max(insets.bottom, EDGE);
  const open = reading?.kind === "carousel";
  const logging = held?.kind === "log";
  const lines = useMemo(() => (logging ? logLines(roundSteps, logNames) : []), [logging, roundSteps, logNames]);
  return (
    <>
      {/* A tap outside the open tray, away from the canvas (which folds it itself): the top bar but its menu button, and the empty
          part of the command column above the dock. A screen reader leaves the tray open. */}
      {outsideLayers({ trayShown, reading: reading != null, reader }) ? (
        <>
          <Pressable testID="tray-outside-bar" accessible={false} importantForAccessibility="no" onPress={choice.foldOutside} style={{ position: "absolute", top: 0, left: 0, right: insets.right + MENU_ZONE, height: barBottom }} />
          <Pressable testID="tray-outside-column" accessible={false} importantForAccessibility="no" onPress={choice.foldOutside} style={{ position: "absolute", top: barBottom, right: insets.right, width: commandWidth, height: anchor - barBottom }} />
        </>
      ) : null}
      <ChoiceTray open={trayShown} place={box} sheet={choice.sheet} choice={choice.choice} picture={picture} dense={screen.height < DENSE_BELOW} onTile={choice.onTile} onRead={onPreview} />
      {panel ? <Pressable testID="reading-scrim" accessibilityRole="button" accessibilityLabel="Close the panel" onPress={close} style={{ position: "absolute", top: barBottom, left: 0, right: 0, bottom: 0 }} /> : null}
      <TrayFrame open={panel != null} surface="paper" testID="reading" place={{ right: insets.right, width, bottom: foot, maxHeight: screen.height - barBottom - foot - EDGE }}>
        {held?.kind === "pile" ? (
          <PileList
            title={PILE_WORDS[held.pile]}
            cards={[...(held.pile === "discard" ? (game.seats[seat]?.discard ?? []) : game.encounterDiscard)].reverse().map((id) => ({ id, label: names.card(id) }))}
            onRead={onPreview}
            onClose={close}
          />
        ) : null}
        {held?.kind === "log" ? <LogPanel round={game.round} lines={lines} onClose={close} /> : null}
        {held?.kind === "threat" ? (
          <ThreatPanel
            seatLabel={game.seatCount > 1 ? `Player ${held.seat + 1}` : "Threat"}
            threat={game.seats[held.seat]?.threat ?? 0}
            rows={threatRows(game, ctx).map((row) => ({ id: row.id, name: names.card(row.id), cost: row.cost, verdict: threatVerdict(row, held.seat) }))}
            onClose={close}
          />
        ) : null}
        {held?.kind === "settings" ? (
          <SettingsPanel
            settings={settings}
            always={settings.alwaysUse.map((effectId) => {
              const code = ctx.effects.find((effect) => effect.id === effectId)?.cardCode;
              return { effectId, label: `Ask again: ${code ? nameOf(code) : effectId}` };
            })}
            onChange={(change) => tableSettings.getState().update(change)}
            onClose={close}
          />
        ) : null}
        {/* A choice is still open under the panel: say so, and the dock's armed button is untouched by closing it. */}
        {trayShown && panel ? (
          <Text testID="choice-waiting" className="pt-1 text-center text-label text-inkMuted">
            Choice waiting
          </Text>
        ) : null}
      </TrayFrame>
      {/* The strip hangs over the canvas only; the tray stays in the command column. */}
      <PhaseCarousel
        open={open}
        carousel={carousel}
        settings={settings}
        top={barBottom}
        left={insets.left}
        width={canvas}
        height={Math.round(Math.min(340, (screen.height - barBottom) * 0.92))}
        onChange={(change) => tableSettings.getState().update(change)}
        onClose={close}
      />
    </>
  );
}
