// Where two games part, for `pnpm game diff`: the first intent that differs between the golden played now and the one golden.json pins, and the paths
// at which two states differ. A golden test that fails prints the whole state; this names the move and the fields.

/** The 0-based index of the first intent that differs, or null when one list is the other's prefix of the same length. */
export function firstDifferent(played: readonly unknown[], pinned: readonly unknown[]): number | null {
  const length = Math.max(played.length, pinned.length);
  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(played[index]) !== JSON.stringify(pinned[index])) return index;
  }
  return null;
}

/** The paths at which `left` and `right` differ (`cards.i12.damage: 2 → 3`), at most `limit`, after a JSON round trip of each (golden.json's form). */
export function stateDiff(left: unknown, right: unknown, limit = 40): string[] {
  const out: string[] = [];
  const show = (value: unknown): string => {
    const text = JSON.stringify(value) ?? "undefined";
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  };
  const visit = (a: unknown, b: unknown, at: string): void => {
    if (out.length >= limit) return;
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    const objects = typeof a === "object" && a !== null && typeof b === "object" && b !== null && Array.isArray(a) === Array.isArray(b);
    if (!objects) {
      out.push(`${at || "(root)"}: ${show(a)} → ${show(b)}`);
      return;
    }
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const key of keys) visit((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], at ? `${at}.${key}` : key);
  };
  visit(JSON.parse(JSON.stringify(left ?? null)), JSON.parse(JSON.stringify(right ?? null)), "");
  return out;
}
