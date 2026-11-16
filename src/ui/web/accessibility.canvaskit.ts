// The accessibility store on the web and the desktop: the phone's (accessibility.ts), unchanged, plus the desktop shell's screen-reader flag. metro.config.js serves this file in
// place of accessibility.ts on the web platform only, and it imports the store without the file extension (Metro keeps one answer for a specifier a folder asks twice), so the
// phone's bundle never sees it. A browser cannot tell a screen reader, and react-native-web answers yes whatever is running, so the store keeps the flag off; the desktop shell can ask
// the platform (Electron's accessibilitySupportEnabled), and its preload puts that on `window` (desktop/preload.ts). With it on, "Follow screen reader" turns the table into a list.
// Without the shell (a browser) the store is the phone's own, the same object.
import { accessibility as storeState, subscribeAccessibility as storeSubscribe, type Accessibility } from "../accessibility";

export type { Accessibility };

// The name desktop/identity.ts gives the preload's object (src/ui/web/accessibility.canvaskit.test.ts pins the two together).
const DESKTOP_API = "middleEarthDesktop";

type Desktop = { accessibilitySupportEnabled: () => boolean; onAccessibilitySupportChanged: (listener: (enabled: boolean) => void) => () => void };

function desktop(): Desktop | null {
  const api = (globalThis as Record<string, unknown>)[DESKTOP_API];
  if (typeof api !== "object" || api === null) return null;
  const { accessibilitySupportEnabled, onAccessibilitySupportChanged } = api as Partial<Desktop>;
  return typeof accessibilitySupportEnabled === "function" && typeof onAccessibilitySupportChanged === "function" ? { accessibilitySupportEnabled, onAccessibilitySupportChanged } : null;
}

// The store's state with the flag on, kept for as long as the store's state is the same object, so a reader is not told twice.
let merged: { from: Accessibility; state: Accessibility } | null = null;

/** The settings as last heard of; the same object until one changes. */
export function accessibility(): Accessibility {
  const state = storeState();
  const api = desktop();
  if (api === null || !api.accessibilitySupportEnabled() || state.screenReader) return state;
  if (merged?.from !== state) merged = { from: state, state: { ...state, screenReader: true } };
  return merged.state;
}

/** For useSyncExternalStore: calls `listener` when any setting changes, and returns the way to stop. */
export function subscribeAccessibility(listener: () => void): () => void {
  const stopStore = storeSubscribe(listener);
  const stopDesktop = desktop()?.onAccessibilitySupportChanged(() => listener());
  return () => {
    stopStore();
    stopDesktop?.();
  };
}
