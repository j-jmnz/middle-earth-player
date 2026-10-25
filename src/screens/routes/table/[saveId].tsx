// The table for the open scenario of a save, always in landscape (the route's stack option, routes/_layout.tsx). The canvas,
// the dock and the panels are src/play; this screen opens the session, keeps each accepted intent in user.db, hands the
// canvas the pictures in the image cache, and lays the pieces out. The reducer is the only writer of the game; how a tap
// becomes an intent is src/play/use-table-choice.ts.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { backStep } from "../../../play/back";
import { slotNumbers } from "../../../play/card-effects";
import { CardPreview } from "../../../play/card-preview";
import { logLines, type LogNames } from "../../../play/log";
import { prefetchCodes, resolutionCodes } from "../../../play/prefetch";
import { QuestBand } from "../../../play/quest-band";
import { railFor } from "../../../play/rail";
import { PILE_WORDS, shownSeat, threatSelector, type PileId } from "../../../play/selectors";
import type { SheetNames } from "../../../play/sheet-types";
import type { TableStore } from "../../../play/store";
import { TableCanvas } from "../../../play/table-canvas";
import type { PictureSource, SlotInfo } from "../../../play/table-canvas-types";
import { ChromeButton, PhaseRail, ThreatRing, threatLine } from "../../../play/table-chrome";
import { MomentBanner, TableDock } from "../../../play/table-dock";
import { LogPanel, PileList, SidePanel } from "../../../play/table-panel";
import { previewCards } from "../../../play/table-preview";
import { useTableChoice } from "../../../play/use-table-choice";
import { ledgerLine, ruleTitle } from "../../../play/ledger";
import { BodyText, NavBar, Screen } from "../../chrome";
import { bookletParams } from "../../campaign-data";
import { inactiveCodes } from "../../../catalog/active-text";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { enqueueImageDownloads } from "../../images/queue";
import { scanAssets } from "../../images/scan-map";
import { cachedImage, useImageSnapshot } from "../../images/store";
import { routeCode } from "../../route-code";
import { sessionStore, useTableSession, type TableSession } from "../../table-session";

const TOP_BAR = 44;
// Under this height a panel covers the top bar too, so its options have room.
const SHORT = 400;

function picture(code: string): PictureSource | null {
  const cached = cachedImage(code);
  if (cached) return { uri: cached.uri };
  const bundled = scanAssets[code];
  return bundled ? bundled.moduleId : null;
}

