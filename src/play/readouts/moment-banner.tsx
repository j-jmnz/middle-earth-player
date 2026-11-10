// The outcome banner over the table (docs/design-system-table.md, Banner): what the last intent did, in beats, for a few
// seconds. A tap or a swipe sends it away (user request, 2026-10-29); the log keeps every step.
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { bannerSpan } from "./banner-span.ts";
import { setBannerHeight } from "./banner-height.ts";
import { layoutAnim, timing, useMotionScale, useReduceMotion } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { CONTAINER_RADIUS } from "../../ui/radius.ts";
import { type Moment } from "../store/outcome.ts";
import { bannerBeatMs } from "./banner-time.ts";
import { bannerLabel, bannerSpeech } from "./banner-speech.ts";
import { LineMark } from "../chrome/table-chrome.tsx";
import { noticeSurface } from "../../ui/surfaces.ts";
import { fillAlpha, type TableTokens } from "../../ui/tokens.ts";
import { tableSettings } from "../../ui/table-settings.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";
import { announce } from "../../ui/announce.ts";
import { useReaderMode } from "../../ui/screen-reader.ts";

const BANNER_WIDTH = 440;
const BANNER_MIN = 260;
// The room it keeps from each side of its band.
const SIDE = 16;
// A swipe this far sideways or up, or a flick, sends the banner away. Medium's sizes, drawn at the UI scale.
const SWIPE_SIDEWAYS = 56;
const SWIPE_UP = 34;
const FLICK = 600;

/**
 * The banner's fill (user request, 2026-10-29): dark and slightly see-through on Dark, a dark red for a failure or an attack
 * (docs/design-system-table.md: the combat banner), with no lit edge and no outline: the red band is its only line. Light keeps its
 * pale panel, a little see-through. Under the phone's Reduce Transparency both are opaque (fillAlpha).
 */
function bannerFill(t: TableTokens, tone: Moment["tone"]) {
  const plain = noticeSurface(0.9, t);
  if (t.depth === "light" || tone !== "bad") return plain;
  return { ...plain, backgroundColor: `rgba(26,10,9,${fillAlpha(t, 0.9)})` };
}

/**
 * What the last intent did, centered on the screen at its top edge for a few seconds, clear of `leftClear` and `rightClear` (the
 * left inset; the right inset and the command column with its tray), narrower than its 260 pt floor when the middle leaves less
 * room (banner-span.ts), over the top bar, the table and any open panel. `top` is
 * where it hangs. A tap, or a swipe sideways or up, dismisses it (`onDismiss`). The caller keys it on the moment, so each one
 * enters and is announced.
 */
