// The cards a change reaches (`pnpm effects reach`, reach.ts): the render of each card and the JSON of its records at a base and in the working tree, compared, and the difference
// printed by card with the printed line of each record that moved. Pure functions over two dumps, so a test reads them without a git tree.

/** One card as a tree renders it: its name, its printed lines by id, the text `pnpm effects render` prints for it, and each of its records as JSON. */
export type CardDump = { name: string; lines: Readonly<Record<string, string>>; text: string; records: Readonly<Record<string, unknown>> };
export type Dump = { cards: Readonly<Record<string, CardDump>> };

export type CardChange = {
  code: string;
  name: string;
  /** The record ids that are in only one tree, or whose JSON differs. */
  added: string[];
  removed: string[];
  changed: string[];
  /** The printed lines, by id, that the moved records name (every line of the card when only the render moved). */
  lines: Record<string, string>;
  /** The render's lines that are only at the base (`-`) or only in the tree (`+`), in order. */
  diff: string[];
};

/** A line diff by the longest common subsequence: `-` for a line only in `before`, `+` for one only in `after`. */
export function lineDiff(before: readonly string[], after: readonly string[]): string[] {
  const common: number[][] = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i -= 1) for (let j = after.length - 1; j >= 0; j -= 1) common[i]![j] = before[i] === after[j] ? common[i + 1]![j + 1]! + 1 : Math.max(common[i + 1]![j]!, common[i]![j + 1]!);
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      i += 1;
      j += 1;
    } else if (j < after.length && (i === before.length || common[i]![j + 1]! > common[i + 1]![j]!)) {
      out.push(`+ ${after[j]}`);
      j += 1;
    } else {
      out.push(`- ${before[i]}`);
      i += 1;
    }
  }
  return out;
}

const json = (value: unknown): string => JSON.stringify(value);

/** The cards whose render or records differ between the two dumps, by code. A card in only one dump is all added or all removed. */
export function reaching(base: Dump, now: Dump): CardChange[] {
  const empty: CardDump = { name: "", lines: {}, text: "", records: {} };
  const changes: CardChange[] = [];
  for (const code of [...new Set([...Object.keys(base.cards), ...Object.keys(now.cards)])].sort()) {
    const before = base.cards[code] ?? empty;
    const after = now.cards[code] ?? empty;
    const ids = [...new Set([...Object.keys(before.records), ...Object.keys(after.records)])];
    const added = ids.filter((id) => !(id in before.records));
    const removed = ids.filter((id) => !(id in after.records));
    const changed = ids.filter((id) => id in before.records && id in after.records && json(before.records[id]) !== json(after.records[id]));
    if (added.length + removed.length + changed.length === 0 && before.text === after.text) continue;
    const moved = [...added, ...removed, ...changed];
    const lines = { ...before.lines, ...after.lines };
    const named = moved.flatMap((id) => ((after.records[id] ?? before.records[id]) as { lines?: string[] } | undefined)?.lines ?? []);
    const shown = named.length > 0 ? Object.fromEntries(Object.entries(lines).filter(([id]) => named.includes(id))) : lines;
    changes.push({ code, name: after.name || before.name, added, removed, changed, lines: shown, diff: lineDiff(before.text.split("\n"), after.text.split("\n")) });
  }
  return changes;
}

/** The report: a heading for each card with the printed lines of its moved records and the render's difference beneath. */
export function formatChanges(changes: readonly CardChange[], baseRef: string): string {
  if (changes.length === 0) return `No card's render or records differ from ${baseRef}.\n`;
  const out: string[] = [`${changes.length} card${changes.length === 1 ? "" : "s"} reached against ${baseRef}`, ""];
  for (const change of changes) {
    const moved = [change.added.length > 0 ? `added ${change.added.join(", ")}` : "", change.removed.length > 0 ? `removed ${change.removed.join(", ")}` : "", change.changed.length > 0 ? `changed ${change.changed.join(", ")}` : ""].filter(Boolean);
    out.push(`## ${change.code} ${change.name}`, moved.length > 0 ? moved.join("; ") : "(the render moved; no record's JSON did)");
    for (const [id, text] of Object.entries(change.lines)) out.push(`  ${id}: ${text}`);
    out.push(...change.diff.map((line) => `  ${line}`), "");
  }
  return out.join("\n");
}
