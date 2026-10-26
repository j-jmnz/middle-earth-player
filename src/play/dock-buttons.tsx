// The buttons that answer the open moment, in the dock (docs/design-system.md,
// Table, Two taps). One filled pill always sits in the same place: the confirm of what is picked, or Pass when nothing is.
// A button that sends an intent with nothing picked arms on its first tap: the line above the buttons says what the second
// tap does and a bar runs down under it; the second tap sends, and the bar running out, another button, or a new pick puts
// it back. Arming changes no button's size, so the second tap lands where the first did. The parent keys this component on
// the moment and the pick, so nothing stays armed into the next one.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { armedLines, armedRoom, armedWords, BAR_DENSE_PX, BAR_PX, LINE_PX } from "./armed-room.ts";
import { MORE_ID } from "./dock-extras.ts";
import { tickArmed } from "./haptics.ts";
import { useScreenReader } from "./screen-reader.ts";
import { ChromeButton, ChromePrimary } from "./sheet-paper.tsx";
import { primaryReady, type Dock, type DockButton } from "./table-choice.ts";
import { tableTokens as t } from "./tokens.ts";

// How long an armed button waits for its second tap; longer while a screen reader is on.
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
  onButton: (button: DockButton) => void;
}) {
  const moreRef = useRef<ComponentRef<typeof View>>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const left = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const reader = useScreenReader();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const press = (button: DockButton) => {
    if (timer.current) clearTimeout(timer.current);
    if (button.arm && armed !== button.testID) {
      setArmed(button.testID);
      const wait = reader ? ARM_READER_MS : ARM_MS;
      left.set(1);
      if (!reduceMotion) left.set(withTiming(0, { duration: wait, easing: Easing.linear }));
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
  const armedButton = [primary, ...dock.secondary].find((button) => button?.testID === armed) ?? null;
  const said = (button: DockButton) => armedWords(button.armed ?? `Tap again: ${button.label}`, dense);
  const line = armedButton ? said(armedButton) : (dock.why ?? (dock.single ? ONLY : null));
  // The room holds the longest thing this moment's buttons can say when armed, in full, so arming moves nothing (armed-room.ts).
  const lines = armedLines([...[primary, ...dock.secondary].map((button) => (button?.arm ? said(button) : null)), dock.why, dock.single ? ONLY : null]);
  return (
    <View className={dense ? "gap-0" : "gap-0.5"}>
      {/* The armed line, always held: what the armed button's second tap does (a caution names the loss in full), or what the
          primary waits for; the bar that runs down has its own 4 pt under the text. Arming moves nothing. */}
      <View style={{ height: armedRoom(lines, dense) }}>
        <View style={{ height: lines * LINE_PX, justifyContent: "flex-end" }}>
          {line ? (
            <Text testID={armedButton ? `${armedButton.testID}-armed` : dock.why ? "sheet-why" : "dock-only"} numberOfLines={lines} accessibilityLabel={armedButton ? (armedButton.armed ?? `Tap again: ${armedButton.label}`) : undefined} className={`text-center text-label ${armedButton ? "text-gold" : "text-muted"}`}>
              {line}
            </Text>
          ) : null}
        </View>
        {armedButton ? (
          <View pointerEvents="none" style={{ height: dense ? BAR_DENSE_PX : BAR_PX, justifyContent: "center", alignItems: "center" }}>
            <Animated.View style={[{ height: 2, backgroundColor: t.gold }, bar]} />
          </View>
        ) : null}
      </View>
      {primary ? (
        <ChromePrimary
          label={primary.label}
          testID={primary.testID}
          compact
          tight={dense}
          disabled={!primaryReady(dock)}
          accessibilityHint={[picked ? `Picked: ${picked}` : null, primary.arm ? HINT : dock.single ? ONLY_HINT : null].filter(Boolean).join(". ") || undefined}
          onPress={() => press(primary)}
        />
      ) : null}
      {/* The other answers are outlined pills on a row of their own; the reading aids are quieter pills on one row under it (short
          words: Undo, Read), which wraps if a third shows. */}
      {dock.secondary.length > 0 ? (
        <View className="flex-row flex-wrap items-center justify-center gap-1.5">
          {dock.secondary.map((button) => (
            <ChromeButton key={button.testID} label={button.label} testID={button.testID} variant="outline" tight={dense} tone={armed === button.testID ? "gold" : "bone"} accessibilityHint={button.arm ? HINT : undefined} onPress={() => press(button)} />
          ))}
        </View>
      ) : null}
      {extras.length > 0 || more.length > 0 ? (
        <View className="flex-row flex-wrap items-center justify-center gap-1.5">
          {extras.map((item) => (
            <ChromeButton key={item.testID} label={item.label} testID={item.testID} variant="quiet" tight={dense} tone="bone" accessibilityLabel={item.accessibilityLabel} onPress={extra(item.onPress)} />
          ))}
          {more.length > 0 ? (
            <View ref={moreRef} collapsable={false}>
              <ChromeButton
                label="More"
                testID={MORE_ID}
                variant="quiet"
                tight={dense}
                tone="bone"
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
