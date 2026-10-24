export const CATALOG_VERSION = 7;

export function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {
  return applied === null || bundled > applied;
}
