import { useLocalSearchParams } from "expo-router";

import { SettingsView } from "../settings-view";

// The app's settings on one page (docs/plans/settings-theme-and-ui-scale.md), pushed from the gear on a hub, the rail's foot, or the
// table's All settings (`from=table`, which names the table as the way back). The dock and the rail are hidden here.
export default function Settings() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <SettingsView fromTable={from === "table"} />;
}
