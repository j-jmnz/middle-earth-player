// The web's CanvasKit load (skia-web.ts imports it on the web only): the wasm from the app's own origin, then the shims. The shims import Skia,
// which builds its API from the loaded CanvasKit when it first runs, so they are imported only after the load.
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web/LoadSkiaWeb";

import { applyRenderControls, watchDraws } from "../web/render-scale.ts";

export async function loadCanvasKit(): Promise<void> {
  // The web app's test controls (render-scale.ts): the drawing scale must be set before a Skia view reads the device's.
  if (process.env.EXPO_PUBLIC_WEBAPP === "1") applyRenderControls();
  await LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" });
  const { installWebShims } = await import("./web-shims.ts");
  installWebShims();
  if (process.env.EXPO_PUBLIC_WEBAPP === "1") {
    // The test meter times Skia's recording of each canvas (render-scale.ts, watchDraws).
    const { Skia } = await import("@shopify/react-native-skia");
    watchDraws(Skia as unknown as Parameters<typeof watchDraws>[0]);
  }
}
