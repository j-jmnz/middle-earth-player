import type { Effect } from "./effect-schema.ts";

/** Card codes that have effect records. An empty list means every sentence is inactive. */
export function activeCardCodes(records: readonly Pick<Effect, "cardCode">[]): ReadonlySet<string> {
  return new Set(records.map((record) => record.cardCode).filter((code) => code.length > 0));
}
