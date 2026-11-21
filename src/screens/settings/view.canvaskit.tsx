// The Settings tab on the web and the desktop (view.tsx is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only): the same page with
// a Saves group, Back up and Restore, drawn after the last group of the rows (src/play/chrome/setting-rows.canvaskit.tsx). Phones keep the system's own backup.
import { SettingsView as PhoneSettingsView } from "./view";
import { ExtraSettingsRows } from "../../ui/web/extra-settings-rows";
import { BackupGroup } from "./web/backup-group";

export function SettingsView(props: { fromTable?: boolean }) {
  return (
    <ExtraSettingsRows.Provider value={<BackupGroup />}>
      <PhoneSettingsView {...props} />
    </ExtraSettingsRows.Provider>
  );
}
