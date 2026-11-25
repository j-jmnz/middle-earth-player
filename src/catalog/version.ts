export const CATALOG_VERSION = 3706744331;

// The version is a hash of what the catalog holds, so any change to it differs from the one a phone applied.
// Newer and older do not mean anything for a hash: only equal and not equal do.
export function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {
  return applied === null || bundled !== applied;
}

// catalog.db carries its own version in SQLite's user_version, a signed 32-bit integer, so the version is folded into
// that range. The phone checks the stamp of the catalog it holds: a file whose stamp is not the code's version is
// replaced, even when user.db already records that version as applied (a build that shipped a stale catalog.db).
export function catalogStamp(version: number): number {
  return version | 0;
}

export function catalogFileIsCurrent(stamp: number | null, version: number): boolean {
  return stamp === catalogStamp(version);
}
