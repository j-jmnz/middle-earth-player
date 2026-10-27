// The banner over the canvas while the player peeks at the other seat (docs/design-system.md, Table, Peeking; phase 26): a raised night
// pill across the top of the canvas that says whose area this is and who is acting, with a gold text button back to the acting seat.
// It sits on the canvas side, under the top bar and clear of the dock column, so the combat spotlight's scrim (over those two) never
// covers it; the pill takes its own touches, so a tap on it reaches no card under it. It fades in and out over the banner tokens and
// snaps under reduced motion. It holds no state and sends nothing.
import { useEffect, useMemo } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { layoutAnim, useMotionScale } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import type { PeekWords } from "./peek.ts";
import { tableTokens as t } from "./tokens.ts";

const PILL = 44;

export function PeekBanner({ words, top, left, width, onBack }: { words: PeekWords; top: number; left: number; width: number; onBack: () => void }) {
  const scale = useMotionScale();
  const fade = useMemo(() => ({ enter: layoutAnim(FadeIn, MOTION.bannerIn, scale), leave: layoutAnim(FadeOut, MOTION.bannerOut, scale) }), [scale]);
  // Android reads a live region on a view that has just mounted unreliably: announce on both platforms.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${words.text}. ${words.back} is the button to return.`);
  }, [words.text, words.back]);
  return (
    <Animated.View testID="peek-layer" entering={fade.enter} exiting={fade.leave} pointerEvents="box-none" style={{ position: "absolute", top, left, width, alignItems: "center", paddingHorizontal: 8 }}>
      {/* The shadow sits on an outer view: iOS clips a shadow on the view that clips its own corners. */}
      <View style={{ maxWidth: "100%", borderRadius: PILL / 2, backgroundColor: t.raised, shadowColor: t.night, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
        <Pressable testID="peek-banner" accessible={false} style={{ minHeight: PILL, flexDirection: "row", alignItems: "center", borderRadius: PILL / 2, borderWidth: 1, borderColor: t.hairline, paddingLeft: 16, paddingRight: 4 }}>
          <Text testID="peek-text" numberOfLines={2} className="shrink text-label text-bone">
            {words.text}
          </Text>
          <Pressable
            testID="peek-back"
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={words.back}
            onPress={onBack}
            className="min-h-11 items-center justify-center rounded-pill px-3"
            style={({ pressed }) => (pressed ? { backgroundColor: t.pressed } : undefined)}
          >
            <Text className="text-label font-medium text-gold">{words.back}</Text>
          </Pressable>
        </Pressable>
      </View>
    </Animated.View>
  );
}
