// The hubs are all mounted while the splash still shows (docs/architecture.md, Screens): the tabs are not lazy, each hub's screen marks itself
// here once its first effects have run, and the root layout holds the splash until every hub has (or `WARM_CAP_MS` has passed, so a hub
// that fails to mount cannot hold the app on a black screen). A launch that opens on another screen (a deep link, the e2e seed) mounts
// no hub and waits for none.

/** The hub routes of routes/(tabs)/_layout.tsx, in dock order. */
export const HUBS = ["index", "scenarios", "decks", "cards", "rules"] as const;

/** The longest the splash waits for the hubs after the databases open. */
export const WARM_CAP_MS = 4000;

const warm = new Set<string>();
const listeners = new Set<() => void>();

/** Whether every hub in `marked` has mounted. */
export function allWarm(marked: ReadonlySet<string>): boolean {
  return HUBS.every((hub) => marked.has(hub));
}

/** A hub's screen has mounted and run its first effects. */
export function markHubWarm(name: string): void {
  if (warm.has(name)) return;
  const before = allWarm(warm);
  warm.add(name);
  if (!before && allWarm(warm)) for (const listener of listeners) listener();
}

export function hubsWarm(): boolean {
  return allWarm(warm);
}

export function subscribeHubsWarm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a launch on these route segments mounts the hubs: the first screen is one of them. */
export function opensOnHubs(segments: readonly string[]): boolean {
  return segments[0] === "(tabs)";
}
