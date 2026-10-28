import type { Effect } from "../../catalog/boundary.ts";

// A card printed again in a later product (Forest Gate 01100 and 41012) has the same lines, so it has the same records: those of `fromCode`
// with the code in the record id, the card code and the ledger line ids changed to `toCode`'s. A test compares the two cards' printed lines.
export function reprint(records: readonly Effect[], fromCode: string, toCode: string): Effect[] {
  const swap = (text: string): string => (text.startsWith(`${fromCode}:`) ? `${toCode}${text.slice(fromCode.length)}` : text);
  const found = records.filter((record) => record.cardCode === fromCode);
  if (found.length === 0) throw new Error(`No record to reprint for ${fromCode}`);
  return found.map((record) => ({ ...record, id: swap(record.id), cardCode: toCode, lines: record.lines.map(swap) }));
}
