// The lines `pnpm test scenario` prints for the records no golden resolves (test/harness/reached.ts writes the list while the scenario's golden suite plays its games): each record with its timing and
// lines, and whether a test of the scenario names it (its id or one of its printed lines). A record no golden reaches needs a card test or a golden that reaches it; the list is the work left, and it
// does not fail the run.
import type { Unreached } from "../../test/harness/reached.ts";

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether one of the texts names the record: its id, or one of its printed lines, as a whole token. */
export function namedIn(row: Unreached, texts: readonly string[]): boolean {
  const names = [row.id, ...row.lines].map((name) => new RegExp(`(?<![\\w:])${escape(name)}(?![\\w])`));
  return texts.some((text) => names.some((name) => name.test(text)));
}

/** The report: a header with the counts, then a line for each record. `texts` are the scenario's test files. */
export function unreachedReport(rows: readonly Unreached[], texts: readonly string[]): string[] {
  if (rows.length === 0) return ["unreached  no record is left that no golden resolves"];
  const untested = rows.filter((row) => !namedIn(row, texts));
  return [
    `unreached  ${rows.length} record${rows.length === 1 ? "" : "s"} no golden resolves, ${untested.length} that no test of the scenario names:`,
    ...rows.map((row) => `  ${untested.includes(row) ? "NO TEST" : "tested "}  ${row.id}  (${row.timing}; ${row.lines.join(", ")})`),
  ];
}
