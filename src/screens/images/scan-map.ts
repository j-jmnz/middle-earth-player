export type ScanAsset = {
  moduleId: number;
  width: number;
  height: number;
};

// Leave this object empty in git. scripts/pack-scans.ts replaces it on the release machine.
export const scanAssets: Record<string, ScanAsset> = {};
