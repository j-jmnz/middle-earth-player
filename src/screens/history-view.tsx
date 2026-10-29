// History (phase 28b): every finished run, campaign or standalone. A switch picks the kind, filters narrow it by campaign or
// box and by result, newest first; campaign runs group under their playthrough in a foldable header (a FlashList of header and run items; a folded group emits no rows). A run opens its
// playthrough's log or, for a standalone game, its outcome while the game exists; the run of a deleted playthrough or game
// says so and does not open. Nothing here edits or deletes a run.
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { RunKind, RunRecord, RunResult } from "../campaign/runs";
import { BodyText, Chevron, Chip, Label, NavBar, Screen, Segmented, ToggleChip } from "./chrome";
import { BOXES, campaignOf, scenarioName } from "./campaign-data";
import { listArchivedSaves, listSaves } from "./campaign-store";
import { deckFaces } from "./deck-store";
import { useDatabases } from "./databases";
import { FoldHeader } from "./fold-section";
import { goBack } from "./go-back";
import { useListGutter } from "./list-gutter";
import { filterRuns, groupRuns, historyItems, scopesOf, startedOf, type HistoryItem, type RunFilter } from "./history-list";
import { courseWords, deletedWords, emptyWords, playthroughWords, plural, runDate, runLabel, scoreWords, seatsWords } from "./history-words";
import { usePalette } from "./palette-hook";
import { existingRefs, listRuns } from "./run-store";
import { seatWord } from "./seats";

const KINDS = ["Campaign", "Standalone"] as const;
type KindWord = (typeof KINDS)[number];

const scopeName = (kind: RunKind, scope: string): string => (kind === "campaign" ? (campaignOf(scope)?.name ?? scope) : (BOXES.find((box) => box.id === scope)?.name ?? scope));

type Playthroughs = { current: string | null; progress: ReadonlyMap<string, { done: number; total: number }> };

