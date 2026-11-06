// The table of an open game, campaign or standalone, always in landscape (each table route's stack option,
// routes/_layout.tsx). The canvas, the dock and the panels are src/play; the route opens the session and keeps each accepted
// intent in user.db, and this view hands the canvas the pictures in the image cache and lays the pieces out. The reducer is
// the only writer of the game; how a tap becomes an intent is src/play/choice/use-table-choice.ts.
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { backStep, playLayers, runBackStep } from "../../play/chrome/back-steps";
import { createBeats } from "../../play/store/beat-store";
import { slotNumbers } from "../../play/cards/card-effects";
import { CardPreview } from "../../play/cards/card-preview";
import { standInText } from "../../play/cards/dungeon-preview";
import { causeKey, type LogNames } from "../../play/store/log";
import { dockPills } from "../../play/choice/dock/extras";
import { ChoiceTray } from "../../play/choice/tray";
import { isDense } from "../../play/choice/dock/budget";
import { MorePopoverView, useMorePopover } from "../../play/choice/dock/more";
import { railFor } from "../../play/phases/rail";
import { dialTicksSelector, threatSelector } from "../../play/store/selectors";
import { effectById, type ReduceContext, type TableStore } from "../../play/store/store";
import { createHandoff } from "../../play/spotlight/handoff";
import type { StageArea } from "../../play/spotlight/stage";
import { PicturedCanvas, PicturedSpotlight } from "./pictured";
import type { TableCanvasProps } from "../../play/canvas/table-canvas-types";
import { MomentBanner } from "../../play/readouts/moment-banner";
import { TableDock } from "../../play/choice/dock/table-dock";
import { TableLayers } from "../../play/chrome/table-layers";
import { openReading, type Reading } from "../../play/chrome/reading";
import { phaseCarousel, stopAheadOf } from "../../play/phases/carousel";
import { tableSettings } from "../../ui/table-settings";
import { useKeepAwake } from "../../play/chrome/use-keep-awake";
import { TableMenu } from "../../play/chrome/table-menu";
import type { MenuItemId } from "../../play/chrome/table-menu-items";
import { previewCards } from "../../play/cards/table-preview";
import { pictureKey } from "../../play/canvas/picture-key";
import { advanceButton, advanceFace, advanceWords } from "../../play/readouts/quest-advance";
import { QuestAdvanceView } from "../../play/readouts/quest-advance-view";
import { useQuestAdvance } from "../../play/readouts/use-quest-advance";
import { PEEK_ROOM, PEEK_TOP } from "../../play/readouts/peek-banner";
import { usePeek } from "../../play/store/use-peek";
import { AreaSummary } from "../../play/canvas/area-summary";
import { useTableChoice } from "../../play/choice/use-table-choice";
import { useTableWiring } from "../../play/chrome/use-table-wiring";
import { trayCount } from "../../play/choice/tray-logic";
import { withAlphaHex } from "../../ui/tokens";
import { useTableTokens } from "../../ui/use-table-tokens";
import { dockReadout } from "../../play/readouts/readout";
import { questScaleOf } from "../../play/readouts/quest-scale";
import { CommandHead } from "../../play/readouts/command-head-view";
import { dockWithNumbers, HEAD_GAP, headPlan, headRoom, NUMBERS_ROW } from "../../play/readouts/command-head";
import { columnReach, coveredTop, type RowFeet } from "../../play/layout/column-reach";
import { campaignTokens, heldDial, nightmareCardId, widgetReadouts } from "../../play/readouts/widgets";
import { whyNotChosen } from "../../play/choice/why";
import { ledgerLine, ruleTitle, sideText } from "../../play/cards/ledger";
import { notApplied } from "../../play/cards/not-applied";
import { BodyText, NavBar, Screen } from "../kit/chrome";
import { TableTopBar, TOP_BAR } from "./top-bar";
import { BAR_TOP } from "../../play/chrome/top-bar-layout";
import { goBack } from "../nav/go-back";
import { useTablePictures } from "./use-table-pictures";
import { pictureAt, useCardLookups } from "./card-lookups";
import { useImageRevision } from "../images/store";
import type { World } from "../../campaign/world";
import type { CardFacts } from "../session/open-game";
import { commandWidth as commandWidthOf } from "./command";
import type { PlayClock } from "../session/play-clock";
import { usePlayClock } from "../session/use-play-clock";
import { useUiScale } from "../../ui/ui-scale";

