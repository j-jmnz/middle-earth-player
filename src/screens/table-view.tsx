// The table of an open game, campaign or standalone, always in landscape (each table route's stack option,
// routes/_layout.tsx). The canvas, the dock and the panels are src/play; the route opens the session and keeps each accepted
// intent in user.db, and this view hands the canvas the pictures in the image cache and lays the pieces out. The reducer is
// the only writer of the game; how a tap becomes an intent is src/play/use-table-choice.ts.
import { useRouter, type Href } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { backStep, playLayers, runBackStep } from "../play/back-steps";
import { createBeats } from "../play/beat-store";
import { slotNumbers } from "../play/card-effects";
import { CardPreview } from "../play/card-preview";
import { standInText } from "../play/dungeon-preview";
import type { LogNames } from "../play/log";
import { prefetchCodes, resolutionCodes } from "../play/prefetch";
import { dockPills } from "../play/dock-extras";
import { ChoiceTray } from "../play/choice-tray";
import { isDense } from "../play/dock-budget";
import { MorePopoverView, useMorePopover } from "../play/dock-more";
import { railFor } from "../play/rail";
import { shownSeat, threatSelector, tickKeySelector } from "../play/selectors";
import type { SheetNames } from "../play/sheet-types";
import { effectById, type ReduceContext, type TableStore } from "../play/store";
import { createHandoff } from "../play/spotlight-handoff";
import { SpotlightLayer } from "../play/spotlight-layer";
import type { SpotlightLayerProps } from "../play/spotlight-handoff";
import type { StageArea } from "../play/spotlight-stage";
import { TableCanvas } from "../play/table-canvas";
import type { PictureSource, TableCanvasProps } from "../play/table-canvas-types";
import { MomentBanner } from "../play/moment-banner";
import { TableDock } from "../play/table-dock";
import { TableLayers } from "../play/table-layers";
import { openReading, type Reading } from "../play/reading";
import { phaseCarousel, stopAheadOf } from "../play/carousel";
import { tableSettings } from "../play/table-settings";
import { useKeepAwake } from "../play/use-keep-awake";
import { TableMenu } from "../play/table-menu";
import type { MenuItemId } from "../play/table-menu-items";
import { previewCards } from "../play/table-preview";
import { pictureCode, pictureKey } from "../play/picture-key";
import { advanceButton, advanceWords } from "../play/quest-advance";
import { QuestAdvanceView } from "../play/quest-advance-view";
import { useQuestAdvance } from "../play/use-quest-advance";
import { PEEK_ROOM } from "../play/peek-banner";
import { usePeek } from "../play/use-peek";
import { useTableChoice } from "../play/use-table-choice";
import { trayCount } from "../play/tray-logic";
import { withAlphaHex } from "../play/tokens";
import { useTableTokens } from "../play/use-table-tokens";
import { dockReadout } from "../play/readout";
import { questScaleOf } from "../play/quest-scale";
import { QuestScaleView } from "../play/quest-scale-view";
import { campaignTokens, heldDial, widgetReadouts } from "../play/widgets";
import { ledgerLine, ruleTitle, sideText } from "../play/ledger";
import { notApplied, notAppliedCodes } from "../play/not-applied";
import { BodyText, NavBar, Screen } from "./chrome";
import { TableTopBar, TOP_BAR } from "./table-top-bar";
import { BAR_TOP } from "../play/top-bar-layout";
import { goBack } from "./go-back";
import { enqueueImageDownloads } from "./images/queue";
import { scanAssets } from "./images/scan-map";
import { cachedImage, useImageRevision, useImageSnapshot } from "./images/store";
import type { World } from "../campaign/world";
import type { CardFacts } from "./open-game";
import { commandWidth as commandWidthOf } from "./table-command";
import { useUiScale } from "../play/ui-scale";

// By picture key (src/play/picture-key.ts): side B where it is bundled, else the card's side A picture.
function picture(key: string): PictureSource | null {
  const bundled = scanAssets[key] ?? scanAssets[pictureCode(key)];
  if (bundled) return bundled.moduleId;
  const cached = cachedImage(pictureCode(key));
  return cached ? { uri: cached.uri } : null;
}

