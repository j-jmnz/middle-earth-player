/** Card codes named by effect rows. An empty list means every sentence is inactive. */
export function activeCardCodes(records: readonly string[]): ReadonlySet<string> {
  const codes = new Set<string>();
  for (const record of records) {
    const code = cardCodeFromEffectRecord(record);
    if (code) codes.add(code);
  }
  return codes;
}

export function cardCodeFromEffectRecord(record: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(record);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !("cardCode" in parsed)) return null;
  const code = parsed.cardCode;
  if (typeof code !== "string" || code.length === 0) return null;
  return code;
}
