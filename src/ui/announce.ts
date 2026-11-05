// The app's one announcer. A screen reader speaks an announcement to its end only if nothing else is announced meanwhile (iOS
// drops one made while another speaks, TalkBack cuts the first off), so `announce` queues what it is given and says the next line
// when the last one is done: at the phone's `announcementFinished` event (iOS), or after a wait sized to the line (Android sends
// no event, and the wait also covers an event that never comes). One module store: the listener exists only while the queue is
// not empty, and the one timer is cancelled with it. The web build speaks at once, as it always has (react-native-web's live region).
import { AccessibilityInfo, Platform } from "react-native";

import { accessibility } from "./accessibility.ts";

// The wait after a line when no event ends it: a base plus the time a default speaking rate takes for each character, capped.
const BASE_MS = 1000;
const PER_CHAR_MS = 70;
const MAX_MS = 12000;
// A queue this long is stale: the oldest lines are dropped, never the newest.
const MAX_QUEUED = 12;

let queue: string[] = [];
let speaking: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let subscription: { remove: () => void } | null = null;

/** How long a line is given before the next one is said, when the phone does not say it has finished. */
export function waitFor(text: string): number {
  return Math.min(MAX_MS, BASE_MS + text.length * PER_CHAR_MS);
}

function stopTimer(): void {
  if (timer != null) clearTimeout(timer);
  timer = null;
}

function stopListening(): void {
  subscription?.remove();
  subscription = null;
}

// Says the next line, or ends the session of the store when none is left.
function advance(): void {
  stopTimer();
  speaking = null;
  const next = queue.shift();
  if (next === undefined) {
    stopListening();
    return;
  }
  speak(next);
}

function speak(text: string): void {
  speaking = text;
  subscription ??= AccessibilityInfo.addEventListener("announcementFinished", (event) => {
    // A line the queue did not make (or an old one) is not the end of this one.
    if (speaking != null && (event.announcement == null || event.announcement === speaking)) advance();
  });
  AccessibilityInfo.announceForAccessibility(text);
  timer = setTimeout(advance, waitFor(text));
}

/** Announces `text` to a screen reader after the lines already queued. On the phone with no screen reader on it does nothing at all: no listener, no timer. */
export function announce(text: string): void {
  if (text === "") return;
  if (Platform.OS === "web") {
    AccessibilityInfo.announceForAccessibility(text);
    return;
  }
  if (!accessibility().screenReader) return;
  if (speaking == null) {
    speak(text);
    return;
  }
  queue = [...queue, text].slice(-MAX_QUEUED);
}

/** Drops every line not yet said (a screen left, a moment replaced). The line being spoken finishes, and its wait still orders what is announced next. */
export function clearAnnouncements(): void {
  queue = [];
}
