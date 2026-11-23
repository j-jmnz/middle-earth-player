// The phone's half of a backup (phone-backup-run.ts, PhoneIo): the file goes out through the system, never through the network. iOS opens the share sheet on a copy in the
// cache (Save to Files, AirDrop); Android has no share sheet for a file without a content provider, so the player picks a folder and the file is written there.
import { reloadAppAsync } from "expo";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { Platform, Share } from "react-native";

import type { PhoneIo, Picked } from "./phone-backup-run";

async function shareFile(bytes: Uint8Array, name: string): Promise<"shared" | "cancelled"> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(bytes);
  const result = await Share.share({ url: file.uri });
  return result.action === Share.dismissedAction ? "cancelled" : "shared";
}

// The folder picker rejects when the player closes it, so a rejection there is a cancel; a failed write after it is an error the caller reports.
async function saveToFolder(bytes: Uint8Array, name: string): Promise<"saved" | "cancelled"> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return "cancelled";
  }
  await folder.createFile(name, "application/octet-stream").write(bytes);
  return "saved";
}

async function pick(): Promise<Picked | null> {
  // Any type: a provider (Files, Drive) gives a .backup file no type the picker could filter on. The copy in the cache is what is read.
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const copy = new File(asset.uri);
  const bytes = await copy.bytes();
  if (copy.exists) copy.delete();
  return { bytes, name: asset.name };
}

export const PHONE_IO: PhoneIo = {
  hand: (bytes, name) => (Platform.OS === "android" ? saveToFolder(bytes, name) : shareFile(bytes, name)),
  pick,
  reload: () => void reloadAppAsync("A backup was restored"),
};
