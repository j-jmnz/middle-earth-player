// The splash ring's glow while the app opens (docs/design-system.md, Splash). The native splash is a still picture, so this draws the
// same frame over everything (black, the ring 120 pt wide in the middle, as app.json's expo-splash-screen entry sets it); once its ring
// has drawn, the root layout hides the native one under it, which no one can see. A blurred copy of the ring behind it breathes while
// `loading`; when loading ends the halo flares, the black fades over the first screen, and `onDone` unmounts it.
import { useEffect, useEffectEvent } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { MOTION } from "../../ui/motion-tokens.ts";
import { timing, useMotionScale } from "../../ui/motion-run.ts";

const RING = require("../../../assets/images/splash-icon.png") as number;
// app.json, expo-splash-screen: `imageWidth` and `backgroundColor`. The picture is square.
const RING_WIDTH = 120;
const SPLASH_BLACK = "black";
// The halo: the ring blurred, a little larger than it, between these strengths over a breath; under reduced motion it holds the middle.
const HALO_BLUR = 10;
const HALO_LOW = 0.2;
const HALO_HIGH = 0.9;
const HALO_GROW = 0.04;
const FLARE_GROW = 0.1;

type Props = {
  /** True while the databases open; false starts the flare and the fade. */
  loading: boolean;
  /** The ring has drawn (or could not): the native splash may hide. */
  onShown: () => void;
  /** The fade has finished: unmount this. */
  onDone: () => void;
};

export function SplashGlow({ loading, onShown, onDone }: Props) {
  const scale = useMotionScale();
  // The halo's strength coming in (0..1), its breath (0..1), the flare at the end (0..1) and the black's opacity.
  const rampIn = useSharedValue(0);
  const breath = useSharedValue(0);
  const flare = useSharedValue(0);
  const veil = useSharedValue(1);
  const finish = useEffectEvent(() => onDone());

  useEffect(() => {
    if (!loading) return;
    rampIn.set(withTiming(1, timing(MOTION.splashRampIn, scale)));
    if (scale === 0) breath.set(0.5);
    else {
      breath.set(0);
      breath.set(withRepeat(withTiming(1, timing(MOTION.splashBreath, scale)), -1, true));
    }
    return () => {
      cancelAnimation(rampIn);
      cancelAnimation(breath);
    };
  }, [loading, scale, rampIn, breath]);

  useEffect(() => {
    if (loading) return;
    if (scale === 0) {
      veil.set(0);
      finish();
      return;
    }
    flare.set(withTiming(1, timing(MOTION.splashFlare, scale)));
    veil.set(
      withTiming(0, timing(MOTION.splashFade, scale), (finished) => {
        if (finished) scheduleOnRN(finish);
      }),
    );
    return () => {
      cancelAnimation(flare);
      cancelAnimation(veil);
    };
  }, [loading, scale, flare, veil]);

  const haloStyle = useAnimatedStyle(() => {
    const strength = rampIn.get() * (HALO_LOW + (HALO_HIGH - HALO_LOW) * breath.get());
    const lit = flare.get();
    return {
      opacity: strength + (1 - strength) * lit,
      transform: [{ scale: 1 + HALO_GROW * breath.get() + FLARE_GROW * lit }],
    };
  });
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));

  return (
    <Animated.View
      pointerEvents={loading ? "auto" : "none"}
      accessible
      accessibilityLabel="Loading"
      style={[StyleSheet.absoluteFill, styles.veil, veilStyle]}
    >
      <View style={styles.ring}>
        <Animated.Image source={RING} blurRadius={HALO_BLUR} accessible={false} style={[styles.picture, haloStyle]} />
        <Image source={RING} accessible={false} onLoad={onShown} onError={onShown} style={styles.picture} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: SPLASH_BLACK, alignItems: "center", justifyContent: "center" },
  ring: { width: RING_WIDTH, height: RING_WIDTH },
  // Sized, not stretched: the web build gives a required picture its own 512 px size unless the style names one.
  picture: { position: "absolute", left: 0, top: 0, width: RING_WIDTH, height: RING_WIDTH },
});
