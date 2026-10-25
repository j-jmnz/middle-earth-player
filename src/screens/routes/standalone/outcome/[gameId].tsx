// The end of a standalone game. Won: Victory and the score (ltp.scoring); there is no campaign card, so nothing to choose.
// Lost: Defeat and the reason. Done writes the result and closes the game; Play again opens a new briefing with the same
// seats, decks and difficulty. Leaving by Back writes nothing: the game waits on the list (Resume) and ends here again.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { finishStandalone } from "../../../../campaign/standalone";
import { BodyText, NavBar, PrimaryButton, Screen, TextButton } from "../../../chrome";
import { scenarioOf } from "../../../campaign-data";
import { useDatabases } from "../../../databases";
import { goBack } from "../../../go-back";
import { palette } from "../../../palette.js";
import { routeCode } from "../../../route-code";
import { useStandaloneSession } from "../../../standalone-session";
import { outcomeLines } from "../../../standalone-list";
import { writeStandalone } from "../../../standalone-store";

export default function StandaloneOutcome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = routeCode(params.gameId);
  const { user } = useDatabases();
  const session = useStandaloneSession(gameId);
  const finished = useMemo(() => (session?.ok ? finishStandalone(session.stored, session.world, session.game) : null), [session]);
  const back = <NavBar onBack={() => goBack(router, "/scenarios")} backTestID="outcome-back" backLabel="Scenarios" />;

  if (!gameId || !session?.ok || !finished) {
    return (
      <Screen testID="standalone-outcome" scene="plain">
        {back}
        <BodyText tone="muted" testID="outcome-closed">
          This game is not open.
        </BodyText>
      </Screen>
    );
  }

  const result = finished.result;
  const scenario = scenarioOf(finished.scenarioId);
  if (!result) {
    return (
      <Screen testID="standalone-outcome" scene="plain">
        <NavBar onBack={() => goBack(router, { pathname: "/standalone/table/[gameId]", params: { gameId } })} backTestID="outcome-table" backLabel="Table" />
        <BodyText tone="muted">The game is not over yet.</BodyText>
      </Screen>
    );
  }

  const won = result.outcome === "won";
  const done = () => {
    writeStandalone(user, finished);
    router.replace("/scenarios");
  };
  const again = () => {
    writeStandalone(user, finished);
    router.replace({ pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId: finished.scenarioId, from: finished.id } });
  };

  return (
    <Screen testID="standalone-outcome" scene={won ? "victory" : "plain"}>
      {back}
      <View className="flex-1 justify-center">
        <Text
          testID="outcome-title"
          accessibilityRole="header"
          className={won ? "text-center font-display text-display uppercase text-gold" : "font-display text-display text-bone"}
          style={won ? { textShadowColor: palette.gold, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } } : undefined}
        >
          {won ? "Victory" : "Defeat"}
        </Text>
        <BodyText tone="muted" className={won ? "mt-1 text-center" : "mt-2"}>
          {scenario?.name ?? ""}
        </BodyText>
        <View className="mt-6 gap-1" testID="outcome-lines">
          {outcomeLines(result).map((line) => (
            <BodyText key={line} tone={won ? "bone" : "muted"} className={won ? "text-center" : undefined}>
              {line}
            </BodyText>
          ))}
        </View>
      </View>
      <View className="gap-1 pb-safe pt-2">
        <BodyText tone="muted" className="mb-2 text-center" testID="outcome-consequence">
          A standalone game writes nothing to a campaign.
        </BodyText>
        <PrimaryButton label="Done" testID="outcome-done" onPress={done} />
        <View className="items-center">
          <TextButton label="Play again" testID="outcome-again" tone="gold" onPress={again} />
        </View>
      </View>
    </Screen>
  );
}
