// The table of an open game, campaign or standalone, always in landscape (each table route's stack option,
// routes/_layout.tsx). The canvas, the dock and the panels are src/play; the route opens the session and keeps each accepted
// intent in user.db, and this view hands the canvas the pictures in the image cache and lays the pieces out. The reducer is
// the only writer of the game; how a tap becomes an intent is src/play/use-table-choice.ts.
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { backStep } from "../play/back";
import { scrubOpen } from "../play/scrub-open";
import { spotlightOpen } from "../play/spotlight-gate";
import { slotNumbers } from "../play/card-effects";
import { CardPreview } from "../play/card-preview";
import type { LogNames } from "../play/log";
import { prefetchCodes, resolutionCodes } from "../play/prefetch";
import { dockPills } from "../play/dock-extras";
import { MorePopoverView, useMorePopover } from "../play/dock-more";
import { railFor } from "../play/rail";
import { shownSeat, threatSelector } from "../play/selectors";
import type { SheetNames } from "../play/sheet-types";
import type { ReduceContext, TableStore } from "../play/store";
import { TableCanvas } from "../play/table-canvas";
import type { PictureSource, SlotInfo } from "../play/table-canvas-types";
import { MomentBanner, TableDock } from "../play/table-dock";
import { TableLayers } from "../play/table-layers";
import { openReading, type Reading } from "../play/reading";
import { phaseCarousel } from "../play/carousel";
import { tableSettings } from "../play/table-settings";
import { TableMenu } from "../play/table-menu";
import type { MenuItemId } from "../play/table-menu-items";
import { threatRows } from "../play/foresight";
import { previewCards } from "../play/table-preview";
import { PEEK_ROOM, playStep, usePeek } from "../play/use-peek";
import { useTableChoice } from "../play/use-table-choice";
import { locationReadout, ringWords, widgetReadouts } from "../play/widgets";
import { ledgerLine, ruleTitle } from "../play/ledger";
import { notApplied, notAppliedCodes } from "../play/not-applied";
import { Screen } from "./chrome";
import { TableTopBar, TOP_BAR } from "./table-top-bar";
import { goBack } from "./go-back";
import { enqueueImageDownloads } from "./images/queue";
import { scanAssets } from "./images/scan-map";
import { cachedImage, useImageSnapshot } from "./images/store";
import type { World } from "../campaign/world";
import type { CardFacts } from "./open-game";

