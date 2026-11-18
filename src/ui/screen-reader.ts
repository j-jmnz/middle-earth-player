// Whether VoiceOver or TalkBack is on. The table then lists the choices of the open moment on paper as well as on the
// canvas (a card drawn only on the canvas is not a control a screen reader can reach), and an armed button waits longer.
// This is the phone's file. react-native-web always answers yes, so the web build uses web/screen-reader.canvaskit.ts
// instead (metro.config.js), which takes the platform's flag from the desktop shell and never from react-native-web.
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";
import { off, subscribeSettings } from "./display-prefs.ts";
import { tableSettings } from "./table-settings.ts";

// Read from the app's one accessibility store (accessibility.ts), not from a listener of its own.
const screenReaderOn = () => accessibility().screenReader;
export function useScreenReader(): boolean {
  return useSyncExternalStore(subscribeAccessibility, screenReaderOn, off);
}

// A development build started with EXPO_PUBLIC_FORCE_READER=1 acts as if a screen reader were on (native only): a script cannot turn VoiceOver or
// TalkBack on, so a scripted run forces the reader table this way. `__DEV__` is false in a release build, so
// the variable does nothing there. Expo inlines the variable at bundle time.
function forced(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ && process.env.EXPO_PUBLIC_FORCE_READER === "1";
}

// The Table as a list setting (table-settings.ts): Always puts the phone on the reader table with no reader on.
const listAlways = () => tableSettings.getState().settings.tableAsList === "always";

/**
 * The gate for everything that exists only for a screen reader on the phone (user instruction, 2026-11-05): the reader table, the
 * announcements of the table's moments, the notes that name what a tap does. True too when Table as a list is Always (a switch or voice
 * player's way in, with no reader on). False on the web (where `useScreenReader` is always true) and, with the setting at its default, with
 * no reader on, so the ordinary app is exactly what it was. What a reader's speech alone needs (a toast's or an armed button's wait, the
 * spotlight's mute) reads `useScreenReader`.
 */
export function useReaderMode(): boolean {
  const reader = useScreenReader();
  const always = useSyncExternalStore(subscribeSettings, listAlways, off);
  return Platform.OS !== "web" && (reader || always || forced());
}