// A FlashList row: one pressable on a solid fill, no light and no shadow (docs/design-system.md, Performance).
function RunRow({ run, deleted, showBox, nameOf, onPress }: { run: RunRecord; deleted: boolean; showBox: boolean; nameOf: (code: string) => string; onPress: (() => void) | null }) {
  const palette = usePalette();
  const scenario = scenarioName(run.scenarioId);
  const date = runDate(run);
  const course = courseWords(run);
  const score = scoreWords(run, nameOf);
  const box = showBox ? (BOXES.find((item) => item.id === run.box)?.name ?? run.box) : null;
  return (
    <View className="pb-3">
      <Pressable testID={`run-${run.id}`} collapsable={false} accessibilityRole={onPress ? "button" : "text"} accessibilityLabel={runLabel(run, scenario, nameOf, deleted)} disabled={onPress == null} onPress={onPress ?? undefined}>
        {({ pressed }) => (
          <View className="min-h-14 flex-row items-center rounded-card px-4 py-3.5" style={{ backgroundColor: pressed ? palette.pressed : palette.raised, borderWidth: 1, borderColor: palette.hairline }}>
            <View className="flex-1">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-display text-heading text-bone">{scenario}</Text>
                  {box || date ? <Label>{[box, date].filter((part) => part != null).join(" · ")}</Label> : null}
                </View>
                <Chip label={run.result === "won" ? "Won" : "Lost"} tone={run.result === "won" ? "accent" : "danger"} />
              </View>
              {run.result === "lost" && run.lossCause ? (
                <Text className="mt-1 text-label text-danger" testID={`run-${run.id}-cause`}>
                  {run.lossCause}
                </Text>
              ) : null}
              <Text className="mt-2 text-label text-muted">{seatsWords(run, nameOf)}</Text>
              {course ? <Text className="text-label text-muted">{course}</Text> : null}
              {score ? <Text className="mt-1 text-label font-semibold text-accentHigh">{score}</Text> : null}
              {deleted ? (
                <Text className="mt-1 text-label text-faint" testID={`run-${run.id}-deleted`}>
                  {deletedWords(run.kind)}
                </Text>
              ) : null}
            </View>
            {onPress ? (
              <View className="ml-2 w-6 items-center">
                <Chevron direction="right" color={palette.faint} size={8} />
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

/** The History screen for one starting kind (the tab that opened it). */
export function HistoryView({ initial }: { initial: RunKind }) {
  const router = useRouter();
  const list = useListGutter();
  const { catalog, user } = useDatabases();
  // Which playthrough groups are folded: for this viewing only (a gone playthrough would leave its id in `settings` for good).
  const [foldedGroups, setFoldedGroups] = useState<ReadonlySet<string>>(new Set());
  const [kindWord, setKindWord] = useState<KindWord>(initial === "standalone" ? "Standalone" : "Campaign");
  const kind: RunKind = kindWord === "Standalone" ? "standalone" : "campaign";
  const [filter, setFilter] = useState<RunFilter>({ scope: null, result: null });
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [refs, setRefs] = useState<ReturnType<typeof existingRefs>>({ saves: new Set(), archived: new Set(), games: new Set() });
  const [playthroughs, setPlaythroughs] = useState<Playthroughs>({ current: null, progress: new Map() });

  useFocusEffect(
    useCallback(() => {
      setRuns(listRuns(user));
      setRefs(existingRefs(user));
      const open = listSaves(user);
      setPlaythroughs({
        current: open[0]?.id ?? null,
        progress: new Map([...open, ...listArchivedSaves(user)].map((save) => [save.id, { done: save.log.completed.length, total: campaignOf(save.campaignId)?.scenarios.length ?? 0 }])),
      });
    }, [user]),
  );

  const faces = useMemo(() => deckFaces(catalog, runs.flatMap((run) => [...run.heroes.flat(), ...(run.reward ?? [])])), [catalog, runs]);
  const nameOf = useCallback((code: string) => faces.get(code)?.name ?? code, [faces]);
  const shown = useMemo(() => filterRuns(runs, kind, filter), [runs, kind, filter]);
  const scopes = useMemo(() => scopesOf(runs, kind), [runs, kind]);
  const filtered = filter.scope != null || filter.result != null;
  const groupId = (refId: string) => `history-${refId}`;
  const items = useMemo<HistoryItem[]>(
    () => (kind === "standalone" ? shown.map((run): HistoryItem => ({ type: "run", id: run.id, run })) : historyItems(groupRuns(shown), (id) => foldedGroups.has(id), groupId)),
    [kind, shown, foldedGroups],
  );

  const exists = (run: RunRecord) => (run.kind === "campaign" ? refs.saves.has(run.refId) : refs.games.has(run.refId));
  const open = (run: RunRecord) => (): void => {
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

  const renderItem = ({ item }: { item: HistoryItem }) => {
    if (item.type === "run") {
      const { run } = item;
      // The box line says something only when it is not the campaign the group already names.
      return <RunRow run={run} deleted={!exists(run)} showBox={run.kind === "standalone" || run.box !== run.campaignId} nameOf={nameOf} onPress={exists(run) ? open(run) : null} />;
    }
    const first = item.group.runs[0];
    if (!first) return null;
    const { refId } = item.group;
    const gone = !refs.saves.has(refId);
    const archived = refs.archived.has(refId);
    const title = campaignOf(first.campaignId ?? "")?.name ?? first.campaignId ?? "";
    const detail = playthroughWords(seatWord(first.seatCount), startedOf(item.group.runs), gone ? null : (playthroughs.progress.get(refId) ?? null));
    const badge = gone ? "Deleted" : archived ? "Archived" : playthroughs.current === refId ? "Current" : undefined;
    return (
      <View className="pb-3 pt-1">
        <FoldHeader id={item.id} title={title} detail={detail} {...(badge ? { badge } : {})} count={item.group.runs.length} unit="run" solid folded={item.folded} onFold={(next) => toggleGroup(item.id, next)} />
      </View>
    );
  };

  const listHead = (
    <View className="pb-2">
      <Segmented options={KINDS} value={kindWord} onChange={chooseKind} testIDPrefix="history" />
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
      {shown.length > 0 ? (
        <Label className="mt-2" testID="history-count">
          {plural(shown.length, "run")}
        </Label>
      ) : null}
    </View>
  );

  return (
    <Screen testID="history" scene="plain">
      <NavBar onBack={() => goBack(router, kind === "campaign" ? "/" : "/scenarios")} backTestID="history-back" title="History" />
      <View className="min-h-0 flex-1" testID="history-list" onLayout={list.onLayout}>
        <FlashList
          data={items}
          extraData={{ refs, playthroughs, nameOf }}
          keyExtractor={(item) => (item.type === "group" ? item.id : `run-${item.id}`)}
          getItemType={(item) => (item.type === "group" ? "group" : "run")}
          style={{ flex: 1 }}
          contentContainerStyle={list.contentContainerStyle}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHead}
          ListFooterComponent={<View className="pb-safe" />}
          ListEmptyComponent={
            <BodyText tone="muted" className="mt-2" testID="history-empty">
              {emptyWords(kind, filtered && runs.some((run) => run.kind === kind))}
            </BodyText>
          }
          renderItem={renderItem}
        />
      </View>
    </Screen>
  );
}
