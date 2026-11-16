// The Saves group of Settings on the web and the desktop (docs/brief.md, Screens, Settings): Back up saves and Restore from a backup. A phone's saves are in the system's own backup,
// so the phone's Settings has no such group. Restore asks in place before it replaces anything (ask-in-place.tsx) and refuses a file with a sentence.
import { useState } from "react";
import { View } from "react-native";

import { SettingChoice, SettingGroup } from "../../../play/chrome/setting-rows";
import { AskInPlace } from "../../kit/ask-in-place";
import { Label, TextButton } from "../../kit/chrome";
import { useDatabases } from "../../data/databases";
import { backUp, pickBackup, restore, type Say } from "./backup-run";

const BACKUP_LINE = "Saves every campaign, game, deck and run on this computer to a file. It is made only when you ask, and it stays where you save it.";
const RESTORE_LINE = "Puts the games from a backup file back on this computer. A file from a newer version of the app is refused.";

function reloadPage(): void {
  window.location.reload();
}

export function BackupGroup() {
  const { user } = useDatabases();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Say | null>(null);
  const [picked, setPicked] = useState<Uint8Array | null>(null);

  const onBackUp = async () => {
    setBusy(true);
    setSaid(null);
    setSaid(await backUp(user, new Date()));
    setBusy(false);
  };
  const onPick = async () => {
    setSaid(null);
    const result = await pickBackup();
    if (result instanceof Uint8Array) setPicked(result);
    else if (result) setSaid(result);
  };
  const onRestore = async () => {
    const bytes = picked;
    if (!bytes) return;
    setBusy(true);
    setPicked(null);
    setSaid(await restore(user, bytes, reloadPage));
    setBusy(false);
  };

  return (
    <SettingGroup title="Saves" testID="app-settings-saves">
      <SettingChoice title="Back up saves" detail={BACKUP_LINE} testID="app-settings-backup">
        <View className="-mx-3 items-start">
          <TextButton label="Back up" tone="accent" testID="app-settings-backup-make" accessibilityHint="Downloads a backup file" disabled={busy} onPress={onBackUp} />
        </View>
      </SettingChoice>
      <SettingChoice title="Restore from a backup" detail={RESTORE_LINE} testID="app-settings-backup-restore-row">
        {picked ? (
          <AskInPlace
            testID="app-settings-backup-ask"
            sentence="This replaces every campaign and game on this computer."
            confirm={{ label: "Replace", testID: "app-settings-backup-confirm", accessibilityLabel: "Replace every campaign and game with the backup", onPress: onRestore }}
            keep={{ testID: "app-settings-backup-keep", accessibilityLabel: "Keep my games", onPress: () => setPicked(null) }}
          />
        ) : (
          <View className="-mx-3 items-start">
            <TextButton label="Choose a backup" tone="accent" testID="app-settings-backup-choose" accessibilityHint="Opens your file picker" disabled={busy} onPress={onPick} />
          </View>
        )}
      </SettingChoice>
      {said ? (
        <Label testID="app-settings-backup-said" tone={said.failed ? "danger" : "muted"}>
          {said.text}
        </Label>
      ) : null}
    </SettingGroup>
  );
}
