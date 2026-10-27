// History (phase 28b): every finished run, campaign or standalone. A switch picks the kind, filters narrow it by campaign or
// box and by result, newest first; campaign runs group under their playthrough in a foldable header. A run opens its
// playthrough's log or, for a standalone game, its outcome while the game exists; the run of a deleted playthrough or game
// says so and does not open. Nothing here edits or deletes a run.
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { RunKind, RunRecord, RunResult } from "../campaign/runs";
import { tileSurface } from "../play/surfaces";
import { BodyText, Chip, Label, NavBar, Screen, ScreenScroll, Segmented, ToggleChip } from "./chrome";
import { BOXES, campaignOf, scenarioName } from "./campaign-data";
import { deckFaces } from "./deck-store";
import { useDatabases } from "./databases";
import { FoldSection, useFolds } from "./fold-section";
import { goBack } from "./go-back";
import { filterRuns, groupRuns, scopesOf, type RunFilter } from "./history-list";
import { courseWords, deletedWords, emptyWords, plural, resultWords, runDate, runLabel, scoreWords, seatsWords } from "./history-words";
import { existingRefs, listRuns } from "./run-store";
import { seatWord } from "./seats";

const KINDS = ["Campaign", "Standalone"] as const;
type KindWord = (typeof KINDS)[number];

const scopeName = (kind: RunKind, scope: string): string => (kind === "campaign" ? (campaignOf(scope)?.name ?? scope) : (BOXES.find((box) => box.id === scope)?.name ?? scope));

function RunRow({ run, deleted, nameOf, onPress }: { run: RunRecord; deleted: boolean; nameOf: (code: string) => string; onPress: (() => void) | null }) {
  const scenario = scenarioName(run.scenarioId);
  const date = runDate(run);
  const course = courseWords(run);
  const score = scoreWords(run, nameOf);
  const box = BOXES.find((item) => item.id === run.box)?.name ?? run.box;
  return (
    <Pressable testID={`run-${run.id}`} collapsable={false} accessibilityRole={onPress ? "button" : "text"} accessibilityLabel={runLabel(run, scenario, nameOf, deleted)} disabled={onPress == null} onPress={onPress ?? undefined}>
      {({ pressed }) => (
        <View className="min-h-14 rounded-card px-4 py-3.5" style={tileSurface(pressed)}>
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="font-display text-heading text-bone">{scenario}</Text>
              <Label>{[box, date].filter((part) => part != null).join(" · ")}</Label>
            </View>
            <Chip label={run.result === "won" ? "Won" : "Lost"} tone={run.result === "won" ? "gold" : "danger"} />
          </View>
          {run.result === "lost" && run.lossCause ? (
            <Text className="mt-1 text-label text-danger" testID={`run-${run.id}-cause`}>
              {resultWords(run).replace(/^Lost · /, "")}
            </Text>
          ) : null}
          <Text className="mt-2 text-label text-muted">{seatsWords(run, nameOf)}</Text>
          {course ? <Text className="text-label text-muted">{course}</Text> : null}
          {score ? <Text className="mt-1 text-label font-semibold text-goldHigh">{score}</Text> : null}
          {deleted ? (
            <Text className="mt-1 text-label text-faint" testID={`run-${run.id}-deleted`}>
              {deletedWords(run.kind)}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/** The History screen for one starting kind (the tab that opened it). */
export function HistoryView({ initial }: { initial: RunKind }) {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const folds = useFolds();
  const [kindWord, setKindWord] = useState<KindWord>(initial === "standalone" ? "Standalone" : "Campaign");
  const kind: RunKind = kindWord === "Standalone" ? "standalone" : "campaign";
  const [filter, setFilter] = useState<RunFilter>({ scope: null, result: null });
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [refs, setRefs] = useState<ReturnType<typeof existingRefs>>({ saves: new Set(), archived: new Set(), games: new Set() });

  useFocusEffect(
    useCallback(() => {
      setRuns(listRuns(user));
      setRefs(existingRefs(user));
    }, [user]),
  );

  const faces = useMemo(() => deckFaces(catalog, runs.flatMap((run) => [...run.heroes.flat(), ...(run.reward ?? [])])), [catalog, runs]);
  const nameOf = (code: string) => faces.get(code)?.name ?? code;
  const shown = filterRuns(runs, kind, filter);
  const scopes = scopesOf(runs, kind);
  const filtered = filter.scope != null || filter.result != null;

  const exists = (run: RunRecord) => (run.kind === "campaign" ? refs.saves.has(run.refId) : refs.games.has(run.refId));
  const open = (run: RunRecord) => (): void => {
    if (run.kind === "campaign") router.push({ pathname: "/log/[saveId]", params: { saveId: run.refId } });
    else router.push({ pathname: "/standalone/outcome/[gameId]", params: { gameId: run.refId } });
  };
  const row = (run: RunRecord) => (
    <View key={run.id}>
      <RunRow run={run} deleted={!exists(run)} nameOf={nameOf} onPress={exists(run) ? open(run) : null} />
    </View>
  );

  const chooseKind = (next: KindWord) => {
    setKindWord(next);
    // A campaign's id is not a box's: the scope starts over; the result stays.
    setFilter((current) => ({ ...current, scope: null }));
  };

  return (
    <Screen testID="history" scene="plain">
      <NavBar onBack={() => goBack(router, kind === "campaign" ? "/" : "/scenarios")} backTestID="history-back" title="History" />
      <ScreenScroll>
        <Segmented options={KINDS} value={kindWord} onChange={chooseKind} testIDPrefix="history" />
        <View className="mt-3 gap-1" testID="history-filters">
          {scopes.length > 1 ? (
            <View className="flex-row flex-wrap gap-x-2" accessibilityLabel={kind === "campaign" ? "Campaign" : "Box"}>
              <ToggleChip label="All" selected={filter.scope == null} testID="history-scope-all" accessibilityLabel={kind === "campaign" ? "All campaigns" : "All boxes"} onPress={() => setFilter({ ...filter, scope: null })} />
              {scopes.map((scope) => (
                <ToggleChip key={scope} label={scopeName(kind, scope)} selected={filter.scope === scope} testID={`history-scope-${scope}`} onPress={() => setFilter({ ...filter, scope })} />
              ))}
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-x-2" accessibilityLabel="Result">
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
        {shown.length === 0 ? (
          <BodyText tone="muted" className="mt-4" testID="history-empty">
            {emptyWords(kind, filtered && runs.some((run) => run.kind === kind))}
          </BodyText>
        ) : (
          <Label className="mt-2" testID="history-count">
            {plural(shown.length, "run")}
          </Label>
        )}
        <View className="mt-2 gap-3" testID="history-list">
          {kind === "standalone"
            ? shown.map(row)
            : groupRuns(shown).map((group) => {
                const first = group.runs[0];
                if (!first) return null;
                const gone = !refs.saves.has(group.refId);
                const title = [campaignOf(first.campaignId ?? "")?.name ?? first.campaignId ?? "", seatWord(first.seatCount), gone ? "deleted" : refs.archived.has(group.refId) ? "archived" : null].filter((part) => part != null).join(" · ");
                const id = `history-${group.refId}`;
                return (
                  <FoldSection key={group.refId} id={id} title={title} count={group.runs.length} folded={folds.folded(id)} onFold={(next) => folds.setFolded(id, next)}>
                    <View className="gap-3 pt-1">{group.runs.map(row)}</View>
                  </FoldSection>
                );
              })}
        </View>
      </ScreenScroll>
    </Screen>
  );
}
