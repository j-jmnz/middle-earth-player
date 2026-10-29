// The banner over the canvas while the player peeks at the other seat (docs/design-system.md, Table, Peeking; phase 26): a raised night
// pill across the top of the canvas that says whose area this is and who is acting, with an accent text button back to the acting seat.
// It sits on the canvas side, under the top bar and clear of the dock column, so the combat spotlight's scrim (over those two) never
// covers it. It is 36 pt tall and takes no touch of its own: only `peek-back` does (a 36 pt button with 4 pt of slop above and below,
// a 44 pt target), so the cards under the rest of the pill stay tappable and it hides as little of the staging row as it can. Both
// words are one line, at most 1.3 times the system font scale, so the pill never grows past the room the table keeps for it. It fades
// in and out over the banner tokens and snaps under reduced motion. It holds no state and sends nothing.
import { useEffect, useMemo } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { layoutAnim, useMotionScale } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import type { PeekWords } from "./peek.ts";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// Medium's sizes; the banner draws them times the UI scale (ui-scale.ts), and callers scale PEEK_TOP.
const PILL = 36;
/** The gap between the top bar and the pill. */
export const PEEK_TOP = 2;
const SCALE = 1.3;

export function PeekBanner({ words, top, left, width, onBack }: { words: PeekWords; top: number; left: number; width: number; onBack: () => void }) {
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const pill = PILL * s;
  // The back button is 36 pt tall at Medium with 4 pt of slop each side, a 44 pt target; at any scale its slop makes up the difference.
  const slop = touchSlop(s, pill);
  const fade = useMemo(() => ({ enter: layoutAnim(FadeIn, MOTION.bannerIn, scale), leave: layoutAnim(FadeOut, MOTION.bannerOut, scale) }), [scale]);
  // Android reads a live region on a view that has just mounted unreliably: announce on both platforms.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${words.text}. ${words.back} is the button to return.`);
  }, [words.text, words.back]);
  return (
    <Animated.View testID="peek-layer" entering={fade.enter} exiting={fade.leave} pointerEvents="box-none" style={{ position: "absolute", top, left, width, alignItems: "center", paddingHorizontal: 8 * s }}>
      {/* The shadow sits on an outer view: iOS clips a shadow on the view that clips its own corners. */}
      <View pointerEvents="box-none" style={{ maxWidth: "100%", borderRadius: pill / 2, backgroundColor: t.raised, shadowColor: t.night, shadowOpacity: 0.9, shadowRadius: 12 * s, shadowOffset: { width: 0, height: 4 * s }, elevation: 8 }}>
        <View testID="peek-banner" pointerEvents="box-none" style={{ height: pill, flexDirection: "row", alignItems: "center", borderRadius: pill / 2, paddingLeft: 16 * s, paddingRight: 2 * s }}>
          <Text testID="peek-text" numberOfLines={1} maxFontSizeMultiplier={SCALE} className="pointer-events-none shrink text-label text-bone">
            {words.text}
          </Text>
          <Pressable
            testID="peek-back"
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={words.back}
            hitSlop={{ top: slop, bottom: slop }}
            onPress={onBack}
            className="h-9 shrink-0 items-center justify-center rounded-pill px-3"
            style={({ pressed }) => (pressed ? { backgroundColor: t.pressed } : undefined)}
          >
            <Text numberOfLines={1} maxFontSizeMultiplier={SCALE} className="text-label font-medium text-accent">
              {words.back}
            </Text>
          </Pressable>
          {/* The hairline edge is drawn over the pill, so it takes no room and no touch. */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: pill / 2, borderWidth: 1, borderColor: t.hairline }]} />
        </View>
      </View>
    </Animated.View>
  );
}
