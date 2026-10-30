// The buttons that answer the open moment, in the dock (docs/design-system.md,
// Table, Two taps). One filled capsule always sits in the same place: the confirm of what is picked, or Pass when nothing is.
// A button that sends an intent with nothing picked arms on its first tap: the line above the buttons says what the second
// tap does and a bar runs down under it; the second tap sends, and the bar running out, another button, or a new pick puts
// it back. Arming changes no button's size, so the second tap lands where the first did. The parent keys this component on
// the moment and the pick, so nothing stays armed into the next one.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { armedLines, armedRoom, armedWords, BAR_DENSE_PX, BAR_PX, LINE_PX } from "./armed-room.ts";
import { MORE_ID } from "./dock-extras.ts";
import { tickArmed } from "./haptics.ts";
import { armBarEasing, useMotionScale } from "./motion-run.ts";
import { useScreenReader } from "./screen-reader.ts";
import { PrimaryButton, SecondaryButton, TextButton } from "./buttons.tsx";
import { primaryReady, type Dock, type DockButton } from "./table-choice.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// How long an armed button waits for its second tap; longer while a screen reader is on. That is a timer, not a motion token: the bar
// only shows it running out, on the linear curve of motion-tokens.ts, and does not run under reduced motion (the line says it).
// Quick does not shorten it: the second tap's window stays the same.
const ARM_MS = 3000;
const ARM_READER_MS = 10000;
const HINT = "Tap twice to confirm";
// A moment with one legal answer: the line above the buttons says the one tap sends it.
const ONLY = "The only choice now: one tap sends it";
const ONLY_HINT = "Sends at once";

// The More pill (`dock-more-actions`) folds the quiet pills behind a popover; it is not the "i" pill (`dock-more`) that opens the
// dock's folded note lines (table-dock.tsx).
export type DockExtra = { label: string; testID: string; onPress: () => void; accessibilityLabel?: string };

