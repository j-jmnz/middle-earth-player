export const CATALOG_VERSION = 1;

export function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {
  return applied === null || bundled > applied;
}
