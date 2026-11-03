import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { AccessibilityInfo, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { layoutAnim, useMotionScale } from "../ui/motion-run";
import { MOTION } from "../ui/motion-tokens";
import { useScreenReader } from "../ui/screen-reader";
import { TextButton } from "./chrome";
import { dismissToast, leaveToastScreen, toastDuration, useToast } from "./toast";
import { Text } from "../ui/text";

/**
 * The toast of src/screens/toast.ts, docked at the foot of the screen's content, above its pinned bar. It takes its own
 * room, so it never covers a row or sits on a row's +. Each screen that can show one draws it once.
 */
export function ToastView() {
  const store = useToast();
  // Screens under the one in front stay mounted; only the focused screen shows, times and announces the toast.
  const focused = useIsFocused();
  const toast = focused ? store : null;
  const screenReader = useScreenReader();
  // The fades are tokens (toastIn, toastOut) at the Animation speed; reduced motion snaps them.
  const scale = useMotionScale();
  const fade = useMemo(() => ({ enter: layoutAnim(FadeInDown, MOTION.toastIn, scale), leave: layoutAnim(FadeOut, MOTION.toastOut, scale) }), [scale]);
  useFocusEffect(useCallback(() => () => leaveToastScreen(), []));

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.text);
    const timer = setTimeout(() => dismissToast(toast.id), toastDuration(toast, screenReader));
    return () => clearTimeout(timer);
  }, [toast, screenReader]);

  if (!toast) return null;
  const undo = toast.undo;
  return (
    <View className="py-2">
      {/* NativeWind does not style a Reanimated view, so the panel is a plain view inside it. */}
      <Animated.View key={toast.id} entering={fade.enter} exiting={fade.leave}>
        <View
          testID="toast"
          accessibilityLiveRegion="polite"
          className="min-h-14 flex-row items-center rounded-container bg-pressed pl-4"
        >
          <Text testID="toast-text" className={`flex-1 py-3 text-body ${toast.tone === "danger" ? "text-danger" : "text-bone"}`}>
            {toast.text}
          </Text>
          {undo ? (
            <TextButton
              testID="toast-undo"
              label="Undo"
              tone="accent"
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
