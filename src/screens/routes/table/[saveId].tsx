// The table for the open scenario of a save, always in landscape (the route's stack option, routes/_layout.tsx). The canvas is
// src/play; this screen opens the session, keeps each accepted intent in user.db, and hands the canvas the pictures in the
// image cache. The reducer is the only writer of the game.
//
// The open moment is a sheet (src/play/sheets.ts, or the action window itself). Its choices are picked on the table, or on a
// paper panel when they are not cards there, and confirmed from the dock at the right (src/play/table-choice.ts): a tap
// only picks, and a button that sends an intent with nothing picked asks for a second tap.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { backStep } from "../../../play/back";
import { effectLines, slotNumbers } from "../../../play/card-effects";
import { CardPreview, type PreviewCard } from "../../../play/card-preview";
import { playSheet, windowSheet } from "../../../play/bar-sheets";
import { logLines, type LogNames } from "../../../play/log";
import { momentOf, type Moment } from "../../../play/outcome";
import { prefetchCodes, resolutionCodes } from "../../../play/prefetch";
import { QuestBand } from "../../../play/quest-band";
import { railFor } from "../../../play/rail";
import { inspectTargets, onTableFor, shownSeat, threatSelector, type PileId } from "../../../play/selectors";
import { dropOutcome, targetFromKey } from "../../../play/selection";
import type { Sheet, SheetNames } from "../../../play/sheet-types";
import { sheetFor } from "../../../play/sheets";
import type { PlayerIntent, ScenarioState, TableStore } from "../../../play/store";
import { TableCanvas } from "../../../play/table-canvas";
import type { PictureSource, SlotInfo, TableHighlight } from "../../../play/table-canvas-types";
import { choiceFor, dockFor, marked, onTheTable, readoutFor, tap, tappable, type Choice, type DockButton, type TapContext } from "../../../play/table-choice";
import { ChromeButton, PhaseRail, ThreatRing, threatLine } from "../../../play/table-chrome";
import { MomentBanner, TableDock, type DockExtra } from "../../../play/table-dock";
import { LogPanel, PileList, SidePanel } from "../../../play/table-panel";
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

// How long the outcome banner stays up; a tap closes it sooner, and the log keeps it.
const MOMENT_MS = 4500;
const TOP_BAR = 44;

function picture(code: string): PictureSource | null {
  const cached = cachedImage(code);
  if (cached) return { uri: cached.uri };
  const bundled = scanAssets[code];
  return bundled ? bundled.moduleId : null;
}

// A sheet the player opened from the table (a payment, a host, an Action, the Actions list), for the game it was opened in.
// `panel` keeps it on paper even when its choices are cards on the table (the Actions list reads the printed lines).
type Overlay = { sheet: Sheet; game: ScenarioState; panel: boolean };

const PILE_TITLE: Record<PileId, string> = { deck: "Deck", discard: "Discard pile", encounterDeck: "Encounter deck", encounterDiscard: "Encounter discard pile" };

