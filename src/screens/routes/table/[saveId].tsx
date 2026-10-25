// The table for the open scenario of a save. The canvas is src/play; this screen opens the session, keeps each accepted
// intent in user.db, and hands the canvas the pictures in the image cache. The reducer is the only writer of the game.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Text, View, type LayoutChangeEvent } from "react-native";
import { useStore } from "zustand";

import { backStep } from "../../../play/back";
import { QuestBand } from "../../../play/quest-band";
import { railFor } from "../../../play/rail";
import { prefetchCodes, resolutionCodes } from "../../../play/prefetch";
import { inspectTargets, shownSeat, threatSelector, zoneSelector } from "../../../play/selectors";
import { dropOutcome, targetFromKey } from "../../../play/selection";
import { actionsSheet, commitSheet, paySheet } from "../../../play/bar-sheets";
import type { Sheet, SheetNames } from "../../../play/sheet-types";
import { isStepWindow, sheetFor } from "../../../play/sheets";
import type { PlayerIntent, ScenarioState, TableStore } from "../../../play/store";
import { TableCanvas } from "../../../play/table-canvas";
import type { PictureSource } from "../../../play/table-canvas-types";
import { CardListPanel, ChromeButton, ChromePrimary, LogPanel, PhaseRail, SheetTab, SheetView, ThreatRing, threatLine } from "../../../play/table-chrome";
import { BodyText, NavBar, Screen } from "../../chrome";
import { bookletParams } from "../../campaign-data";
import { inactiveCodes } from "../../../catalog/active-text";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { enqueueImageDownloads } from "../../images/queue";
import { scanAssets } from "../../images/scan-map";
import { cachedImage, useImageSnapshot } from "../../images/store";
import { routeCode } from "../../route-code";
import { ledgerLine, ruleTitle } from "../../../play/ledger";
import { logLines, type LogNames } from "../../../play/log";
import { sessionStore, useTableSession, type TableSession } from "../../table-session";

function picture(code: string): PictureSource | null {
  const cached = cachedImage(code);
  if (cached) return { uri: cached.uri };
  const bundled = scanAssets[code];
  return bundled ? bundled.moduleId : null;
}

