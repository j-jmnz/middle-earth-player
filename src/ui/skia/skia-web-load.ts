// The web's CanvasKit load (skia-web.ts imports it on the web only): the wasm from the app's own origin, then the shims. The shims import Skia,
// which builds its API from the loaded CanvasKit when it first runs, so they are imported only after the load.
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web/LoadSkiaWeb";

export async function loadCanvasKit(): Promise<void> {
  await LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" });
  const { installWebShims } = await import("./web-shims.ts");
  installWebShims();
}
