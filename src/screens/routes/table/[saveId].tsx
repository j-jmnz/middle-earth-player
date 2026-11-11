// The table for the open scenario of a campaign save: opens the session and keeps each accepted intent in user.db.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { BodyText, NavBar, Screen } from "../../kit/chrome";
import { bookletParams, scenarioName } from "../../data/campaign-data";
import { useDatabases } from "../../data/databases";
import { goBack } from "../../nav/go-back";
import { routeCode } from "../../nav/route-code";
import { TableLoading } from "../../table/loading";
import { TableView, type TableNav } from "../../table/view";
import { continueTable, restartTable, sessionStore, useTableSessionAfterPaint } from "../../session/table-session";
import { DROPPED_SAVE, MISSING_GAME, STALE_CLOSED } from "../../session/stale-words";
import { useStaleChoice } from "../../session/use-stale-choice";
import { StaleSheet } from "../../table/stale-sheet";

// What a choice answers when the route has no save id: nothing to continue.
const MISSING = { ok: false, message: MISSING_GAME } as const;

export default function TableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog, user } = useDatabases();
  // Each choice of the stale sheet runs once after a paint and opens the save again; a refusal stays on the sheet with its sentence (use-stale-choice.ts).
  const choice = useStaleChoice({ continue: () => (saveId ? continueTable(catalog, user, saveId) : MISSING), restart: () => (saveId ? restartTable(catalog, user, saveId) : MISSING) });
  // Opened once per save, after the first paint (null until then): the store holds the game from here on, and each accepted intent is
  // written to user.db.
  const session = useTableSessionAfterPaint(saveId, choice.attempt);
  const table = useMemo(() => (session?.ok ? sessionStore(session, user) : null), [session, user]);

  if (saveId && (!session || choice.running)) {
    // The replay has not run yet (a miss in the session cache): the table's own frame, so the table replaces it without a jump.
    return <TableLoading onBack={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} backLabel="Path" />;
  }
  if (!saveId || !session || !session.ok || !table) {
    const stale = session?.ok === false && session.reason === "stale";
    const sentence = stale ? STALE_CLOSED : session?.ok === false && session.reason === "dropped" ? DROPPED_SAVE : "No scenario is open.";
    const leave = () => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/");
    return (
      <Screen testID="table" scene="calm">
        <NavBar onBack={leave} backTestID="table-back" backLabel="Path" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
        {stale && saveId ? (
          <StaleSheet
            title={scenarioName(session.save?.loadout?.scenarioId ?? "")}
            error={choice.refused}
            moves={session.save?.active?.intents.length ?? 0}
            standalone={false}
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
    backLabel: "Path",
    backAccessibilityLabel: "Back to the path",
    back: { pathname: "/path/[saveId]", params: { saveId } },
    outcome: { pathname: "/resolution/[saveId]", params: { saveId } },
    booklet: bookletParams(session.save.campaignId, session.save.loadout?.scenarioId),
  };
  return <TableView session={session} store={table.store} clock={table.clock} nav={nav} />;
}
