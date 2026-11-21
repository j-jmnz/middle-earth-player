import { useLocalSearchParams } from "expo-router";

import { SettingsView } from "../../settings/view";

// The first page of Settings (docs/design-system.md, Settings): the categories, the search and the quick setups, pushed from the gear on a hub,
// the rail's foot, or the table's All settings (`from=table`, which names the table as the way back). The dock and the rail are hidden here.
export default function Settings() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <SettingsView fromTable={from === "table"} />;
}
