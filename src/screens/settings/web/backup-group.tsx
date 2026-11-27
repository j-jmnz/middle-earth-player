// The Saves page of Settings on the web and the desktop (docs/brief.md, Screens, Settings): Back up saves and Restore from a backup. A phone's saves are in the system's own backup,
// so the phone's Settings has no such page. Restore asks in place before it replaces anything (ask-in-place.tsx) and refuses a file with a sentence.
import { useEffect, useState } from "react";
import { View } from "react-native";

import { SettingChoice } from "../../../play/chrome/setting-row";
import { AskInPlace } from "../../kit/ask-in-place";
import { Label, TextButton } from "../../kit/chrome";
import { useDatabases } from "../../data/databases";
import { savedToStorage } from "../../data/web/saved";
import { clearRestored, peekRestored, restoredLine } from "./backup-note";
import { backUp, pickBackup, restore, type Picked, type Say } from "./backup-run";

const BACKUP_LINE = "Saves every campaign, game, deck and run on this computer to a file. It is made only when you ask, and it stays where you save it.";
const RESTORE_LINE = "Replaces the campaigns, games, decks, runs and settings on this computer with the ones in a backup file. A file this version of the app cannot read is refused.";

// The web app keeps its saves in memory and copies them to storage (src/screens/data/web/memory-databases.ts), so the restored rows are in storage before the page goes.
function reloadPage(): void {
  void savedToStorage().then(() => window.location.reload());
}

export function BackupGroup() {
  const { user } = useDatabases();
  const [busy, setBusy] = useState(false);
  // A restore reloads the page, which loses what it said: the restored file's name was left for this page (backup-note.ts) and is said once.
  const [said, setSaid] = useState<Say | null>(() => {
    const name = peekRestored();
    return name ? { text: restoredLine(name), failed: false } : null;
  });
  const [picked, setPicked] = useState<Picked | null>(null);

  useEffect(() => {
    clearRestored();
  }, []);

  const onBackUp = async () => {
    setBusy(true);
    setSaid(null);
    setSaid(await backUp(user, new Date()));
    setBusy(false);
  };
  const onPick = async () => {
    setSaid(null);
    const result = await pickBackup();
    if (!result) return;
    if ("bytes" in result) setPicked(result);
    else setSaid(result);
  };
  const onRestore = async () => {
    const file = picked;
    if (!file) return;
    setBusy(true);
    setPicked(null);
    setSaid(await restore(user, file, reloadPage));
    setBusy(false);
  };

  return (
    <View testID="app-settings-saves">
      <SettingChoice title="Back up saves" detail={BACKUP_LINE} testID="app-settings-backup">
        <View className="-mx-3 items-start">
          <TextButton label="Back up" tone="accent" testID="app-settings-backup-make" accessibilityHint="Downloads a backup file" disabled={busy} onPress={onBackUp} />
        </View>
      </SettingChoice>
      <SettingChoice title="Restore from a backup" detail={RESTORE_LINE} testID="app-settings-backup-restore-row">
        {picked ? (
          <AskInPlace
            testID="app-settings-backup-ask"
            sentence={`This replaces every campaign, game, deck, run and setting on this computer with the ones in ${picked.name}.`}
            confirm={{ label: "Replace", testID: "app-settings-backup-confirm", accessibilityLabel: `Replace everything on this computer with ${picked.name}`, onPress: onRestore }}
            keep={{ testID: "app-settings-backup-keep", accessibilityLabel: "Keep what is on this computer", onPress: () => setPicked(null) }}
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
    </View>
  );
}
