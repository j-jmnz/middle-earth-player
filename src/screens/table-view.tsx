// The table of an open game, campaign or standalone, always in landscape (each table route's stack option,
// routes/_layout.tsx). The canvas, the dock and the panels are src/play; the route opens the session and keeps each accepted
// intent in user.db, and this view hands the canvas the pictures in the image cache and lays the pieces out. The reducer is
// the only writer of the game; how a tap becomes an intent is src/play/use-table-choice.ts.
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { backStep } from "../play/back";
import { slotNumbers } from "../play/card-effects";
import { CardPreview } from "../play/card-preview";
import { logLines, type LogNames } from "../play/log";
import { prefetchCodes, resolutionCodes } from "../play/prefetch";
import { QuestBand } from "../play/quest-band";
import { railFor } from "../play/rail";
import { PILE_WORDS, shownSeat, threatSelector, type PileId } from "../play/selectors";
import type { SheetNames } from "../play/sheet-types";
import type { ReduceContext, TableStore } from "../play/store";
import { TableCanvas } from "../play/table-canvas";
import type { PictureSource, SlotInfo } from "../play/table-canvas-types";
import { ChromeButton, PhaseRail, ThreatRing, threatLine } from "../play/table-chrome";
import { MomentBanner, TableDock } from "../play/table-dock";
import { LogPanel, PileList, ReferencePanel, SidePanel, ThreatPanel } from "../play/table-panel";
import { turnReference } from "../play/reference";
import { tableSettings } from "../play/table-settings";
import { threatRows, threatVerdict } from "../play/foresight";
import { previewCards } from "../play/table-preview";
import { useTableChoice } from "../play/use-table-choice";
import { ledgerLine, ruleTitle } from "../play/ledger";
import { notApplied, notAppliedCodes } from "../play/not-applied";
import { Screen } from "./chrome";
import { goBack } from "./go-back";
import { enqueueImageDownloads } from "./images/queue";
import { scanAssets } from "./images/scan-map";
import { cachedImage, useImageSnapshot } from "./images/store";
import type { World } from "../campaign/world";
import type { CardFacts } from "./open-game";

