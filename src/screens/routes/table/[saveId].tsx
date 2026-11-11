// The table for the open scenario of a campaign save: opens the session and keeps each accepted intent in user.db.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { BodyText, NavBar, Screen } from "../../kit/chrome";
import { bookletParams, scenarioName } from "../../data/campaign-data";
import { useDatabases } from "../../data/databases";
import { goBack } from "../../nav/go-back";
import { routeCode } from "../../nav/route-code";
import { TableLoading } from "../../table/loading";
import { TableView, type TableNav } from "../../table/view";
import { continueTable, restartTable, sessionStore, useTableSessionAfterPaint } from "../../session/table-session";
import { STALE_CLOSED, type StaleChoice } from "../../session/stale-words";
import { StaleSheet } from "../../table/stale-sheet";

export default function TableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog, user } = useDatabases();
  // Each choice of the stale sheet writes once and opens the save again; a refusal stays on the sheet with its sentence.
  const [attempt, setAttempt] = useState(0);
  const [refused, setRefused] = useState<string | null>(null);
  // Opened once per save, after the first paint (null until then): the store holds the game from here on, and each accepted intent is
  // written to user.db.
  const session = useTableSessionAfterPaint(saveId, attempt);
  const table = useMemo(() => (session?.ok ? sessionStore(session, user) : null), [session, user]);

  if (saveId && !session) {
    // The replay has not run yet (a miss in the session cache): the table's own frame, so the table replaces it without a jump.
    return <TableLoading onBack={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} backLabel="Path" />;
  }
  if (!saveId || !session || !session.ok || !table) {
    const stale = session?.ok === false && session.reason === "stale";
    const sentence = stale ? STALE_CLOSED : session?.ok === false && session.reason === "dropped" ? "The scenario in progress could not be read, so it was dropped. Your log and decks are kept." : "No scenario is open.";
    const leave = () => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/");
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
        <NavBar onBack={leave} backTestID="table-back" backLabel="Path" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
        {stale && saveId ? (
          <StaleSheet
            title={scenarioName(session.save?.loadout?.scenarioId ?? "")}
            error={refused}
            takenBack={session.takenBack}
            fromCheckpoint={session.fromCheckpoint}
            changes={session.changes}
            onContinue={() => choose(continueTable(catalog, user, saveId))}
            onRestart={() => choose(restartTable(catalog, user, saveId))}
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
