// The app's one announcer. A screen reader speaks an announcement to its end only if nothing else is announced meanwhile (iOS
// drops one made while another speaks, TalkBack cuts the first off), so `announce` queues what it is given and says the next line
// when the last one is done: at the phone's `announcementFinished` event (iOS), or after a wait sized to the line (Android sends
// no event, and the wait also covers an event that never comes). One module store: the listener exists only while the queue is
// not empty, and the one timer is cancelled with it. The web build speaks at once, as it always has (react-native-web's live region).
// The announcer follows whether a screen reader is on through its own subscription to the accessibility store (started by the first line,
// so it does not depend on a component being mounted), and holds a line made before the phone has said whether one is on.
import { AccessibilityInfo, Platform } from "react-native";

import { accessibility, subscribeAccessibility } from "./accessibility.ts";

// The wait after a line when no event ends it: a base plus the time a default speaking rate takes for each character, capped.
const BASE_MS = 1000;
const PER_CHAR_MS = 70;
const MAX_MS = 12000;
// A queue this long is stale: the oldest lines are dropped, never the newest. A banner's title and its lines are about ten at most, so this
// holds a whole banner and the moment after it.
const MAX_QUEUED = 24;

let queue: string[] = [];
let speaking: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let subscription: { remove: () => void } | null = null;
// Whether a screen reader is on, as the phone last said (null until it has answered), and the lines made before it did.
let known: boolean | null = null;
let held: string[] = [];
let stopStore: (() => void) | null = null;
// What waits for the announcer to fall silent (a focus move that would talk over a line).
let idle: (() => void)[] = [];

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
    runIdle();
    return;
  }
  speak(next);
}

function runIdle(): void {
  const waiting = idle;
  idle = [];
  for (const callback of waiting) callback();
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

function readerOn(): boolean | null {
  return accessibility().screenReader ? true : known;
}

function enqueue(text: string): void {
  if (speaking == null) {
    speak(text);
    return;
  }
  queue = [...queue, text].slice(-MAX_QUEUED);
}

// Starts the announcer's own follow of the screen reader setting, once: the store's changes, and the phone's first answer.
function begin(): void {
  if (stopStore) return;
  stopStore = subscribeAccessibility(() => {
    known = accessibility().screenReader;
  });
  AccessibilityInfo.isScreenReaderEnabled()
    .then((on) => {
      known = accessibility().screenReader || on;
      const waiting = held;
      held = [];
      if (known) for (const text of waiting) enqueue(text);
      else if (!isAnnouncing()) runIdle();
    })
    .catch(() => {
      known = false;
      held = [];
    });
}

/** Announces `text` to a screen reader after the lines already queued. On the phone with no screen reader on it does nothing at all: no listener, no timer. */
export function announce(text: string): void {
  if (text === "") return;
  if (Platform.OS === "web") {
    AccessibilityInfo.announceForAccessibility(text);
    return;
  }
  begin();
  const on = readerOn();
  if (on === null) {
    held = [...held, text].slice(-MAX_QUEUED);
    return;
  }
  if (on) enqueue(text);
}

/** Drops every line not yet said (a screen left, a moment replaced). The line being spoken finishes, and its wait still orders what is announced next. */
export function clearAnnouncements(): void {
  queue = [];
  held = [];
  if (speaking == null) runIdle();
}

/** Whether a line is being said or waits to be: a focus move made now would talk over it. */
export function isAnnouncing(): boolean {
  return speaking != null || queue.length > 0 || held.length > 0;
}

/** Calls `callback` once nothing is being announced (at once when that is already so); returns the way to cancel it. */
export function onIdle(callback: () => void): () => void {
  if (!isAnnouncing()) {
    callback();
    return () => undefined;
  }
  idle = [...idle, callback];
  return () => {
    idle = idle.filter((waiting) => waiting !== callback);
  };
}

/** For tests: forgets what the phone said and everything queued. */
export function resetAnnouncer(): void {
  stopTimer();
  stopListening();
  stopStore?.();
  stopStore = null;
  queue = [];
  held = [];
  idle = [];
  speaking = null;
  known = null;
}
