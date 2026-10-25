export type BundledBooklet = {
  moduleId: number;
  filename: string;
};

// Leave this object empty in git. scripts/pack-booklets.ts replaces it on the release machine.
export const bundledBooklets: Partial<Record<string, BundledBooklet>> = {};