function Table({ session, store, saveId }: { session: Extract<TableSession, { ok: true }>; store: TableStore; saveId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const images = useImageSnapshot();
  const game = useStore(store, (state) => state.game);
  const legal = useStore(store, (state) => state.legal);
  const refusal = useStore(store, (state) => state.refusal);
  const threatOf = useMemo(() => threatSelector(), []);
  const threats = useStore(store, (state) => threatOf(state.game));
  const roundSteps = useStore(store, (state) => state.roundSteps);
  const moment = useStore(store, (state) => state.moment);
  const selected = useStore(store, (state) => state.selected);
  const seat = shownSeat(game);
  const ctx = session.ctx;

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [held, setHeld] = useState<Choice | null>(null);
  const [folded, setFolded] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [pile, setPile] = useState<PileId | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // The last moment the player closed (or that timed out), by its sequence number.
  const [closedMoment, setClosedMoment] = useState(0);

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
  const rail = useMemo(() => railFor(game), [game]);
  const logNames: LogNames = useMemo(
    () => ({ card: names.card, code: nameOf, effectCard: (effectId: string) => ctx.effects.find((effect) => effect.id === effectId)?.cardCode ?? null, rule: ruleTitle, line: ledgerLine }),
    [names, nameOf, ctx],
  );
  const lines = useMemo(() => (logOpen ? logLines(roundSteps, logNames) : []), [logOpen, roundSteps, logNames]);

  // The open moment: a sheet opened from the table while the game is the one it was opened in, or the window's own.
  const base = useMemo(() => sheetFor(game, ctx, legal, names) ?? windowSheet(game, ctx, legal, names), [game, ctx, legal, names]);
  const live = overlay && overlay.game === game ? overlay : null;
  const sheet = live?.sheet ?? base;
  const table: TapContext = useMemo(() => ({ game, ctx, legal, names }), [game, ctx, legal, names]);
  const onTable = useMemo(() => onTableFor(game, seat), [game, seat]);
  const panel = (live?.panel ?? false) || !onTheTable(sheet, onTable);
  const panelOpen = panel && folded !== sheet.key;
  const choice = choiceFor(sheet, held);
  const passLegal = legal.some((intent) => intent.type === "Pass");
  const dock = useMemo(() => dockFor(sheet, choice, table, { overlay: live != null, passLegal }), [sheet, choice, table, live, passLegal]);
  const readout = useMemo(() => readoutFor(game, ctx, sheet, choice), [game, ctx, sheet, choice]);
  const highlight: TableHighlight = useMemo(
    () => ({
      tappable: panel ? new Set<string>() : tappable(sheet),
      picked: marked(sheet, choice),
      share: sheet.kind === "distribute" ? (sheet.purpose.kind === "archery" ? "damage" : "pay") : null,
    }),
    [panel, sheet, choice],
  );
  // The hand card being played rises whole above the bottom edge.
  const raised = live && (live.sheet.kind === "pick" || live.sheet.kind === "distribute") ? (live.sheet.kind === "pick" ? (live.sheet.about?.[0] ?? null) : live.sheet.purpose.kind === "play" ? live.sheet.purpose.cardId : null) : null;

  const info = useCallback((cardId: string): SlotInfo => slotNumbers(game, ctx, cardId), [game, ctx]);

  // What the last accepted intent did, over the table for a few seconds.
  const said = useMemo((): Moment | null => (moment ? momentOf(moment.before, game, moment.steps, names) : null), [moment, game, names]);
  const banner = moment && said && closedMoment !== moment.seq ? said : null;
  useEffect(() => {
    if (!moment) return;
    const timer = setTimeout(() => setClosedMoment(moment.seq), MOMENT_MS);
    return () => clearTimeout(timer);
  }, [moment]);

  const dispatch = useCallback(
    (intent: PlayerIntent) => {
      if (store.getState().dispatch(intent)) {
        setOverlay(null);
        setHeld(null);
        setFolded(null);
      }
    },
    [store],
  );
  const open = useCallback(
    (next: Sheet, asPanel = false) => {
      setOverlay({ sheet: next, game: store.getState().game, panel: asPanel });
      setHeld(null);
    },
    [store],
  );
  const onOutcome = useCallback(() => router.replace({ pathname: "/resolution/[saveId]", params: { saveId } }), [router, saveId]);
  const onButton = useCallback(
    (button: DockButton) => {
      const action = button.action;
      if (action.kind === "intent") dispatch(action.intent);
      else if (action.kind === "open") open(action.sheet);
      else if (action.kind === "outcome") onOutcome();
      else if (action.kind === "clear") setHeld({ key: sheet.key, ids: [], shares: [] });
      else {
        setOverlay(null);
        setHeld(null);
      }
    },
    [dispatch, open, onOutcome, sheet],
  );

  // A tap on the table: a pile's list, a pick for the open moment, or (on a card the moment does not ask about) the card large.
  const onTap = useCallback(
    (cardId: string) => {
      if (cardId.startsWith("pile:")) {
        const id = cardId.slice(5) as PileId;
        if (id === "discard" || id === "encounterDiscard") setPile(id);
        return;
      }
      const result = tap(sheet, held, cardId, table);
      if (result.kind === "choice") setHeld(result.choice);
      else if (result.kind === "open") open(result.sheet);
      else if (game.cards[cardId]?.face !== "down") setPreview(cardId);
    },
    [sheet, held, table, open, game],
  );
  const onDrop = useCallback(
    (cardId: string, key: string) => {
      const outcome = dropOutcome(game, ctx, legal, cardId, targetFromKey(key));
      store.getState().select(null);
      if (outcome.kind === "play") {
        const opened = playSheet(game, ctx, legal, names, cardId, outcome.hostId);
        if (opened) open(opened);
      } else if (outcome.kind === "commit" || outcome.kind === "choose") {
        const result = tap(base, live ? null : held, cardId, table);
        if (result.kind === "choice") {
          setOverlay(null);
          setHeld(result.choice);
        }
      }
    },
    [game, ctx, legal, names, store, open, base, live, held, table],
  );

  // Android hardware Back peels one layer at a time (src/play/back.ts) and only then leaves the table.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (preview) {
        setPreview(null);
        return true;
      }
      const step = backStep({ logOpen, pileOpen: pile != null, overlayOpen: live != null, panelOpen });
      if (step === "closeLog") setLogOpen(false);
      else if (step === "closePile") setPile(null);
      else if (step === "closeOverlay") setOverlay(null);
      else if (step === "foldPanel") setFolded(sheet.key);
      else goBack(router, { pathname: "/path/[saveId]", params: { saveId } });
      return true;
    });
    return () => subscription.remove();
  }, [preview, logOpen, pile, live, panelOpen, sheet, router, saveId]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  };

  const showLife = game.widgets.lifeTracker && game.life != null;
  const threatText = threatLine(threats, showLife ? (game.life ?? 0) : null);
  const commandWidth = Math.round(Math.min(280, Math.max(210, screen.width * 0.3)));
  const panelWidth = Math.round(Math.min(480, Math.max(320, screen.width * 0.46)));
  const pickedNames = choice.ids.length > 0 && sheet.kind !== "trigger" ? choice.ids.map((id) => names.card(id)).join(", ") : sheet.kind === "trigger" ? (sheet.options.find((item) => item.id === choice.ids[0])?.text ?? null) : null;
  const header = dockHeader(sheet);

  // The dock's extra buttons: read the card the moment is about, list every Action on paper, bring a folded panel back.
  const extras: DockExtra[] = [];
  const about = sheet.kind === "pick" ? sheet.about?.[0] : sheet.kind === "trigger" ? sheet.sourceId : undefined;
  if (about) extras.push({ label: "Read the card", testID: "sheet-inspect", onPress: () => setPreview(about) });
  if (sheet.kind === "window" && sheet.triggers.length > 0) {
    extras.push({
      label: `Actions (${sheet.triggers.length})`,
      testID: "table-actions",
      onPress: () => open({ kind: "trigger", key: `actions:${game.round}:${game.mode}`, step: sheet.step, title: "Actions", sourceId: null, timing: "Action", note: "Only the Actions the rules allow now are listed.", hide: null, options: sheet.triggers, pass: null }, true),
    });
  }
  if (panel && !panelOpen) extras.push({ label: "Choose", testID: "sheet-expand", onPress: () => setFolded(null) });

  // The long-pressed card, the cards attached to it and its face-up shadow cards, each with the effects on it now.
  const previewCards = useMemo((): PreviewCard[] => {
    if (!preview) return [];
    return inspectTargets(game, preview).flatMap((id, index): PreviewCard[] => {
      const card = game.cards[id];
      if (!card) return [];
      const type = session.world.cards.get(card.code)?.type;
      return [
        {
          code: card.code,
          name: nameOf(card.code),
          source: picture(card.code),
          landscape: type === "quest",
          text: session.facts.get(card.code)?.text ?? null,
          effects: effectLines(game, ctx, id, names.card),
          ...(index > 0 ? { role: card.zone === "shadow" ? "Shadow card" : "Attachment" } : {}),
        },
      ];
    });
    // Read again when a scan lands while the preview is up (the image snapshot moves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, game, session, ctx, nameOf, names, images.revision]);
  // The preview opens on the long-pressed card even when it is an attachment.
  const previewStart = preview ? Math.max(0, inspectTargets(game, preview).indexOf(preview)) : 0;

  return (
    <Screen testID="table" scene="felt" inset={false}>
      <View className="flex-1" style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <View className="flex-row items-center px-2" style={{ minHeight: TOP_BAR }}>
          <ChromeButton label="‹ Path" testID="table-back" accessibilityLabel="Back to the path" onPress={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} />
          <View className="flex-row">
            {threats.map((threat) => (
              <ThreatRing key={threat.seat} threat={threat} label={threats.length > 1 ? `Player ${threat.seat + 1}` : "Threat"} compact />
            ))}
            {showLife ? <ThreatRing threat={{ seat: 0, threat: game.life ?? 0, eliminated: false }} label="Life" testID="life" icon={null} compact /> : null}
          </View>
          <PhaseRail rail={rail} />
          <Text testID="table-round" className="px-2 text-label text-muted">{`Round ${game.round}`}</Text>
          <ChromeButton label="Log" testID="log-open" tone="gold" accessibilityLabel="This round's log" onPress={() => setLogOpen(true)} />
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
                highlight={highlight}
                raised={raised}
                onTap={onTap}
                onPreview={setPreview}
                onDrop={onDrop}
              />
            ) : null}
            {banner && moment ? <MomentBanner moment={banner} onClose={() => setClosedMoment(moment.seq)} /> : null}
          </View>
          <View testID="command" className="justify-between px-2" style={{ width: commandWidth, paddingBottom: Math.max(insets.bottom, 8) }}>
            <QuestBand game={game} ctx={ctx} nameOf={nameOf} />
            <TableDock
              step={header.step}
              title={header.title}
              note={header.note}
              picked={panel ? null : pickedNames}
              unavailable={sheet.kind === "pick" ? (sheet.unavailable ?? []) : []}
              readout={readout}
              refusal={refusal}
              dock={dock}
              onButton={onButton}
              extras={extras}
            />
          </View>
        </View>
      </View>
      {panelOpen ? (
        <View style={{ position: "absolute", top: insets.top + TOP_BAR, bottom: 0, right: 0, width: panelWidth + insets.right }}>
          <SidePanel
            sheet={sheet}
            held={held}
            dock={dock}
            threat={threatText}
            refusal={refusal}
            onTile={(cardId) => {
              const result = tap(sheet, held, cardId, table);
              if (result.kind === "choice") setHeld(result.choice);
              else if (result.kind === "open") open(result.sheet);
            }}
            onButton={onButton}
            onFold={() => setFolded(sheet.key)}
            onRead={setPreview}
          />
        </View>
      ) : null}
      {pile ? (
        <View style={{ position: "absolute", top: insets.top + TOP_BAR, bottom: 0, right: 0, width: panelWidth + insets.right }}>
          <PileList
            title={PILE_TITLE[pile]}
            cards={[...(pile === "discard" ? (game.seats[seat]?.discard ?? []) : game.encounterDiscard)].reverse().map((id) => ({ id, label: names.card(id) }))}
            onRead={setPreview}
            onClose={() => setPile(null)}
          />
        </View>
      ) : null}
      {logOpen ? (
        <View style={{ position: "absolute", top: insets.top + TOP_BAR, bottom: 0, right: 0, width: panelWidth + insets.right }}>
          <LogPanel round={game.round} lines={lines} onClose={() => setLogOpen(false)} />
        </View>
      ) : null}
      {preview && previewCards[0] ? (
        <PreviewAt key={preview} cards={previewCards} start={previewStart} onClose={() => setPreview(null)} onDetails={(code) => router.push({ pathname: "/card/[code]", params: { code } })} />
      ) : null}
    </Screen>
  );
}

// The preview opened on one of a host's cards: that card first, the rest with it.
function PreviewAt({ cards, start, onClose, onDetails }: { cards: readonly PreviewCard[]; start: number; onClose: () => void; onDetails: (code: string) => void }) {
  const first = cards[start] ?? cards[0];
  if (!first) return null;
  const related = cards.filter((_, index) => index !== start);
  return <CardPreview card={first} related={related} onClose={onClose} onDetails={onDetails} />;
}

// The dock's words for the open moment.
function dockHeader(sheet: Sheet): { step: string; title: string; note: string | null } {
  if (sheet.kind === "outcome") return { step: sheet.result === "won" ? "Resolution" : "Scenario", title: sheet.title, note: sheet.note };
  if (sheet.kind === "window") return { step: sheet.step, title: sheet.title, note: [sheet.note, sheet.passNote].filter((part) => part != null).join(" ") || null };
  return { step: sheet.step, title: sheet.title, note: sheet.note };
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