export function DockButtons({
  dock,
  extras = [],
  more = [],
  onMore,
  picked = null,
  dense = false,
  chars,
  onButton,
}: {
  dock: Dock;
  extras?: readonly DockExtra[];
  // The quiet pills folded behind the More pill (dock-extras.ts, dockPills), and what the pill does: it reports the screen y of its foot.
  more?: readonly DockExtra[];
  onMore?: (foot: number) => void;
  // What is picked, in words: no line on the dock says it (the cards wear their marks, the primary's verb counts them), so a
  // screen reader hears it in the primary's hint.
  picked?: string | null;
  // A short phone (under 400 pt tall): tighter rows, the armed line without its lead-in when that saves a line (dock-budget.ts).
  dense?: boolean;
  // The characters a label line holds at the dock's measured width (dock-budget.ts, labelChars); the estimate when not measured.
  chars?: number;
  onButton: (button: DockButton) => void;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const moreRef = useRef<ComponentRef<typeof View>>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const left = useSharedValue(1);
  const animates = useMotionScale() > 0;
  const reader = useScreenReader();
  // The arm timer and the bar running down stop with the dock.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(left);
    },
    [left],
  );
  const press = (button: DockButton) => {
    if (timer.current) clearTimeout(timer.current);
    if (button.arm && armed !== button.testID) {
      setArmed(button.testID);
      const wait = reader ? ARM_READER_MS : ARM_MS;
      left.set(1);
      if (animates) left.set(withTiming(0, { duration: wait, easing: armBarEasing }));
      timer.current = setTimeout(() => setArmed(null), wait);
      tickArmed();
      // A screen reader hears what the second tap does, the loss a caution names included.
      AccessibilityInfo.announceForAccessibility(button.armed ?? `Tap again: ${button.label}`);
      return;
    }
    setArmed(null);
    onButton(button);
  };
  const extra = (handler: () => void) => () => {
    if (timer.current) clearTimeout(timer.current);
    setArmed(null);
    handler();
  };
  // More folds the quiet pills: it reports where its foot is, so the popover sits level with it.
  const pressMore = () => {
    if (timer.current) clearTimeout(timer.current);
    setArmed(null);
    moreRef.current?.measureInWindow((_x, y, _w, height) => onMore?.(Math.round(y + height)));
  };
  const bar = useAnimatedStyle(() => ({ width: `${Math.round(left.get() * 100)}%` }));
  const primary = dock.primary;
  const hints = [picked ? `Picked: ${picked}` : null, primary?.arm ? HINT : dock.single ? ONLY_HINT : null].filter(Boolean).join(". ");
  const primaryHint = hints === "" ? undefined : hints;
  const armedButton = [primary, ...dock.secondary].find((button) => button?.testID === armed) ?? null;
  const said = (button: DockButton) => armedWords(button.armed ?? `Tap again: ${button.label}`, dense, chars);
  const line = armedButton ? said(armedButton) : (dock.why ?? (dock.single ? ONLY : null));
  // The room holds the longest thing this moment's buttons can say when armed, in full, so arming moves nothing (armed-room.ts).
  const lines = armedLines([...[primary, ...dock.secondary].map((button) => (button?.arm ? said(button) : null)), dock.why, dock.single ? ONLY : null], chars);
  return (
    <View className={dense ? "gap-0" : "gap-0.5"}>
      {/* The armed line, always held: what the armed button's second tap does (a caution names the loss in full), or what the
          primary waits for; the bar that runs down has its own 4 pt under the text. Arming moves nothing. */}
      <View style={{ height: armedRoom(lines, dense, s) }}>
        <View style={{ height: lines * LINE_PX * s, justifyContent: "flex-end" }}>
          {line ? (
            <Text testID={armedButton ? `${armedButton.testID}-armed` : dock.why ? "sheet-why" : "dock-only"} numberOfLines={lines} accessibilityLabel={armedButton ? (armedButton.armed ?? `Tap again: ${armedButton.label}`) : undefined} className={`text-center text-label ${armedButton ? "text-accent" : "text-muted"}`}>
              {line}
            </Text>
          ) : null}
        </View>
        {armedButton ? (
          <View pointerEvents="none" style={{ height: (dense ? BAR_DENSE_PX : BAR_PX) * s, justifyContent: "center", alignItems: "center" }}>
            <Animated.View style={[{ height: 2 * s, backgroundColor: t.accent }, bar]} />
          </View>
        ) : null}
      </View>
      {primary ? (
        <PrimaryButton
          label={primary.label}
          testID={primary.testID}
          dock
          compact={dense}
          disabled={!primaryReady(dock)}
          accessibilityHint={primaryHint}
          onPress={() => press(primary)}
        />
      ) : null}
      {/* The other answers are secondary capsules on a row of their own; the reading aids are text buttons with small muted words on
          one row under it (Undo, Read), which wraps if a third shows. */}
      {dock.secondary.length > 0 ? (
        <View className="flex-row flex-wrap items-center justify-center gap-1.5">
          {dock.secondary.map((button) => (
            <SecondaryButton key={button.testID} label={button.label} testID={button.testID} tight={dense} accessibilityHint={button.arm ? HINT : undefined} onPress={() => press(button)} />
          ))}
        </View>
      ) : null}
      {extras.length > 0 || more.length > 0 ? (
        <View className="flex-row flex-wrap items-center justify-center gap-1">
          {extras.map((item) => (
            <TextButton key={item.testID} label={item.label} testID={item.testID} small tight={dense} tone="muted" accessibilityLabel={item.accessibilityLabel} onPress={extra(item.onPress)} />
          ))}
          {more.length > 0 ? (
            <View ref={moreRef} collapsable={false}>
              <TextButton
                label="More"
                testID={MORE_ID}
                small
                tight={dense}
                tone="muted"
                accessibilityHint={`Lists ${more.map((item) => item.accessibilityLabel ?? item.label).join(", ")}`}
                onPress={pressMore}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
