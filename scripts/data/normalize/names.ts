export function distance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j] ?? 0;
      row[j] = Math.min(current + 1, (row[j - 1] ?? 0) + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[right.length] ?? 0;
}

// The sources spell a card title with or without its accents and hyphens ("Dour Handed", "Dour-handed").
export function titleKey(title: string): string {
  return title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Quest-card text has typos ("Buckleberry Ferry"). Two names match when they differ by at most two letters.
export function sameName(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b || distance(a, b) <= 2;
}

