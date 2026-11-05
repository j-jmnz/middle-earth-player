// Whether VoiceOver or TalkBack is on. The table then lists the choices of the open moment on paper as well as on the
// canvas (a card drawn only on the canvas is not a control a screen reader can reach), and an armed button waits longer.
// react-native-web always answers yes, so the web build, whose table is already a list of names, lists every choice on
// paper.
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";

// Read from the app's one accessibility store (accessibility.ts), not from a listener of its own.
const screenReaderOn = () => accessibility().screenReader;
const off = () => false;

export function useScreenReader(): boolean {
  return useSyncExternalStore(subscribeAccessibility, screenReaderOn, off);
}

// A development build started with EXPO_PUBLIC_FORCE_READER=1 acts as if a screen reader were on (native only): Maestro cannot turn VoiceOver or
// TalkBack on, so its reader flow (.maestro/features/screen-reader.yaml) forces the reader table this way. `__DEV__` is false in a release build, so
// the variable does nothing there. Expo inlines the variable at bundle time.
function forced(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ && process.env.EXPO_PUBLIC_FORCE_READER === "1";
}

/**
 * The gate for everything that exists only for a screen reader on the phone (user instruction, 2026-11-05): the reader table, the
 * announcements of the table's moments, the notes that name what a tap does. False on the web (where `useScreenReader` is always
 * true) and with no reader on, so the ordinary app is exactly what it was.
 */
export function useReaderMode(): boolean {
  const reader = useScreenReader();
  return Platform.OS !== "web" && (reader || forced());
}
