export type BundledBooklet = {
  moduleId: number;
  filename: string;
  bytes: number;
  sha256: string;
};

// The stub every checkout carries. When `.cache/booklets/bundled-map.ts` exists (written by `pnpm booklets:pack`, which
// `data:sync rules`, `pnpm android` and the EAS hook run), metro.config.js bundles that file in its place.
export const bundledBooklets: Partial<Record<string, BundledBooklet>> = {};
