// The table of a standalone game: opens the game and keeps each accepted intent in user.db. Back goes to the scenarios.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { BodyText, NavBar, Screen } from "../../../chrome";
import { bookletParams } from "../../../campaign-data";
import { useDatabases } from "../../../databases";
import { goBack } from "../../../go-back";
import { routeCode } from "../../../route-code";
import { standaloneStore, useStandaloneSessionAfterPaint } from "../../../standalone-session";
import { TableLoading } from "../../../table-loading";
import { TableView, type TableNav } from "../../../table-view";
import { STANDALONE_DROPPED } from "../../../standalone-words";

export default function StandaloneTableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = routeCode(params.gameId);
  const { user } = useDatabases();
  // Opened once per game, after the first paint (null until then): the store holds the game from here on, and each accepted intent is
  // written to user.db.
  const session = useStandaloneSessionAfterPaint(gameId);
  const table = useMemo(() => (session?.ok ? standaloneStore(session, user) : null), [session, user]);

  if (gameId && !session) {
    // The replay has not run yet (a miss in the session cache): the table's own frame, so the table replaces it without a jump.
    return <TableLoading onBack={() => goBack(router, "/scenarios")} backLabel="Scenarios" />;
  }
  if (!gameId || !session || !session.ok || !table) {
    const sentence = session?.ok === false && session.reason === "dropped" ? STANDALONE_DROPPED : "This game is not open.";
    return (
      <Screen testID="table" scene="calm">
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
  return <TableView session={session} store={table.store} clock={table.clock} nav={nav} />;
}
