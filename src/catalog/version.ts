export const CATALOG_VERSION = 5;

export function shouldReplaceCatalog(bundled: number, applied: number | null): boolean {
  return applied === null || bundled > applied;
}
