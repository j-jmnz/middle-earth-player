/** Deterministic generator. The scenario stores `seed` and `seedCursor`; each roll advances the cursor by one. */

export function nextUint(seed: number, cursor: number): number {
  let z = (seed + Math.imul(cursor + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x7feb352d);
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x846ca68b);
  return (z ^ (z >>> 16)) >>> 0;
}

export function shuffleIds(
  ids: readonly string[],
  seed: number,
  cursor: number,
): { ids: string[]; cursor: number } {
  const next = ids.slice();
  let current = cursor;
  for (let index = next.length - 1; index > 0; index -= 1) {
    const roll = nextUint(seed, current) % (index + 1);
    current += 1;
    const swap = next[index];
    next[index] = next[roll] ?? swap;
    next[roll] = swap;
  }
  return { ids: next, cursor: current };
}
