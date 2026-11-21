// The buttons that answer the open moment, in the dock (docs/design-system.md,
// Table, Two taps). One filled capsule always sits in the same place: the confirm of what is picked, or Pass when nothing is.
// A button that sends an intent with nothing picked arms on its first tap: the line above the buttons says what the second
// tap does and a bar runs down under it; the second tap sends, and the bar running out, another button, or a new pick puts
// it back. Arming changes no button's size, so the second tap lands where the first did. The parent keys this component on
// the moment and the pick, so nothing stays armed into the next one.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { useWindowDimensions, View } from "react-native";
import { useStore } from "zustand";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { armedRoom, armedSaid, armMs, BAR_DENSE_PX, BAR_PX, dockArmedLines, LINE_PX, ONLY } from "./armed-room.ts";
import { MORE_ID } from "./extras.ts";
import { pausedFor } from "./phase-pause.ts";
import { RING_OFFSET, RING_WIDTH } from "../../../ui/focus-ring-style.ts";
import { tickArmed } from "../../../ui/haptics.ts";
import { playSound } from "../../../ui/sound/sound.ts";
import { armBarEasing, useMotionScale } from "../../../ui/motion-run.ts";
import { useScreenReader } from "../../../ui/screen-reader.ts";
import { tableSettings } from "../../../ui/table-settings.ts";
import { PrimaryButton, SecondaryButton, TextButton } from "../../../ui/buttons.tsx";
import { primaryReady, type Dock, type DockButton } from "../table-choice.ts";
import { useUiScale } from "../../../ui/ui-scale.ts";
import { useTableTokens } from "../../../ui/use-table-tokens.ts";
import { Text } from "../../../ui/text.tsx";
import { announce } from "../../../ui/announce.ts";

// How long an armed button waits for its second tap is the Confirm time setting (armed-room.ts, armMs): Standard is longer while a screen
// reader speaks, and No limit waits for another button, a new pick or a new moment, the bar drawn full and still. That is a timer, not a
// motion token: the bar only shows it running out, on the linear curve of src/ui/motion-tokens.ts, and does not run under reduced motion
// (the line says it). Quick does not shorten it: the second tap's window stays the same.
const HINT = "Tap twice to confirm";
// A moment with one legal answer: the line above the buttons says the one tap sends it (ONLY, armed-room.ts).
const ONLY_HINT = "Sends at once";

// The More pill (`dock-more-actions`) folds the quiet pills behind a popover; it is not the "i" pill (`dock-more`) that opens the
// dock's folded note lines (table-dock.tsx).
export type DockExtra = { label: string; testID: string; onPress: () => void; accessibilityLabel?: string; accessibilityHint?: string };

