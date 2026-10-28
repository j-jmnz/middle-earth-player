// The Reanimated side of the motion tokens (motion-tokens.ts): the same names, handed to withTiming, withSpring and the layout
// animations (FadeIn, SlideInDown, ...), and the hook that reads the speed setting and reduced motion once. Nothing here holds a
// number: a length comes from a token and the scale (motionScale), and a scale of 0 (reduced motion) snaps.
import { Easing, ReduceMotion, useReducedMotion, useSharedValue, withTiming, type EasingFunction, type SharedValue } from "react-native-reanimated";
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { ARM_BAR_EASING, motionScale, ms, SHAPE, springTune, timed, type EasingName, type Timeable, type Spring, type Tween } from "./motion-tokens.ts";
import { tableSettings } from "./table-settings.ts";

const EASINGS: Readonly<Record<EasingName, EasingFunction>> = {
  linear: Easing.linear,
  outCubic: Easing.out(Easing.cubic),
  inCubic: Easing.in(Easing.cubic),
  outQuad: Easing.out(Easing.quad),
  inQuad: Easing.in(Easing.quad),
  outBack: Easing.out(Easing.back(SHAPE.backOvershoot)),
};

/** Reanimated's version of a named curve. */
export function easingOf(name: EasingName): EasingFunction {
  return EASINGS[name];
}

/** A withTiming config for a token at a scale: its length, and its curve when it names one. */
export function timing(token: Tween, scale: number): { duration: number; easing?: EasingFunction } {
  return token.easing ? { duration: ms(token, scale), easing: easingOf(token.easing) } : { duration: ms(token, scale) };
}

/** The linear curve of the dock's armed bar. */
export const armBarEasing: EasingFunction = EASINGS[ARM_BAR_EASING];

/** A withSpring config for a spring token at a scale: the same damping ratio, settling in `scale` times as long. */
export function springConfig(token: Spring, scale: number): { mass: number; stiffness: number; damping: number } {
  return springTune({ ms: Math.max(1, token.ms * scale), zeta: token.zeta });
}

// What a layout animation builder (FadeIn, SlideInDown, ...) offers: each call changes the builder and returns it.
type Builder = { easing(curve: EasingFunction): unknown; reduceMotion(reduce: ReduceMotion): unknown };

/** A layout animation (FadeIn, SlideInDown, ...) of a token's length and curve, snapping under reduced motion (the system's, or the override). */
export function layoutAnim<C extends new () => Builder>(base: C, token: Tween, scale: number): InstanceType<C> {
  const sized = timed(base as unknown as Timeable<InstanceType<C>>, token, scale);
  if (token.easing) sized.easing(easingOf(token.easing));
  // The Reduce motion override (user request, 2026-10-28) is read here, not from a hook: a scale of 0 rebuilds the builder anyway.
  sized.reduceMotion(tableSettings.getState().settings.reduceMotion === "always" ? ReduceMotion.Always : ReduceMotion.System);
  return sized;
}

/** Reduced motion: the phone's setting, or the Reduce motion override set to Always (user request, 2026-10-28). */
export function useReduceMotion(): boolean {
  const always = useStore(tableSettings, (state) => state.settings.reduceMotion === "always");
  // Reanimated reads the phone's value once; the first frame uses it, then the phone's setting is followed live.
  const [system, setSystem] = useState(useReducedMotion());
  useEffect(() => {
    let current = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (current) setSystem(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystem);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return system || always;
}

/** The motion scale now: the Animation speed setting and reduced motion read together (1 Normal, 0.6 Quick, 0 reduced). */
export function useMotionScale(): number {
  const speed = useStore(tableSettings, (state) => state.settings.animationSpeed);
  const reduced = useReduceMotion();
  return motionScale(speed, reduced);
}

/**
 * The 0..1 progress of something that opens and closes (the tray, the menu, the carousel): up over `enter`, down over `leave`,
 * decelerating in and accelerating out. `leaving` holds it mounted while it runs down. With the scale at 0 it snaps and is never
 * mounted for an exit.
 */
export function useOpenMotion(open: boolean, enter: Tween, leave: Tween): { progress: SharedValue<number>; leaving: boolean; scale: number } {
  const scale = useMotionScale();
  // Mounted while it leaves, set while rendering when `open` turns off.
  const [wasOpen, setWasOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && scale > 0);
  }
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    if (scale === 0) progress.set(open ? 1 : 0);
    else if (open) progress.set(withTiming(1, timing(enter, scale)));
    else
      progress.set(
        withTiming(0, timing(leave, scale), (finished) => {
          if (finished) scheduleOnRN(setLeaving, false);
        }),
      );
  }, [open, scale, progress, enter, leave]);
  return { progress, leaving, scale };
}
