// History (docs/design-system.md, History): the library of one kind, the playthroughs or the standalone games, each one card with the
// runs it wrote. A switch picks the kind. In progress and Finished are open; Archived folds, folded until the player opens
// it. A card opens what it is (a playthrough's path; a game's table, outcome or a new deal). Manage, in the bar (or a long press on
// a card), folds each card to its head and puts Archive or Restore and Delete in a band at its foot: Archive and Restore act at once
// with Undo in a toast, Delete asks in place. The list is a FlashList of flat items (history/list.ts).
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { AccessibilityInfo, View } from "react-native";

import type { RunKind, RunRecord } from "../../campaign/runs";
import { standaloneStatus, type ListedStandalone } from "../../campaign/standalone";
import { scenarioName } from "../data/campaign-data";
import { archiveSave, deleteSave, restoreSave } from "../data/campaign-store";
import { BodyText, NavBar, PillButton, Screen, Section, Segmented } from "../kit/chrome";
import { deckFaces } from "../deck/store";
import { heroFace } from "../art/hero-tile";
import { useDatabases } from "../data/databases";
import { FoldHeader, useFolds } from "../kit/fold-section";
import { goBack } from "../nav/go-back";
import { deleteGameSentence, gameDestination, gameWords, saveWords, type CardState, type CardWords, type GameDestination } from "./entries";
import { libraryItems, type FoldedSection, type LibraryItem, type OpenSection } from "./list";
import { EMPTY_LIBRARY, readLibrary, type Library, type LibrarySave } from "./read";
import { CardActions, HistoryCard } from "./rows";
import { emptyWords } from "./words";
import { useListGutter } from "../nav/list-gutter";
import { pathHref } from "../campaign/scenario-links";
import { deleteSentence, describe, partyCodes } from "./save-line";
import { archiveStandalone, deleteStandalone, restoreStandalone } from "../data/standalone-store";
import { gameCaption } from "./standalone-words";
import { recordUnclosedRun } from "../session/table-session";
import { showToast } from "../kit/toast";
import { ToastView } from "../kit/toast-view";
import { useBottomInset } from "../nav/use-bottom-inset";

const KINDS = ["Campaign", "Standalone"] as const;
type KindWord = (typeof KINDS)[number];

const SECTION_TITLES: Record<OpenSection | FoldedSection, string> = { "in-progress": "In progress", finished: "Finished", archived: "Archived" };


type Item = LibraryItem<LibrarySave, ListedStandalone>;

// What a fold counts: playthroughs or games.
const foldUnit = (kind: RunKind): string => (kind === "campaign" ? "playthrough" : "game");

// What managing can do to a playthrough or game: its name for the toast and a screen reader, and how to put it away, bring it back and delete it.
type Managed = { id: string; name: string; described: string; sentence: string; archive: () => void; restore: () => void; remove: () => void };

