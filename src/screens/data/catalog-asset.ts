export type MetroAssetModule = number | string | { readonly uri: string };

export function catalogAssetModule(loaded: unknown): MetroAssetModule {
  if (typeof loaded === "number") return loaded;
  if (typeof loaded === "string" && loaded.length > 0) return loaded;
  if (isUriAsset(loaded)) return loaded;
  throw new Error(`Catalog asset did not resolve to a Metro asset (received ${typeof loaded})`);
}

function isUriAsset(value: unknown): value is { uri: string } {
  if (typeof value !== "object" || value === null || !("uri" in value)) return false;
  return typeof value.uri === "string" && value.uri.length > 0;
}
