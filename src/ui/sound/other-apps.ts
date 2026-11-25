// The Stop other audio setting at work (docs/design-system-table.md, Sound; user decision, 2026-11-25): on a phone the app stops the
// audio of other apps as it opens, each time it comes back to the front and as the setting is turned on. The root layout starts it
// once the stored settings are read, so a player who turned the setting off keeps their own music.
import { AppState } from "react-native";

import { tableSettings } from "../table-settings.ts";
import { claimAudio } from "./session.ts";

/** Starts the rule and returns its stop. Safe to start again: it holds only its two listeners. */
export function watchOtherAudio(): () => void {
  claimAudio();
  const settings = tableSettings.subscribe((state, before) => {
    if (state.settings.stopOtherAudio !== before.settings.stopOtherAudio) claimAudio();
  });
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") claimAudio();
  });
  return () => {
    settings();
    appState.remove();
  };
}
