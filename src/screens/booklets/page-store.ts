// The page the booklet view last reported, kept outside React so the screen that owns the view does not re-render on each page turn;
// only the reader-mode button (page-rules-button.tsx) subscribes.
let current: { id: string; page: number } | null = null;
const listeners = new Set<() => void>();

export function reportBookletPage(id: string, page: number): void {
  if (current?.id === id && current.page === page) return;
  current = { id, page };
  for (const listener of [...listeners]) listener();
}

export function subscribeBookletPage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The last page reported for `id`, or null before the view has reported one. */
export function bookletPageOf(id: string): number | null {
  return current?.id === id ? current.page : null;
}
