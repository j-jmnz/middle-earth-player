import { requireOptionalNativeModule } from "expo-modules-core";

type ImageBackupExclusionModule = {
  excludeFromBackup(directoryUri: string): void;
};

export function excludeImageDirectoryFromBackup(directoryUri: string): void {
  let native: ImageBackupExclusionModule | null = null;
  try {
    native = requireOptionalNativeModule<ImageBackupExclusionModule>("ImageBackupExclusion");
  } catch {
    return;
  }
  native?.excludeFromBackup(directoryUri);
}
