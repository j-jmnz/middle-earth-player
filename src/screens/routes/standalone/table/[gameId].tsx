// The table of a standalone game: opens the game and keeps each accepted intent in user.db. Back goes to the scenarios.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { BodyText, NavBar, Screen } from "../../../kit/chrome";
import { bookletOf, scenarioName } from "../../../data/campaign-data";
import { useDatabases } from "../../../data/databases";
import { goBack } from "../../../nav/go-back";
import { routeCode } from "../../../nav/route-code";
import { continueStandaloneGame, restartStandaloneGame, standaloneStore, useStandaloneSessionAfterPaint } from "../../../session/standalone-session";
import { DROPPED_GAME, MISSING_GAME, STALE_CLOSED } from "../../../session/stale-words";
import { useStaleChoice } from "../../../session/use-stale-choice";
import { StaleSheet } from "../../../table/stale-sheet";
import { TableLoading } from "../../../table/loading";
import { TableView, type TableNav } from "../../../table/view";
import { TableMusic } from "../../../../play/chrome/table-music";

// What a choice answers when the route has no game id: nothing to continue.
const MISSING = { ok: false, message: MISSING_GAME } as const;

export default function StandaloneTableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = routeCode(params.gameId);
  const { catalog, user } = useDatabases();
  // Each choice of the stale sheet runs once after a paint and opens the game again; a refusal stays on the sheet with its sentence (use-stale-choice.ts).
  const choice = useStaleChoice({ continue: () => (gameId ? continueStandaloneGame(catalog, user, gameId) : MISSING), restart: () => (gameId ? restartStandaloneGame(catalog, user, gameId) : MISSING) });
  // Opened once per game, after the first paint (null until then): the store holds the game from here on, and each accepted intent is
  // written to user.db.
  const session = useStandaloneSessionAfterPaint(gameId, choice.attempt);
  const table = useMemo(() => (session?.ok ? standaloneStore(session, user) : null), [session, user]);

  if (gameId && (!session || choice.running)) {
    // The replay has not run yet (a miss in the session cache): the table's own frame, so the table replaces it without a jump.
    return <TableLoading onBack={() => goBack(router, "/scenarios")} backLabel="Scenarios" />;
  }
  if (!gameId || !session || !session.ok || !table) {
    const stale = session?.ok === false && session.reason === "stale";
    const sentence = stale ? STALE_CLOSED : session?.ok === false && session.reason === "dropped" ? DROPPED_GAME : "This game is not open.";
    const leave = () => goBack(router, "/scenarios");
    return (
      <Screen testID="table" scene="calm">
        <NavBar onBack={leave} backTestID="table-back" backLabel="Scenarios" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
        {stale && gameId ? (
          <StaleSheet
            title={scenarioName(session.stored?.scenarioId ?? "")}
            error={choice.refused}
            moves={session.stored?.active?.intents.length ?? 0}
            standalone
            takenBack={session.takenBack}
            fromCheckpoint={session.fromCheckpoint}
            changes={session.changes}
            onContinue={choice.onContinue}
            onRestart={choice.onRestart}
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
    booklet: bookletOf(session.stored.campaignId, session.stored.scenarioId),
  };
  return (
    <>
      <TableMusic store={table.store} ctx={session.ctx} />
      <TableView session={session} store={table.store} clock={table.clock} nav={nav} intents={() => table.game().active?.intents ?? null} />
    </>
  );
}
