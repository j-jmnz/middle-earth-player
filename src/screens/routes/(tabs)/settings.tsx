import { useLocalSearchParams } from "expo-router";

import { SettingsView } from "../../settings-view";

// The app's settings on one page (docs/plans/settings-theme-and-ui-scale.md). The table's All settings passes `from=table`, which adds Back to the table.
export default function Settings() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <SettingsView fromTable={from === "table"} />;
}
