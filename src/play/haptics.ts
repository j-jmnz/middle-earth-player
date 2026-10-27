// The table's haptic ticks (user request, 2026-10-25): a light tick when a dock button arms, a firmer one when an intent is
// sent or taken back, a warning when the reducer refuses one. They add to what the screen shows and never replace it. On
// Android they are the system's haptic constants (performAndroidHapticsAsync), which follow the phone's touch-feedback
// setting and need no vibrator; the other calls would buzz the vibrator. A phone without haptics, or the web, ignores them:
// a failed tick is not an error the player should see.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const android = Platform.OS === "android";

function quietly(tick: () => Promise<void>): void {
  try {
    tick().catch(() => undefined);
  } catch {
    // A platform without the module.
  }
}

/** A dock button armed: its second tap will send. */
export function tickArmed(): void {
  quietly(() => (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick) : Haptics.selectionAsync()));
}

/** The reducer accepted an intent, or Undo went back one. */
export function tickSent(): void {
  quietly(() => (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)));
}

/** The reducer refused an intent: the reason is on the dock. */
export function tickRefused(): void {
  quietly(() => (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)));
}

/** A card played from the hand landed on the table (the squash of its motion): a light tick, at most one per new state. */
export function tickLand(): void {
  quietly(() => (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)));
}

/** The strike of the combat spotlight met its target: a medium impact at the hit stop, at most one per strike. */
export function tickImpact(): void {
  quietly(() => (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)));
}
