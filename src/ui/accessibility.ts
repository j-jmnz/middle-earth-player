// The phone's accessibility settings the table follows, kept once for the whole app: Reduce motion, whether a screen reader (VoiceOver,
// TalkBack) is on, Bold Text, Reduce Transparency and Increase Contrast. The hooks that read them (useReduceMotion and useMotionScale in src/ui/motion-run.ts, useScreenReader in screen-reader.ts) share
// this store through useSyncExternalStore, so the AccessibilityInfo listeners exist once while any component reads them, not once for
// each hook call (about twenty on an open table). The first subscriber starts the listeners and reads the current values; the last one
// leaving removes them.
import { AccessibilityInfo, Platform } from "react-native";

export type Accessibility = {
  // The phone's Reduce motion, or null until the phone has answered (the hook then uses Reanimated's reading of it).
  reduceMotion: boolean | null;
  screenReader: boolean;
  // iOS Bold Text: the body face is drawn one weight heavier (faces.ts). Always false elsewhere.
  boldText: boolean;
  // iOS Reduce Transparency: what the table draws translucent is drawn opaque (surfaces.ts, opaqueFill). Always false elsewhere.
  reduceTransparency: boolean;
  // iOS Increase Contrast (darker system colors) or Android High contrast text: Strong outlines follows it (display-prefs.ts). False on the web.
  increaseContrast: boolean;
};

const FIELDS = ["reduceMotion", "screenReader", "boldText", "reduceTransparency", "increaseContrast"] as const;

let state: Accessibility = { reduceMotion: null, screenReader: false, boldText: false, reduceTransparency: false, increaseContrast: false };
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function set(change: Partial<Accessibility>): void {
  const next = { ...state, ...change };
  // A value that did not change keeps the same state, so a reader is not told twice.
  if (FIELDS.every((field) => next[field] === state[field])) return;
  state = next;
  for (const listener of [...listeners]) listener();
}

// The settings that exist on one platform only: each has its query method and its event. A method the platform lacks (react-native-web, or the other
// phone platform) reads as off, and an event it lacks is a no-op in React Native.
type Method = "isBoldTextEnabled" | "isReduceTransparencyEnabled" | "isDarkerSystemColorsEnabled" | "isHighTextContrastEnabled";
function ask(method: Method): Promise<boolean> {
  const query = (AccessibilityInfo as Partial<Record<Method, () => Promise<boolean>>>)[method];
  if (typeof query !== "function") return Promise.resolve(false);
  try {
    return query.call(AccessibilityInfo).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

const PHONE: readonly { field: "boldText" | "reduceTransparency" | "increaseContrast"; event: "boldTextChanged" | "reduceTransparencyChanged" | "darkerSystemColorsChanged" | "highTextContrastChanged" }[] = [
  { field: "boldText", event: "boldTextChanged" },
  { field: "reduceTransparency", event: "reduceTransparencyChanged" },
  { field: "increaseContrast", event: "darkerSystemColorsChanged" },
  { field: "increaseContrast", event: "highTextContrastChanged" },
];

function listen(event: (typeof PHONE)[number]["event"], handler: (enabled: boolean) => void): { remove: () => void } {
  try {
    return AccessibilityInfo.addEventListener(event, handler);
  } catch {
    return { remove: () => undefined };
  }
}

// Reads the current values and follows them live; returns the way to stop.
function start(): () => void {
  let live = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      if (live) set({ reduceMotion: enabled });
    })
    .catch(() => undefined);
  // react-native-web answers yes whatever is running, and a browser cannot tell a screen reader: on the web the flag stays off (the web table is
  // drawn, and Table as a list is the way to the list). The desktop shell will set it from the platform's own flag.
  if (Platform.OS !== "web") {
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (live) set({ screenReader: enabled });
      })
      .catch(() => undefined);
  }
  ask("isBoldTextEnabled").then((enabled) => {
    if (live) set({ boldText: enabled });
  });
  ask("isReduceTransparencyEnabled").then((enabled) => {
    if (live) set({ reduceTransparency: enabled });
  });
  // Increase Contrast has an iOS and an Android source: only one can be on. Both answers make one value, set whatever it is, so a stale true
  // from an earlier start does not survive a restart.
  Promise.all([ask("isDarkerSystemColorsEnabled"), ask("isHighTextContrastEnabled")]).then(([darker, highText]) => {
    if (live) set({ increaseContrast: darker || highText });
  });
  const subscriptions = [
    AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => set({ reduceMotion: enabled })),
    ...(Platform.OS !== "web" ? [AccessibilityInfo.addEventListener("screenReaderChanged", (enabled) => set({ screenReader: enabled }))] : []),
    ...PHONE.map(({ field, event }) => listen(event, (enabled) => set({ [field]: enabled }))),
  ];
  return () => {
    live = false;
    for (const subscription of subscriptions) subscription.remove();
  };
}

/** For useSyncExternalStore: calls `listener` when any setting changes, and returns the way to stop. */
export function subscribeAccessibility(listener: () => void): () => void {
  listeners.add(listener);
  if (!stop) stop = start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stop) {
      stop();
      stop = null;
    }
  };
}

/** The settings as last heard of; the same object until one changes. */
export function accessibility(): Accessibility {
  return state;
}