function Table({ session, store, saveId }: { session: Extract<TableSession, { ok: true }>; store: TableStore; saveId: string }) {
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
  const [pile, setPile] = useState<PileId | null>(null);
  // The card shown large, and cards listed with it that are not on the table (the Look window's).
  const [preview, setPreview] = useState<{ id: string; extra: readonly string[] } | null>(null);

  // Prefetch the hand, staging and the screen about to open; never the whole cache. The canvas draws names until a file lands.
  const hand = game.seats[seat]?.hand;
  useEffect(() => {
    const current = store.getState().game;
    const next = [...resolutionCodes(current), ...(selected ? [current.cards[selected]?.code ?? ""] : [])];
    const jobs = prefetchCodes(current, seat, next).flatMap((code) => {
      const imagesrc = session.facts.get(code)?.imagesrc;
      return imagesrc ? [{ code, imagesrc, first: true }] : [];
    });
    if (jobs.length > 0) enqueueImageDownloads(jobs);
  }, [store, session, seat, hand, game.staging, selected, game.stageCleared]);

  const nameOf = useCallback((code: string) => session.world.cards.get(code)?.name ?? code, [session]);
  const sphereOf = useCallback((code: string) => session.world.cards.get(code)?.sphere ?? null, [session]);
  const names: SheetNames = useMemo(() => ({ card: (cardId: string) => nameOf(store.getState().game.cards[cardId]?.code ?? cardId), line: ledgerLine }), [nameOf, store]);
  // Unique text with no effect record is inactive: the canvas veils it, and no control applies it.
  const inactiveSet = useMemo(() => inactiveCodes([...session.facts].map(([code, facts]) => [code, facts.text] as const), ctx.effects), [session, ctx]);
  const inactive = useCallback((code: string) => inactiveSet.has(code), [inactiveSet]);
  // Read from the latest state: the canvas draws again when the cards, the effects in play or the attack change.
  const info = useCallback((cardId: string): SlotInfo => slotNumbers(store.getState().game, ctx, cardId), [store, ctx]);
  const rail = useMemo(() => railFor(game), [game]);
  const logNames: LogNames = useMemo(
    () => ({ card: names.card, code: nameOf, effectCard: (effectId: string) => ctx.effects.find((effect) => effect.id === effectId)?.cardCode ?? null, rule: ruleTitle, line: ledgerLine }),
    [names, nameOf, ctx],
  );
  const lines = useMemo(() => (logOpen ? logLines(roundSteps, logNames) : []), [logOpen, roundSteps, logNames]);

  const onOutcome = useCallback(() => router.replace({ pathname: "/resolution/[saveId]", params: { saveId } }), [router, saveId]);
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
      const step = backStep({ logOpen, pileOpen: pile != null, overlayOpen: choice.overlayOpen, panelOpen: choice.panelOpen });
      if (step === "closeLog") setLogOpen(false);
      else if (step === "closePile") setPile(null);
      else if (step === "closeOverlay") choice.closeOverlay();
      else if (step === "foldPanel") choice.fold();
      else goBack(router, { pathname: "/path/[saveId]", params: { saveId } });
      return true;
    });
    return () => subscription.remove();
  }, [preview, logOpen, pile, choice, router, saveId]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  };

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
        (code) => ({ name: nameOf(code), source: picture(code), landscape: session.world.cards.get(code)?.type === "quest", text: session.facts.get(code)?.text ?? null }),
        names.card,
        preview.extra,
      )
    : null;
  const shown = previewed?.cards[previewed.start];

  return (
    <Screen testID="table" scene="felt" inset={false}>
      <View className="flex-1" style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <View className="flex-row items-center px-2" style={{ minHeight: TOP_BAR }}>
          <ChromeButton label="‹ Path" testID="table-back" accessibilityLabel="Back to the path" onPress={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} />
          <View className="flex-row">
            {threats.map((threat) => (
              <ThreatRing
                key={threat.seat}
                threat={threat}
                label={threats.length > 1 ? `P${threat.seat + 1}` : "Threat"}
                accessibilityName={threats.length > 1 ? `Player ${threat.seat + 1} threat` : "Threat"}
                active={threats.length > 1 && threat.seat === seat}
                compact
              />
            ))}
            {showLife ? <ThreatRing threat={{ seat: 0, threat: game.life ?? 0, eliminated: false }} label="Life" testID="life" icon={null} compact /> : null}
          </View>
          <PhaseRail rail={rail} narrow={narrow} />
          {narrow ? null : <Text testID="table-round" className="px-2 text-label text-muted">{`Round ${game.round}`}</Text>}
          <ChromeButton label="Log" testID="log-open" tone="gold" accessibilityLabel="This round's log" onPress={() => setLogOpen(true)} />
          <ChromeButton label="Rules" testID="rules-open" tone="gold" accessibilityLabel="Look up a rule" onPress={() => router.push("/glossary")} />
          <ChromeButton
            label="Booklet"
            testID="booklet-open"
            tone="gold"
            accessibilityLabel="Open the booklet"
            onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(session.save.campaignId, session.save.loadout?.scenarioId) })}
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
                onTap={choice.onTap}
                onPreview={onPreview}
                onDrop={choice.onDrop}
              />
            ) : null}
            {choice.banner ? <MomentBanner moment={choice.banner} /> : null}
          </View>
          <View testID="command" className="justify-between px-2" style={{ width: commandWidth, paddingBottom: Math.max(insets.bottom, 8) }}>
            {/* The quest card on the table already shows its progress: the band gives way while the dock shows numbers. */}
            {choice.readout ? <View /> : <QuestBand game={game} ctx={ctx} nameOf={nameOf} />}
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

export default function TableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { user } = useDatabases();
  // Opened once per save: the store holds the game from here on, and each accepted intent is written to user.db.
  const session = useTableSession(saveId);
  const store = useMemo(() => (session?.ok ? sessionStore(session, user).store : null), [session, user]);

  if (!saveId || !session || !session.ok || !store) {
    const sentence =
      session?.ok === false && session.reason === "dropped"
        ? "The scenario in progress was dropped because the rules or the card data changed. Your log and decks are kept."
        : "No scenario is open.";
    return (
      <Screen testID="table" scene="plain">
        <NavBar onBack={() => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/")} backTestID="table-back" backLabel="Path" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
      </Screen>
    );
  }
  return <Table session={session} store={store} saveId={saveId} />;
}
