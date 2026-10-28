// E2E ONLY. A Maestro flow that needs a finished scenario opens a save parked on that moment instead of playing fifty rounds
// (docs/architecture.md, Tests): `openLink: middleearthlcg://e2e/won` (or `lost`, `duo`, `knife-lost`, `mirkwood-won`, `mirkwood-lost`, `anduin-won`, `anduin-lost`) writes a new save from the
// fixture and opens its path; a name with no committed fixture (`won` and `knife-lost` are open) opens nothing. A fixture is
// a real game of saved deck cards that the reducer replays; `knife-lost` starts
// from the log scenario 1's `won` game writes (src/campaign/fixtures.ts).
// Outside the e2e-test build (EXPO_PUBLIC_E2E_SEED, eas.json) this route writes nothing.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";

import { fixtureSave, hasFixture, isFixtureName } from "../../../campaign/fixtures";
import { CATALOG_VERSION } from "../../../catalog/version";
import { BodyText, NavBar, Screen } from "../../chrome";
import { restoreSave, writeSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { e2eBuild } from "../../e2e";
import { goBack } from "../../go-back";
import { routeCode } from "../../route-code";

export default function E2eFixture() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fixture: string }>();
  const name = routeCode(params.fixture);
  const { user } = useDatabases();
  const known = name != null && isFixtureName(name) && hasFixture(name);
  const allowed = e2eBuild() && known;
  const saveId = useMemo(() => (allowed ? `save-e2e-${name}` : null), [allowed, name]);

  useEffect(() => {
    if (!allowed || !saveId || !name || !isFixtureName(name)) return;
    writeSave(user, fixtureSave(name, saveId, CATALOG_VERSION));
    // A fixture save archived by an earlier run is written again; it must also be back on the list.
    restoreSave(user, saveId);
    router.replace({ pathname: "/path/[saveId]", params: { saveId } });
  }, [allowed, saveId, name, user, router]);

  return (
    <Screen testID="e2e-fixture" scene="plain">
      <NavBar onBack={() => goBack(router, "/")} backTestID="e2e-back" />
      <BodyText tone="muted">{allowed ? "Opening the fixture" : known ? "This link works only in the e2e-test build." : "No fixture is committed under this name."}</BodyText>
    </Screen>
  );
}
