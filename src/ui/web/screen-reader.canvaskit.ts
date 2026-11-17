// The screen-reader gate on the web and the desktop (screen-reader.ts is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only).
// react-native-web answers yes to every screen-reader question, so the web's accessibility store (accessibility.canvaskit.ts) holds the flag off until the desktop shell
// says the platform has one on: a browser cannot tell. The web draws the canvas, and the list is the Table as a list setting, so `useReaderMode` has no web exception.
import { useSyncExternalStore } from "react";

import { off, subscribeSettings } from "../display-prefs.ts";
import { tableSettings } from "../table-settings.ts";
import { accessibility, subscribeAccessibility } from "./accessibility.canvaskit.ts";

const screenReaderOn = () => accessibility().screenReader;
export function useScreenReader(): boolean {
  return useSyncExternalStore(subscribeAccessibility, screenReaderOn, off);
}

// A development build started with EXPO_PUBLIC_FORCE_READER=1 acts as if a screen reader were on (the phone's Maestro flow uses it; a dev web build can too).
function forced(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ && process.env.EXPO_PUBLIC_FORCE_READER === "1";
}

const listAlways = () => tableSettings.getState().settings.tableAsList === "always";

/** True with a screen reader on (the desktop shell's flag), with Table as a list on Always, or when a development build forces the reader table. */
export function useReaderMode(): boolean {
  const reader = useScreenReader();
  const always = useSyncExternalStore(subscribeSettings, listAlways, off);
  return reader || always || forced();
}
