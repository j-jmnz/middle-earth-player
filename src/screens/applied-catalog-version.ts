function appliedCatalogVersionStatement(version: number): string {
  if (!Number.isInteger(version)) {
    throw new Error(`Catalog version must be an integer, received ${String(version)}`);
  }
  return `INSERT INTO meta (id, applied_catalog_version) VALUES (1, ${version}) ON CONFLICT(id) DO UPDATE SET applied_catalog_version = excluded.applied_catalog_version`;
}

export function writeAppliedCatalogVersion(exec: (statement: string) => void, version: number): void {
  exec(appliedCatalogVersionStatement(version));
}