// The lookups made since the image cache last changed (`revision`, images/store.ts). A card shown large (the preview, the advanced stage) is
// described during the render and its description is kept while its inputs are the same, so the picture it shows has to be an input: this
// reads `picture` for a revision and is read again only when the revision moves, which re-describes the card when its file lands.
let looked: { revision: number; sources: Map<string, PictureSource | null> } = { revision: -1, sources: new Map() };
function pictureAt(key: string, revision: number): PictureSource | null {
  if (looked.revision !== revision) looked = { revision, sources: new Map() };
  if (!looked.sources.has(key)) looked.sources.set(key, picture(key));
  return looked.sources.get(key) ?? null;
}

// The canvas and the spotlight's layer read the image cache's revision themselves, so a picture that lands draws them and not the view above
// (the table view, its hooks and its panels).
const PicturedCanvas = memo(function PicturedCanvas(props: Omit<TableCanvasProps, "pictureRevision">) {
  const { revision } = useImageSnapshot();
  return <TableCanvas {...props} pictureRevision={revision} />;
});

const PicturedSpotlight = memo(function PicturedSpotlight(props: Omit<SpotlightLayerProps, "pictureRevision">) {
  const { revision } = useImageSnapshot();
  return <SpotlightLayer {...props} pictureRevision={revision} />;
});

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

