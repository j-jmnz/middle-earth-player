// The last move's line in the command column's head (docs/design-system-table.md, Last move): what the last intent did that the table does not
// show, as a title and one or two rows of words, or folded into one run of text (the title, then the words, on two rows at most) where the head is short. It floats over no part of the table but the band a covered row may hold when the head has no room (command-head.ts, movePlan), nothing times it, and a tap
// opens the Log. It draws the lean telling only (store/outcome.ts, momentsOf); a screen reader hears the full one (table-hooks.ts).
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { bannerLabel } from "./banner-speech.ts";
import { layoutAnim, useMotionScale } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { ITEM_RADIUS } from "../../ui/radius.ts";
import type { Moment } from "../store/outcome.ts";
import { noticeSurface } from "../../ui/surfaces.ts";
import { fillAlpha, type TableTokens } from "../../ui/tokens.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

/** The line's fill: the notice surface, a dark red for a failure or an attack on Dark; opaque under the phone's Reduce Transparency (fillAlpha). */
function moveFill(t: TableTokens, tone: Moment["tone"], pressed: boolean) {
  const plain = noticeSurface(0.9, t);
  if (pressed) return { ...plain, backgroundColor: t.pressed };
  if (t.depth === "light" || tone !== "bad") return plain;
  return { ...plain, backgroundColor: `rgba(26,10,9,${fillAlpha(t, 0.9)})` };
}

/** The rows of a line as one sentence of words. */
export function moveWords(moment: Moment): string {
  return moment.lines.map((line) => line.text).join(" · ");
}

export function LastMove({ moment, row, onPress }: { moment: Moment; row: boolean; onPress: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const scale = useMotionScale();
  const fade = useMemo(() => ({ enter: layoutAnim(FadeIn, MOTION.bannerIn, scale), leave: layoutAnim(FadeOut, MOTION.bannerOut, scale) }), [scale]);
  const words = moveWords(moment);
  return (
    <Animated.View entering={fade.enter} exiting={fade.leave}>
      <Pressable testID="moment" accessibilityRole="button" accessibilityLabel={bannerLabel(moment)} accessibilityHint="Opens the log" onPress={onPress}>
        {/* The fill is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
        {({ pressed }) => (
          <View style={{ borderRadius: ITEM_RADIUS * s, overflow: "hidden", ...moveFill(t, moment.tone, pressed) }}>
            {/* A failure or an attack keeps the 3 pt threat-red band along the top. */}
            {moment.tone === "bad" ? <View style={{ height: 3 * s, backgroundColor: t.threat }} /> : null}
            {row ? (
              <Text testID="moment-title" numberOfLines={2} className="px-3 py-1.5 text-label text-bone">
                <Text className="font-display text-label text-bone">{moment.title}</Text>
                {words === "" ? "" : ` · ${words}`}
              </Text>
            ) : (
              <View className="px-3 py-1.5">
                <Text testID="moment-title" numberOfLines={1} className="font-display text-body text-bone">
                  {moment.title}
                </Text>
                {words === "" ? null : (
                  <Text testID="moment-words" numberOfLines={2} className="text-label text-bone">
                    {words}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