export function MomentBanner({
  moment,
  top,
  leftClear,
  rightClear,
  onBeat,
  onDismiss,
}: {
  moment: Moment;
  top: number;
  leftClear: number;
  rightClear: number;
  onBeat?: (cards: readonly string[]) => void;
  onDismiss: () => void;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const screen = useWindowDimensions();
  const { left, right } = bannerSpan(screen.width, BANNER_WIDTH * s + 2 * SIDE, leftClear, rightClear);
  const room = Math.max(0, screen.width - left - right - 2 * SIDE);
  const label = bannerLabel(moment);
  // The phone's reader never sees the spotlight, so it hears the banner's title and then each line as its own announcement, in order, through
  // the queue (banner-speech.ts); every other listener (the web list included) hears the label at once, as it always has.
  const reader = useReaderMode();
  // A live region is Android's only and is not read reliably on a view that has just mounted: announce on both platforms.
  const say = useEffectEvent(() => {
    if (reader) for (const line of bannerSpeech(moment)) announce(line);
    else announce(label);
  });
  useEffect(() => say(), [label, reader]);
  // The fades: the banner and each line come in and the banner goes out over MOTION.bannerIn and bannerOut.
  const scale = useMotionScale();
  const fade = useMemo(() => ({ enter: layoutAnim(FadeInDown, MOTION.bannerIn, scale), leave: layoutAnim(FadeOut, MOTION.bannerOut, scale) }), [scale]);
  // The swipe: the banner follows the finger, and past the distance (or on a flick) slides off and is dismissed; short of it, it
  // springs back. A downward drag only stretches a little, since down is not a way out. A tap dismisses it where it stands.
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const gesture = useMemo(() => {
    // Worked out here, on the JS thread: the pan's callbacks run on the UI thread, where calling a plain function (timing) closes the
    // app (user report, 2026-10-29: a swipe closed it, a tap did not).
    const out = timing(MOTION.bannerOut, scale);
    const width = BANNER_WIDTH * s;
    const tap = Gesture.Tap().onEnd((_event, success) => {
      if (success) scheduleOnRN(onDismiss);
    });
    const pan = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .activeOffsetY([-10, 10])
      .onUpdate((event) => {
        dx.set(event.translationX);
        dy.set(Math.min(event.translationY, 8 * s));
      })
      .onEnd((event) => {
        const sideways = Math.abs(event.translationX) > SWIPE_SIDEWAYS * s || Math.abs(event.velocityX) > FLICK * s;
        const up = event.translationY < -SWIPE_UP * s || event.velocityY < -FLICK * s;
        if (!sideways && !up) {
          dx.set(withSpring(0));
          dy.set(withSpring(0));
          return;
        }
        const done = (finished?: boolean) => {
          "worklet";
          if (finished) scheduleOnRN(onDismiss);
        };
        // Up wins when the drag went mostly up.
        if (sideways && !(up && Math.abs(event.translationY) > Math.abs(event.translationX))) dx.set(withTiming(Math.sign(event.translationX || event.velocityX) * (width + 200 * s), out, done));
        else dy.set(withTiming(-(top + 200 * s), out, done));
      });
    return Gesture.Race(pan, tap);
  }, [dx, dy, s, top, scale, onDismiss]);
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { translateY: dy.get() }],
    opacity: 1 - Math.min(0.6, Math.abs(dx.get()) / (BANNER_WIDTH * s)),
  }));
  // Resolve in beats: one line more every beat (banner-time.ts), each ringing on the table the cards it names; reduced motion shows all.
  const reduceMotion = useReduceMotion();
  const speed = useStore(tableSettings, (state) => state.settings.animationSpeed);
  const [shownLines, setShownLines] = useState(reduceMotion ? moment.lines.length : 1);
  useEffect(() => {
    if (shownLines >= moment.lines.length) return;
    const timer = setTimeout(() => setShownLines((count) => count + 1), bannerBeatMs(speed));
    return () => clearTimeout(timer);
  }, [shownLines, moment.lines.length, speed]);
  // The list table keeps its rows under the banner's height while it is up (banner-height.ts).
  useEffect(() => () => setBannerHeight(0), []);
  const beatCards = moment.lines[Math.max(0, shownLines - 1)]?.cards ?? [];
  const beatKey = beatCards.join(",");
  useEffect(() => {
    onBeat?.(beatKey === "" ? [] : beatKey.split(","));
    return () => onBeat?.([]);
  }, [beatKey, onBeat]);
  return (
    <Animated.View entering={fade.enter} exiting={fade.leave} pointerEvents="box-none" onLayout={(event) => setBannerHeight(Math.round(event.nativeEvent.layout.height))} style={{ position: "absolute", top, left, right, alignItems: "center", paddingHorizontal: SIDE }}>
      <GestureDetector gesture={gesture}>
        {/* The shadow sits on an outer view: iOS clips a shadow on the view that clips its own corners. */}
        {/* The corners are a style: a class on a reanimated view does not apply. */}
        <Animated.View style={[{ minWidth: Math.min(BANNER_MIN * s, room), maxWidth: room, borderRadius: CONTAINER_RADIUS * s, ...bannerFill(t, moment.tone) }, swipeStyle]}>
          <View
            testID="moment"
            accessible
            accessibilityLabel={label}
            accessibilityActions={[{ name: "escape", label: "Dismiss" }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "escape") onDismiss();
            }}
            onAccessibilityEscape={onDismiss}
            className="overflow-hidden rounded-container"
          >
            {/* The combat banner (a failure or an attack) keeps its 3 pt threat-red band along the top. */}
            {moment.tone === "bad" ? <View style={{ height: 3 * s, backgroundColor: t.threat }} /> : null}
            <View className={`items-center px-4 pb-2 ${moment.tone === "bad" ? "pt-1.5" : "pt-2.5"}`}>
              <Text testID="moment-title" className="text-center font-display text-heading text-bone" style={{ lineHeight: 24 * s }}>
                {moment.title}
              </Text>
              {moment.lines.slice(0, shownLines).map((line, index) => (
                <Animated.View key={index} entering={fade.enter} className="mt-0.5 flex-row items-center gap-2">
                  <LineMark mark={line.mark} tint="bone" size={14 * s} />
                  <Text className="shrink text-label text-bone">{line.text}</Text>
                </Animated.View>
              ))}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
