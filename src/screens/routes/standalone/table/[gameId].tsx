// The table of a standalone game: opens the game and keeps each accepted intent in user.db. Back goes to the scenarios.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { BodyText, NavBar, Screen } from "../../../kit/chrome";
import { bookletParams, scenarioName } from "../../../data/campaign-data";
import { useDatabases } from "../../../data/databases";
import { goBack } from "../../../nav/go-back";
import { routeCode } from "../../../nav/route-code";
import { continueStandaloneGame, restartStandaloneGame, standaloneStore, useStandaloneSessionAfterPaint } from "../../../session/standalone-session";
import { STALE_CLOSED, type StaleChoice } from "../../../session/stale-words";
import { StaleSheet } from "../../../table/stale-sheet";
import { TableLoading } from "../../../table/loading";
import { TableView, type TableNav } from "../../../table/view";

export default function StandaloneTableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = routeCode(params.gameId);
  const { catalog, user } = useDatabases();
  // Each choice of the stale sheet writes once and opens the game again; a refusal stays on the sheet with its sentence.
  const [attempt, setAttempt] = useState(0);
  const [refused, setRefused] = useState<string | null>(null);
  // Opened once per game, after the first paint (null until then): the store holds the game from here on, and each accepted intent is
  // written to user.db.
  const session = useStandaloneSessionAfterPaint(gameId, attempt);
  const table = useMemo(() => (session?.ok ? standaloneStore(session, user) : null), [session, user]);

  if (gameId && !session) {
    // The replay has not run yet (a miss in the session cache): the table's own frame, so the table replaces it without a jump.
    return <TableLoading onBack={() => goBack(router, "/scenarios")} backLabel="Scenarios" />;
  }
  if (!gameId || !session || !session.ok || !table) {
    const stale = session?.ok === false && session.reason === "stale";
    const sentence = stale ? STALE_CLOSED : session?.ok === false && session.reason === "dropped" ? "The game in progress could not be read, so it was dropped. Your decks are kept; deal it again from Scenarios." : "This game is not open.";
    const leave = () => goBack(router, "/scenarios");
    const choose = (choice: StaleChoice) => {
      if (choice.ok) {
        setRefused(null);
        setAttempt((count) => count + 1);
      } else {
        setRefused(choice.message);
      }
    };
    return (
      <Screen testID="table" scene="calm">
        <NavBar onBack={leave} backTestID="table-back" backLabel="Scenarios" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
        {stale && gameId ? (
          <StaleSheet
            title={scenarioName(session.stored?.scenarioId ?? "")}
            error={refused}
            takenBack={session.takenBack}
            onContinue={() => choose(continueStandaloneGame(catalog, user, gameId))}
            onRestart={() => choose(restartStandaloneGame(catalog, user, gameId))}
            onLeave={leave}
          />
        ) : null}
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
