// E2E ONLY. A Maestro flow that needs a finished scenario opens a save parked on that moment instead of playing fifty rounds
// (docs/architecture.md, Tests): `openLink: middleearthlcg://e2e/won` (or `lost`) writes a new save from the fixture and
// opens its path. The fixture is a real game of the two starter decks that the reducer replays (src/campaign/fixtures.ts).
// Outside the e2e-test build (EXPO_PUBLIC_E2E_SEED, eas.json) this route writes nothing.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";

import { fixtureSave, isFixtureName } from "../../../campaign/fixtures";
import { CATALOG_VERSION } from "../../../catalog/version";
import { BodyText, NavBar, Screen } from "../../chrome";
import { writeSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { e2eBuild } from "../../e2e";
import { goBack } from "../../go-back";
import { routeCode } from "../../route-code";

export default function E2eFixture() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fixture: string }>();
  const name = routeCode(params.fixture);
  const { user } = useDatabases();
  const allowed = e2eBuild() && name != null && isFixtureName(name);
  const saveId = useMemo(() => (allowed ? `save-e2e-${name}` : null), [allowed, name]);

  useEffect(() => {
    if (!allowed || !saveId || !name || !isFixtureName(name)) return;
    writeSave(user, fixtureSave(name, saveId, CATALOG_VERSION));
    router.replace({ pathname: "/path/[saveId]", params: { saveId } });
  }, [allowed, saveId, name, user, router]);

  return (
    <Screen testID="e2e-fixture" scene="plain">
      <NavBar onBack={() => goBack(router, "/")} backTestID="e2e-back" />
      <BodyText tone="muted">{allowed ? "Opening the fixture" : "This link works only in the e2e-test build."}</BodyText>
    </Screen>
  );
}