function Table({ session, store, saveId }: { session: Extract<TableSession, { ok: true }>; store: TableStore; saveId: string }) {
  const router = useRouter();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const images = useImageSnapshot();
  const game = useStore(store, (state) => state.game);
  const legal = useStore(store, (state) => state.legal);
  const refusal = useStore(store, (state) => state.refusal);
  const pending = useStore(store, (state) => state.pendingCommit);
  const threatOf = useMemo(() => threatSelector(), []);
  const threats = useStore(store, (state) => threatOf(state.game));
  // A sheet opened from the bar or from another sheet (a pay sheet, the attackers of an attack). Gone when the game moves.
  const [overlay, setOverlay] = useState<{ sheet: Sheet; game: ScenarioState } | null>(null);
  const [collapsed, setCollapsed] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const roundSteps = useStore(store, (state) => state.roundSteps);

  // Prefetch the hand, staging and the screen about to open; never the whole cache. The canvas draws names until a file lands.
  const seat = useStore(store, (state) => shownSeat(state.game));
  const handOf = useMemo(() => zoneSelector("hand", seat), [seat]);
  const stagingOf = useMemo(() => zoneSelector("staging", seat), [seat]);
  const hand = useStore(store, (state) => handOf(state.game));
  const staging = useStore(store, (state) => stagingOf(state.game));
  const selected = useStore(store, (state) => state.selected);
  const won = game.stageCleared;
  useEffect(() => {
    const current = store.getState().game;
    const next = [...resolutionCodes(current), ...(selected ? [current.cards[selected]?.code ?? ""] : [])];
    const jobs = prefetchCodes(current, seat, next).flatMap((code) => {
      const imagesrc = session.facts.get(code)?.imagesrc;
      return imagesrc ? [{ code, imagesrc, first: true }] : [];
    });
    if (jobs.length > 0) enqueueImageDownloads(jobs);
  }, [store, session, seat, hand, staging, selected, won]);

  const nameOf = useCallback((code: string) => session.world.cards.get(code)?.name ?? code, [session]);
  const sphereOf = useCallback((code: string) => session.world.cards.get(code)?.sphere ?? null, [session]);
  const names: SheetNames = useMemo(
    () => ({ card: (cardId: string) => nameOf(store.getState().game.cards[cardId]?.code ?? cardId), line: ledgerLine }),
    [nameOf, store],
  );
  // Unique text with no effect record is inactive: the canvas veils it, and no control applies it.
  const inactiveSet = useMemo(() => inactiveCodes([...session.facts].map(([code, facts]) => [code, facts.text] as const), session.ctx.effects), [session]);
  const inactive = useCallback((code: string) => inactiveSet.has(code), [inactiveSet]);
  const rail = useMemo(() => railFor(game), [game]);
  const logNames: LogNames = useMemo(
    () => ({
      card: names.card,
      code: nameOf,
      effectCard: (effectId: string) => session.ctx.effects.find((effect) => effect.id === effectId)?.cardCode ?? null,
      rule: ruleTitle,
      line: ledgerLine,
    }),
    [names, nameOf, session],
  );
  const lines = useMemo(() => (logOpen ? logLines(roundSteps, logNames) : []), [logOpen, roundSteps, logNames]);
  const windowSheet = useMemo(() => sheetFor(game, session.ctx, legal, names), [game, session, legal, names]);
  const sheet = overlay && overlay.game === game ? overlay.sheet : windowSheet;
  const showSheet = sheet != null && collapsed !== sheet.key;

  // The overlay (a pay or attackers sheet) closes only when the reducer accepts, so a refusal keeps the player's choices.
  const dispatch = useCallback(
    (intent: PlayerIntent) => {
      if (store.getState().dispatch(intent)) setOverlay(null);
    },
    [store],
  );
  const openSheet = useCallback((next: Sheet) => setOverlay({ sheet: next, game: store.getState().game }), [store]);
  const openCard = useCallback(
    (cardId: string) => {
      const code = store.getState().game.cards[cardId]?.code;
      if (code) router.push({ pathname: "/card/[code]", params: { code } });
    },
    [router, store],
  );
  // A tap on a card with attachments lists them, so each is a full-size target (they only peek out under the host).
  const [inspectList, setInspectList] = useState<readonly string[] | null>(null);
  const onInspect = useCallback(
    (cardId: string) => {
      const targets = inspectTargets(store.getState().game, cardId);
      if (targets.length > 1) setInspectList(targets);
      else openCard(cardId);
    },
    [store, openCard],
  );
  const onDrop = useCallback(
    (cardId: string, key: string) => {
      const { game: now, legal: listed, select, toggleCommit } = store.getState();
      const outcome = dropOutcome(now, session.ctx, listed, cardId, targetFromKey(key));
      select(null);
      if (outcome.kind === "intent") dispatch(outcome.intent);
      else if (outcome.kind === "commit") toggleCommit(cardId);
      else if (outcome.kind === "pay") openSheet(paySheet(now, names, outcome.request, { kind: "play", cardId, hostId: outcome.hostId }));
    },
    [store, session, dispatch, openSheet, names],
  );
  const onOutcome = useCallback(() => router.replace({ pathname: "/resolution/[saveId]", params: { saveId } }), [router, saveId]);
  // Android hardware Back peels one layer at a time (src/play/back.ts) and only then leaves the table.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const step = backStep({ logOpen, inspectOpen: inspectList != null, sheetOpen: sheet != null && showSheet });
      if (step === "closeLog") setLogOpen(false);
      else if (step === "closeInspect") setInspectList(null);
      else if (step === "foldSheet" && sheet) setCollapsed(sheet.key);
      else goBack(router, { pathname: "/path/[saveId]", params: { saveId } });
      return true;
    });
    return () => subscription.remove();
  }, [logOpen, inspectList, sheet, showSheet, router, saveId]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  };

  const actionWindow = game.window?.kind === "pass" || isStepWindow(game);
  const canPass = legal.some((intent) => intent.type === "Pass") && actionWindow;
  const canCommit = legal.some((intent) => intent.type === "Commit");
  const hasActions = actionWindow && legal.some((intent) => intent.type === "Trigger");
  const committing = canCommit && pending.length > 0;
  const showLife = game.widgets.lifeTracker && game.life != null;
  const threatText = threatLine(threats, showLife ? (game.life ?? 0) : null);

  return (
    <Screen testID="table" scene="felt" inset={false}>
      <View className="flex-row items-center justify-between px-4">
        <ChromeButton label="‹ Path" testID="table-back" accessibilityLabel="Back to the path" onPress={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} />
        <Text testID="table-round" className="text-label text-muted">{`Round ${game.round}`}</Text>
        <ChromeButton label="Log" testID="log-open" tone="gold" accessibilityLabel="This round's log" onPress={() => setLogOpen(true)} />
        <ChromeButton
          label="Booklet"
          testID="booklet-open"
          tone="gold"
          accessibilityLabel="Open the booklet"
          onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(session.save.campaignId, session.save.loadout?.scenarioId) })}
        />
      </View>
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
            onInspect={onInspect}
            onDrop={onDrop}
          />
        ) : null}
        <QuestBand game={game} ctx={session.ctx} nameOf={nameOf} />
      </View>
      {refusal && (!sheet || !showSheet) ? (
        <Text testID="table-refusal" className="px-6 text-body text-danger">
          {refusal}
        </Text>
      ) : null}
      <PhaseRail rail={rail} />
      {inspectList ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <CardListPanel
            cards={inspectList.map((id) => ({ id, label: names.card(id) }))}
            onOpen={(id) => {
              setInspectList(null);
              openCard(id);
            }}
            onClose={() => setInspectList(null)}
          />
        </View>
      ) : null}
      {logOpen ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <LogPanel round={game.round} lines={lines} onClose={() => setLogOpen(false)} />
        </View>
      ) : null}
      {sheet && showSheet && !logOpen && !inspectList ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <SheetView sheet={sheet} game={game} names={names} threat={threatText} refusal={refusal} onIntent={dispatch} onNext={openSheet} onOutcome={onOutcome} onInspect={onInspect} onCollapse={() => setCollapsed(sheet.key)} />
        </View>
      ) : null}
      {sheet && !showSheet ? <SheetTab title={sheet.title} threat={threatText} onOpen={() => setCollapsed(null)} /> : null}
      {!sheet ? (
        <View className="flex-row items-end justify-between px-4 pb-safe pt-2">
          <View className="flex-row gap-3">
            {threats.map((threat) => (
              <ThreatRing key={threat.seat} threat={threat} label={threats.length > 1 ? `Player ${threat.seat + 1}` : "Threat"} />
            ))}
            {showLife ? <ThreatRing threat={{ seat: 0, threat: game.life ?? 0, eliminated: false }} label="Life" testID="life" icon={null} /> : null}
          </View>
          <View className="flex-1 items-end gap-1 pl-3">
            <View className="flex-row">
              {canCommit ? <ChromeButton label="Quest with" testID="table-commit-sheet" tone="gold" onPress={() => openSheet(commitSheet(game, session.ctx, names, pending))} /> : null}
              {hasActions ? <ChromeButton label="Actions" testID="table-actions" tone="gold" onPress={() => openSheet(actionsSheet(game, session.ctx, legal, names))} /> : null}
            </View>
            {committing ? (
              <ChromePrimary label={`Commit ${pending.length}`} testID="table-commit" onPress={() => dispatch({ type: "Commit", cardIds: [...pending] })} />
            ) : (
              <>
                <ChromePrimary label="Pass" testID="table-pass" disabled={!canPass} onPress={() => dispatch({ type: "Pass" })} />
                {!canPass ? (
                  <Text testID="table-pass-why" className="text-label text-muted">
                    The engine is resolving; nothing can be passed yet.
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>
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
