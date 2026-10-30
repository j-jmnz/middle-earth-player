// History (docs/design-system.md, History): the library of one kind, the playthroughs or the standalone games, with the runs they wrote.
// A switch picks the kind and filters narrow it by campaign or box and by result. Sections hold In progress, Finished, Archived and
// Deleted; a playthrough is a foldable header over its runs, a game one row, each with a ⋯ that opens its sheet (history-sheet.tsx).
// The list is a FlashList of flat items, and a folded playthrough emits no run items. A run opens its playthrough's log or its game's
// outcome while that exists; the run of a deleted one says so and does not open.
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import type { RunKind, RunRecord, RunResult } from "../campaign/runs";
import { standaloneStatus } from "../campaign/standalone";
import { BodyText, Eyebrow, NavBar, Screen, Segmented, ToggleChip } from "./chrome";
import { BOXES, campaignOf } from "./campaign-data";
import { deckFaces } from "./deck-store";
import { useDatabases } from "./databases";
import { goBack } from "./go-back";
import { GameRow, GoneHeader, RunRow, SaveHeader } from "./history-rows";
import { EMPTY_LIBRARY, readLibrary, type Library, type LibrarySave } from "./history-read";
import { HistorySheet, type RefTarget } from "./history-sheet";
import { useListGutter } from "./list-gutter";
import { filterRuns, libraryItems, scopesOf, type LibraryItem, type LibrarySection, type RunFilter } from "./history-list";
import { emptyWords, plural } from "./history-words";

const KINDS = ["Campaign", "Standalone"] as const;
type KindWord = (typeof KINDS)[number];

const SECTION_TITLES: Record<LibrarySection, string> = { "in-progress": "In progress", finished: "Finished", archived: "Archived", deleted: "Deleted" };

const scopeName = (kind: RunKind, scope: string): string => (kind === "campaign" ? (campaignOf(scope)?.name ?? scope) : (BOXES.find((box) => box.id === scope)?.name ?? scope));

type Item = LibraryItem<LibrarySave, Library["games"][number]>;