export function DockButtons({
  dock,
  extras = [],
  more = [],
  aidsFolded = false,
  onMore,
  picked = null,
  dense = false,
  chars,
  onButton,
}: {
  dock: Dock;
  extras?: readonly DockExtra[];
  // The quiet pills folded behind the More pill (dock/extras.ts, dockPills), and what the pill does: it reports the screen y of its foot.
  more?: readonly DockExtra[];
  // The reading aids are all behind More because the room is short at a larger text size (dock/extras.ts, foldAids): the More pill then
  // sits on the answers' row and the aids' row is not drawn.
  aidsFolded?: boolean;
  onMore?: (foot: number) => void;
  // What is picked, in words: no line on the dock says it (the cards wear their marks, the primary's verb counts them), so a
  // screen reader hears it in the primary's hint.
  picked?: string | null;
  // A short phone (under 400 pt tall): tighter rows, the armed line without its lead-in when that saves a line (dock/budget.ts).
  dense?: boolean;
  // The characters a label line holds at the dock's measured width (dock/budget.ts, labelChars); the estimate when not measured.
  chars?: number;
  onButton: (button: DockButton) => void;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const text = useWindowDimensions().fontScale;
  const moreRef = useRef<ComponentRef<typeof View>>(null);
  const [armed, setArmed] = useState<string | null>(null);
  // A keyboard holds focus on the primary: on a dense dock its ring (the width and its offset) would lie over the armed bar, so the bar moves up.
  const [primaryFocus, setPrimaryFocus] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When this moment came onto the dock (the parent keys this component on it), for the phase pause (phase-pause.ts).
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);
  const left = useSharedValue(1);
  const animates = useMotionScale() > 0;
  // The wait follows the real reader (it speaks the line), not the Table as a list setting.
  const reader = useScreenReader();
  const confirmTime = useStore(tableSettings, (state) => state.settings.confirmTime);
  // The arm timer and the bar running down stop with the dock.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(left);
    },
    [left],
  );
  const press = (button: DockButton) => {
    if (pausedFor(button, shownAt.current, Date.now())) return;
    if (timer.current) clearTimeout(timer.current);
    if (button.arm && armed !== button.testID) {
      setArmed(button.testID);
      const wait = armMs(confirmTime, reader);
      left.set(1);
      if (wait != null) {
        if (animates) left.set(withTiming(0, { duration: wait, easing: armBarEasing }));
        timer.current = setTimeout(() => setArmed(null), wait);
      }
      tickArmed();
      playSound("ui.select");
      // A screen reader hears what the second tap does, the loss a caution names included.
      announce(button.armed ?? `Tap again: ${button.label}`);
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
  const line = armedButton ? armedSaid(armedButton, dense, chars) : (dock.why ?? (dock.single ? ONLY : null));
  // An armed answer that reaches past one window says so in gold, its line and its bar alike.
  const armedGold = armedButton?.reach != null;
  const armedColor = armedGold ? t.phase : t.accent;
  // The room holds the longest thing this moment's buttons can say when armed, in full, so arming moves nothing (armed-room.ts).
  const lines = dockArmedLines(dock, dense, chars);
  const inline = aidsFolded && more.length > 0;
  const moreButton =
    more.length > 0 ? (
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
    ) : null;
  return (
    <View className={dense ? "gap-0" : "gap-0.5"}>
      {/* The armed line, always held: what the armed button's second tap does (a caution names the loss in full), or what the
          primary waits for; the bar that runs down has its own 4 pt under the text (the bar at the top of it, 2 pt clear above the primary). Arming moves nothing. */}
      <View style={{ height: armedRoom(lines, dense, s, text) }}>
        {/* A fixed slot: the armed line keeps the lines this moment's longest caution takes (numberOfLines {lines}), each as tall as the phone's text size makes it. */}
        <View style={{ height: lines * LINE_PX * s * text, justifyContent: "flex-end" }}>
          {line ? (
            <Text testID={armedButton ? `${armedButton.testID}-armed` : dock.why ? "sheet-why" : "dock-only"} numberOfLines={lines} accessibilityLabel={armedButton ? (armedButton.armed ?? `Tap again: ${armedButton.label}`) : undefined} className={`text-center text-label ${armedButton ? "text-accent" : "text-muted"}`} style={armedGold ? { color: armedColor } : undefined}>
              {line}
            </Text>
          ) : null}
        </View>
        {armedButton ? (
          <View pointerEvents="none" style={{ height: (dense ? BAR_DENSE_PX : BAR_PX) * s, justifyContent: "flex-start", alignItems: "center", transform: [{ translateY: dense && primaryFocus ? -(RING_WIDTH + RING_OFFSET) * s : 0 }] }}>
            <Animated.View style={[{ height: 2 * s, backgroundColor: armedColor }, bar]} />
          </View>
        ) : null}
      </View>
      {primary ? (
        <PrimaryButton
          label={primary.label}
          testID={primary.testID}
          dock
          tone={primary.reach ? "phase" : "accent"}
          compact={dense}
          disabled={!primaryReady(dock)}
          accessibilityHint={primaryHint}
          onFocusChange={setPrimaryFocus}
          onPress={() => press(primary)}
        />
      ) : null}
      {/* The other answers are secondary capsules on a row of their own; the reading aids are text buttons with small muted words on
          one row under it (Undo, Read), which wraps if a third shows; folded behind More (`aidsFolded`) they leave that row and More joins this one. */}
      {dock.secondary.length > 0 || inline ? (
        <View className="flex-row flex-wrap items-center justify-center gap-2" style={{ marginTop: (dense ? 4 : 6) * s }}>
          {dock.secondary.map((button) => (
            <SecondaryButton key={button.testID} label={button.label} testID={button.testID} tone={button.reach ? "phase" : "accent"} tight={dense} accessibilityHint={button.arm ? HINT : undefined} onPress={() => press(button)} />
          ))}
          {inline ? moreButton : null}
        </View>
      ) : null}
      {!inline && (extras.length > 0 || more.length > 0) ? (
        <View className="flex-row flex-wrap items-center justify-center gap-1" style={{ marginTop: (dense ? 2 : 4) * s }}>
          {extras.map((item) => (
            <TextButton key={item.testID} label={item.label} testID={item.testID} small tight={dense} tone="muted" accessibilityLabel={item.accessibilityLabel} accessibilityHint={item.accessibilityHint} onPress={extra(item.onPress)} />
          ))}
          {moreButton}
        </View>
      ) : null}
    </View>
  );
}