const TOP_BAR = 44;
// Under this height a panel covers the top bar too, so its options have room.
const SHORT = 400;

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
  const roundSteps = useStore(store, (state) => state.roundSteps);
  const selected = useStore(store, (state) => state.selected);
  const seat = shownSeat(game);
  const ctx = session.ctx;

  const [logOpen, setLogOpen] = useState(false);
  // A reading panel over the table's right side: the threat panel (a tap on a dial) for a seat.
  const [reading, setReading] = useState<{ kind: "threat"; seat: number } | { kind: "reference" } | null>(null);
  const settings = useStore(tableSettings, (state) => state.settings);
  const look = useMemo(() => ({ contrast: settings.highContrast }), [settings.highContrast]);
  const [pile, setPile] = useState<PileId | null>(null);
  // The card shown large, and cards listed with it that are not on the table (the Look window's).
  const [preview, setPreview] = useState<{ id: string; extra: readonly string[] } | null>(null);

  // Prefetch the hand, the cards on the table and the screen about to open; never the whole cache. The canvas draws names
  // until a file lands. The codes are joined into one string so the effect runs when the set changes, not on every intent.
  const wanted = useMemo(() => {
    const next = [...resolutionCodes(game), ...(selected ? [game.cards[selected]?.code ?? ""] : [])];
    return prefetchCodes(game, seat, next).join(",");
  }, [game, seat, selected]);
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
    const now = store.getState().game;
    return slotNumbers(now, ctx, cardId, shownSeat(now));
  }, [store, ctx]);
  const rail = useMemo(() => railFor(game), [game]);
  const logNames: LogNames = useMemo(
    () => ({ card: names.card, code: nameOf, effectCard: (effectId: string) => ctx.effects.find((effect) => effect.id === effectId)?.cardCode ?? null, rule: ruleTitle, line: ledgerLine }),
    [names, nameOf, ctx],
  );
  const lines = useMemo(() => (logOpen ? logLines(roundSteps, logNames) : []), [logOpen, roundSteps, logNames]);

  const onOutcome = useCallback(() => router.replace(nav.outcome), [router, nav]);
  const onPile = useCallback((id: string) => {
    if (id === "discard" || id === "encounterDiscard") setPile(id);
  }, []);
  const onPreview = useCallback((id: string, extra: readonly string[] = []) => setPreview({ id, extra }), []);
  const choice = useTableChoice({ store, ctx, names, onPreview, onPile, onOutcome });

  // Android hardware Back peels one layer at a time (src/play/back.ts) and only then leaves the table.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (preview) {
        setPreview(null);
        return true;
      }
      const step = backStep({ infoOpen: reading != null, logOpen, pileOpen: pile != null, overlayOpen: choice.overlayOpen, panelOpen: choice.panelOpen });
      if (step === "closeInfo") setReading(null);
      else if (step === "closeLog") setLogOpen(false);
      else if (step === "closePile") setPile(null);
      else if (step === "closeOverlay") choice.closeOverlay();
      else if (step === "foldPanel") choice.fold();
      else goBack(router, nav.back);
      return true;
    });
    return () => subscription.remove();
  }, [preview, reading, logOpen, pile, choice, router, nav]);

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
  const ticksOf = (_seat: number): readonly number[] => ticks;
  const showLife = game.widgets.lifeTracker && game.life != null;
  const threatText = threatLine(threats, showLife ? (game.life ?? 0) : null);
  const commandWidth = Math.round(Math.min(280, Math.max(210, screen.width * 0.3)));
  const panelWidth = Math.round(Math.min(480, Math.max(320, screen.width * 0.46)));
  // A panel slides in from the right, under the top bar; on a short phone it covers the top bar too.
  const panelTop = screen.height < SHORT ? 0 : insets.top + TOP_BAR;
  const panelStyle = { position: "absolute" as const, top: panelTop, bottom: 0, right: 0, width: panelWidth + insets.right };
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
      )
    : null;
  const shown = previewed?.cards[previewed.start];

  return (
    <Screen testID="table" scene="felt" inset={false}>
      <View className="flex-1" style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <View className="flex-row items-center px-2" style={{ minHeight: TOP_BAR }}>
          <ChromeButton label={`‹ ${nav.backLabel}`} testID="table-back" accessibilityLabel={nav.backAccessibilityLabel} onPress={() => goBack(router, nav.back)} />
          <View className="flex-row">
            {threats.map((threat) => (
              <ThreatRing
                key={threat.seat}
                threat={threat}
                label={threats.length > 1 ? `P${threat.seat + 1}` : "Threat"}
                accessibilityName={threats.length > 1 ? `Player ${threat.seat + 1} threat` : "Threat"}
                active={threats.length > 1 && threat.seat === seat}
                compact
                ticks={ticksOf(threat.seat)}
                onPress={() => setReading({ kind: "threat", seat: threat.seat })}
              />
            ))}
            {showLife ? <ThreatRing threat={{ seat: 0, threat: game.life ?? 0, eliminated: false }} label="Life" testID="life" icon={null} elimination={false} compact /> : null}
          </View>
          <PhaseRail rail={rail} narrow={narrow} onPress={() => setReading({ kind: "reference" })} />
          {narrow ? null : <Text testID="table-round" className="px-2 text-label text-muted">{`Round ${game.round}`}</Text>}
          <ChromeButton label="Log" testID="log-open" tone="gold" accessibilityLabel="This round's log" onPress={() => setLogOpen(true)} />
          <ChromeButton label="Rules" testID="rules-open" tone="gold" accessibilityLabel="Look up a rule" onPress={() => router.push("/glossary")} />
          <ChromeButton
            label="Booklet"
            testID="booklet-open"
            tone="gold"
            accessibilityLabel="Open the booklet"
            onPress={() => router.push({ pathname: "/booklet/[id]", params: nav.booklet })}
          />
        </View>
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
            {/* The quest card on the table already shows its progress: the band gives way while the dock shows numbers. */}
            {choice.readout ? <View /> : <QuestBand game={game} ctx={ctx} nameOf={nameOf} line={ledgerLine} />}
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
              extras={choice.extras}
              resetKey={choice.resetKey}
              guide={choice.guide}
            />
          </View>
        </View>
      </View>
      {choice.panelOpen ? (
        <View style={panelStyle}>
          <SidePanel
            sheet={choice.sheet}
            game={game}
            choice={choice.choice}
            dock={choice.dock}
            readout={choice.readout}
            threat={threatText}
            refusal={refusal}
            resetKey={choice.resetKey}
            onTile={choice.onTile}
            onButton={choice.onButton}
            onFold={choice.fold}
            onRead={(cardId) => onPreview(cardId)}
            undo={choice.undo}
          />
        </View>
      ) : null}
      {pile ? (
        <View style={panelStyle}>
          <PileList
            title={PILE_WORDS[pile]}
            cards={[...(pile === "discard" ? (game.seats[seat]?.discard ?? []) : game.encounterDiscard)].reverse().map((id) => ({ id, label: names.card(id) }))}
            onRead={(cardId) => onPreview(cardId)}
            onClose={() => setPile(null)}
          />
        </View>
      ) : null}
      {logOpen ? (
        <View style={panelStyle}>
          <LogPanel round={game.round} lines={lines} onClose={() => setLogOpen(false)} />
        </View>
      ) : null}
      {reading?.kind === "reference" ? (
        <View style={panelStyle}>
          <ReferencePanel
            phases={turnReference(game, ruleTitle)}
            settings={settings}
            always={settings.alwaysUse.map((effectId) => {
              const code = ctx.effects.find((effect) => effect.id === effectId)?.cardCode;
              return { effectId, label: `Ask again: ${code ? nameOf(code) : effectId}` };
            })}
            onChange={(change) => tableSettings.getState().update(change)}
            onClose={() => setReading(null)}
          />
        </View>
      ) : null}
      {reading?.kind === "threat" ? (
        <View style={panelStyle}>
          <ThreatPanel
            seatLabel={game.seatCount > 1 ? `Player ${reading.seat + 1}` : "Threat"}
            threat={game.seats[reading.seat]?.threat ?? 0}
            rows={threatRows(game, ctx).map((row) => ({ id: row.id, name: names.card(row.id), cost: row.cost, verdict: threatVerdict(row, reading.seat) }))}
            onClose={() => setReading(null)}
          />
        </View>
      ) : null}
      {/* Over the table and any open panel, centered on the screen under the top bar. */}
      {choice.banner ? <MomentBanner key={choice.bannerKey} moment={choice.banner} top={insets.top + TOP_BAR + 6} width={screen.width} onBeat={choice.onBeat} /> : null}
      {preview && previewed && shown ? (
        <CardPreview
          key={preview.id}
          card={shown}
          related={previewed.cards.filter((_, index) => index !== previewed.start)}
          onClose={() => setPreview(null)}
          onDetails={(code) => router.push({ pathname: "/card/[code]", params: { code } })}
        />
      ) : null}
    </Screen>
  );
}