export function TableView({ session, store, nav }: { session: OpenedTable; store: TableStore; nav: TableNav }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const s = useUiScale();
  const t = useTableTokens();
  // The canvas wrapper's size, and its left edge in the row (the quest scale's width, when it shows).
  const [size, setSize] = useState<{ width: number; height: number; x: number } | null>(null);
  // The plan and clock the table canvas hands the combat spotlight's full-screen layer, created once (spotlight-handoff.ts).
  const [handoff] = useState(createHandoff);
  // The pieces that draw pictures read the image cache's revision themselves (PicturedCanvas), so this view does not render for a file landing.
  const game = useStore(store, (state) => state.game);
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
  // Only the settings this view uses: a change to another (the theme, the scale, a haptics switch) does not render it.
  const highContrast = useStore(tableSettings, (state) => state.settings.highContrast);
  const stopsOn = useStore(tableSettings, (state) => state.settings.stopsOn);
  const stops = useStore(tableSettings, (state) => state.settings.stops);
  useKeepAwake();
  const look = useMemo(() => ({ contrast: highContrast }), [highContrast]);
  // The card shown large, and cards listed with it that are not on the table (the Look window's).
  const [preview, setPreview] = useState<{ id: string; extra: readonly string[] } | null>(null);

  // Prefetch the hand, the cards on the table and the screen about to open; never the whole cache. The canvas draws names
  // until a file lands. The codes are joined into one string so the effect runs when the set changes, not on every intent.
  const wanted = useMemo(() => prefetchCodes(game, peek.shown, resolutionCodes(game)).join(","), [game, peek.shown]);
  useEffect(() => {
    const jobs = wanted.split(",").flatMap((code) => {
      const imagesrc = session.facts.get(code)?.imagesrc;
      return imagesrc ? [{ code, imagesrc, first: true }] : [];
    });
    if (jobs.length > 0) enqueueImageDownloads(jobs);
  }, [session, wanted]);
  // A card picked up (a drag begins, the canvas selects it) is fetched at once if its picture is missing. The pickup is the store's `selected`,
  // read here from a listener instead of a subscription, so picking a card up does not render this view or the hooks and panels under it.
  useEffect(
    () =>
      store.subscribe((state, before) => {
        const id = state.selected;
        if (id == null || id === before.selected) return;
        const code = state.game.cards[id]?.code;
        const imagesrc = code ? session.facts.get(code)?.imagesrc : undefined;
        if (code && imagesrc) enqueueImageDownloads([{ code, imagesrc, first: true }]);
      }),
    [store, session],
  );

  const nameOf = useCallback((code: string) => session.world.cards.get(code)?.name ?? code, [session]);
  const sphereOf = useCallback((code: string) => session.world.cards.get(code)?.sphere ?? null, [session]);
  const names: SheetNames = useMemo(
    () => ({ card: (cardId: string) => nameOf(store.getState().game.cards[cardId]?.code ?? cardId), line: ledgerLine, text: (code: string) => session.facts.get(code)?.text ?? null }),
    [nameOf, store, session],
  );
  // A printed line no effect record reads is not applied: the canvas marks the card, and no control applies the line.
  const inactiveSet = useMemo(() => notAppliedCodes([...session.facts].map(([code, facts]) => [code, facts.text] as const)), [session]);
  const inactive = useCallback((code: string) => inactiveSet.has(code), [inactiveSet]);
  // Read from the state the canvas holds and the seat it draws, never from the store in a render.
  const info = useCallback<TableCanvasProps["info"]>((now, seat, cardId) => slotNumbers(now, ctx, cardId, seat), [ctx]);
  const rail = useMemo(() => railFor(game), [game]);
  // The strip is laid out only while it is open; the rail's S (a stop of the player's lies ahead) is read without laying it out.
  const carouselOpen = reading?.kind === "carousel";
  const carousel = useMemo(() => (carouselOpen ? phaseCarousel(game, { stopsOn, stops }, ruleTitle) : null), [carouselOpen, game, stopsOn, stops]);
  const stopAhead = useMemo(() => stopAheadOf(game, { stopsOn, stops }), [game, stopsOn, stops]);
  const logNames: LogNames = useMemo(
    () => ({ card: names.card, code: nameOf, effectCard: (effectId: string) => effectById(ctx, effectId)?.cardCode ?? null, rule: ruleTitle, line: ledgerLine }),
    [names, nameOf, ctx],
  );

  // A menu row closes the menu and then acts (src/play/table-menu-items.ts).
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
        case "settings":
          setReading({ kind: "settings" });
          return;
        default: {
          const unreachable: never = id;
          throw new Error(`Unknown menu row ${String(unreachable)}`);
        }
      }
    },
    [router, nav],
  );
  const onOutcome = useCallback(() => router.replace(nav.outcome), [router, nav]);
  // A discard pile opens its list; a deck with an encounter card attached to it (Iron Shackles, 01105:A:1) opens that card, whose preview says what it does.
  const onPile = useCallback(
    (id: string) => {
      if (id === "discard" || id === "encounterDiscard") return setReading({ kind: "pile", pile: id });
      const { game: now, viewedSeat } = store.getState();
      const shackles = id === "deck" ? now.seats[shownSeat(now, viewedSeat)]?.deckAttached?.[0] : undefined;
      if (shackles) setPreview({ id: shackles, extra: [] });
    },
    [store],
  );
  const onPreview = useCallback((id: string, extra: readonly string[] = []) => setPreview({ id, extra }), []);
  // The stage the quest just advanced to, shown large until Progress (src/play/quest-advance.ts); the table answers nothing meanwhile.
  const advance = useQuestAdvance(store);
  const choice = useTableChoice({ store, ctx, names, beats, onPreview, onPile, onOutcome, hold: advance.held });
  // A card shown large reads its picture from the cache, so it is described again when a file lands (pictureAt) while it is up.
  const revision = useImageRevision(preview != null || advance.shown != null);
  // The quiet pills: Undo and up to two others, or Undo and More (dock-extras.ts); More opens a popover (dock-more.tsx).
  const pills = dockPills(choice.extras);
  const scale = useMemo(() => questScaleOf(game, ctx, choice.readout), [game, ctx, choice.readout]);
  // A tablet's table (a window 600 pt tall or more, in logical points) has room for the larger dials.
  const tabletTable = screen.height / s >= 600;
  const more = useMorePopover(pills.more.length, choice.resetKey);
  const { open: moreOpen, lines: linesOpen, close: closeMore } = more;

  // Android hardware Back peels one layer at a time (src/play/back.ts) and only then leaves the table.
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
        previewOpen: preview != null, readingOpen: reading != null,
        overlayOpen: choice.overlayOpen, panelOpen: choice.panelOpen,
      });
      if (runBackStep(step, store)) return true;
      if (step === "closeMenu") setMenuOpen(false);
      else if (step === "closeMore" || step === "closeLines") closeMore();
      else if (step === "closePreview") (previewClose.current ?? (() => setPreview(null)))();
      else if (step === "closeReading") setReading(null);
      else if (step === "closeOverlay") choice.closeOverlay();
      else if (step === "foldPanel") choice.fold();
      else goBack(router, nav.back);
      return true;
    });
    return () => subscription.remove();
  }, [store, menuOpen, moreOpen, linesOpen, closeMore, preview, reading, choice, router, nav, advance]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height, x } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height && current.x === x ? current : { width, height, x }));
  };

  // The staging enemies' engagement costs, marked on each dial's meter (the same for every seat; each dial reads its own).
  const tickOf = useMemo(() => tickKeySelector(ctx), [ctx]);
  const tickKey = useStore(store, (state) => tickOf(state.game));
  const ticks = useMemo(() => (tickKey === "" ? [] : tickKey.split(",").map(Number)), [tickKey]);
  // What the dials and bar read of the game, derived once for each state; the campaign card's tokens are rebuilt only when its name or count changes.
  const widgets = useMemo(() => widgetReadouts(game), [game]);
  const campaign = useMemo(() => campaignTokens(game, ctx.effects, nameOf), [game, ctx, nameOf]);
  const tokenName = campaign?.name ?? null;
  const tokenCount = campaign?.tokens ?? null;
  const tokens = useMemo(() => (tokenName == null || tokenCount == null ? null : { name: tokenName, tokens: tokenCount }), [tokenName, tokenCount]);
  const held = useMemo(() => heldDial(game, nameOf), [game, nameOf]);
  const commandWidth = commandWidthOf(screen.width, s);
  // The screen the combat spotlight fills: its size, where the canvas's corner is on it (under the top bar, after the left inset and
  // the quest scale) and the safe insets (spotlight-stage.ts).
  // The bar's top: under the top inset, and never at the screen's very edge (BAR_TOP).
  const barTop = Math.max(insets.top, BAR_TOP * s);
  const barBottom = barTop + TOP_BAR * s;
  const canvasX = size?.x ?? 0;
  const stageArea = useMemo<StageArea>(
    () => ({ width: screen.width, height: screen.height, origin: { x: insets.left + canvasX, y: barBottom }, safe: { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left } }),
    [screen.width, screen.height, insets.left, insets.top, insets.right, insets.bottom, canvasX, barBottom],
  );
  const narrow = (screen.width - insets.left - insets.right) / s < 760;
  // How a card code is shown large, by picture key (src/play/picture-key.ts): the preview's cards and the advanced stage.
  const describe = (code: string, key = code) => ({
    name: nameOf(code),
    source: pictureAt(key, revision),
    landscape: session.world.cards.get(code)?.type === "quest",
    // A revealed quest stage reads its B side.
    text: (key !== code ? sideText(code, "B") : null) ?? session.facts.get(code)?.text ?? standInText(session.world.cards, code),
    notApplied: notApplied(code, session.world.cards.get(code)?.type, session.facts.get(code)?.text ?? null),
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
      )
    : null;
  const shown = previewed?.cards[previewed.start];

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
          rail={rail}
          stopAhead={stopAhead}
          carouselOpen={carouselOpen}
          narrow={narrow}
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
          {/* The quest scale at the left edge, in the Quest phase only (user request, 2026-10-29): the threat in staging against the
              willpower committed, live as characters commit. Outside it the canvas takes its room. */}
          {scale.live ? (
            <View style={{ paddingBottom: Math.max(insets.bottom, 10 * s), paddingTop: 4 * s }}>
              <QuestScaleView scale={scale} wide={tabletTable} />
            </View>
          ) : null}
          <View className="min-h-0 flex-1" onLayout={onLayout}>
            {size ? (
              <PicturedCanvas
                store={store}
                width={size.width}
                height={size.height}
                picture={picture}
                nameOf={nameOf}
                sphereOf={sphereOf}
                inactive={inactive}
                info={info}
                highlight={choice.highlight}
                beats={beats}
                raised={choice.raised}
                fight={choice.fight}
                bottomInset={insets.bottom}
                stageArea={stageArea}
                handoff={handoff}
                look={look}
                onTap={choice.onTap}
                onPreview={onPreview}
                onDrop={choice.onDrop}
              />
            ) : null}
          </View>
          {/* The command column stands on a fade to the night at its foot and right edge, clear (0 alpha) at its left edge and at its top so no straight edge shows (one radial gradient of the column's own width and height from the bottom-right corner); the dock has no panel of its own. */}
          <View testID="command" className="justify-between px-2" style={{ width: commandWidth, paddingBottom: Math.max(insets.bottom, 8 * s), backgroundImage: `radial-gradient(100% 100% at 100% 100%, ${t.night} 0%, ${withAlphaHex(t.night, 0.92)} 35%, ${withAlphaHex(t.night, 0)} 100%)` }}>
            <TableDock
              step={choice.header.step}
              lead={choice.header.lead}
              title={choice.header.title}
              note={choice.header.note}
              picked={choice.picked}
              unavailable={choice.unavailable}
              // The quest scale shows the willpower against the threat in the Quest phase, so the dock keeps only the readout's result line.
              readout={dockReadout(choice.readout, scale.live)}
              refusal={refusal}
              dock={choice.dock}
              onButton={choice.onButton}
              extras={pills.pills}
              more={pills.more}
              onMore={more.show} onLines={more.showLines}
              resetKey={choice.resetKey}
              guide={choice.guide}
              trayOpen={choice.panelOpen}
              count={trayCount(choice.sheet, choice.choice)}
              tray={<ChoiceTray open={choice.panelOpen} sheet={choice.sheet} choice={choice.choice} picture={picture} dense={isDense(screen.height, s)} onTile={choice.onTile} onRead={onPreview} />}
              onTop={setAnchor}
            />
          </View>
        </View>
      </View>
      <TableLayers
        store={store}
        ctx={ctx}
        names={names}
        nameOf={nameOf}
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
        onPreview={onPreview}
        onAllSettings={() => {
          // The panel closes first, so it is not still open when the player comes back.
          setReading(null);
          router.push({ pathname: "/settings", params: { from: "table" } });
        }}
      />
      {/* The combat spotlight: a full-screen canvas over the table, the bar and the dock, mounted only while it plays and deaf to touches
          (the table canvas and the scrim in TableLayers catch the skip). The banner, the preview and the menu stay above it. */}
      <PicturedSpotlight handoff={handoff} picture={picture} nameOf={nameOf} sphereOf={sphereOf} />
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
      {advance.shown && advancedCard ? (
        <QuestAdvanceView
          key={advance.shown.seq}
          card={{ code: advancedCard.code, ...describe(advancedCard.code, pictureKey(advancedCard)) }}
          words={advanceWords(game, ctx, advance.shown.stageId, nameOf(advancedCard.code), ledgerLine)}
          button={advanceButton(game, ctx, advance.shown, ledgerLine)}
          asks={advance.asks}
          choice={choice}
          picture={picture}
          onProgress={advance.close}
        />
      ) : null}
      {/* Last, so the layer Back closes first is the one on top. */}
      <TableMenu open={menuOpen} nav={nav} top={barBottom} right={insets.right + 8 * s} onClose={() => setMenuOpen(false)} onSelect={onMenuRow} />
      <MorePopoverView more={more} items={pills.more} words={{ title: choice.header.lead + choice.header.title, guide: choice.guide, note: choice.header.note, unavailable: choice.unavailable }} commandWidth={commandWidth} insetRight={insets.right} onClose={more.close} />
    </Screen>
  );
}

