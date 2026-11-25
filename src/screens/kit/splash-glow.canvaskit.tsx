// The splash on the web and the desktop (metro.config.js serves this file in place of splash-glow.tsx on the web platform only). It draws the phone's splash
// (docs/design-system.md, Splash) with CSS animations and transitions on opacity and transform, which the browser's compositor runs: a page has one thread, and
// while it opens the databases and mounts the hubs a Reanimated breath would stand still. The halo's wrapper comes in once, the halo breathes inside it, and when
// loading ends the breath holds its frame, a second halo flares over it and the black fades; a timer as long as the fade unmounts the splash.
// The exported page already holds the splash, drawn with no motion (the server cannot know the reader's Reduce motion); the breath starts once the page's
// script has taken the page over and read it, as the phone's still splash gives way to the breathing one.
// After the first paint (or when the splash goes, if no frame came first) it also starts loading CanvasKit (ui/skia/skia-web.ts), so the table's Skia files are imported once it has. The splash mounts with the
// root layout and stays through the first screen, so the frame it waits for is the first one. The phone has Skia built in and loads nothing. It also starts the
// page stylesheet (the focus ring, the dock "i" hit area: ui/web/page-styles.ts) and the watch that makes the table inert behind a full-screen layer (ui/web/modal-layers.ts).
import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";

import { MOTION, ms, type EasingName } from "../../ui/motion-tokens";
import { useMotionScale } from "../../ui/motion-run";
import { startCanvasKitOnFrame } from "../../ui/skia/skia-web";
import { startModalLayers } from "../../ui/web/modal-layers";
import { startPageStyles } from "../../ui/web/page-styles";
import { FLARE_GROW, HALO_BLUR, HALO_GROW, HALO_HIGH, HALO_LOW, RING, RING_WIDTH, SPLASH_BLACK, type SplashProps } from "./splash-glow";

// The curves the splash tokens name, as CSS (the same cubic and sine curves Reanimated's Easing draws).
const CURVES: Partial<Record<EasingName, string>> = {
  outCubic: "cubic-bezier(0.33, 1, 0.68, 1)",
  inOutSine: "cubic-bezier(0.37, 0, 0.63, 1)",
  inQuad: "cubic-bezier(0.11, 0, 0.5, 0)",
};
const curveOf = (name: EasingName | null): string => (name ? CURVES[name] ?? "linear" : "linear");

// react-native-web's animation and transition styles, which React Native's style types do not list.
const web = (style: Record<string, unknown>): ViewStyle => style as ViewStyle;

// The two keyframes rules, added to the page once (as the backdrop's fog adds its drift: art/backdrop.tsx). Only a live page asks, so the server writes none.
const RAMP_IN = "splash-ramp-in";
const BREATH = "splash-breath";
let keyframesWritten = false;
function writeKeyframes(): void {
  if (keyframesWritten) return;
  keyframesWritten = true;
  const style = document.createElement("style");
  style.textContent =
    `@keyframes ${RAMP_IN} { from { opacity: 0; } to { opacity: 1; } }\n` +
    `@keyframes ${BREATH} { from { opacity: ${HALO_LOW}; transform: scale(1); } to { opacity: ${HALO_HIGH}; transform: scale(${1 + HALO_GROW}); } }`;
  document.head.appendChild(style);
}

// False in the exported page and in the render that takes it over, true from then on.
const never = (): (() => void) => () => {};
const onPage = (): boolean => true;
const onServer = (): boolean => false;

export function SplashGlow({ loading, onShown, onDone }: SplashProps) {
  const live = useSyncExternalStore(never, onPage, onServer);
  const speed = useMotionScale();
  const scale = live ? speed : 0;
  const finish = useEffectEvent(() => onDone());

  useEffect(() => {
    startPageStyles();
    startModalLayers();
    return startCanvasKitOnFrame();
  }, []);

  // The black has faded (or, under reduced motion, went in one step): unmount.
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(finish, ms(MOTION.splashFade, scale));
    return () => clearTimeout(timer);
  }, [loading, scale]);

  const moving = scale > 0;
  if (moving) writeKeyframes();
  const veil = web({
    opacity: loading ? 1 : 0,
    transitionProperty: "opacity",
    transitionDuration: `${ms(MOTION.splashFade, scale)}ms`,
    transitionTimingFunction: curveOf(MOTION.splashFade.easing),
  });
  const rampIn = web({
    animationName: RAMP_IN,
    animationDuration: `${ms(MOTION.splashRampIn, scale)}ms`,
    animationTimingFunction: curveOf(MOTION.splashRampIn.easing),
    animationFillMode: "both",
  });
  const breath = web({
    animationName: BREATH,
    animationDuration: `${ms(MOTION.splashBreath, scale)}ms`,
    animationTimingFunction: curveOf(MOTION.splashBreath.easing),
    animationIterationCount: "infinite",
    animationDirection: "alternate",
    animationPlayState: loading ? "running" : "paused",
  });
  const flare = web({
    opacity: loading ? 0 : 1,
    transform: `scale(${loading ? 1 : 1 + HALO_GROW + FLARE_GROW})`,
    transitionProperty: "opacity, transform",
    transitionDuration: `${ms(MOTION.splashFlare, scale)}ms`,
    transitionTimingFunction: curveOf(MOTION.splashFlare.easing),
  });

  return (
    <View pointerEvents={loading ? "auto" : "none"} accessible accessibilityLabel="Loading" style={[StyleSheet.absoluteFill, styles.veil, veil]}>
      <View style={styles.ring}>
        <View style={[styles.layer, moving ? rampIn : null]}>
          <View style={[styles.layer, moving ? breath : styles.steady]}>
            <Image source={RING} blurRadius={HALO_BLUR} accessible={false} style={styles.picture} />
          </View>
        </View>
        {moving ? (
          <View style={[styles.layer, flare]}>
            <Image source={RING} blurRadius={HALO_BLUR} accessible={false} style={styles.picture} />
          </View>
        ) : null}
        <Image source={RING} accessible={false} onLoad={onShown} onError={onShown} style={styles.picture} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: SPLASH_BLACK, alignItems: "center", justifyContent: "center" },
  ring: { width: RING_WIDTH, height: RING_WIDTH },
  layer: { position: "absolute", left: 0, top: 0, width: RING_WIDTH, height: RING_WIDTH },
  // Reduced motion: the halo holds the middle of a breath.
  steady: { opacity: (HALO_LOW + HALO_HIGH) / 2 },
  // Sized, not stretched: the web build gives a required picture its own 512 px size unless the style names one.
  picture: { position: "absolute", left: 0, top: 0, width: RING_WIDTH, height: RING_WIDTH },
});
