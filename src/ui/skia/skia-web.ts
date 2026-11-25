// Skia on the web needs CanvasKit (a wasm) loaded before any Skia module is evaluated: `Skia.web.ts` builds its API from `global.CanvasKit` when it
// first runs. One module store holds the load's state. The web's splash starts it after the first paint (`startCanvasKit`, screens/kit/splash-glow.canvaskit.tsx), the table's web entry
// points (play/canvas/table-canvas.tsx, play/spotlight/layer.tsx) read it with `useCanvasKit` and import their `.native.tsx` Skia files only once it is
// "ready", so no Skia module runs during the static render or before CanvasKit. The wasm is served from the app's own origin
// (`pnpm assets canvaskit` copies it to public/canvaskit.wasm), so the desktop build loads it offline. The phone has Skia built in: it is always
// ready there, nothing is loaded, and the loader (skia-web-load.ts) is behind a web-only branch. Once CanvasKit is loaded the web shims
// (web-shims.ts) are installed, so the phone's `.native` table files run on it unchanged.
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

export type CanvasKitStatus = "idle" | "loading" | "ready" | "failed";

let status: CanvasKitStatus = "idle";
const listeners = new Set<() => void>();

function set(next: CanvasKitStatus): void {
  status = next;
  for (const listener of [...listeners]) listener();
}

async function load(): Promise<void> {
  try {
    const loader = Platform.OS === "web" ? await import("./skia-web-load.ts") : null;
    await loader?.loadCanvasKit();
    set("ready");
  } catch (error) {
    console.warn(`CanvasKit did not load, so the table stays a list: ${error instanceof Error ? error.message : String(error)}`);
    set("failed");
  }
}

/** Begins loading CanvasKit once; a later call does nothing. Called after the first paint, never during a render. */
export function startCanvasKit(): void {
  if (status !== "idle") return;
  set("loading");
  void load();
}

/**
 * Starts the load on the next frame and returns the cleanup. A cleanup that runs before the frame has come (the splash unmounts first when the
 * window paints late) starts the load at once instead of dropping it: the table's canvas waits on this load and nothing else starts it.
 */
export function startCanvasKitOnFrame(): () => void {
  const frame = requestAnimationFrame(startCanvasKit);
  return () => {
    cancelAnimationFrame(frame);
    startCanvasKit();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const current = () => status;
const serverStatus = (): CanvasKitStatus => "idle";

/** Where the load stands. The static render and the first client render both read "idle", so they agree. Always "ready" on the phone. */
export function useCanvasKit(): CanvasKitStatus {
  const status = useSyncExternalStore(subscribe, current, serverStatus);
  return Platform.OS === "web" ? status : "ready";
}
