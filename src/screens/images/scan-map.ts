export type ScanAsset = {
  moduleId: number | { uri: string };
  width: number;
  height: number;
};

// Leave this object empty in git. scripts/build/pack-scans.ts replaces it on the release machine.
export const scanAssets: Record<string, ScanAsset> = {};
