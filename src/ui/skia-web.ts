// Skia on the web needs CanvasKit (a wasm) loaded before any Skia module is evaluated: `Skia.web.ts` builds its API from `global.CanvasKit` when it
// first runs. One module store holds the load's state. The root layout starts it after the first paint (`startCanvasKit`), the table's web entry
// points (play/canvas/table-canvas.tsx, play/spotlight/layer.tsx) read it with `useCanvasKit` and import their `.native.tsx` Skia files only once it is
// "ready", so no Skia module runs during the static render or before CanvasKit. The wasm is served from the app's own origin
// (`pnpm assets canvaskit` copies it to public/canvaskit.wasm), so the desktop build loads it offline. skia-web.native.ts is the phone's: always ready.
import { useSyncExternalStore } from "react";

export type CanvasKitStatus = "idle" | "loading" | "ready" | "failed";

let status: CanvasKitStatus = "idle";
const listeners = new Set<() => void>();

function set(next: CanvasKitStatus): void {
  status = next;
  for (const listener of [...listeners]) listener();
}

async function load(): Promise<void> {
  try {
    const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/module/web/LoadSkiaWeb");
    await LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" });
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

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const current = () => status;
const serverStatus = (): CanvasKitStatus => "idle";

/** Where the load stands. The static render and the first client render both read "idle", so they agree. */
export function useCanvasKit(): CanvasKitStatus {
  return useSyncExternalStore(subscribe, current, serverStatus);
}
