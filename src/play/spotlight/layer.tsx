// The web build's spotlight layer (the phone's file is spotlight/layer.native.tsx, which draws with Skia). It is a gate like
// canvas/table-canvas.tsx: nothing until CanvasKit is loaded (ui/skia-web.ts), then the Skia file, imported by its explicit path.
import { lazy, memo, Suspense } from "react";

import { useCanvasKit } from "../../ui/skia-web.ts";
import type { SpotlightLayerProps } from "./handoff.ts";

const Drawn = lazy(() => import("./layer.native.tsx").then((module) => ({ default: module.SpotlightLayer })));

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
