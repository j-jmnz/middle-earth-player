// The end of a standalone game. Won: Victory and the score (ltp.scoring); there is no campaign card, so nothing to choose.
// Lost: Defeat and the reason. The result is fixed by the game state and asks for nothing, so it is written as the screen
// opens and the list shows it at once; Done returns to the scenarios, and Play again opens a new briefing with the same
// seats, decks and difficulty. A game already finished shows its stored result.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";

import { finishStandalone } from "../../../../campaign/standalone";
import { ActionBar, BodyText, Label, NavBar, PrimaryButton, Screen, StatTile, TextButton } from "../../../chrome";
import { withAlphaHex } from "../../../../play/tokens";
import { scenarioOf } from "../../../campaign-data";
import { useDatabases } from "../../../databases";
import { goBack } from "../../../go-back";
import { palette } from "../../../palette.js";
import { routeCode } from "../../../route-code";
import { useStandaloneSession } from "../../../standalone-session";
import { outcomeLines } from "../../../standalone-words";
import { writeStandalone } from "../../../standalone-store";

export default function StandaloneOutcome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = routeCode(params.gameId);
  const { user } = useDatabases();
  const session = useStandaloneSession(gameId);
  const finished = useMemo(() => (session?.ok ? finishStandalone(session.stored, session.world, session.game) : (session?.stored ?? null)), [session]);
  const ended = session?.ok === true && finished?.result != null;
  useEffect(() => {
    if (ended && finished) writeStandalone(user, finished);
  }, [ended, finished, user]);
  const back = <NavBar onBack={() => goBack(router, "/scenarios")} backTestID="outcome-back" backLabel="Scenarios" />;

  if (!gameId || !finished || (!session?.ok && !finished.result)) {
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
  const done = () => router.replace("/scenarios");
  const again = () => {
    router.replace({ pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId: finished.scenarioId, from: finished.id } });
  };

  const word = { fontSize: 44, lineHeight: 52, letterSpacing: 4 };
  return (
    <Screen testID="standalone-outcome" scene={won ? "victory" : "plain"}>
      {back}
      <View className={won ? "flex-1 pt-16" : "flex-1 justify-center"}>
        <Text
          testID="outcome-title"
          accessibilityRole="header"
          className={`text-center font-display-bold ${won ? "text-goldHigh" : "text-danger"}`}
          style={{ ...word, textShadowColor: won ? palette.gold : withAlphaHex(palette.threat, 0.6), textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } }}
        >
          {won ? "Victory" : "Defeat"}
        </Text>
        <Text className="mt-1 text-center font-display text-heading text-bone">{scenario?.name ?? ""}</Text>
        {result.outcome === "won" ? (
          // The score as the numbers the player watches: score, completed rounds, victory points (ltp.scoring).
          <View className="mt-10" testID="outcome-lines">
            <View className="flex-row gap-2">
              <StatTile label="Score" value={String(result.score.score)} />
              <StatTile label="Rounds" value={String(result.score.rounds)} />
              <StatTile label="Victory points" value={String(result.score.victoryPoints)} />
            </View>
            <Label className="mt-2 text-center">Lower is better.</Label>
          </View>
        ) : (
          <View className="mt-6 gap-1" testID="outcome-lines">
            {outcomeLines(result).map((line) => (
              <BodyText key={line} tone="muted" className="text-center">
                {line}
              </BodyText>
            ))}
          </View>
        )}
      </View>
      <ActionBar>
        <Label tone="muted" className="mb-3 text-center" testID="outcome-consequence">
          A standalone game writes nothing to a campaign.
        </Label>
        <PrimaryButton label="Done" testID="outcome-done" onPress={done} />
        <View className="mt-1 items-center">
          <TextButton label="Play again" testID="outcome-again" tone="gold" onPress={again} />
        </View>
      </ActionBar>
    </Screen>
  );
}
