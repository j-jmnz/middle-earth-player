// The web build's spotlight layer (the phone's file is spotlight/layer.native.tsx, which draws with Skia). It is a gate like
// canvas/table-canvas.tsx: nothing until CanvasKit is loaded (ui/skia/skia-web.ts), then the Skia file, imported by its explicit path. The Skia
// file is held-layer.tsx, which keeps one canvas mounted between spotlights and warms it (the phone's layer.native.tsx mounts it while one plays).
import { lazy, memo, Suspense } from "react";

import { useCanvasKit } from "../../ui/skia/skia-web.ts";
import type { SpotlightLayerProps } from "./handoff.ts";

const Drawn = lazy(() => import("./held-layer.tsx").then((module) => ({ default: module.HeldSpotlightLayer })));

function LayerOrNothing(props: SpotlightLayerProps) {
  const status = useCanvasKit();
  if (status !== "ready") return null;
  return (
    <Suspense fallback={null}>
      <Drawn {...props} />
    </Suspense>
  );
}

export const SpotlightLayer = memo(LayerOrNothing);