/** The History screen for one starting kind (the tab that opened it). */
export function HistoryView({ initial }: { initial: RunKind }) {
  const router = useRouter();
  const list = useListGutter();
  const bottom = useBottomInset();
  const { catalog, user } = useDatabases();
  const folds = useFolds();
  const [kindWord, setKindWord] = useState<KindWord>(initial === "standalone" ? "Standalone" : "Campaign");
  const kind: RunKind = kindWord === "Standalone" ? "standalone" : "campaign";
  const [library, setLibrary] = useState<Library>(EMPTY_LIBRARY);
  // Manage puts the actions under each card; `asking` is the one whose Delete waits on its second tap. Both end when History loses focus.
  const [managing, setManaging] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLibrary(readLibrary(user));
    setAsking(null);
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        setManaging(false);
        setAsking(null);
      };
    }, [refresh]),
  );

  const { runs } = library;
  const faces = deckFaces(catalog, [
    ...runs.flatMap((run) => [...run.heroes.flat(), ...(run.reward ?? [])]),
    ...[...library.saves, ...library.archivedSaves].flatMap((ref) => partyCodes(ref.save)),
    ...[...library.games, ...library.archivedGames].flatMap((game) => game.loadout?.seats.flatMap((seat) => seat.heroes) ?? []),
  ]);
  const nameOf = (code: string) => faces.get(code)?.name ?? code;
  // A fold is stored per kind, folded until the player opens it.
  const foldId = (section: FoldedSection) => `history-${kind}-${section}`;
  const items = libraryItems({
    kind,
    saves: library.saves,
    archivedSaves: library.archivedSaves,
    games: library.games,
    archivedGames: library.archivedGames,
    runs,
    folded: (section) => folds.folded(foldId(section), true),
    finished: (ref) => ref.line.next.kind === "finished",
    playing: (game) => standaloneStatus(game) === "playing",
  });
  const anyRef = kind === "campaign" ? library.saves.length + library.archivedSaves.length > 0 : library.games.length + library.archivedGames.length > 0;

  const go = (href: Href) => () => router.push(href);
  const startManaging = () => {
    setManaging(true);
    setAsking(null);
  };
  const chooseKind = (next: KindWord) => {
    setKindWord(next);
    setManaging(false);
    setAsking(null);
  };

  // Archive and Restore act at once and can be taken back from the toast; Delete cannot, so it is asked first.
  function putAway(entry: Managed, archived: boolean): void {
    if (archived) entry.restore();
    else entry.archive();
    // The Archived fold opens, so the card is seen landing there and Restore is in reach.
    if (!archived) folds.setFolded(foldId("archived"), false, true);
    refresh();
    showToast(`${archived ? "Restored" : "Archived"} ${entry.name}`, {
      undo: () => {
        if (archived) entry.archive();
        else entry.restore();
        refresh();
      },
    });
  }
  function remove(entry: Managed): void {
    entry.remove();
    refresh();
    showToast(`Deleted ${entry.name}`);
  }

  const managedSave = (ref: LibrarySave): Managed => ({
    id: ref.id,
    name: ref.line.name,
    described: describe(ref.line),
    sentence: deleteSentence(describe(ref.line)),
    archive: () => archiveSave(user, ref.id),
    restore: () => restoreSave(user, ref.id),
    remove: () => {
      // An open scenario is a run that was never closed: it is recorded before the playthrough goes.
      if (ref.save.active) recordUnclosedRun(catalog, user, ref.id);
      deleteSave(user, ref.id);
    },
  });
  const managedGame = (game: ListedStandalone): Managed => ({
    id: game.id,
    name: scenarioName(game.scenarioId),
    described: `${scenarioName(game.scenarioId)}, ${gameCaption(game)}`,
    sentence: deleteGameSentence(`${scenarioName(game.scenarioId)}, ${gameCaption(game)}`),
    archive: () => archiveStandalone(user, game.id),
    restore: () => restoreStandalone(user, game.id),
    remove: () => deleteStandalone(user, game.id),
  });

  // The route of where a game's card leads (gameDestination).
  const gameHref = (game: ListedStandalone, to: GameDestination["to"]): Href => {
    if (to === "table") return { pathname: "/standalone/table/[gameId]", params: { gameId: game.id } };
    if (to === "outcome") return { pathname: "/standalone/outcome/[gameId]", params: { gameId: game.id } };
    return { pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId: game.scenarioId, from: game.id } };
  };

  // A live or archived card starts Manage on a long press, as a deck does; while managing it shows its head alone, so the list scans.
  // `party`: a game's heroes by seat, shown as tiles under its lines (a playthrough's show under each of its runs).
  const card = (testID: string, state: CardState, words: CardWords, listed: readonly RunRecord[], open: { onPress: () => void; verb: string } | null, footer: ReactNode, party?: readonly (readonly string[])[] | null) => (
    <HistoryCard
      testID={testID}
      state={state}
      title={words.title}
      lines={words.lines}
      chip={words.chip}
      lead={words.firstSeat.map((code) => heroFace(faces, code))}
      runs={managing ? [] : listed}
      nameOf={nameOf}
      faces={faces}
      party={managing ? null : (party ?? null)}
      accessibilityLabel={open ? `${open.verb} ${words.spoken}` : words.spoken}
      onPress={open?.onPress ?? null}
      onLongPress={startManaging}
      footer={footer}
    />
  );

  const actions = (entry: Managed, archived: boolean) =>
    managing ? (
      <CardActions
        id={entry.id}
        described={entry.described}
        archived={archived}
        asking={asking === entry.id}
        sentence={entry.sentence}
        onArchive={() => putAway(entry, archived)}
        onAsk={() => {
          setAsking(entry.id);
          AccessibilityInfo.announceForAccessibility(`${entry.sentence} Tap Delete for good to confirm.`);
        }}
        onDelete={() => remove(entry)}
        onKeep={() => setAsking(null)}
      />
    ) : null;

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.type) {
      case "heading":
        return (
          // The title lines up with a fold's, past where its chevron sits.
          <View className="pt-2">
            <Section title={SECTION_TITLES[item.section]} testID={item.id} className="pl-6" />
          </View>
        );
      case "fold":
        return (
          <View className="pt-3">
            <FoldHeader
              id={item.id}
              testID={item.id}
              title={SECTION_TITLES[item.section]}
              count={item.count}
              unit={foldUnit(kind)}
              folded={item.folded}
              onFold={(next) => folds.setFolded(foldId(item.section), next, true)}
            />
          </View>
        );
      case "save": {
        const entry = managedSave(item.save);
        return (
          <View className="pb-3">
            {card(`entry-${item.save.id}`, item.archived ? "archived" : "live", saveWords(item.save, item.runs, item.started, item.archived, nameOf), item.runs, { onPress: go(pathHref(item.save.id)), verb: "Open" }, actions(entry, item.archived))}
          </View>
        );
      }
      case "game": {
        const entry = managedGame(item.game);
        const open = gameDestination(item.game, item.run != null);
        return (
          <View className="pb-3">
            {card(
              `entry-${item.game.id}`,
              item.archived ? "archived" : "live",
              gameWords(item.game, managing ? null : item.run, open?.word ?? null, item.archived, nameOf),
              [],
              open ? { onPress: go(gameHref(item.game, open.to)), verb: open.verb } : null,
              actions(entry, item.archived),
              item.run?.heroes ?? item.game.loadout?.seats.map((seat) => seat.heroes) ?? null,
            )}
          </View>
        );
      }
    }
  };

  const manage = anyRef ? (
    <PillButton testID="history-manage" label={managing ? "Done" : "Manage"} accessibilityLabel={managing ? "Done managing" : kind === "campaign" ? "Manage playthroughs" : "Manage games"} onPress={managing ? () => setManaging(false) : startManaging} />
  ) : undefined;

  return (
    <Screen testID="history" scene="calm">
      <NavBar onBack={() => goBack(router, kind === "campaign" ? "/" : "/scenarios")} backTestID="history-back" title="History" right={manage} />
      <View className="min-h-0 flex-1" testID="history-list" onLayout={list.onLayout}>
        <FlashList
          data={items}
          extraData={{ library, managing, asking, nameOf, faces }}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          style={{ flex: 1 }}
          contentContainerStyle={list.contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="pb-1 pt-1">
              <Segmented options={KINDS} value={kindWord} onChange={chooseKind} testIDPrefix="history" accessibilityLabel="Show" stretch />
            </View>
          }
          ListFooterComponent={<View className="pb-safe" />}
          ListEmptyComponent={
            <BodyText tone="muted" className="mt-4" testID="history-empty">
              {emptyWords(kind)}
            </BodyText>
          }
          renderItem={renderItem}
        />
      </View>
      {/* A pushed screen has no dock or bar under the toast: it keeps clear of the home indicator itself, and sits in the list's column. */}
      <View style={{ paddingBottom: bottom, paddingHorizontal: list.inset }}>
        <ToastView />
      </View>
    </Screen>
  );
}
