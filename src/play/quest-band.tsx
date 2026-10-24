// The pinned quest stage: the stage art sits on the canvas at the left of the band; its name, a thin gold progress bar and
// the count are text beside it (docs/design-system.md, Table). The numbers are the engine's.
import { Text, View } from "react-native";

import { questPointsOf } from "../rules/quest.ts";
import type { ReduceContext, ScenarioState } from "./store.ts";
import { tableTokens as t } from "./tokens.ts";

// The band and the art's width, from layout.ts: a 72 pt band, the art 1.4 times as wide as it is tall, a 12 pt gutter.
const ART_RIGHT = 12 + Math.round((72 - 8) * 1.4) + 12;

export function QuestBand({ game, ctx, nameOf }: { game: ScenarioState; ctx: ReduceContext; nameOf: (code: string) => string }) {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage) return null;
  const points = questPointsOf(game, stage, ctx.cards);
  const fraction = points ? Math.min(1, stage.progress / points) : 0;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: ART_RIGHT, right: 12, height: 72, justifyContent: "center" }}>
      <Text testID="quest-stage" numberOfLines={1} className="font-display text-body text-bone">
        {nameOf(stage.code)}
      </Text>
      {points != null ? (
        <>
          <View className="mt-1 h-1 rounded-pill" style={{ backgroundColor: t.hairline }}>
            <View className="h-1 rounded-pill" style={{ width: `${Math.round(fraction * 100)}%`, backgroundColor: t.gold }} />
          </View>
          <Text testID="quest-progress" className="mt-1 font-display text-label text-muted">{`${stage.progress} / ${points} progress`}</Text>
        </>
      ) : (
        <Text testID="quest-progress" className="mt-1 text-label text-muted">
          No quest points
        </Text>
      )}
    </View>
  );
}
