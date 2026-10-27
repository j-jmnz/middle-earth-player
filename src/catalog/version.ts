export const CATALOG_VERSION = 591872461;

// The version is a hash of what the catalog holds, so any change to it differs from the one a phone applied.
// Newer and older do not mean anything for a hash: only equal and not equal do.
export function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {
  return applied === null || bundled !== applied;
}
