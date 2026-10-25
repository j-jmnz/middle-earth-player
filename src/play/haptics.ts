// The table's haptic ticks (user request, 2026-10-25): a light tick when a dock button arms, a firmer one when an intent is
// sent or taken back, a warning when the reducer refuses one. They add to what the screen shows and never replace it. A
// phone without haptics, or the web, ignores them: a failed tick is not an error the player should see.
import * as Haptics from "expo-haptics";

function quietly(tick: Promise<void>): void {
  tick.catch(() => undefined);
}

/** A dock button armed: its second tap will send. */
export function tickArmed(): void {
  quietly(Haptics.selectionAsync());
}

/** The reducer accepted an intent, or Undo went back one. */
export function tickSent(): void {
  quietly(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** The reducer refused an intent: the reason is on the dock. */
export function tickRefused(): void {
  quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
