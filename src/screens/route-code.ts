export function routeCode(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}
