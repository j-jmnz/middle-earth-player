// The rows of History's library list (docs/design-system.md, History): a run, a standalone game, a playthrough's header and the ⋯ that
// opens a playthrough's or game's sheet (history-sheet.tsx). Each is one FlashList item on a solid fill: no light and no shadow.
import { Pressable, View } from "react-native";

import type { RunRecord } from "../campaign/runs";
import { rowSurface } from "../play/surfaces";
import { Text } from "../play/text";
import { useUiScale } from "../play/ui-scale";
import { useTableTokens } from "../play/use-table-tokens";
import { BOXES, campaignOf, scenarioName } from "./campaign-data";
import { Chevron, Chip, IconButton, Label } from "./chrome";
import { FoldHeader } from "./fold-section";
import { startedOf } from "./history-list";
import { courseWords, deletedWords, playthroughWords, runDate, runLabel, scoreWords, seatsWords } from "./history-words";
import type { LibrarySave } from "./history-read";
import { usePalette } from "./palette-hook";
import { describe } from "./save-panels";
import { seatWord } from "./seats";
import { gameCaption } from "./standalone-words";
import type { ListedStandalone } from "../campaign/standalone";

// Three dots in a row, drawn as views in the colour the button gives them.
function DotsMark({ color }: { color: string }) {
  const s = useUiScale();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" className="flex-row" style={{ gap: 4 * s }}>
      {[0, 1, 2].map((dot) => (
        <View key={dot} style={{ width: 4 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: color }} />
      ))}
    </View>
  );
}

/** The round glass ⋯ at the end of a playthrough's or game's row; `described` names the one it acts on. */
export function RefMenuButton({ refId, described, onPress }: { refId: string; described: string; onPress: () => void }) {
  return (
    <View className="ml-2">
      <IconButton testID={`ref-menu-${refId}`} label={`Actions for ${described}`} tone="bone" mark={({ color }) => <DotsMark color={color} />} onPress={onPress} />
    </View>
  );
}

/** One run: the scenario with its result, the box and date, the cause of a loss, the heroes, the course and the score. It opens while `onPress` is given. */
export function RunRow({ run, deleted, showBox, nameOf, onPress }: { run: RunRecord; deleted: boolean; showBox: boolean; nameOf: (code: string) => string; onPress: (() => void) | null }) {
  const palette = usePalette();
  const t = useTableTokens();
  const scenario = scenarioName(run.scenarioId);
  const date = runDate(run);
  const course = courseWords(run);
  const score = scoreWords(run, nameOf);
  const box = showBox ? (BOXES.find((item) => item.id === run.box)?.name ?? run.box) : null;
  return (
    <Pressable testID={`run-${run.id}`} collapsable={false} accessibilityRole={onPress ? "button" : "text"} accessibilityLabel={runLabel(run, scenario, nameOf, deleted)} disabled={onPress == null} onPress={onPress ?? undefined}>
      {({ pressed }) => (
        <View className="min-h-14 flex-row items-center rounded-item px-4 py-3.5" style={rowSurface(pressed, t)}>
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
  );
}

/** A standalone game: its run (which opens the outcome) when it has one, else its scenario and how it stands; the ⋯ at its end. */
export function GameRow({ game, run, nameOf, onOpen, onMenu }: { game: ListedStandalone; run: RunRecord | null; nameOf: (code: string) => string; onOpen: () => void; onMenu: () => void }) {
  const t = useTableTokens();
  const scenario = scenarioName(game.scenarioId);
  const caption = gameCaption(game);
  return (
    <View className="flex-row items-center pb-3">
      <View className="min-w-0 flex-1">
        {run ? (
          <RunRow run={run} deleted={false} showBox nameOf={nameOf} onPress={onOpen} />
        ) : (
          <View testID={`history-game-${game.id}`} accessible accessibilityLabel={`${scenario}, ${caption}`} className="min-h-14 justify-center rounded-item px-4 py-3.5" style={rowSurface(false, t)}>
            <Text className="font-display text-heading text-bone">{scenario}</Text>
            <Label>{caption}</Label>
          </View>
        )}
      </View>
      <RefMenuButton refId={game.id} described={`${scenario}, ${caption}`} onPress={onMenu} />
    </View>
  );
}

/** A playthrough's header: its name, the seats, start and progress, and its run count while folded; the ⋯ stays when it is folded. */
export function SaveHeader({ foldId, item, started, count, folded, onFold, onMenu }: { foldId: string; item: LibrarySave; started: number | null; count: number; folded: boolean; onFold: (folded: boolean) => void; onMenu: () => void }) {
  const { line } = item;
  return (
    <View className="pb-3 pt-1">
      <FoldHeader
        id={foldId}
        title={line.name}
        detail={playthroughWords(line.seats, started, { done: line.done, total: line.total })}
        count={count}
        unit="run"
        folded={folded}
        onFold={onFold}
        trailing={<RefMenuButton refId={item.id} described={describe(line)} onPress={onMenu} />}
      />
    </View>
  );
}

/** The header of a deleted playthrough's runs: the campaign and the seats and start its runs know. It has no menu. */
export function GoneHeader({ foldId, runs, folded, onFold }: { foldId: string; runs: readonly RunRecord[]; folded: boolean; onFold: (folded: boolean) => void }) {
  const first = runs[0];
  if (!first) return null;
  const title = campaignOf(first.campaignId ?? "")?.name ?? first.campaignId ?? "";
  return (
    <View className="pb-3 pt-1">
      <FoldHeader id={foldId} title={title} detail={playthroughWords(seatWord(first.seatCount), startedOf(runs), null)} count={runs.length} unit="run" folded={folded} onFold={onFold} />
    </View>
  );
}