/** Where the table's chrome leads: back to the screen the game belongs to, the outcome screen, and the booklet. */
export type TableNav = {
  backLabel: string;
  backAccessibilityLabel: string;
  back: Href;
  outcome: Href;
  booklet: { id: string; page?: string };
};

/** What the table draws from: the opened world, the reducer context, and each card's picture source and text. */
export type OpenedTable = { world: World; ctx: ReduceContext; facts: ReadonlyMap<string, CardFacts> };

// The Nightmare setup card on the table, if the game has one (docs/brief.md, Nightmare).
function setupCodes(game: { cards: Readonly<Record<string, { zone: string; code: string }>> }): string[] {
  return Object.values(game.cards).filter((card) => card.zone === "nightmare").map((card) => card.code);
}

export function TableView({ session, store, clock, nav }: { session: OpenedTable; store: TableStore; clock: PlayClock; nav: TableNav }) {
  usePlayClock(clock);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const s = useUiScale();
  const t = useTableTokens();
  // The canvas wrapper's size (the command column lies over its right edge), and its left edge in the row.
  const [size, setSize] = useState<{ width: number; height: number; x: number } | null>(null);
  // The plan and clock the table canvas hands the combat spotlight's full-screen layer, created once (spotlight/handoff.ts).
  const [handoff] = useState(createHandoff);
  // The pieces that draw pictures read the image cache's revision themselves (PicturedCanvas), so this view does not render for a file landing.
  const game = useStore(store, (state) => state.game);
  const resumed = useStore(store, (state) => state.resumed);
  const refusal = useStore(store, (state) => state.refusal);
  const threatOf = useMemo(() => threatSelector(), []);
  const threats = useStore(store, (state) => threatOf(state.game));
  const peek = usePeek(store);
  // The banner's beat rings cards on the canvas, which reads it from here (beat-store.ts).
  const [beats] = useState(createBeats);
  const ctx = session.ctx;

  const [menuOpen, setMenuOpen] = useState(false);
  // The card preview closes with its own animation; the Back layers call it through this (back.ts).
  const previewClose = useRef<(() => void) | null>(null);
  // The one reading layer over the table (reading.ts): a dial's threat panel, the phase carousel (the rail), the table settings,
  // the log (the menu's rows), a discard pile's list. Opening one replaces the last.
  const [reading, setReading] = useState<Reading | null>(null);
  // The screen y of the top of the dock's content: the tap layer that folds the choice's rows covers the column above it.
  const [anchor, setAnchor] = useState<number | null>(null);
  // The command column's height and the dock's own: the head (the quest meter) fills the room between them.
  const [columnHeight, setColumnHeight] = useState(0);
  const [dockHeight, setDockHeight] = useState(0);
  // The readout's numbers row, as last measured (the dock drops it while the meter shows the numbers).
  const [numbersRow, setNumbersRow] = useState(NUMBERS_ROW * s);
  // Whether the dock, as last measured, drew that row.
  const [dockHasNumbers, setDockHasNumbers] = useState(true);
  // The feet of the canvas's staging and engagement rows, as the canvas last laid them out (column-reach.ts).
  const [feet, setFeet] = useState<RowFeet | null>(null);
  // Only the settings this view uses: a change to another (the theme, the scale, a haptics switch) does not render it.
  const highContrast = useStore(tableSettings, (state) => state.settings.highContrast);
  const stopsOn = useStore(tableSettings, (state) => state.settings.stopsOn);
  const stops = useStore(tableSettings, (state) => state.settings.stops);
  useKeepAwake();
  const look = useMemo(() => ({ contrast: highContrast }), [highContrast]);
  // The card shown large, and cards listed with it that are not on the table (the Look window's).
  const [preview, setPreview] = useState<{ id: string; extra: readonly string[] } | null>(null);
  // The scenario's setup card shown large from the menu (user request, 2026-11-01): a preview of its own, since the card need not be on the table.
  const [setupShown, setSetupShown] = useState(false);

  // The pictures of the hand, the table and the screen about to open, and of a card picked up (use-table-pictures.ts).
  useTablePictures(store, session, game, peek.shown);

  // Names, spheres, pictures and not-applied marks by picture key (card-lookups.ts).
  const { nameOf, sphereOf, lostIsland, ownSide, pictureOf, names, inactive } = useCardLookups(session, store);
  // Read from the state the canvas holds and the seat it draws, never from the store in a render.
  const info = useCallback<TableCanvasProps["info"]>((now, seat, cardId) => slotNumbers(now, ctx, cardId, seat), [ctx]);
  const rail = useMemo(() => railFor(game), [game]);
  // The strip is laid out only while it is open; the rail's S (a stop of the player's lies ahead) is read without laying it out.
  const carouselOpen = reading?.kind === "carousel";
  const carousel = useMemo(() => (carouselOpen ? phaseCarousel(game, { stopsOn, stops }, ruleTitle) : null), [carouselOpen, game, stopsOn, stops]);
  const stopAhead = useMemo(() => stopAheadOf(game, { stopsOn, stops }), [game, stopsOn, stops]);
  const logNames: LogNames = useMemo(
    () => ({
      card: names.card,
      code: nameOf,
      // A cause on the Lost Island side of a double-sided location names a Lost Island, never the location.
      effectCard: (effectId: string, lineId: string) => {
        const code = effectById(ctx, effectId)?.cardCode;
        return code ? causeKey(code, lineId, session.world.cards.get(code)?.keywords.uncharted === true) : null;
      },
      rule: ruleTitle,
      line: ledgerLine,
    }),
    [names, nameOf, ctx, session],
  );

  // A menu row closes the menu and then acts (src/play/chrome/table-menu-items.ts).
  const onMenuRow = useCallback(
    (id: MenuItemId) => {
      setMenuOpen(false);
      switch (id) {
        case "leave":
          goBack(router, nav.back);
          return;
        case "log":
          setReading({ kind: "log" });
          return;
        case "rules":
          router.push("/glossary");
          return;
        case "booklet":
          router.push({ pathname: "/booklet/[id]", params: nav.booklet });
          return;
        case "setup":
          setPreview(null);
          setSetupShown(true);
          return;
        case "settings":
          setReading({ kind: "settings" });
          return;
        case "resign":
          // Asked first: a resigned scenario is lost and its outcome opens.
          Alert.alert("Resign this scenario?", "The game is lost and its outcome opens.", [
            { text: "Keep playing", style: "cancel" },
            { text: "Resign", style: "destructive", onPress: () => store.getState().dispatch({ type: "Resign" }) },
          ]);
          return;
        default: {
          const unreachable: never = id;
          throw new Error(`Unknown menu row ${String(unreachable)}`);
        }
      }
    },
    [router, nav, store],
  );
  const onOutcome = useCallback(() => router.replace(nav.outcome), [router, nav]);
  // The printed facts, the preview opener, the pile taps, the Heading dial and the Island Map chip (use-table-wiring.ts).
  const { facts, success, onPreview, onPile, headingDial, island } = useTableWiring({ store, ctx, game, setReading, setPreview });
  // The stage the quest just advanced to, shown large until Progress (src/play/readouts/quest-advance.ts); the table answers nothing meanwhile.
  const advance = useQuestAdvance(store);
  const choice = useTableChoice({ store, ctx, names, beats, onPreview, onPile, onOutcome, hold: advance.held });
  // A card shown large reads its picture from the cache, so it is described again when a file lands (pictureAt) while it is up.
  const revision = useImageRevision(preview != null || advance.shown != null);
  // The quiet pills: Undo and up to two others, or Undo and More (dock/extras.ts); More opens a popover (dock/more.tsx).
  const pills = dockPills(choice.extras);
  const scale = useMemo(() => questScaleOf(game, ctx, choice.readout), [game, ctx, choice.readout]);
  const more = useMorePopover(pills.more.length, choice.resetKey);
  const { open: moreOpen, lines: linesOpen, close: closeMore } = more;

  // Android hardware Back peels one layer at a time (src/play/chrome/back.ts) and only then leaves the table.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      // The quest advance screen is on top: Back is its Progress, and does nothing while the stage asks.
      if (advance.shown) {
        if (!advance.asks) advance.close();
        return true;
      }
      const step = backStep({
        ...playLayers(store),
        menuOpen, moreOpen, linesOpen,
        previewOpen: preview != null || setupShown, readingOpen: reading != null,
        overlayOpen: choice.overlayOpen, panelOpen: choice.panelOpen,
      });
      if (runBackStep(step, store)) return true;
      if (step === "closeMenu") setMenuOpen(false);
      else if (step === "closeMore" || step === "closeLines") closeMore();
      else if (step === "closePreview") (previewClose.current ?? (() => (setupShown ? setSetupShown(false) : setPreview(null))))();
      else if (step === "closeReading") setReading(null);
      else if (step === "closeOverlay") choice.closeOverlay();
      else if (step === "foldPanel") choice.fold();
      else goBack(router, nav.back);
      return true;
    });
    return () => subscription.remove();
  }, [store, menuOpen, moreOpen, linesOpen, closeMore, preview, setupShown, reading, choice, router, nav, advance]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height, x } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height && current.x === x ? current : { width, height, x }));
  };

  // The staging enemies' engagement costs, marked on each dial's meter: the one staging area's for every dial, and once stages are separate each seat's own.
  const tickOf = useMemo(() => dialTicksSelector(ctx), [ctx]);
  const tickKey = useStore(store, (state) => tickOf(state.game));
  const ticks = useMemo(() => tickKey.split("|").map((key) => (key === "" ? [] : key.split(",").map(Number))), [tickKey]);
  // What the dials and bar read of the game, derived once for each state; the campaign card's tokens are rebuilt only when its name or count changes.
  const widgets = useMemo(() => widgetReadouts(game), [game]);
  const campaign = useMemo(() => campaignTokens(game, ctx.effects, nameOf, peek.shown), [game, ctx, nameOf, peek.shown]);
  const tokenName = campaign?.name ?? null;
  const tokenCount = campaign?.tokens ?? null;
  const tokens = useMemo(() => (tokenName == null || tokenCount == null ? null : { name: tokenName, tokens: tokenCount }), [tokenName, tokenCount]);
  const held = useMemo(() => heldDial(game, nameOf), [game, nameOf]);
  // The Nightmare setup card next to the quest deck, on Nightmare: the Eye in the top bar opens it.
  const nightmareId = useMemo(() => nightmareCardId(game), [game]);
  const commandWidth = commandWidthOf(screen.width, s);
  // The head stands in the column's room above the dock (command-head.ts), the quest meter in the Quest phase only; while it shows, the dock keeps only the readout's result line.
  const footPad = Math.max(insets.bottom, 8 * s);
  // Once stage 2B has split the table a peek shows the other seat's staging row, which the pill would cover: the canvas leaves the pill its room above the row.
  const peekRoom = peek.words && game.separate === true ? (PEEK_ROOM - PEEK_TOP) * s : 0;
  // The reach (the top rows wholly above the dock, which a crowded row may run on under, column-reach.ts) is planned without the head, against the dock with its
  // numbers row, the same height whether or not the meter has taken it; the head then gets only the room under the rows the reach covers (no flip between the two).
  const questNumbers = choice.readout?.kind === "quest" && choice.readout.stats.length > 0;
  const planDock = dockWithNumbers(dockHeight, numbersRow, questNumbers && !dockHasNumbers);
  const column = { height: columnHeight, foot: footPad, dock: planDock, margin: 8 * s, top: peekRoom };
  const reach = columnReach(column, feet);
  const covered = coveredTop(column, feet, reach);
  const room = headRoom(columnHeight, footPad, dockHeight, HEAD_GAP * s, covered);
  const planRoom = headRoom(columnHeight, footPad, planDock, HEAD_GAP * s, covered);
  const headShown = columnHeight > 0 && dockHeight > 0 && headPlan(planRoom, s, scale.live) !== "hidden";
  const meterShown = headShown && scale.live;
  // The screen the combat spotlight fills: its size, where the canvas's corner is on it (under the top bar, after the left inset and
  // the left inset) and the safe insets (spotlight/stage.ts).
  // The bar's top: under the top inset, and never at the screen's very edge (BAR_TOP).
  const barTop = Math.max(insets.top, BAR_TOP * s);
  const barBottom = barTop + TOP_BAR * s;
  const canvasX = size?.x ?? 0;
  const stageArea = useMemo<StageArea>(
    () => ({ width: screen.width, height: screen.height, origin: { x: insets.left + canvasX, y: barBottom }, safe: { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left } }),
    [screen.width, screen.height, insets.left, insets.top, insets.right, insets.bottom, canvasX, barBottom],
  );
  const narrow = (screen.width - insets.left - insets.right) / s < 760;
  // A tap on a covered row reaches the canvas, which folds the tray or picks, so the tray's outside layer over the column starts under it.
  const columnClear = reach === 0 || !feet ? 0 : peekRoom + (reach === 2 ? feet.engaged : feet.staging);
  // How a card code is shown large, by picture key (src/play/canvas/picture-key.ts): the preview's cards and the advanced stage.
  const describe = (code: string, key = code) => ({
    name: nameOf(key),
    source: pictureAt(key, revision, ownSide(key)),
    landscape: session.world.cards.get(code)?.type === "quest",
    // A revealed quest stage reads its B side.
    text: (key !== code ? sideText(code, "B") : null) ?? session.facts.get(code)?.text ?? standInText(session.world.cards, code, (base) => session.facts.get(base)?.text ?? null),
    notApplied: lostIsland(key) ? null : notApplied(code, session.world.cards.get(code)?.type, session.facts.get(code)?.text ?? null),
  });
  const advancedCard = advance.shown ? game.cards[advance.shown.stageId] : undefined;
  const previewed = preview
    ? previewCards(
        game,
        ctx,
        preview.id,
        describe,
        names.card,
        preview.extra,
        ledgerLine,
        (cardId) => whyNotChosen(game, ctx, cardId, choice.sheet),
      )
    : null;
  const shown = previewed?.cards[previewed.start];
  // The setup card: the scenario's campaign card on its Setup side (rr.campaign-cards), then the Nightmare setup card on Nightmare.
  const setupCards = setupShown ? [session.world.scenario.campaignCard, ...setupCodes(game)].map((code) => ({ code, ...describe(code) })) : [];

  // The stack locks the table to landscape, but iPadOS can still give the app a portrait window (a resizable window, Split
  // View). The table is not laid out for one, so it asks to be turned.
  if (screen.height > screen.width) {
    return (
      <Screen testID="table-portrait" scene="table">
        <NavBar onBack={() => goBack(router, nav.back)} backTestID="table-back" backLabel={nav.backLabel} />
        <View className="flex-1 items-center justify-center px-6">
          <BodyText tone="muted">Make this window wider, or turn the screen to landscape, to play. The game is saved.</BodyText>
        </View>
      </Screen>
    );
  }

  return (
    // Bleed: the view below insets itself (barTop), so the status bar's inset is not added twice (user report, 2026-10-30).
    <Screen testID="table" scene="table" bleed>
      {/* Never flattened: with "auto" alone this view is layout-only and the renderer drops it, so the menu or a popover turning
          it to "no-hide-descendants" would add a native view and move the canvas into it, and the canvas would flash. */}
      <View className="flex-1" collapsable={false} importantForAccessibility={menuOpen || more.open || more.lines ? "no-hide-descendants" : "auto"} style={{ paddingTop: barTop, paddingLeft: insets.left, paddingRight: insets.right }}>
        <TableTopBar
          threats={threats}
          acting={peek.acting}
          viewed={peek.viewed}
          life={widgets.life}
          burdenDeck={widgets.burdenDeck}
          tokens={tokens}
          heading={headingDial} island={island}
          onIsland={() => setReading({ kind: "island" })}
          onNightmare={nightmareId ? () => onPreview(nightmareId) : null}
          rail={rail}
          stopAhead={stopAhead} carouselOpen={carouselOpen}
          narrow={narrow} areas={game.separate === true}
          ticks={ticks}
          ringSeat={held?.seat}
          ringWords={held?.words}
          ringMark={held?.mark}
          menuOpen={menuOpen}
          onThreat={(threatSeat) => { choice.foldOutside(); setReading(peek.tap(threatSeat) ? null : { kind: "threat", seat: threatSeat }); }}
          onRail={() => setReading((now) => openReading(now, { kind: "carousel" }))}
          onMenu={() => setMenuOpen((open) => !open)}
        />
        <View className="min-h-0 flex-1 flex-row">
          {/* The command column's fade (below), under the canvas. */}
          <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: commandWidth, backgroundImage: `radial-gradient(100% 100% at 100% 100%, ${t.night} 0%, ${withAlphaHex(t.night, 0.92)} 35%, ${withAlphaHex(t.night, 0)} 100%)` }} />
          <View className="min-h-0 flex-1" style={{ paddingTop: peekRoom }} onLayout={onLayout}>
            {/* Once stage 2B splits the table: whose staging area, which stage and how many cards, as one accessible line (words/area.ts). */}
            <AreaSummary store={store} nameOf={nameOf} />
            {size ? (
              <PicturedCanvas
                store={store}
                width={size.width - commandWidth}
                height={size.height - peekRoom}
                column={commandWidth}
                reach={columnHeight > 0 && dockHeight > 0 && feet != null ? reach : null}
                onRowFeet={setFeet}
                picture={pictureOf}
                nameOf={nameOf}
                sphereOf={sphereOf}
                inactive={inactive}
                facts={facts}
                success={success}
                info={info}
                highlight={choice.highlight} readerSeed={choice.readerSeed}
                beats={beats}
                raised={choice.raised}
                fight={choice.fight}
                bottomInset={insets.bottom}
                stageArea={stageArea}
                handoff={handoff}
                look={look}
                onTap={choice.onTap}
                onEmptyTap={choice.foldOutside}
                onPreview={onPreview}
                onDrop={choice.onDrop}
              />
            ) : null}
          </View>
          {/* The command column lies over the canvas's right edge, its empty top passing taps to the canvas. It stands on a fade to the night at its foot and right edge, clear (0 alpha) at its left edge and at its top so no straight edge shows (one radial gradient of the column's own width and height from the bottom-right corner), drawn under the canvas (above) so a row that runs on under the column stays clear; the dock has no panel of its own. */}
          <View testID="command" pointerEvents="box-none" className="justify-between px-2" onLayout={(event) => setColumnHeight(Math.round(event.nativeEvent.layout.height))} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: commandWidth, paddingBottom: footPad }}>
            {/* Above the dock, from the column's top to the dock's top; it never pushes the dock (command-head.ts). */}
            <CommandHead scale={scale} room={room} bottom={footPad + dockHeight + HEAD_GAP * s} onMeter={() => setReading({ kind: "stagingThreat" })} />
            <TableDock
              step={choice.header.step}
              lead={choice.header.lead}
              title={choice.header.title}
              note={choice.header.note}
              picked={choice.picked}
              unavailable={choice.unavailable}
              readout={dockReadout(choice.readout, meterShown)}
              refusal={refusal}
              dock={choice.dock}
              onButton={choice.onButton}
              extras={pills.pills}
              more={pills.more}
              onMore={more.show} onLines={more.showLines}
              resetKey={choice.resetKey} momentKey={choice.sheet.key} stay={choice.stayFocus}
              guide={choice.guide}
              trayOpen={choice.panelOpen}
              count={trayCount(choice.sheet, choice.choice)}
              tray={<ChoiceTray open={choice.panelOpen} sheet={choice.sheet} choice={choice.choice} picture={pictureOf} dense={isDense(screen.height, s)} onTile={choice.onTile} onRead={onPreview} onStep={choice.onStep} />}
              onTop={setAnchor}
              onHeight={(height, hasNumbers) => {
                setDockHeight(height);
                setDockHasNumbers(hasNumbers);
              }}
              onNumbers={setNumbersRow}
            />
          </View>
        </View>
      </View>
      <TableLayers
        store={store}
        ctx={ctx}
        names={names}
        nameOf={nameOf}
        picture={pictureOf}
        choice={choice}
        reading={reading}
        onReading={setReading}
        carousel={carousel}
        logNames={logNames}
        screen={screen}
        insets={insets}
        barBottom={barBottom}
        commandWidth={commandWidth}
        anchorTop={anchor}
        columnClear={columnClear}
        onPreview={onPreview}
        onAllSettings={() => {
          // The panel closes first, so it is not still open when the player comes back.
          setReading(null);
          router.push({ pathname: "/settings", params: { from: "table" } });
        }}
      />
      {/* The combat spotlight: a full-screen canvas over the table, the bar and the dock, mounted only while it plays and deaf to touches
          (the table canvas and the scrim in TableLayers catch the skip). The banner, the preview and the menu stay above it. */}
      <PicturedSpotlight handoff={handoff} picture={pictureOf} nameOf={nameOf} sphereOf={sphereOf} />
      {/* Over the top bar, the table and any open panel, centered on the screen at its top edge (user request, 2026-10-29), and
          narrowed so it never covers the command column's tray (banner-span.ts). While the table peeks it hangs under the peek pill, so
          Back to Player 1 stays in reach. */}
      {choice.banner ? (
        <MomentBanner
          key={choice.bannerKey}
          moment={choice.banner}
          top={peek.words ? barTop + (TOP_BAR + PEEK_ROOM) * s : insets.top + 4 * s}
          leftClear={insets.left}
          rightClear={insets.right + commandWidth}
          onBeat={choice.onBeat}
          onDismiss={choice.dismissBanner}
        />
      ) : null}
      {advance.shown && advancedCard ? (
        <QuestAdvanceView
          key={advance.shown.seq}
          card={{ code: advancedCard.code, ...describe(advancedCard.code, pictureKey({ code: advancedCard.code, face: advanceFace(game, advancedCard) })) }}
          words={advanceWords(game, ctx, advance.shown.stageId, nameOf(advancedCard.code), ledgerLine, advance.shown.also, nameOf)}
          button={advanceButton(game, ctx, advance.shown, ledgerLine, resumed)}
          asks={advance.asks}
          choice={choice}
          picture={pictureOf}
          onRead={onPreview}
          onProgress={advance.close}
        />
      ) : null}
      {/* After the quest advance screen, so a card read from its options stands over it. */}
      {preview && previewed && shown ? (
        <CardPreview
          key={preview.id}
          card={shown}
          related={previewed.cards.filter((_, index) => index !== previewed.start)}
          onClose={() => setPreview(null)}
          ownsBack={false}
          closeRef={previewClose}
          onDetails={(code) => router.push({ pathname: "/card/[code]", params: { code } })}
        />
      ) : null}
      {setupCards[0] ? (
        <CardPreview
          key="setup-card"
          card={setupCards[0]}
          related={setupCards.slice(1)}
          onClose={() => setSetupShown(false)}
          ownsBack={false}
          closeRef={previewClose}
          onDetails={(code) => router.push({ pathname: "/card/[code]", params: { code } })}
        />
      ) : null}
      {/* Last, so the layer Back closes first is the one on top. */}
      <TableMenu open={menuOpen} nav={nav} top={barBottom} right={insets.right + 8 * s} onClose={() => setMenuOpen(false)} onSelect={onMenuRow} />
      <MorePopoverView more={more} items={pills.more} words={{ title: choice.header.lead + choice.header.title, guide: choice.guide, note: choice.header.note, unavailable: choice.unavailable }} commandWidth={commandWidth} insetRight={insets.right} onClose={more.close} />
    </Screen>
  );
}