/** The History screen for one starting kind (the tab that opened it). */
export function HistoryView({ initial }: { initial: RunKind }) {
  const router = useRouter();
  const list = useListGutter();
  const { catalog, user } = useDatabases();
  // Which playthroughs are folded: for this viewing only (a gone playthrough would leave its id in `settings` for good).
  const [foldedGroups, setFoldedGroups] = useState<ReadonlySet<string>>(new Set());
  const [kindWord, setKindWord] = useState<KindWord>(initial === "standalone" ? "Standalone" : "Campaign");
  const kind: RunKind = kindWord === "Standalone" ? "standalone" : "campaign";
  const [filter, setFilter] = useState<RunFilter>({ scope: null, result: null });
  const [library, setLibrary] = useState<Library>(EMPTY_LIBRARY);
  const [menu, setMenu] = useState<RefTarget | null>(null);
  const { runs } = library;

  const refresh = useCallback(() => setLibrary(readLibrary(user)), [user]);
  useFocusEffect(refresh);

  const faces = deckFaces(catalog, runs.flatMap((run) => [...run.heroes.flat(), ...(run.reward ?? [])]));
  const nameOf = (code: string) => faces.get(code)?.name ?? code;
  const shownRuns = filterRuns(runs, kind, filter).length;
  const scopes = scopesOf(runs, kind);
  const items = libraryItems({
    kind,
    saves: library.saves,
    archivedSaves: library.archivedSaves,
    games: library.games,
    archivedGames: library.archivedGames,
    runs,
    filter,
    folded: (id) => foldedGroups.has(id),
    finished: (item) => item.line.next.kind === "finished",
    playing: (game) => standaloneStatus(game) === "playing",
  });
  // The filter is why a list is empty only when there was something to filter.
  const anything = kind === "campaign" ? library.saves.length + library.archivedSaves.length > 0 : library.games.length + library.archivedGames.length > 0;
  const filtered = (filter.scope != null || filter.result != null) && (anything || runs.some((run) => run.kind === kind));

  const openRun = (run: RunRecord) => (): void => {
    if (run.kind === "campaign") router.push({ pathname: "/log/[saveId]", params: { saveId: run.refId } });
    else router.push({ pathname: "/standalone/outcome/[gameId]", params: { gameId: run.refId } });
  };
  const toggleGroup = (id: string, folded: boolean) =>
    setFoldedGroups((current) => {
      const next = new Set(current);
      if (folded) next.add(id);
      else next.delete(id);
      return next;
    });

  const chooseKind = (next: KindWord) => {
    setKindWord(next);
    // A campaign's id is not a box's: the scope starts over; the result stays.
    setFilter((current) => ({ ...current, scope: null }));
  };

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.type) {
      case "section":
        return (
          <View className="pb-2 pt-3" accessibilityRole="header" testID={item.id}>
            <Eyebrow>{SECTION_TITLES[item.section]}</Eyebrow>
          </View>
        );
      case "save":
        return (
          <SaveHeader
            foldId={item.id}
            item={item.save}
            started={item.started}
            count={item.runs.length}
            folded={item.folded}
            onFold={(next) => toggleGroup(item.id, next)}
            onMenu={() => setMenu({ kind: "campaign", ref: item.save, archived: item.section === "archived" })}
          />
        );
      case "game":
        return (
          <GameRow
            game={item.game}
            run={item.run}
            nameOf={nameOf}
            onOpen={() => router.push({ pathname: "/standalone/outcome/[gameId]", params: { gameId: item.game.id } })}
            onMenu={() => setMenu({ kind: "standalone", game: item.game, run: item.run, archived: item.section === "archived" })}
          />
        );
      case "gone":
        return <GoneHeader foldId={item.id} runs={item.group.runs} folded={item.folded} onFold={(next) => toggleGroup(item.id, next)} />;
      case "run":
        // The box line says something only when it is not the campaign the playthrough's header already names.
        return (
          <View className="pb-3">
            <RunRow run={item.run} deleted={item.deleted} showBox={item.run.kind === "standalone" || item.run.box !== item.run.campaignId} nameOf={nameOf} onPress={item.deleted ? null : openRun(item.run)} />
          </View>
        );
    }
  };

  const listHead = (
    <View className="pb-2">
      {/* The run count is the switch's label: a scroll container may never announce its own. */}
      <Segmented options={KINDS} value={kindWord} onChange={chooseKind} testIDPrefix="history" accessibilityLabel={shownRuns > 0 ? `History, ${plural(shownRuns, "run")}` : "History"} />
      <View className="mt-3 gap-1" testID="history-filters">
        {scopes.length > 1 ? (
          <View className="flex-row flex-wrap gap-x-2" accessibilityRole="radiogroup" accessibilityLabel={kind === "campaign" ? "Filter by campaign" : "Filter by box"}>
            <ToggleChip label={kind === "campaign" ? "All campaigns" : "All boxes"} selected={filter.scope == null} testID="history-scope-all" onPress={() => setFilter({ ...filter, scope: null })} />
            {scopes.map((scope) => (
              <ToggleChip key={scope} label={scopeName(kind, scope)} selected={filter.scope === scope} testID={`history-scope-${scope}`} onPress={() => setFilter({ ...filter, scope })} />
            ))}
          </View>
        ) : null}
        <View className="flex-row flex-wrap gap-x-2" accessibilityRole="radiogroup" accessibilityLabel="Filter by result">
          {([null, "won", "lost"] as const).map((result: RunResult | null) => (
            <ToggleChip
              key={result ?? "all"}
              label={result == null ? "All results" : result === "won" ? "Won" : "Lost"}
              selected={filter.result === result}
              testID={`history-result-${result ?? "all"}`}
              onPress={() => setFilter({ ...filter, result })}
            />
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <Screen testID="history" scene="calm">
      <NavBar onBack={() => goBack(router, kind === "campaign" ? "/" : "/scenarios")} backTestID="history-back" title="History" />
      <View className="min-h-0 flex-1" testID="history-list" onLayout={list.onLayout}>
        <FlashList
          data={items}
          extraData={{ library, nameOf }}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          style={{ flex: 1 }}
          contentContainerStyle={list.contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHead}
          ListFooterComponent={<View className="pb-safe" />}
          ListEmptyComponent={
            <BodyText tone="muted" className="mt-2" testID="history-empty">
              {emptyWords(kind, filtered)}
            </BodyText>
          }
          renderItem={renderItem}
        />
      </View>
      <HistorySheet target={menu} onClose={() => setMenu(null)} onChanged={refresh} />
    </Screen>
  );
}
