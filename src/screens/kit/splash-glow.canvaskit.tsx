// The splash on the web and the desktop (splash-glow.tsx is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only). It draws the
// phone's splash and, after the first paint, starts loading CanvasKit (ui/skia/skia-web.ts), so the table's Skia files are imported once it has. The splash mounts with the
// root layout and stays through the first screen, so the frame it waits for is the first one. The phone has Skia built in and loads nothing. It also starts the
// page stylesheet (the focus ring, the dock "i" hit area: ui/web/page-styles.ts) and the watch that makes the table inert behind a full-screen layer (ui/web/modal-layers.ts).
import { useEffect } from "react";

import { startCanvasKit } from "../../ui/skia/skia-web";
import { startModalLayers } from "../../ui/web/modal-layers";
import { startPageStyles } from "../../ui/web/page-styles";
import { SplashGlow as PhoneSplashGlow } from "./splash-glow";

export function SplashGlow(props: Parameters<typeof PhoneSplashGlow>[0]) {
  useEffect(() => {
    startPageStyles();
    startModalLayers();
    const frame = requestAnimationFrame(startCanvasKit);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <PhoneSplashGlow {...props} />;
}
