// History (docs/design-system.md, History): the library of one kind, the playthroughs or the standalone games, each one card with the
// runs it wrote. A switch picks the kind. In progress and Finished are open; Archived and Deleted fold, folded until the player opens
// them. A card opens what it is (a playthrough's path; a game's table, outcome or a new deal). Manage, in the bar (or a long press on
// a card), puts Archive or Restore and Delete under each card: Archive and Restore act at once with Undo in a toast, Delete asks in
// place. The list is a FlashList of flat items (history-list.ts).
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import type { RunKind, RunRecord } from "../campaign/runs";
import { standaloneStatus, type ListedStandalone } from "../campaign/standalone";
import { scenarioName } from "./campaign-data";
import { archiveSave, deleteSave, restoreSave } from "./campaign-store";
import { BodyText, Eyebrow, NavBar, PillButton, Screen, Segmented } from "./chrome";
import { deckFaces } from "./deck-store";
import { useDatabases } from "./databases";
import { FoldHeader, useFolds } from "./fold-section";
import { goBack } from "./go-back";
import { gameWords, goneWords, saveWords, type CardWords } from "./history-entries";
import { libraryItems, type FoldedSection, type LibraryItem, type OpenSection } from "./history-list";
import { EMPTY_LIBRARY, readLibrary, type Library, type LibrarySave } from "./history-read";
import { CardActions, HistoryCard } from "./history-rows";
import { emptyWords } from "./history-words";
import { leadFace } from "./hub-parts";
import { useListGutter } from "./list-gutter";
import { usePalette } from "./palette-hook";
import { pathHref } from "./scenario-links";
import { DELETE_SENTENCE, describe, partyCodes } from "./save-line";
import { archiveStandalone, deleteStandalone, restoreStandalone } from "./standalone-store";
import { gameCaption } from "./standalone-words";
import { recordUnclosedRun } from "./table-session";
import { showToast } from "./toast";
import { ToastView } from "./toast-view";

const KINDS = ["Campaign", "Standalone"] as const;
type KindWord = (typeof KINDS)[number];

const SECTION_TITLES: Record<OpenSection | FoldedSection, string> = { "in-progress": "In progress", finished: "Finished", archived: "Archived", deleted: "Deleted" };

const DELETE_GAME = "Delete this game? It is gone for good. Its run stays in History; your decks stay.";

type Item = LibraryItem<LibrarySave, ListedStandalone>;

// What a fold counts: playthroughs or games, except a deleted game, whose entry is its run.
const foldUnit = (kind: RunKind, section: FoldedSection): string => (kind === "campaign" ? "playthrough" : section === "deleted" ? "run" : "game");

// What managing can do to a playthrough or game: its name for the toast and a screen reader, and how to put it away, bring it back and delete it.
type Managed = { id: string; name: string; described: string; sentence: string; archive: () => void; restore: () => void; remove: () => void };

/** The History screen for one starting kind (the tab that opened it). */
export function HistoryView({ initial }: { initial: RunKind }) {
  const router = useRouter();
  const palette = usePalette();
  const list = useListGutter();
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

  // Archive and Restore act at once and can be taken back from the toast; Delete cannot, so it asked first.
  function putAway(entry: Managed, archived: boolean): void {
    if (archived) entry.restore();
    else entry.archive();
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
    sentence: DELETE_SENTENCE,
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
    sentence: DELETE_GAME,
    archive: () => archiveStandalone(user, game.id),
    restore: () => restoreStandalone(user, game.id),
    remove: () => deleteStandalone(user, game.id),
  });

  // Where a game's card leads: its table while it is playing, its outcome once it has a run, else a new deal of the same game.
  const gameOpen = (game: ListedStandalone, hasRun: boolean): { href: Href; verb: string } | null => {
    if (standaloneStatus(game) === "playing") return { href: { pathname: "/standalone/table/[gameId]", params: { gameId: game.id } }, verb: "Resume" };
    if (hasRun) return { href: { pathname: "/standalone/outcome/[gameId]", params: { gameId: game.id } }, verb: "Outcome of" };
    if (game.loadout) return { href: { pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId: game.scenarioId, from: game.id } }, verb: "Play again" };
    return null;
  };

  // A card that can be managed starts Manage on a long press, as a deck does.
  const card = (testID: string, words: CardWords, listed: readonly RunRecord[], open: { onPress: () => void; verb: string } | null, manageable: boolean) => (
    <HistoryCard
      testID={testID}
      title={words.title}
      lines={words.lines}
      chip={words.chip}
      lead={leadFace(faces, words.firstHero, palette)}
      runs={listed}
      nameOf={nameOf}
      accessibilityLabel={open ? `${open.verb} ${words.spoken}` : words.spoken}
      onPress={open?.onPress ?? null}
      onLongPress={manageable ? startManaging : null}
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
        onAsk={() => setAsking(entry.id)}
        onDelete={() => remove(entry)}
        onKeep={() => setAsking(null)}
      />
    ) : null;

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.type) {
      case "heading":
        return (
          <View className="pb-2 pt-4" accessibilityRole="header" testID={item.id}>
            <Eyebrow>{SECTION_TITLES[item.section]}</Eyebrow>
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
              unit={foldUnit(kind, item.section)}
              folded={item.folded}
              onFold={(next) => folds.setFolded(foldId(item.section), next, true)}
            />
          </View>
        );
      case "save": {
        const entry = managedSave(item.save);
        return (
          <View className="pb-3">
            {card(`entry-${item.save.id}`, saveWords(item.save, item.runs, item.started, nameOf), item.runs, { onPress: go(pathHref(item.save.id)), verb: "Open" }, true)}
            {actions(entry, item.archived)}
          </View>
        );
      }
      case "game": {
        const entry = managedGame(item.game);
        const open = gameOpen(item.game, item.run != null);
        return (
          <View className="pb-3">
            {card(`entry-${item.game.id}`, gameWords(item.game, item.run, nameOf), [], open ? { onPress: go(open.href), verb: open.verb } : null, true)}
            {actions(entry, item.archived)}
          </View>
        );
      }
      case "gone": {
        const words = goneWords(item.runs, nameOf);
        if (!words) return null;
        // A game's one run is worded in its card's lines; a playthrough's runs are listed under its name.
        const listed = item.runs[0]?.kind === "campaign" ? item.runs : [];
        return <View className="pb-3">{card(item.id, words, listed, null, false)}</View>;
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
          extraData={{ library, managing, asking, nameOf }}
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
      <ToastView />
    </Screen>
  );
}
