// The Settings screens on the web and the desktop (view.tsx is the phone's, unchanged; metro.config.js serves this file in its place on the web
// platform only): the same screens with a Saves page, Back up and Restore (web/backup-group.tsx). Phones keep the system's own backup.
import { SettingsView as PhoneSettingsView } from "./view";
import type { CategoryId } from "../../play/chrome/settings-catalog";
import { BackupGroup } from "./web/backup-group";

export function SettingsView(props: { fromTable?: boolean; category?: CategoryId }) {
  return <PhoneSettingsView {...props} saves={<BackupGroup />} />;
}
