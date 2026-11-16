// The accessibility store on the web and the desktop: the phone's (accessibility.ts), unchanged, with the screen-reader flag decided here. metro.config.js serves this file in
// place of accessibility.ts on the web platform only, and it imports the store without the file extension (Metro keeps one answer for a specifier a folder asks twice), so the
// phone's bundle never sees it. react-native-web answers yes to the screen-reader question whatever is running and a browser cannot tell one, so the flag is off here whatever the
// store holds (the web table is drawn, and Table as a list is the way to the list). The desktop shell can ask the platform (Electron's accessibilitySupportEnabled), and its
// preload puts that on `window` (desktop/preload.ts). With it on, "Follow screen reader" turns the table into a list. Without the shell (a browser) the state is the phone's
// own, the same object, with the flag off.
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

// The store's state with the flag decided, kept for as long as the store's state is the same object and the flag the same, so a reader is not told twice.
let merged: { from: Accessibility; screenReader: boolean; state: Accessibility } | null = null;

/** The settings as last heard of; the same object until one changes. */
export function accessibility(): Accessibility {
  const state = storeState();
  const api = desktop();
  const screenReader = api !== null && api.accessibilitySupportEnabled();
  if (state.screenReader === screenReader) return state;
  if (merged?.from !== state || merged.screenReader !== screenReader) merged = { from: state, screenReader, state: { ...state, screenReader } };
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
