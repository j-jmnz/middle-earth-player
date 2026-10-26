// The quest stage in words, above the dock: its name, a thin gold progress bar and the count. The stage card itself is on
// the canvas at the left of the table; this keeps its name readable at a glance (docs/design-system.md, Table). The numbers
// are the engine's.
import { Text, View } from "react-native";

import { questPointsOf } from "../rules/quest.ts";

import { GameIcon } from "./game-icon.tsx";
import { questObjective } from "./objective.ts";
import type { ReduceContext, ScenarioState } from "./store.ts";
import { tableTokens as t } from "./tokens.ts";

export function QuestBand({ game, ctx, nameOf, line }: { game: ScenarioState; ctx: ReduceContext; nameOf: (code: string) => string; line: (id: string) => string | null }) {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage) return null;
  const points = questPointsOf(game, stage, ctx.cards);
  const fraction = points ? Math.min(1, stage.progress / points) : 0;
  // A stage with no quest points is won some other way: its printed line says how (objective.ts).
  const objective = points == null ? questObjective(game, ctx, line) : null;
  return (
    <View accessible accessibilityLabel={points != null ? `${nameOf(stage.code)}. ${stage.progress} of ${points} progress` : `${nameOf(stage.code)}. ${objective ?? "No quest points"}`}>
      <Text testID="quest-stage" numberOfLines={1} className="font-display text-label text-bone">
        {nameOf(stage.code)}
      </Text>
      {points != null ? (
        <View className="mt-1 flex-row items-center gap-2">
          <View className="h-1 flex-1 rounded-pill" style={{ backgroundColor: t.hairline }}>
            <View className="h-1 rounded-pill" style={{ width: `${Math.round(fraction * 100)}%`, backgroundColor: t.gold }} />
          </View>
          <GameIcon name="questPoints" size={14} />
          <Text testID="quest-progress" className="font-display text-label text-muted">{`${stage.progress} / ${points}`}</Text>
        </View>
      ) : (
        <Text testID="quest-progress" numberOfLines={4} className="mt-1 text-label text-muted">
          {objective ?? "No quest points"}
        </Text>
      )}
    </View>
  );
}
