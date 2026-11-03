// The layers over the table that read or answer (phase 21): the one reading panel (a discard pile, the log, the threat panel, the
// table settings; reading-panels.tsx) and the phase carousel, with the hit layers that close them on a tap outside, and the hit
// layers that fold the choice's rows (choice/tray.tsx), which stand in the dock. The table view hands them the numbers; they send no intent. One reading layer at a time (reading.ts):
// a new one replaces the last.
//   - The choice folds on a tap on the canvas (use-table-choice.ts, onTap), on the top bar except its menu button and its dials, or on the empty
//     part of the command column above the dock. That tap is swallowed.
//   - A reading panel and the carousel have a scrim from the top bar's foot down: a tap anywhere else closes it and does nothing
//     more. The top bar stays live, so a dial or the rail replaces the layer.
//   - The carousel hangs over the canvas only, and the choice stays in the command column; neither covers the dock's armed line or buttons.
//   - While the combat spotlight plays, its scrim (spotlight/scrim.tsx) is over the top bar and the dock, above all of these.
//   - The peek banner (peek-banner.tsx) is the lowest of them, over the canvas only: the scrims and panels sit above it, and the spotlight's
//     scrim (the bar and the dock column) never covers it.
import { useEffect, useEffectEvent, useMemo } from "react";
import { Pressable } from "react-native";
import { useStore } from "zustand";

import type { Carousel } from "../phases/carousel.ts";
import { grappleDetail } from "../words/grapple.ts";
import { threatRows, threatVerdict } from "../store/foresight.ts";
import { logLines, type LogNames } from "../store/log.ts";
import { useDialsEdge } from "./bar-edge.ts";
import { PEEK_TOP, PeekBanner } from "../readouts/peek-banner.tsx";
import { carouselHeight } from "../phases/carousel-size.ts";
import { PhaseCarousel } from "../phases/phase-carousel.tsx";
import { PhaseSweep } from "../phases/phase-sweep.tsx";
import type { Reading } from "./reading.ts";
import { kindWords, victorySaid, victoryWords } from "../words/list.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { LogPanel, PileList, RowList, SettingsPanel, ThreatPanel, type ListCard } from "./reading-panels.tsx";
import { IslandPanel } from "../dream-chaser/island-panel.tsx";
import { WAITING, islandFit, islandPanelWidth, islandReadout, standingWords } from "../dream-chaser/island-table.ts";
import { foldTitle } from "../layout/row-fold.ts";
import { areaRoleOf } from "../store/stormcaller-table.ts";
import { AREA_LIST_TITLE } from "../words/stormcaller.ts";
import { alwaysRows } from "./settings-words.ts";
import { useScreenReader } from "../../ui/screen-reader.ts";
import { hidesFace, PILE_WORDS, pileIds, type PileId } from "../store/selectors.ts";
import type { Sheet, SheetNames } from "../choice/sheet-types.ts";
import { SpotlightScrim } from "../spotlight/scrim.tsx";
import type { ReduceContext, TableStore } from "../store/store.ts";
import type { PictureSource } from "../canvas/table-canvas-types.ts";
import { victoryPointsOf } from "../../rules/core/printed-stat.ts";
import { settingsPanelWidth } from "./settings-panel-width.ts";
import { tableSettings } from "../../ui/table-settings.ts";
import { TrayFrame, useHeld } from "../choice/tray-frame.tsx";
import { usePeek } from "../store/use-peek.ts";
import { useSpotlightHold } from "../spotlight/use-spotlight.ts";
import { BAR_PAD, MENU_BUTTON } from "./top-bar-layout.ts";
import { outsideLayers, trayBox } from "../choice/tray-logic.ts";
import { discardPlays } from "../choice/table-choice.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import type { TableChoice } from "../choice/use-table-choice.ts";
import { Text } from "../../ui/text.tsx";

// The menu button's zone at the top bar's right (at the UI scale, `menuZone`). A tap there is the menu's, never the tray's.
const READING_MIN = 300;
const EDGE = 8;

type Pictures = (key: string) => PictureSource | null;

// A card of a list as the table shows it: its name, its picture on the side it lies (`key`, its picture key; "" while facedown), and the
// line under it: `detail` when given (what a grapple says of a folded location), else its type and sphere, read from its printing.
function listCard(id: string, code: string, key: string, names: SheetNames, picture: Pictures, cards: ReduceContext["cards"], detail: string | null = null): ListCard {
  const facedown = key === "";
  return { id, label: facedown ? "Facedown card" : names.card(id), detail: detail ?? (facedown ? null : kindWords(cards.get(code))), picture: facedown ? null : picture(key), pictureKey: key || id };
}

