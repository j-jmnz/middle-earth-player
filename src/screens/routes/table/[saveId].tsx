// The table for the open scenario of a campaign save: opens the session and keeps each accepted intent in user.db.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import { BodyText, NavBar, Screen } from "../../chrome";
import { bookletParams } from "../../campaign-data";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { routeCode } from "../../route-code";
import { TableView, type TableNav } from "../../table-view";
import { sessionStore, useTableSession } from "../../table-session";

export default function TableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { user } = useDatabases();
  // Opened once per save: the store holds the game from here on, and each accepted intent is written to user.db.
  const session = useTableSession(saveId);
  const store = useMemo(() => (session?.ok ? sessionStore(session, user).store : null), [session, user]);

  if (!saveId || !session || !session.ok || !store) {
    const sentence =
      session?.ok === false && session.reason === "dropped"
        ? "The scenario in progress was dropped because the rules or the card data changed. Your log and decks are kept."
        : "No scenario is open.";
    return (
      <Screen testID="table" scene="plain">
        <NavBar onBack={() => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/")} backTestID="table-back" backLabel="Path" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
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
  return <TableView session={session} store={store} nav={nav} />;
}
