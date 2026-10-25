// The table of a standalone game: opens the game and keeps each accepted intent in user.db. Back goes to the scenarios.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { BodyText, NavBar, Screen } from "../../../chrome";
import { bookletParams } from "../../../campaign-data";
import { useDatabases } from "../../../databases";
import { goBack } from "../../../go-back";
import { routeCode } from "../../../route-code";
import { standaloneStore, useStandaloneSession } from "../../../standalone-session";
import { TableView, type TableNav } from "../../../table-view";
import { STANDALONE_DROPPED } from "../../../standalone-list";

export default function StandaloneTableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = routeCode(params.gameId);
  const { user } = useDatabases();
  // Opened once per game: the store holds the game from here on, and each accepted intent is written to user.db.
  const session = useStandaloneSession(gameId);
  const store = useMemo(() => (session?.ok ? standaloneStore(session, user).store : null), [session, user]);

  if (!gameId || !session || !session.ok || !store) {
    const sentence = session?.ok === false && session.reason === "dropped" ? STANDALONE_DROPPED : "This game is not open.";
    return (
      <Screen testID="table" scene="plain">
        <NavBar onBack={() => goBack(router, "/scenarios")} backTestID="table-back" backLabel="Scenarios" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
      </Screen>
    );
  }
  const nav: TableNav = {
    backLabel: "Scenarios",
    backAccessibilityLabel: "Back to the scenarios",
    back: "/scenarios",
    outcome: { pathname: "/standalone/outcome/[gameId]", params: { gameId } },
    booklet: bookletParams(session.stored.campaignId, session.stored.scenarioId),
  };
  return <TableView session={session} store={store} nav={nav} />;
}