// The discard pile list, the log and the threat panel read the game themselves, so the layers above them do not render on every state.
// A discard pile's line is each card's type and sphere; the victory display's adds the Victory points each card scores (words/list.ts).
function PileReading({ store, ctx, pile, seat, names, picture, sheet, peeking, onRead, onPlay, onClose }: { store: TableStore; ctx: ReduceContext; pile: PileId; seat: number; names: SheetNames; picture: Pictures; sheet: Sheet; peeking: boolean; onRead: (cardId: string) => void; onPlay: (cardId: string) => void; onClose: () => void }) {
  const game = useStore(store, (state) => state.game);
  const cards = [...pileIds(game, pile, seat)].reverse().map((id) => {
    const card = game.cards[id];
    const made = listCard(id, card?.code ?? "", card ? pictureKey(card) : "", names, picture, ctx.cards);
    if (pile !== "victory") return made;
    const points = victoryPointsOf(game, id, ctx.cards);
    return { ...made, detail: victoryWords(made.detail ?? null, points), said: victorySaid(made.detail ?? null, points) };
  });
  return (
    <PileList
      title={PILE_WORDS[pile]}
      cards={cards}
      playable={pile === "discard" && !peeking ? discardPlays(game, seat, sheet) : []}
      onRead={onRead}
      onPlay={onPlay}
      onClose={onClose}
    />
  );
}

// The cards a row folded away, as the canvas last laid the table out (store.ts, `folded`): a row shows one large. It subscribes to what it
// draws of them, as one key each: the card's code and picture key ("" for a card the table hides the face of, which is not named: selectors.ts,
// hidesFace) and what a folded location says of the enemies grappled under it (the count and the Threat they add), so a state that changes
// none of that does not render it.
function RowReading({ store, ctx, row, names, picture, onRead, onClose }: { store: TableStore; ctx: ReduceContext; row: "staging" | "engaged"; names: SheetNames; picture: Pictures; onRead: (cardId: string) => void; onClose: () => void }) {
  const ids = useStore(store, (state) => state.rowFolds[row]);
  const rowsKey = useStore(store, (state) =>
    state.rowFolds[row]
      .map((id) => {
        const card = state.game.cards[id];
        const key = card && !hidesFace(card) ? pictureKey(card) : "";
        return [card?.code ?? "", key, grappleDetail(state.game, id) ?? ""].join("\t");
      })
      .join("\n"),
  );
  // A stack that holds only the Stormcaller's area's cards is titled for it (stormcaller-table.ts); its stage never folds.
  const areaOnly = useStore(store, (state) => row === "staging" && ids.length > 0 && ids.every((id) => areaRoleOf(state.game, id) != null));
  const rows = rowsKey.split("\n");
  const cards = ids.map((id, at) => {
    const [code = "", key = "", grapple = ""] = (rows[at] ?? "").split("\t");
    return listCard(id, code, key, names, picture, ctx.cards, grapple || null);
  });
  return <RowList title={areaOnly ? AREA_LIST_TITLE : foldTitle(row)} cards={cards} onRead={onRead} onClose={onClose} />;
}

function LogReading({ store, logNames, onClose }: { store: TableStore; logNames: LogNames; onClose: () => void }) {
  const round = useStore(store, (state) => state.game.round);
  const roundSteps = useStore(store, (state) => state.roundSteps);
  const lines = useMemo(() => logLines(roundSteps, logNames), [roundSteps, logNames]);
  return <LogPanel round={round} lines={lines} onClose={onClose} />;
}

// The Island Map: the map as the game lays it out, fitted to the room the panel has (island-table.ts); a tile shows its card large.
function IslandReading({ store, ctx, width, maxHeight, onRead, onClose }: { store: TableStore; ctx: ReduceContext; width: number; maxHeight: number; onRead: (cardId: string) => void; onClose: () => void }) {
  const s = useUiScale();
  const game = useStore(store, (state) => state.game);
  const readout = useMemo(() => islandReadout(game, ctx.cards), [game, ctx]);
  const fit = useMemo(() => islandFit(width, maxHeight, s, readout ? standingWords(readout) : ""), [width, maxHeight, s, readout]);
  return readout ? <IslandPanel readout={readout} fit={fit} onRead={onRead} onClose={onClose} /> : null;
}

