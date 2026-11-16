// The phone has Skia built in: nothing to load, so the table's entry points (play/canvas/table-canvas.tsx, play/spotlight/layer.tsx) are always ready.
// The web half is skia-web.ts.
import type { CanvasKitStatus } from "./skia-web.ts";

export type { CanvasKitStatus };

export function startCanvasKit(): void {}

export function useCanvasKit(): CanvasKitStatus {
  return "ready";
}
