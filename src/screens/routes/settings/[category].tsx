import { useLocalSearchParams } from "expo-router";

import { isCategoryId } from "../../../play/chrome/settings-catalog";
import { SettingsView } from "../../settings/view";

// One category's page of Settings (docs/design-system.md, Settings), pushed from the first page. A name that is no category opens the first page.
export default function SettingsCategory() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return <SettingsView category={isCategoryId(category) ? category : undefined} />;
}
