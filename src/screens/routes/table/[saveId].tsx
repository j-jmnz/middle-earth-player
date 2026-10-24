// The table for the open scenario of a save. The canvas is src/play; this screen opens the session, keeps each accepted
// intent in user.db, and hands the canvas the pictures in the image cache. The reducer is the only writer of the game.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { useStore } from "zustand";

import { QuestBand } from "../../../play/quest-band";
import { railFor } from "../../../play/rail";
import { threatSelector } from "../../../play/selectors";
import { dropOutcome, targetFromKey } from "../../../play/selection";
import { actionsSheet, commitSheet, paySheet, sheetFor, type Sheet, type SheetNames } from "../../../play/sheets";
import type { PlayerIntent, ScenarioState, TableStore } from "../../../play/store";
import { TableCanvas } from "../../../play/table-canvas";
import type { PictureSource } from "../../../play/table-canvas-types";
import { ChromeButton, ChromePrimary, LogPanel, PhaseRail, SheetTab, SheetView, ThreatRing } from "../../../play/table-chrome";
import { BodyText, NavBar, Screen } from "../../chrome";
import { bookletParams } from "../../campaign-data";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { scanAssets } from "../../images/scan-map";
import { cachedImage, useImageSnapshot } from "../../images/store";
import { routeCode } from "../../route-code";
import { inactiveCodes } from "../../../play/inactive";
import { ledgerLine, ruleTitle } from "../../../play/ledger";
import { logLines, type LogNames } from "../../../play/log";
import { openTable, sessionStore, type TableSession } from "../../table-session";

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

  const nameOf = useCallback((code: string) => session.world.cards.get(code)?.name ?? code, [session]);
  const names: SheetNames = useMemo(
    () => ({ card: (cardId: string) => nameOf(store.getState().game.cards[cardId]?.code ?? cardId), line: ledgerLine }),
    [nameOf, store],
  );
  // Unique text with no effect record is inactive: the canvas veils it, and no control applies it.
  const inactiveSet = useMemo(() => inactiveCodes(new Map([...session.facts].map(([code, facts]) => [code, facts.text])), session.ctx.effects), [session]);
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

  const dispatch = useCallback(
    (intent: PlayerIntent) => {
      setOverlay(null);
      store.getState().dispatch(intent);
    },
    [store],
  );
  const openSheet = useCallback((next: Sheet) => setOverlay({ sheet: next, game: store.getState().game }), [store]);
  const onInspect = useCallback(
    (cardId: string) => {
      const code = store.getState().game.cards[cardId]?.code;
      if (code) router.push({ pathname: "/card/[code]", params: { code } });
    },
    [router, store],
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
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  };

  const canPass = legal.some((intent) => intent.type === "Pass") && game.window?.kind === "pass";
  const canCommit = legal.some((intent) => intent.type === "Commit");
  const hasActions = game.window?.kind === "pass" && legal.some((intent) => intent.type === "Trigger");
  const committing = canCommit && pending.length > 0;
  const showLife = game.widgets.lifeTracker && game.life != null;

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
            inactive={inactive}
            onInspect={onInspect}
            onDrop={onDrop}
          />
        ) : null}
        <QuestBand game={game} ctx={session.ctx} nameOf={nameOf} />
      </View>
      {refusal ? (
        <Text testID="table-refusal" className="px-6 text-body text-danger">
          {refusal}
        </Text>
      ) : null}
      <PhaseRail rail={rail} />
      {logOpen ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <LogPanel round={game.round} lines={lines} onClose={() => setLogOpen(false)} />
        </View>
      ) : null}
      {sheet && showSheet && !logOpen ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <SheetView sheet={sheet} game={game} names={names} onIntent={dispatch} onNext={openSheet} onOutcome={onOutcome} onInspect={onInspect} onCollapse={() => setCollapsed(sheet.key)} />
        </View>
      ) : null}
      {sheet && !showSheet ? <SheetTab title={sheet.title} onOpen={() => setCollapsed(null)} /> : null}
      {!sheet ? (
        <View className="flex-row items-end justify-between px-4 pb-safe pt-2">
          <View className="flex-row gap-3">
            {threats.map((threat) => (
              <ThreatRing key={threat.seat} threat={threat} label={threats.length > 1 ? `Player ${threat.seat + 1}` : "Threat"} />
            ))}
            {showLife ? <ThreatRing threat={{ seat: 9, threat: game.life ?? 0, eliminated: false }} label="Life" /> : null}
          </View>
          <View className="flex-1 items-end gap-1 pl-3">
            <View className="flex-row">
              {canCommit ? <ChromeButton label="Quest with" testID="table-commit-sheet" tone="gold" onPress={() => openSheet(commitSheet(game, session.ctx, names, pending))} /> : null}
              {hasActions ? <ChromeButton label="Actions" testID="table-actions" tone="gold" onPress={() => openSheet(actionsSheet(game, session.ctx, legal, names))} /> : null}
            </View>
            {committing ? (
              <ChromePrimary label={`Commit ${pending.length}`} testID="table-commit" onPress={() => dispatch({ type: "Commit", cardIds: [...pending] })} />
            ) : (
              <ChromePrimary label="Pass" testID="table-pass" disabled={!canPass} onPress={() => dispatch({ type: "Pass" })} />
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
  const { catalog, user } = useDatabases();
  // Opened once per save: the store holds the game from here on, and each accepted intent is written to user.db.
  const session = useMemo(() => (saveId ? openTable(catalog, user, saveId) : null), [catalog, user, saveId]);
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