function ThreatReading({ store, ctx, names, seat, onClose }: { store: TableStore; ctx: ReduceContext; names: SheetNames; seat: number; onClose: () => void }) {
  const game = useStore(store, (state) => state.game);
  return (
    <ThreatPanel
      seatLabel={game.seatCount > 1 ? `Player ${seat + 1}` : null}
      threat={game.seats[seat]?.threat ?? 0}
      rows={threatRows(game, ctx, seat).map((row) => ({ id: row.id, name: names.card(row.id), cost: row.cost, verdict: threatVerdict(row, seat) }))}
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
  picture,
  onPreview,
  onAllSettings,
}: {
  store: TableStore;
  ctx: ReduceContext;
  names: SheetNames;
  // A card's picture by its picture key, as the table and the choice's rows draw it.
  picture: Pictures;
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
  // The settings panel and the card lists (a pile's, a row's) stand on night; the log, the threat panel and the Island Map on paper.
  const night = settingsOpen || held?.kind === "pile" || held?.kind === "row";
  // The settings panel is wider than the other panels, so its three-word switches fit (settings-panel-width.ts).
  const width = settingsOpen ? settingsPanelWidth(canvas, s, screen.width - insets.left - insets.right - 2 * EDGE * s) : Math.max(READING_MIN * s, box.width);
  const foot = Math.max(insets.bottom, EDGE * s);
  // The Island Map's panel is wider than the reading frame, so its words stand beside the grid (island-table.ts); the "Choice waiting" line under it takes its room from the height.
  const shown = held?.kind === "island" ? islandPanelWidth(width, screen.width - insets.left - insets.right - 2 * EDGE * s, s) : width;
  const room = screen.height - barBottom - foot - EDGE * s;
  const open = reading?.kind === "carousel";
  const strip = useHeld(carousel);
  return (
    <>
      {peek.words ? <PeekBanner words={peek.words} top={barBottom + PEEK_TOP * s} left={insets.left} width={canvas} onBack={peek.back} /> : null}
      {/* The phase title crosses the screen's center (user request, 2026-11-01); taps pass through it. */}
      <PhaseSweep store={store} area={{ left: 0, top: 0, width: screen.width, height: screen.height }} />
      {/* A tap outside the open tray, away from the canvas (which folds it itself): the top bar but its menu button and its dials (a dial
          cannot pick: the table view folds the tray on its tap and then peeks), and the empty part of the command column above the dock. A screen reader leaves the tray open. */}
      {outsideLayers({ trayShown, reading: reading != null, reader }) ? (
        <>
          <Pressable testID="tray-outside-bar" accessible={false} importantForAccessibility="no" onPress={choice.foldOutside} style={{ position: "absolute", top: 0, left: insets.left + dialsEdge, right: insets.right + menuZone, height: barBottom }} />
          <Pressable testID="tray-outside-column" accessible={false} importantForAccessibility="no" onPress={choice.foldOutside} style={{ position: "absolute", top: barBottom, right: insets.right, width: commandWidth, height: Math.max(0, anchor - barBottom) }} />
        </>
      ) : null}
      {panel ? <Pressable testID="reading-scrim" accessibilityRole="button" accessibilityLabel="Close the panel" onPress={close} style={{ position: "absolute", top: barBottom, left: 0, right: 0, bottom: 0 }} /> : null}
      <TrayFrame open={panel != null} surface={night ? "night" : "paper"} testID="reading" place={{ right: insets.right, width: shown, bottom: foot, maxHeight: room }}>
        {held?.kind === "pile" ? (
          <PileReading
            store={store}
            ctx={ctx}
            picture={picture}
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
        {held?.kind === "row" ? <RowReading store={store} ctx={ctx} row={held.row} names={names} picture={picture} onRead={onPreview} onClose={close} /> : null}
        {held?.kind === "log" ? <LogReading store={store} logNames={logNames} onClose={close} /> : null}
        {held?.kind === "threat" ? <ThreatReading store={store} ctx={ctx} names={names} seat={held.seat} onClose={close} /> : null}
        {held?.kind === "island" ? <IslandReading store={store} ctx={ctx} width={shown} maxHeight={room - (trayShown ? WAITING * s : 0)} onRead={onPreview} onClose={close} /> : null}
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
          <Text testID="choice-waiting" className={`pt-1 text-center text-label ${night ? "text-muted" : "text-inkMuted"}`}>
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
