// The Saves page of Settings on a phone and a tablet (docs/brief.md, Persistence and shipping; user decision, 2026-11-23): Back up saves and Restore from a backup, with the
// file the web and the desktop make (web/backup-group.tsx is their page), so a game moves between every client. Restore asks in place before it replaces anything.
import { useState } from "react";
import { View } from "react-native";

import { SettingChoice } from "../../play/chrome/setting-row";
import { useDatabases } from "../data/databases";
import { AskInPlace } from "../kit/ask-in-place";
import { Label, TextButton } from "../kit/chrome";
// A phone-only file with no web sibling, so it is named whole.
import { PHONE_IO } from "./phone-backup-io.native";
import { backUp, pickBackup, restore, type Picked, type Say } from "./phone-backup-run";

const BACKUP_LINE = "Saves every campaign, game, deck and run on this device to a file. It is made only when you ask, and it goes only where you put it.";
const RESTORE_LINE = "Replaces the campaigns, games, decks, runs and settings on this device with the ones in a backup file. A file this version of the app cannot read is refused.";

export function PhoneSaves() {
  const { user } = useDatabases();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Say | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  const onBackUp = async () => {
    setBusy(true);
    setSaid(null);
    setSaid(await backUp(user, new Date(), PHONE_IO));
    setBusy(false);
  };
  const onPick = async () => {
    setSaid(null);
    const result = await pickBackup(PHONE_IO);
    if (!result) return;
    if ("bytes" in result) setPicked(result);
    else setSaid(result);
  };
  const onRestore = async () => {
    const file = picked;
    if (!file) return;
    setBusy(true);
    setPicked(null);
    setSaid(await restore(user, file, PHONE_IO));
    setBusy(false);
  };

  return (
    <View testID="app-settings-saves">
      <SettingChoice title="Back up saves" detail={BACKUP_LINE} testID="app-settings-backup">
        <View className="-mx-3 items-start">
          <TextButton label="Back up" tone="accent" testID="app-settings-backup-make" accessibilityHint="Makes a backup file and asks where to put it" disabled={busy} onPress={onBackUp} />
        </View>
      </SettingChoice>
      <SettingChoice title="Restore from a backup" detail={RESTORE_LINE} testID="app-settings-backup-restore-row">
        {picked ? (
          <AskInPlace
            testID="app-settings-backup-ask"
            sentence={`This replaces every campaign, game, deck, run and setting on this device with the ones in ${picked.name}.`}
            confirm={{ label: "Replace", testID: "app-settings-backup-confirm", accessibilityLabel: `Replace everything on this device with ${picked.name}`, onPress: onRestore }}
            keep={{ testID: "app-settings-backup-keep", accessibilityLabel: "Keep what is on this device", onPress: () => setPicked(null) }}
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
