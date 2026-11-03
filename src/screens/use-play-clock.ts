// Drives a PlayClock from the table screen: resumed on mount and when the app returns to the foreground, paused on unmount (a hidden
// Activity tears its effects down and runs them again on show) and when the app goes to the background or becomes inactive.
import { useEffect } from "react";
import { AppState } from "react-native";

import type { PlayClock } from "./play-clock";

export function usePlayClock(clock: PlayClock): void {
  useEffect(() => {
    clock.resume();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") clock.resume();
      else clock.pause();
    });
    return () => {
      subscription.remove();
      clock.pause();
    };
  }, [clock]);
}
