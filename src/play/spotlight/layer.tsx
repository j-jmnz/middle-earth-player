// The web build has no Skia canvas (the same split as table-canvas.tsx): it lists the table and plays no spotlight. The phone draws the
// layer in spotlight/layer.native.tsx.
import type { SpotlightLayerProps } from "./handoff.ts";

export function SpotlightLayer(_props: SpotlightLayerProps) {
  return null;
}
