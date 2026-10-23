export const CATALOG_VERSION = 2;

export function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {
  return applied === null || bundled > applied;
}
