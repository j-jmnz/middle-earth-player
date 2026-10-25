// The buttons that answer the open moment, in the dock on night or at the foot of a paper panel (docs/design-system.md,
// Table, Two taps). One filled pill always sits in the same place: the confirm of what is picked, or Pass when nothing is.
// A button that sends an intent with nothing picked arms on its first tap: the line above the buttons says what the second
// tap does and a bar runs down under it; the second tap sends, and the bar running out, another button, or a new pick puts
// it back. Arming changes no button's size, so the second tap lands where the first did. The parent keys this component on
// the moment and the pick, so nothing stays armed into the next one.
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useScreenReader } from "./screen-reader.ts";
import { ChromeButton, ChromePrimary } from "./sheet-paper.tsx";
import { primaryReady, type Dock, type DockButton } from "./table-choice.ts";
import { tableTokens as t } from "./tokens.ts";

// How long an armed button waits for its second tap; longer while a screen reader is on.
const ARM_MS = 3000;
const ARM_READER_MS = 10000;
const HINT = "Tap twice to confirm";

export type DockExtra = { label: string; testID: string; onPress: () => void };

export function DockButtons({ dock, extras = [], surface, onButton }: { dock: Dock; extras?: readonly DockExtra[]; surface: "night" | "paper"; onButton: (button: DockButton) => void }) {
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
  const bar = useAnimatedStyle(() => ({ width: `${Math.round(left.get() * 100)}%` }));
  const paper = surface === "paper";
  const primary = dock.primary;
  const armedButton = [primary, ...dock.secondary].find((button) => button?.testID === armed) ?? null;
  const line = armedButton ? (armedButton.armed ?? `Tap again: ${armedButton.label}`) : dock.why;
  return (
    <View className="gap-1">
      {/* One line above the buttons, always there: what the armed button's second tap does, or what the primary waits for. */}
      <View style={{ minHeight: 20, justifyContent: "flex-end" }}>
        {line ? (
          <Text testID={armedButton ? `${armedButton.testID}-armed` : "sheet-why"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} className={`text-center text-label ${armedButton ? (paper ? "text-inkLabel" : "text-gold") : paper ? "text-inkMuted" : "text-muted"}`}>
            {line}
          </Text>
        ) : null}
        {armedButton ? <Animated.View style={[{ height: 2, alignSelf: "center", backgroundColor: paper ? t.inkLabel : t.gold, marginTop: 1 }, bar]} /> : null}
      </View>
      {primary ? (
        <ChromePrimary
          label={primary.label}
          testID={primary.testID}
          surface={surface}
          compact
          disabled={!primaryReady(dock)}
          accessibilityHint={primary.arm ? HINT : undefined}
          onPress={() => press(primary)}
        />
      ) : null}
      <View className="flex-row flex-wrap items-center justify-center">
        {dock.secondary.map((button) => (
          <ChromeButton key={button.testID} label={button.label} testID={button.testID} tone={paper ? "ink" : armed === button.testID ? "gold" : "bone"} accessibilityHint={button.arm ? HINT : undefined} onPress={() => press(button)} />
        ))}
        {extras.map((item) => (
          <ChromeButton key={item.testID} label={item.label} testID={item.testID} tone={paper ? "ink" : "muted"} onPress={extra(item.onPress)} />
        ))}
      </View>
    </View>
  );
}
