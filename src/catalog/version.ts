export const CATALOG_VERSION = 3;

export function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {
  return applied === null || bundled > applied;
}