function picture(code: string): PictureSource | null {
  const cached = cachedImage(code);
  if (cached) return { uri: cached.uri };
  const bundled = scanAssets[code];
  return bundled ? bundled.moduleId : null;
}

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
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const images = useImageSnapshot();
  const game = useStore(store, (state) => state.game);
  const refusal = useStore(store, (state) => state.refusal);
  const threatOf = useMemo(() => threatSelector(), []);
  const threats = useStore(store, (state) => threatOf(state.game));
  const selected = useStore(store, (state) => state.selected);
  const peek = usePeek(store);
  const ctx = session.ctx;

  const [menuOpen, setMenuOpen] = useState(false);
  // The card preview closes with its own animation; the Back layers call it through this (back.ts).
  const previewClose = useRef<(() => void) | null>(null);
  // The one reading layer over the table (reading.ts): a dial's threat panel, the phase carousel (the rail), the table settings,
  // the log (the menu's rows), a discard pile's list. Opening one replaces the last.
  const [reading, setReading] = useState<Reading | null>(null);
  // The screen y of the top of the dock's buttons block, which the choice tray stays above.
  const [anchor, setAnchor] = useState<number | null>(null);
  const settings = useStore(tableSettings, (state) => state.settings);
  const look = useMemo(() => ({ contrast: settings.highContrast }), [settings.highContrast]);
  // The card shown large, and cards listed with it that are not on the table (the Look window's).
  const [preview, setPreview] = useState<{ id: string; extra: readonly string[] } | null>(null);

  // Prefetch the hand, the cards on the table and the screen about to open; never the whole cache. The canvas draws names
  // until a file lands. The codes are joined into one string so the effect runs when the set changes, not on every intent.
  const wanted = useMemo(() => {
    const next = [...resolutionCodes(game), ...(selected ? [game.cards[selected]?.code ?? ""] : [])];
    return prefetchCodes(game, peek.shown, next).join(",");
  }, [game, peek.shown, selected]);
  useEffect(() => {
    const jobs = wanted.split(",").flatMap((code) => {
      const imagesrc = session.facts.get(code)?.imagesrc;
      return imagesrc ? [{ code, imagesrc, first: true }] : [];
    });
    if (jobs.length > 0) enqueueImageDownloads(jobs);
  }, [session, wanted]);

  const nameOf = useCallback((code: string) => session.world.cards.get(code)?.name ?? code, [session]);
  const sphereOf = useCallback((code: string) => session.world.cards.get(code)?.sphere ?? null, [session]);
  const names: SheetNames = useMemo(
    () => ({ card: (cardId: string) => nameOf(store.getState().game.cards[cardId]?.code ?? cardId), line: ledgerLine, text: (code: string) => session.facts.get(code)?.text ?? null }),
    [nameOf, store, session],
  );
  // A printed line no effect record reads is not applied: the canvas marks the card, and no control applies the line.
  const inactiveSet = useMemo(() => notAppliedCodes([...session.facts].map(([code, facts]) => [code, facts.text] as const)), [session]);
  const inactive = useCallback((code: string) => inactiveSet.has(code), [inactiveSet]);
  // Read from the latest state: the canvas draws again when the cards, the effects in play or the attack change.
  const info = useCallback((cardId: string): SlotInfo => {
    const { game: now, viewedSeat } = store.getState();
    return slotNumbers(now, ctx, cardId, shownSeat(now, viewedSeat));
  }, [store, ctx]);
  const rail = useMemo(() => railFor(game), [game]);
  const carousel = useMemo(() => phaseCarousel(game, { stopsOn: settings.stopsOn, stops: settings.stops }, ruleTitle), [game, settings.stopsOn, settings.stops]);
  const logNames: LogNames = useMemo(
    () => ({ card: names.card, code: nameOf, effectCard: (effectId: string) => ctx.effects.find((effect) => effect.id === effectId)?.cardCode ?? null, rule: ruleTitle, line: ledgerLine }),
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
  const onPile = useCallback((id: string) => (id === "discard" || id === "encounterDiscard" ? setReading({ kind: "pile", pile: id }) : undefined), []);
  const onPreview = useCallback((id: string, extra: readonly string[] = []) => setPreview({ id, extra }), []);
  const choice = useTableChoice({ store, ctx, names, onPreview, onPile, onOutcome });
  // The quiet pills: Undo and up to two others, or Undo and More (dock-extras.ts); More opens a popover (dock-more.tsx).
  const pills = dockPills(choice.extras);
  const more = useMorePopover(pills.more.length, choice.resetKey);
  const { open: moreOpen, lines: linesOpen, close: closeMore } = more;

  // Android hardware Back peels one layer at a time (src/play/back.ts) and only then leaves the table.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const step = backStep({
        spotlightOpen: spotlightOpen(store.getState().spotlight), scrubOpen: scrubOpen(), peekOpen: peek.viewed != null,
        menuOpen, moreOpen, linesOpen,
        previewOpen: preview != null, readingOpen: reading != null,
        overlayOpen: choice.overlayOpen, panelOpen: choice.panelOpen,
      });
      if (playStep(step, store)) return true;
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
  }, [store, peek.viewed, menuOpen, moreOpen, linesOpen, closeMore, preview, reading, choice, router, nav]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  };

  // The staging enemies' engagement costs, marked on each dial's meter (the same for every seat; each dial reads its own).
  const tickKey = useStore(store, (state) =>
    threatRows(state.game, ctx)
      .filter((row) => !row.blocked)
      .map((row) => row.cost)
      .join(","),
  );
  const ticks = useMemo(() => (tickKey === "" ? [] : tickKey.split(",").map(Number)), [tickKey]);
  const widgets = widgetReadouts(game);
  const locations = locationReadout(game);
  const commandWidth = Math.round(Math.min(280, Math.max(210, screen.width * 0.3)));
  const narrow = screen.width - insets.left - insets.right < 760;
  const previewed = preview
    ? previewCards(
        game,
        ctx,
        preview.id,
        (code) => ({
          name: nameOf(code),
          source: picture(code),
          landscape: session.world.cards.get(code)?.type === "quest",
          text: session.facts.get(code)?.text ?? null,
          notApplied: notApplied(code, session.world.cards.get(code)?.type, session.facts.get(code)?.text ?? null),
        }),
        names.card,
        preview.extra,
        ledgerLine,
      )
    : null;
  const shown = previewed?.cards[previewed.start];

  return (
    <Screen testID="table" scene="felt" inset={false}>
      <View className="flex-1" importantForAccessibility={menuOpen || more.open || more.lines ? "no-hide-descendants" : "auto"} style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <TableTopBar
          threats={threats}
          acting={peek.acting} viewed={peek.viewed}
          life={widgets.life}
          burdenDeck={widgets.burdenDeck}
          rail={rail}
          stopAhead={carousel.stopAhead}
          carouselOpen={reading?.kind === "carousel"}
          narrow={narrow}
          ticks={ticks}
          ringSeat={locations?.heldBy}
          ringWords={ringWords(locations, nameOf)}
          menuOpen={menuOpen}
          onThreat={(threatSeat) => peek.tap(threatSeat) || setReading({ kind: "threat", seat: threatSeat })}
          onRail={() => setReading((now) => openReading(now, { kind: "carousel" }))}
          onMenu={() => setMenuOpen((open) => !open)}
        />
        <View className="min-h-0 flex-1 flex-row">
          <View className="min-h-0 flex-1" onLayout={onLayout}>
            {size ? (
              <TableCanvas
                store={store}
                width={size.width}
                height={size.height}
                picture={picture}
                pictureRevision={images.revision}
                nameOf={nameOf}
                sphereOf={sphereOf}
                inactive={inactive}
                info={info}
                highlight={choice.highlight}
                raised={choice.raised}
                fight={choice.fight}
                bottomInset={insets.bottom}
                look={look}
                onTap={choice.onTap}
                onPreview={onPreview}
                onDrop={choice.onDrop}
              />
            ) : null}
          </View>
          <View testID="command" className="justify-between px-2" style={{ width: commandWidth, paddingBottom: Math.max(insets.bottom, 8) }}>
            <TableDock
              step={choice.header.step}
              title={choice.header.title}
              note={choice.header.note}
              picked={choice.picked}
              unavailable={choice.unavailable}
              readout={choice.readout}
              refusal={refusal}
              dock={choice.dock}
              onButton={choice.onButton}
              extras={pills.pills}
              more={pills.more}
              onMore={more.show} onLines={more.showLines}
              resetKey={choice.resetKey}
              guide={choice.guide} trayOpen={choice.panelOpen}
              onBlock={setAnchor}
            />
          </View>
        </View>
      </View>
      <TableLayers
        store={store}
        ctx={ctx}
        names={names}
        nameOf={nameOf}
        picture={picture}
        choice={choice}
        reading={reading}
        onReading={setReading}
        settings={settings}
        carousel={carousel}
        logNames={logNames}
        screen={screen}
        insets={insets}
        barBottom={insets.top + TOP_BAR}
        commandWidth={commandWidth}
        anchorTop={anchor}
        onPreview={onPreview}
      />
      {/* Over the table and any open panel, centered on the screen under the top bar. */}
      {choice.banner ? <MomentBanner key={choice.bannerKey} moment={choice.banner} top={insets.top + TOP_BAR + 6 + (peek.words ? PEEK_ROOM : 0)} width={screen.width} onBeat={choice.onBeat} /> : null}
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
      {/* Last, so the layer Back closes first is the one on top. */}
      <TableMenu open={menuOpen} nav={nav} top={insets.top + TOP_BAR} right={insets.right + 8} onClose={() => setMenuOpen(false)} onSelect={onMenuRow} />
      <MorePopoverView more={more} items={pills.more} words={{ title: choice.header.title, guide: choice.guide, note: choice.header.note, unavailable: choice.unavailable }} commandWidth={commandWidth} insetRight={insets.right} onClose={more.close} />
    </Screen>
  );
}

