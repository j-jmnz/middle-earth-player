// Whether VoiceOver or TalkBack is on. The table then lists the choices of the open moment on paper as well as on the
// canvas (a card drawn only on the canvas is not a control a screen reader can reach), and an armed button waits longer.
// react-native-web always answers yes, so the web build, whose table is already a list of names, lists every choice on
// paper.
import { useSyncExternalStore } from "react";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";

// Read from the app's one accessibility store (accessibility.ts), not from a listener of its own.
const screenReaderOn = () => accessibility().screenReader;
const off = () => false;

export function useScreenReader(): boolean {
  return useSyncExternalStore(subscribeAccessibility, screenReaderOn, off);
}
