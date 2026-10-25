import { useEffect, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut, ReduceMotion } from "react-native-reanimated";

import { TextButton } from "./chrome";
import { dismissToast, toastDuration, useToast } from "./toast";

const enter = FadeInDown.duration(160).reduceMotion(ReduceMotion.System);
const leave = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((next) => {
        if (live) setEnabled(next);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

/**
 * The toast of src/screens/toast.ts, floating over the foot of the screen. `bottom` lifts it over a pinned action bar.
 * Each screen that can show one draws this as its last child.
 */
export function ToastView({ bottom = 12 }: { bottom?: number }) {
  const toast = useToast();
  const screenReader = useScreenReader();

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.text);
    const timer = setTimeout(() => dismissToast(toast.id), toastDuration(toast.tone, screenReader));
    return () => clearTimeout(timer);
  }, [toast, screenReader]);

  if (!toast) return null;
  const undo = toast.undo;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom }}>
      {/* NativeWind does not style a Reanimated view, so the panel is a plain view inside it. */}
      <Animated.View key={toast.id} entering={enter} exiting={leave}>
        <View
          testID="toast"
          accessibilityLiveRegion="polite"
          className={`min-h-14 flex-row items-center rounded-tile border bg-pressed pl-4 ${toast.tone === "danger" ? "border-danger" : "border-goldLine"}`}
        >
          <Text testID="toast-text" className={`flex-1 py-3 text-body ${toast.tone === "danger" ? "text-danger" : "text-bone"}`}>
            {toast.text}
          </Text>
          {undo ? (
            <TextButton
              testID="toast-undo"
              label="Undo"
              tone="gold"
              accessibilityLabel={`Undo: ${toast.text}`}
              onPress={() => {
                undo();
                dismissToast(toast.id);
              }}
            />
          ) : (
            <TextButton testID="toast-close" label="OK" accessibilityLabel="Dismiss" onPress={() => dismissToast(toast.id)} />
          )}
        </View>
      </Animated.View>
    </View>
  );
}
